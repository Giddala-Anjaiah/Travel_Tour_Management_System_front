import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import PDFDocument from 'pdfkit';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import {
  recordCustomerActivity,
  getPackageRecommendations,
  getHotelRecommendations,
  ActivityValidationError
} from './recommendationService.js';
import Stripe from 'stripe';
import QRCode from 'qrcode';

dotenv.config();

let stripeInstance = null;
function getStripe() {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key || key.startsWith('sk_test_your') || key.trim() === '') {
      throw new Error('STRIPE_SECRET_KEY is not configured. Set it in backend/.env and restart the server.');
    }
    stripeInstance = new Stripe(key, { apiVersion: '2024-12-18.acacia' });
  }
  return stripeInstance;
}

const app = express();
const PORT = process.env.PORT || 5000;

function normalizeCorsOrigin(origin) {
  if (!origin) return undefined;
  try {
    const url = new URL(origin);
    if (url.protocol === 'https:' || url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      return origin;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

const jwtSecret = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.JWT_SECRET) {
  console.warn('JWT_SECRET not set â€” using ephemeral fallback. Set this in production environment.');
}

app.use(cors({
  origin: (origin, callback) => {
    const allowed = normalizeCorsOrigin(origin);
    callback(null, allowed);
  },
  credentials: true,
}));
app.set('trust proxy', 1);

// --- Stripe webhook (must be BEFORE express.json() to capture raw body) ---
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  if (!sig) {
    return res.status(400).json({ message: 'Missing stripe-signature header' });
  }
  let event;
  try {
    event = getStripe().webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET || '');
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ message: 'Invalid signature' });
  }

  try {
    await handleStripeEvent(event);
  } catch (err) {
    console.error('Error handling stripe event:', err.message);
    return res.status(500).json({ message: 'Webhook handler failed' });
  }

  res.json({ received: true });
});

app.use(express.json());

// --- Profile image storage (local filesystem) ---
const AVATAR_DIR = path.join(process.cwd(), 'uploads', 'avatars');
fs.mkdirSync(AVATAR_DIR, { recursive: true });

const avatarStorage = multer.diskStorage({
  destination: AVATAR_DIR,
  filename: (_req, file, cb) => {
    const safeName = String(file.originalname).replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const unique = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}-${safeName}`;
    cb(null, unique);
  },
});

const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = allowed.test(file.mimetype);
    if (extOk && mimeOk) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, JPG, PNG and WEBP images are allowed'));
    }
  },
}).single('avatar');

// Serve uploaded avatars statically so the frontend can reference them by URL.
app.use('/api/uploads/avatars', express.static(AVATAR_DIR));

app.use(passport.initialize());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

// User Schema
const userSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  phone: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['admin', 'customer', 'tour_operator', 'hotel_partner'],
    default: 'customer'
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  // Contact details that can be edited from the profile screen.
  alternatePhone: String,
  address: String,
  avatar: String,
  // Timestamp of the last password change, used to invalidate older sessions.
  passwordChangedAt: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date
  }
});

userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ createdAt: 1 });

const User = mongoose.model('User', userSchema);

// Session Schema — one record per signed-in device, so a user can review and
// revoke the sessions that are active on their account.
const sessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // JWT id, so a presented token maps back to exactly one session.
  tokenId: {
    type: String,
    required: true,
    unique: true
  },
  userAgent: String,
  ip: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastSeenAt: {
    type: Date,
    default: Date.now
  },
  // Snapshot of the account's passwordChangedAt when the session was created.
  // A later password change moves the account marker forward, which makes every
  // session with an older snapshot stale.
  passwordChangedAt: Date,
  expiresAt: {
    type: Date,
    required: true
  },
  revokedAt: Date
});

sessionSchema.index({ userId: 1, revokedAt: 1, lastSeenAt: -1 });
sessionSchema.index({ expiresAt: 1 });

const Session = mongoose.model('Session', sessionSchema);

// Destination/Package Schema
const packageSchema = new mongoose.Schema({
  operatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  destination: {
    type: String,
    required: true
  },
  duration: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  bookings: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  description: String,
  inclusions: [String],
  image: String,
  images: [String],
  category: String,
  shortDescription: String,
  highlights: [String],
  exclusions: [String],
  terms: String,
  cancellationPolicy: {
    enabled: {
      type: Boolean,
      default: false
    },
    rules: [{
      minDaysBeforeTrip: {
        type: Number,
        min: 0
      },
      refundPercentage: {
        type: Number,
        min: 0,
        max: 100
      }
    }]
  },
  pickupInfo: String,
  startingLocation: String,
  transportType: String,
  minTravelers: {
    type: Number,
    default: 1
  },
  maxTravelers: {
    type: Number,
    default: 20
  },
  publishedStatus: {
    type: String,
    enum: ['draft', 'published', 'unpublished'],
    default: 'draft'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

packageSchema.index({ status: 1, publishedStatus: 1 });
packageSchema.index({ operatorId: 1, status: 1 });
packageSchema.index({ destination: 1, status: 1 });
packageSchema.index({ bookings: -1, price: -1 });
packageSchema.index({ category: 1, status: 1 });
packageSchema.index({ createdAt: 1 });

const Package = mongoose.model('Package', packageSchema);

// Itinerary Schema
const itinerarySchema = new mongoose.Schema({
  operatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  packageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Package',
    required: true
  },
  packageName: String,
  days: {
    type: Number,
    required: true
  },
  hotels: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  dayDetails: [{
    dayNumber: Number,
    title: String,
    date: Date,
    description: String,
    location: String,
    // Activities are kept as mixed values so an activity that was stored as a
    // plain string (older itineraries) is still readable. The setter turns
    // anything that comes in as text into the full activity object.
    activities: {
      type: [mongoose.Schema.Types.Mixed],
      set: value => normalizeActivities(value)
    },
    meals: [String],
    accommodation: {
      type: {
        name: String,
        hotelName: String,
        checkInTime: String,
        checkOutTime: String,
        roomType: String,
        location: String,
        notes: String
      },
      set: value => (typeof value === 'string' ? { name: value } : value)
    },
    transportation: {
      type: {
        mode: String,
        vehicle: String,
        departureTime: String,
        arrivalTime: String,
        departureLocation: String,
        arrivalLocation: String,
        details: String
      },
      set: value => (typeof value === 'string' ? { mode: value } : value)
    },
    hotel: {
      type: {
        name: String,
        checkIn: String,
        checkOut: String,
        address: String
      },
      set: value => (typeof value === 'string' ? { name: value } : value)
    },
    transport: [{
      time: String,
      mode: String,
      from: String,
      to: String,
      details: String
    }],
    images: [String],
    notes: String
  }],

  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const Itinerary = mongoose.model('Itinerary', itinerarySchema);

// Hotel Schema
const hotelSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  location: {
    type: String,
    required: true
  },
  rooms: {
    type: Number,
    required: true
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  partner: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  createdAt: {
    type: Date,
    default: Date.now
   }
});

hotelSchema.index({ status: 1, location: 1 });
hotelSchema.index({ status: 1, rating: -1 });
hotelSchema.index({ partner: 1 });

const Hotel = mongoose.model('Hotel', hotelSchema);

// Room Schema
const roomSchema = new mongoose.Schema({
  hotel: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true
  },
  total: {
    type: Number,
    required: true
  },
  available: {
    type: Number,
    required: true
  },
  booked: {
    type: Number,
    default: 0
  },
  price: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

roomSchema.index({ hotel: 1, price: 1 });
roomSchema.index({ hotel: 1, roomType: 1 });

const Room = mongoose.model('Room', roomSchema);

// Booking Schema
const bookingSchema = new mongoose.Schema({
  operatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  packageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Package'
  },
  hotelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel'
  },
  customer: {
    type: String
  },
  email: {
    type: String
  },
  phone: String,
  package: {
    type: String
  },
  dates: {
    type: String
  },
  travelers: {
    type: Number,
    default: 1
  },
  amount: {
    type: Number,
    required: true
  },
  paidAmount: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['confirmed', 'pending', 'cancelled', 'completed', 'rejected'],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['paid', 'pending', 'partial', 'refunded', 'failed'],
    default: 'pending'
  },
  bookingDate: {
    type: Date,
    default: Date.now
  },
  bookingId: {
    type: String,
    unique: true
  },
  timeline: [{
    status: String,
    date: Date,
    note: String
  }],
  hotelName: String,
  guestName: String,
  guestEmail: String,
  guestPhone: String,
  roomType: String,
  rooms: Number,
  guests: Number,
  checkInDate: Date,
  checkOutDate: Date,
  notes: String,
  cancellationPolicySnapshot: {
    enabled: Boolean,
    rules: [{
      minDaysBeforeTrip: Number,
      refundPercentage: Number
    }]
  },
  cancellation: {
    cancelledAt: Date,
    cancelledBy: String,
    reason: String,
    daysBeforeTrip: Number,
    refundPercentage: Number,
    refundAmount: Number,
    cancellationFee: Number
  },
  refund: {
    amount: Number,
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'not_applicable'],
      default: 'pending'
    },
    processedAt: Date,
    transactionId: String
  },
  coupon: {
    code: String,
    couponId: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon' },
    discountType: String,
    discountValue: Number,
    discountAmount: Number
  },
  paymentMethod: {
    type: String,
    enum: ['stripe', 'upi', 'manual', 'qr', 'cash'],
    default: 'stripe'
  },
  manualTransactionId: String,
  manualPaymentNotes: String,
  manualPaymentDate: Date,
  manualPaymentMethod: String,
  paymentReference: String,
  paymentState: {
    type: String,
    enum: ['CREATED', 'PENDING', 'SUCCEEDED', 'FAILED', 'EXPIRED', 'CANCELLED', 'PARTIAL']
  },
  paymentProvider: {
    type: String,
    enum: ['stripe', 'upi', 'manual']
  },
  paymentCreatedAt: Date,
  paymentConfirmedAt: Date,
  idempotencyKey: String,
  originalAmount: Number,
   discountAmount: Number,
   finalAmount: Number,
  membershipId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MembershipSubscription'
  },
  membershipDiscountPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  membershipDiscountAmount: {
    type: Number,
    default: 0,
    min: 0
  }
});

bookingSchema.index({ customerId: 1, bookingDate: -1 });
bookingSchema.index({ paymentStatus: 1, bookingDate: -1 });
bookingSchema.index({ status: 1, bookingDate: -1 });
bookingSchema.index({ packageId: 1, status: 1 });
bookingSchema.index({ bookingDate: 1 });
bookingSchema.index({ operatorId: 1, status: 1 });
bookingSchema.index({ hotelId: 1, checkInDate: 1 });
bookingSchema.index({ hotelName: 1, paymentStatus: 1 });
bookingSchema.index({ hotelName: 1, bookingDate: -1 });
bookingSchema.index({ operatorId: 1, paymentStatus: 1, bookingDate: -1 });

const Booking = mongoose.model('Booking', bookingSchema);

// Invoice Schema
const invoiceSchema = new mongoose.Schema({
  invoiceNo: {
    type: String,
    required: true,
    unique: true
  },
  customer: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  package: {
    type: String,
    required: true
  },
  hotelName: {
    type: String
  },
  amount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['paid', 'pending', 'overdue'],
    default: 'pending'
  },
  date: {
    type: Date,
    default: Date.now
  },
  dueDate: {
    type: Date,
    required: true
   }
});

invoiceSchema.index({ customer: 1, date: -1 });
invoiceSchema.index({ status: 1, date: -1 });
invoiceSchema.index({ date: 1 });

const Invoice = mongoose.model('Invoice', invoiceSchema);

// Review Schema
const reviewSchema = new mongoose.Schema({
  operatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  packageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Package'
  },
  customer: {
    type: String,
    required: true
  },
  package: {
    type: String,
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    required: true
  },
  response: {
    text: String,
    date: Date
  },
  status: {
    type: String,
    enum: ['approved', 'pending', 'rejected'],
    default: 'pending'
  },
   date: {
     type: Date,
     default: Date.now
   }
});

reviewSchema.index({ packageId: 1, status: 1 });
reviewSchema.index({ customerId: 1, status: 1 });
reviewSchema.index({ status: 1, date: -1 });
reviewSchema.index({ packageId: 1, rating: -1 });

const Review = mongoose.model('Review', reviewSchema);

// Coupon Schema
const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  description: String,
  discount: {
    type: Number,
    required: true,
    min: 0
  },
  type: {
    type: String,
    enum: ['percentage', 'flat'],
    required: true
  },
  minPurchase: {
    type: Number,
    required: true,
    min: 0
  },
  maxDiscount: {
    type: Number,
    min: 0
  },
  applicableTo: {
    type: String,
    enum: ['package', 'hotel', 'both'],
    default: 'both'
  },
  packageIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Package'
  }],
  startDate: {
    type: Date,
    default: Date.now
  },
  expiry: {
    type: Date,
    required: true
  },
  usage: {
    type: Number,
    default: 0
  },
  maxUsage: {
    type: Number,
    required: true,
    min: 0
  },
  perUserLimit: {
    type: Number,
    default: 1,
    min: 0
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

couponSchema.pre('save', function(next) {
  if (this.isModified('code')) {
    this.code = String(this.code).toUpperCase().trim()
  }
  if (this.isModified('updatedAt')) {
    this.updatedAt = new Date()
  }
  next()
})

const Coupon = mongoose.model('Coupon', couponSchema);

couponSchema.index({ code: 1 });
couponSchema.index({ status: 1, expiry: 1 });
couponSchema.index({ applicableTo: 1 });

const couponUsageSchema = new mongoose.Schema({
  couponId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Coupon',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true
  },
  discountAmount: Number,
  usedAt: {
    type: Date,
    default: Date.now
  }
});

couponUsageSchema.index({ couponId: 1, userId: 1 }, { unique: true });

const CouponUsage = mongoose.model('CouponUsage', couponUsageSchema);

// Settings Schema
const settingsSchema = new mongoose.Schema({
  siteName: {
    type: String,
    default: 'Travel Tour Management System'
  },
  siteEmail: String,
  sitePhone: String,
  currency: {
    type: String,
    default: 'INR'
  },
  timezone: {
    type: String,
    default: 'Asia/Kolkata'
  },
  maintenanceMode: {
    type: Boolean,
    default: false
  },
  allowRegistration: {
    type: Boolean,
    default: true
  },
  requireApproval: {
    type: Boolean,
    default: false
  },
  taxRate: {
    type: Number,
    default: 18
  },
  cancellationPolicy: String,
  refundPolicy: String,
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const Settings = mongoose.model('Settings', settingsSchema);

// Operator Profile Schema
const operatorProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  companyName: String,
  logo: String,
  businessAddress: String,
  city: String,
  state: String,
  country: String,
  postalCode: String,
  website: String,
  description: String,
  businessRegNumber: String,
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  },
  alternatePhone: String,
  licenseNumber: String,
  taxId: String,
  commissionRate: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  commissionType: {
    type: String,
    enum: ['percentage', 'fixed'],
    default: 'percentage'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const OperatorProfile = mongoose.model('OperatorProfile', operatorProfileSchema);

// Notification Schema
const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['booking', 'payment', 'review', 'system', 'offer', 'availability', 'itinerary_change', 'departure_reminder', 'disruption'],
    required: true
  },
  title: String,
  message: String,
  relatedId: mongoose.Schema.Types.ObjectId,
  // Set when the alert belongs to a specific trip so the customer trip-alert
  // feed can scope every alert to the booking that triggered it.
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking'
  },
  severity: {
    type: String,
    enum: ['info', 'warning', 'critical'],
    default: 'info'
  },
  // Frontend route the alert links to (e.g. /customer/bookings/:id/tracker).
  actionUrl: String,
  // Stable key used to make automated alerts idempotent, so a scheduler run
  // never produces the same reminder twice.
  dedupeKey: String,
  acknowledged: {
    type: Boolean,
    default: false
  },
  acknowledgedAt: Date,
  read: {
    type: Boolean,
    default: false
  },
  readAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, type: 1, createdAt: -1 });
notificationSchema.index({ dedupeKey: 1 });
notificationSchema.index({ bookingId: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);

// Notification Preference Schema — lets a traveller choose which classes of
// alert they actually want to receive (in-app and/or email).
const notificationPreferenceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  booking: { type: Boolean, default: true },
  payment: { type: Boolean, default: true },
  itinerary_change: { type: Boolean, default: true },
  departure_reminder: { type: Boolean, default: true },
  disruption: { type: Boolean, default: true },
  offer: { type: Boolean, default: true },
  inApp: { type: Boolean, default: true },
  email: { type: Boolean, default: true },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const NotificationPreference = mongoose.model('NotificationPreference', notificationPreferenceSchema);

// Communication Audit Trail Schema — records every operator-to-customer
// message (booking/itinerary updates) sent through the platform.
const communicationSchema = new mongoose.Schema({
  operatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['booking_update', 'itinerary_update', 'general', 'disruption'],
    required: true
  },
  channel: {
    type: String,
    enum: ['in_app', 'email', 'both'],
    required: true
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  recipientType: {
    type: String,
    enum: ['single', 'booking', 'package', 'all_confirmed'],
    required: true
  },
  recipientCount: { type: Number, default: 0 },
  relatedBookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
  relatedPackageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Package' },
  relatedItineraryId: { type: mongoose.Schema.Types.ObjectId },
  status: {
    type: String,
    enum: ['sent', 'partial', 'failed'],
    default: 'sent'
  },
  emailSent: { type: Boolean, default: false },
  inAppSent: { type: Boolean, default: false },
  errorMessage: String,
  sentAt: { type: Date, default: Date.now }
});

communicationSchema.index({ operatorId: 1, sentAt: -1 });
communicationSchema.index({ type: 1, sentAt: -1 });
communicationSchema.index({ relatedBookingId: 1 });

const Communication = mongoose.model('Communication', communicationSchema);

// Pricing Schema
const pricingSchema = new mongoose.Schema({
  packageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Package',
    required: true
  },
  operatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  basePrice: {
    type: Number,
    required: true
  },
  adultPrice: Number,
  childPrice: Number,
  infantPrice: Number,
  singleOccupancyPrice: Number,
  groupPricing: [{
    minPeople: Number,
    pricePerPerson: Number
  }],
  discount: {
    type: Number,
    default: 0
  },
  promotionalPrice: Number,
  tax: {
    type: Number,
    default: 0
  },
  serviceFee: {
    type: Number,
    default: 0
  },
  validFrom: Date,
  validUntil: Date,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const Pricing = mongoose.model('Pricing', pricingSchema);

// Availability Schema
const availabilitySchema = new mongoose.Schema({
  packageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Package',
    required: true
  },
  operatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  totalSeats: {
    type: Number,
    required: true
  },
  availableSeats: {
    type: Number,
    required: true
  },
  soldSeats: {
    type: Number,
    default: 0
  },
  bookingCutoffDate: Date,
  minGroupSize: {
    type: Number,
    default: 1
  },
  maxGroupSize: Number,
status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  cancellationPolicy: {
    enabled: {
      type: Boolean,
      default: false
    },
    rules: [{
      minDaysBeforeTrip: {
        type: Number,
        min: 0
      },
      refundPercentage: {
        type: Number,
        min: 0,
        max: 100
      }
    }]
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const Availability = mongoose.model('Availability', availabilitySchema);

// HotelProfile Schema
const hotelProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  email: String,
  phone: String,
  hotelName: {
    type: String,
    required: true
  },
  address: String,
  city: String,
  state: String,
  country: String,
  postalCode: String,
  website: String,
  description: String,
  starRating: Number,
  checkinTime: String,
  checkoutTime: String,
  amenities: [String],
  registrationNumber: String,
  taxId: String,
  logo: String,
  settings: {
    emailNotifications: { type: Boolean, default: true },
    smsNotifications: { type: Boolean, default: false },
    pushNotifications: { type: Boolean, default: true },
    bookingAlerts: { type: Boolean, default: true },
    paymentUpdates: { type: Boolean, default: true },
    reviewAlerts: { type: Boolean, default: true },
    guestNotifications: { type: Boolean, default: true },
    currency: { type: String, default: 'INR' },
    language: { type: String, default: 'English' },
    timezone: { type: String, default: 'IST' }
  }
});
const HotelProfile = mongoose.model('HotelProfile', hotelProfileSchema);

// Support Ticket Schema
const ticketSchema = new mongoose.Schema({
  ticketId: { type: String, unique: true, required: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  customerName: { type: String, required: true },
  customerEmail: { type: String, required: true },
  subject: { type: String, required: true },
  description: { type: String, required: true },
  category: {
    type: String,
    enum: ['billing', 'booking', 'technical', 'account', 'general', 'refund', 'cancellation'],
    default: 'general'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'resolved', 'closed', 'escalated'],
    default: 'open'
  },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedToName: String,
  responseTarget: Date,
  firstResponseAt: Date,
  resolvedAt: Date,
  escalationCount: { type: Number, default: 0 },
  messages: [{
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    senderName: String,
    senderRole: { type: String, enum: ['customer', 'admin', 'system'] },
    message: { type: String, required: true },
    isInternal: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
  }],
  tags: [String],
  satisfactionRating: { type: Number, min: 1, max: 5 },
  feedback: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

ticketSchema.index({ ticketId: 1 });
ticketSchema.index({ status: 1 });
ticketSchema.index({ priority: 1 });
ticketSchema.index({ customerEmail: 1 });
ticketSchema.index({ assignedTo: 1 });

const Ticket = mongoose.model('Ticket', ticketSchema);

// Wishlist Schema
const wishlistSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  itemType: {
    type: String,
    enum: ['package', 'hotel'],
    default: 'package'
  },
  packageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Package'
  },
  hotelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hotel'
  },
  itemId: {
    type: mongoose.Schema.Types.ObjectId
  },
  packageName: String,
  hotelName: String,
  name: String,
  destination: String,
  location: String,
  image: String,
  rating: Number,
  price: Number,
  originalPrice: Number,
  lastPrice: Number,
  targetPrice: Number,
  priceAlertEnabled: {
    type: Boolean,
    default: false
  },
  category: String,
  addedAt: {
    type: Date,
    default: Date.now
  },
  lastCheckedAt: Date
});
wishlistSchema.index({ userId: 1, itemType: 1, itemId: 1 });
wishlistSchema.index({ userId: 1, addedAt: -1 });
const Wishlist = mongoose.model('Wishlist', wishlistSchema);

function pickUpdates(body, keys) {
  const updates = {};
  for (const key of keys) {
    if (body[key] !== undefined) updates[key] = body[key];
  }
  return updates;
}

function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  try {
    const payload = jwt.verify(token, jwtSecret);
    req.user = payload;
    req.token = token;

    // Tokens issued before session tracking existed carry no jti, so they are
    // accepted as-is; every new token is bound to a revocable session.
    if (!payload.jti) {
      return next();
    }

    return checkSession(payload, req, res, next);
  } catch (error) {
    const message = error.name === 'TokenExpiredError'
      ? 'Your session has expired. Please sign in again.'
      : 'Invalid or expired token';
    return res.status(401).json({ message });
  }
}

// Confirms the session behind a token is still alive: not revoked, not
// expired, the account is still active, and the password has not been changed
// since the session was created.
async function checkSession(payload, req, res, next) {
  try {
    const session = await Session.findOne({ tokenId: payload.jti }).lean();
    if (!session) {
      return res.status(401).json({ message: 'Session not found. Please sign in again.' });
    }
    if (session.revokedAt) {
      return res.status(401).json({ message: 'This session has been signed out. Please sign in again.' });
    }
    if (session.expiresAt && session.expiresAt.getTime() <= Date.now()) {
      return res.status(401).json({ message: 'Your session has expired. Please sign in again.' });
    }

    const security = await getUserSecurityState(payload.userId);
    if (security?.status === 'inactive') {
      return res.status(403).json({ message: 'Account is inactive. Contact an administrator.' });
    }
    // The session carries the password marker it was created with. When the
    // password changes, the account marker moves forward and every session with
    // an older marker (or, for sessions predating this field, an older start
    // time) is no longer allowed to authenticate.
    const sessionMarker = session.passwordChangedAt || session.createdAt;
    if (security?.passwordChangedAt && sessionMarker < security.passwordChangedAt) {
      return res.status(401).json({ message: 'Your password was changed. Please sign in again.' });
    }

    req.session = session;
    touchSession(session.tokenId);
    return next();
  } catch (error) {
    console.error('Session check failed:', error.message);
    return res.status(500).json({ message: 'Session check failed' });
  }
}

// Cached so the hot path of every authenticated request does not need two
// extra database round trips.
const securityStateCache = new Map();
const SECURITY_STATE_TTL_MS = 30 * 1000;

async function getUserSecurityState(userId) {
  const cached = securityStateCache.get(String(userId));
  if (cached && Date.now() - cached.at < SECURITY_STATE_TTL_MS) {
    return cached.state;
  }
  try {
    const user = await User.findById(userId).select('status passwordChangedAt').lean();
    const state = user ? { status: user.status, passwordChangedAt: user.passwordChangedAt } : null;
    securityStateCache.set(String(userId), { state, at: Date.now() });
    return state;
  } catch (error) {
    console.error('Failed to load user security state:', error.message);
    return null;
  }
}

function invalidateSecurityStateCache(userId) {
  if (userId) {
    securityStateCache.delete(String(userId));
  } else {
    securityStateCache.clear();
  }
}

// Records that a session is still in use, at most once every five minutes.
const sessionTouchCache = new Map();
function touchSession(tokenId) {
  const now = Date.now();
  const last = sessionTouchCache.get(tokenId) || 0;
  if (now - last < 5 * 60 * 1000) return;
  sessionTouchCache.set(tokenId, now);
  Session.updateOne({ tokenId }, { $set: { lastSeenAt: new Date() } }).catch(() => {});
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
}

function requireTourOperator(req, res, next) {
  if (req.user?.role !== 'tour_operator') {
    return res.status(403).json({ message: 'Tour operator access required' });
  }
  next();
}

function requireCustomer(req, res, next) {
  if (req.user?.role !== 'customer') {
    return res.status(403).json({ message: 'Customer access required' });
  }
  next();
}

function requireHotelPartner(req, res, next) {
  if (req.user?.role !== 'hotel_partner') {
    return res.status(403).json({ message: 'Hotel partner access required' });
  }
  next();
}

// --- Account security -----------------------------------------------------

const AUTH_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_PATTERN = /^[+]?[\d][\d\s-]{7,19}$/;

// Shared password policy: at least 8 characters with an uppercase letter, a
// lowercase letter and a digit.
function validatePasswordStrength(password) {
  const value = String(password ?? '');
  if (!value) {
    return { valid: false, message: 'Password is required' };
  }
  if (value.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long' };
  }
  if (value.length > 128) {
    return { valid: false, message: 'Password must be under 128 characters' };
  }
  if (!/[A-Z]/.test(value)) {
    return { valid: false, message: 'Password must include an uppercase letter' };
  }
  if (!/[a-z]/.test(value)) {
    return { valid: false, message: 'Password must include a lowercase letter' };
  }
  if (!/\d/.test(value)) {
    return { valid: false, message: 'Password must include a number' };
  }
  return { valid: true, message: 'Password is strong enough' };
}

function validateContactDetails({ fullName, email, phone }) {
  if (fullName !== undefined && !String(fullName).trim()) {
    return { valid: false, message: 'Full name cannot be empty' };
  }
  if (email !== undefined && !EMAIL_PATTERN.test(String(email).trim())) {
    return { valid: false, message: 'Enter a valid email address' };
  }
  if (phone !== undefined && !PHONE_PATTERN.test(String(phone).trim())) {
    return { valid: false, message: 'Enter a valid phone number' };
  }
  return { valid: true };
}

// Turns a raw user-agent into something a person can recognise in the
// "active sessions" list.
function describeDevice(userAgent = '') {
  const ua = String(userAgent);
  const browser =
    /Edg\//.test(ua) ? 'Edge'
      : /OPR\//.test(ua) ? 'Opera'
        : /Chrome\//.test(ua) ? 'Chrome'
          : /Safari\//.test(ua) ? 'Safari'
            : /Firefox\//.test(ua) ? 'Firefox'
              : 'Browser';
  const platform =
    /Windows/.test(ua) ? 'Windows'
      : /Android/.test(ua) ? 'Android'
        : /iPhone|iPad|iPod/.test(ua) ? 'iOS'
          : /Mac OS X/.test(ua) ? 'macOS'
            : /Linux/.test(ua) ? 'Linux'
              : 'Unknown OS';
  const mobile = /Mobile|Android|iPhone|iPad/.test(ua) ? 'mobile' : 'desktop';
  return { browser, platform, device: `${browser} on ${platform}`, type: mobile };
}

// Signs a token and records the session it belongs to, so the session can be
// reviewed and revoked later. The session record is written before the caller
// responds, otherwise the first request after signing in could arrive before
// the record exists and be rejected as an unknown session.
async function issueAuthToken(user, req) {
  const tokenId = crypto.randomUUID();
  const token = jwt.sign(
    { userId: String(user._id), email: user.email, role: user.role, jti: tokenId },
    jwtSecret,
    { expiresIn: '24h' }
  );

  try {
    await Session.create({
      userId: user._id,
      tokenId,
      userAgent: String(req?.headers?.['user-agent'] || '').slice(0, 500),
      ip: req?.ip ? String(req.ip) : '',
      passwordChangedAt: user.passwordChangedAt || undefined,
      expiresAt: new Date(Date.now() + AUTH_TOKEN_TTL_MS)
    });
  } catch (err) {
    console.error('Failed to record session:', err.message);
  }

  return token;
}

async function revokeOtherSessions(userId, keepTokenId) {
  const filter = { userId, revokedAt: { $exists: false } };
  if (keepTokenId) filter.tokenId = { $ne: keepTokenId };
  const result = await Session.updateMany(filter, { $set: { revokedAt: new Date() } });
  return result.modifiedCount || 0;
}

async function revokeAllSessions(userId) {
  const result = await Session.updateMany(
    { userId, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } }
  );
  return result.modifiedCount || 0;
}

// Shapes a session document for the client.
function serializeSession(session, currentTokenId) {
  const device = describeDevice(session.userAgent);
  return {
    id: String(session._id),
    tokenId: session.tokenId,
    device: device.device,
    browser: device.browser,
    platform: device.platform,
    type: device.type,
    ip: session.ip || 'Unknown',
    createdAt: session.createdAt,
    lastSeenAt: session.lastSeenAt || session.createdAt,
    expiresAt: session.expiresAt,
    current: session.tokenId === currentTokenId
  };
}

// Registers the account-security endpoints for a role group. The group's
// auth middleware is already mounted, so every route below is protected.
function registerAccountSecurityRoutes(prefix) {
  // Changes the password for the signed-in user. Every other session is
  // revoked and the current session is kept so the user is not signed out of
  // the device they are working on.
  app.post(`${prefix}/account/password`, async (req, res) => {
    try {
      const { currentPassword, newPassword, confirmPassword } = req.body || {};

      if (!currentPassword) {
        return res.status(400).json({ message: 'Enter your current password' });
      }
      if (!newPassword) {
        return res.status(400).json({ message: 'Enter a new password' });
      }
      if (confirmPassword !== undefined && confirmPassword !== newPassword) {
        return res.status(400).json({ message: 'New password and confirmation do not match' });
      }
      if (newPassword === currentPassword) {
        return res.status(400).json({ message: 'New password must be different from the current one' });
      }

      const strength = validatePasswordStrength(newPassword);
      if (!strength.valid) {
        return res.status(400).json({ message: strength.message });
      }

      const user = await User.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const matches = await bcrypt.compare(currentPassword, user.password);
      if (!matches) {
        return res.status(401).json({ message: 'Current password is incorrect' });
      }

      user.password = await bcrypt.hash(newPassword, 12);
      user.passwordChangedAt = new Date();
      await user.save();
      invalidateSecurityStateCache(req.user.userId);

      const revoked = await revokeOtherSessions(req.user.userId, req.user.jti);

      // The device that made the change keeps working, so the marker it was
      // created with is moved forward to the new password. Every other device
      // is signed out by the marker move and by the revocation above.
      if (req.user.jti) {
        await Session.updateOne(
          { tokenId: req.user.jti },
          { $set: { passwordChangedAt: user.passwordChangedAt } }
        );
      }

      await sendNotificationEmail(
        user.email,
        'Your password was changed',
        `The password for your TravelTour account was changed${revoked ? ` and ${revoked} other session(s) were signed out` : ''}. If this was not you, contact support immediately.`
      ).catch(err => console.error('Password change email failed:', err.message));

      res.status(200).json({ message: 'Password changed successfully', revokedSessions: revoked });
    } catch (error) {
      console.error('Error changing password:', error);
      res.status(500).json({ message: 'Error changing password' });
    }
  });

  // Lists the devices that are currently signed in to the account.
  app.get(`${prefix}/account/sessions`, async (req, res) => {
    try {
      const sessions = await Session.find({
        userId: req.user.userId,
        revokedAt: { $exists: false },
        expiresAt: { $gt: new Date() }
      }).sort({ lastSeenAt: -1 });

      const serialized = sessions.map(session => serializeSession(session, req.user.jti));
      res.status(200).json({
        sessions: serialized,
        activeCount: serialized.length,
        currentTokenId: req.user.jti || null
      });
    } catch (error) {
      console.error('Error fetching sessions:', error);
      res.status(500).json({ message: 'Error fetching sessions' });
    }
  });

  // Signs a single device out.
  app.delete(`${prefix}/account/sessions/:id`, async (req, res) => {
    try {
      const session = await Session.findOne({ _id: req.params.id, userId: req.user.userId });
      if (!session) {
        return res.status(404).json({ message: 'Session not found' });
      }
      if (session.tokenId === req.user.jti) {
        return res.status(400).json({ message: 'Use sign out to end the session you are currently using' });
      }

      session.revokedAt = new Date();
      await session.save();

      res.status(200).json({ message: 'Session signed out' });
    } catch (error) {
      console.error('Error revoking session:', error);
      res.status(500).json({ message: 'Error revoking session' });
    }
  });

  // Signs every other device out, keeping the current one alive.
  app.post(`${prefix}/account/sessions/revoke-others`, async (req, res) => {
    try {
      const revoked = await revokeOtherSessions(req.user.userId, req.user.jti);
      res.status(200).json({ message: 'Other sessions signed out', revokedSessions: revoked });
    } catch (error) {
      console.error('Error revoking sessions:', error);
      res.status(500).json({ message: 'Error revoking sessions' });
    }
  });

  // Ends the session that made the request.
  app.post(`${prefix}/account/logout`, async (req, res) => {
    try {
      if (req.user?.jti) {
        await Session.updateOne(
          { tokenId: req.user.jti },
          { $set: { revokedAt: new Date() } }
        );
      }
      res.status(200).json({ message: 'Signed out' });
    } catch (error) {
      console.error('Error signing out:', error);
      res.status(500).json({ message: 'Error signing out' });
    }
  });
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Case-insensitive OR search across the given fields. Returns null when there is
// nothing to search for, so callers can merge it into an existing filter safely.
function searchFilter(fields, term) {
  const needle = String(term ?? '').trim();
  if (!needle) return null;
  const rx = new RegExp(escapeRegExp(needle), 'i');
  return { $or: fields.map(field => ({ [field]: rx })) };
}

function getPagination(query = {}, { defaultLimit = DEFAULT_PAGE_SIZE } = {}) {
  const rawLimit = query.limit;
  const rawPage = query.page;

  let limit;
  if (rawLimit === undefined || rawLimit === null || rawLimit === '') {
    limit = defaultLimit;
  } else if (String(rawLimit).trim().toLowerCase() === 'all') {
    limit = 0;
  } else {
    const parsedLimit = parseInt(rawLimit, 10);
    if (Number.isNaN(parsedLimit)) limit = defaultLimit;
    else if (parsedLimit <= 0) limit = 0;
    else limit = Math.min(parsedLimit, MAX_PAGE_SIZE);
  }
  if (limit < 0) limit = 0;

  const parsedPage = parseInt(rawPage, 10);
  const page = Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;

  const skip = limit > 0 ? (page - 1) * limit : 0;
  return { page, limit, skip };
}

async function findPage(Model, filter = {}, options = {}) {
  const {
    query = {},
    sort,
    select,
    populate,
    defaultLimit = DEFAULT_PAGE_SIZE,
    defaultSort = null
  } = options;

  const { page, limit, skip } = getPagination(query, { defaultLimit });

  let cursor = Model.find(filter);
  const activeSort = sort || defaultSort;
  if (activeSort) cursor = cursor.sort(activeSort);
  if (select) cursor = cursor.select(select);
  if (populate) cursor = cursor.populate(populate);
  if (limit > 0) cursor = cursor.skip(skip).limit(limit);
  cursor = cursor.lean();

  const [docs, total] = await Promise.all([
    cursor,
    Model.countDocuments(filter)
  ]);

  const totalPages = limit > 0 ? Math.max(1, Math.ceil(total / limit)) : 1;
  return {
    docs,
    total,
    page,
    limit,
    totalPages,
    hasNext: limit > 0 ? page * limit < total : false,
    hasPrev: page > 1
  };
}

function pagedResponse(res, key, { docs, total, page, limit, totalPages, hasNext, hasPrev }, extra = {}) {
  const pagination = {
    page,
    limit,
    total,
    totalPages,
    hasNext,
    hasPrev,
    count: docs.length
  };
  if (limit === 0) pagination.all = true;
  return res.status(200).json({ [key]: docs, pagination, ...extra });
}

async function validateCouponForRequest({ code, bookingType, packageId, hotelId, amount, userId }) {
  const coupon = await Coupon.findOne({ code: String(code).toUpperCase().trim() });
  if (!coupon) return { success: false, message: 'Invalid coupon code' };

  const now = new Date();
  if (coupon.status !== 'active') return { success: false, message: 'Coupon is inactive' };
  if (now < coupon.startDate) return { success: false, message: 'Coupon is not active yet' };
  if (now > coupon.expiry) return { success: false, message: 'Coupon has expired' };
  if (coupon.usage >= coupon.maxUsage) return { success: false, message: 'Coupon usage limit reached' };

  const applicableTo = coupon.applicableTo || 'both';
  if (bookingType === 'package' && !['package', 'both'].includes(applicableTo)) {
    return { success: false, message: 'Coupon is not applicable to package bookings' };
  }
  if (bookingType === 'hotel' && !['hotel', 'both'].includes(applicableTo)) {
    return { success: false, message: 'Coupon is not applicable to hotel bookings' };
  }

  if (applicableTo === 'package' && coupon.packageIds && coupon.packageIds.length > 0 && packageId) {
    if (!coupon.packageIds.map(id => String(id)).includes(String(packageId))) {
      return { success: false, message: 'This coupon is not applicable to the selected package' };
    }
  }

  const bookingAmount = Number(amount) || 0;
  if (bookingAmount < coupon.minPurchase) {
    return { success: false, message: `Minimum booking amount is ₹${coupon.minPurchase.toLocaleString()}` };
  }

  let discountAmount = 0;
  if (coupon.type === 'percentage') {
    discountAmount = (bookingAmount * Number(coupon.discount)) / 100;
    if (coupon.maxDiscount && discountAmount > coupon.maxDiscount) {
      discountAmount = coupon.maxDiscount;
    }
  } else {
    discountAmount = Number(coupon.discount);
  }

  if (discountAmount >= bookingAmount) {
    discountAmount = bookingAmount - 1;
  }
  const finalAmount = Math.max(0, bookingAmount - discountAmount);

  if (userId) {
    const userUsage = await CouponUsage.countDocuments({ couponId: coupon._id, userId });
    if (userUsage >= coupon.perUserLimit) {
      return { success: false, message: 'You have already used this coupon' };
    }
  }

  return {
    success: true,
    coupon: {
      code: coupon.code,
      discountType: coupon.type,
      discountValue: coupon.discount,
      couponId: coupon._id
    },
    originalAmount: bookingAmount,
    discountAmount,
    finalAmount,
    message: 'Coupon applied successfully'
  };
}

async function requireOperatorOwnership(req, res, next) {
  const resourceId = req.params.id || req.params.packageId || req.params.bookingId;
  const resourceType = req.path.includes('packages') ? 'Package' : 
                        req.path.includes('bookings') ? 'Booking' : 
                        req.path.includes('itineraries') ? 'Itinerary' : 
                        req.path.includes('reviews') ? 'Review' : null;
  
  if (!resourceType || !resourceId) {
    return next();
  }

  try {
    let resource;
    if (resourceType === 'Package') {
      resource = await Package.findById(resourceId);
    } else if (resourceType === 'Booking') {
      resource = await Booking.findById(resourceId);
    } else if (resourceType === 'Itinerary') {
      resource = await Itinerary.findById(resourceId);
    } else if (resourceType === 'Review') {
      resource = await Review.findById(resourceId);
    }

    if (!resource) {
      return res.status(404).json({ message: 'Resource not found' });
    }

    if (resource.operatorId && resource.operatorId.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'You do not have permission to access this resource' });
    }

    next();
  } catch (error) {
    return res.status(500).json({ message: 'Error checking ownership' });
  }
}

function rangeStart(range) {
  const start = new Date();
  if (range === 'week') start.setDate(start.getDate() - 7);
  else if (range === 'quarter') start.setMonth(start.getMonth() - 3);
  else if (range === 'year') start.setFullYear(start.getFullYear() - 1);
  else start.setMonth(start.getMonth() - 1);
  return start;
}

function duplicateError(error) {
  return error?.code === 11000;
}

function calculateRefund(booking, cancellationDate = new Date()) {
  const result = {
    bookingAmount: 0,
    daysBeforeTrip: 0,
    refundPercentage: 0,
    refundAmount: 0,
    cancellationFee: 0
  };

  if (!booking) {
    return result;
  }

  // Parse trip date from checkInDate or dates field
  let tripDate = null;
  if (booking.checkInDate) {
    tripDate = new Date(booking.checkInDate);
  } else if (booking.dates) {
    // Handle various date string formats
    const dateStr = String(booking.dates).trim();
    tripDate = new Date(dateStr);
  }
  
  if (!tripDate || isNaN(tripDate.getTime())) {
    return result;
  }

  // Use date-only comparison (midnight to midnight) to avoid timezone issues
  const cancellation = new Date(cancellationDate);
  const tripMidnight = new Date(tripDate.getFullYear(), tripDate.getMonth(), tripDate.getDate());
  const cancelMidnight = new Date(cancellation.getFullYear(), cancellation.getMonth(), cancellation.getDate());
  
  const timeDiff = tripMidnight.getTime() - cancelMidnight.getTime();
  const daysBeforeTrip = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

  result.daysBeforeTrip = daysBeforeTrip;

  // Check for cancellation policy snapshot (package bookings) or hotel cancellation policy (hotel bookings)
  let policySnapshot = booking.cancellationPolicySnapshot;
  if (!policySnapshot && booking.hotelId && booking.hotelId.cancellationPolicy) {
    policySnapshot = booking.hotelId.cancellationPolicy;
  }
  
  if (!policySnapshot || !policySnapshot.enabled || !policySnapshot.rules || policySnapshot.rules.length === 0) {
    result.refundPercentage = 0;
    result.refundAmount = 0;
    result.cancellationFee = booking.finalAmount || booking.amount || 0;
    result.bookingAmount = booking.finalAmount || booking.amount || 0;
    return result;
  }

  // Sort rules descending by minDaysBeforeTrip
  const sortedRules = [...policySnapshot.rules].sort((a, b) => (b.minDaysBeforeTrip || 0) - (a.minDaysBeforeTrip || 0));
  let applicablePercentage = 0;

  // Find first rule where daysBeforeTrip >= minDaysBeforeTrip (inclusive boundary)
  for (const rule of sortedRules) {
    const minDays = rule.minDaysBeforeTrip || 0;
    if (daysBeforeTrip >= minDays) {
      applicablePercentage = rule.refundPercentage || 0;
      break;
    }
  }

  // If trip has already started/passed (negative days), refund is 0%
  if (daysBeforeTrip < 0) {
    applicablePercentage = 0;
  }

  const bookingAmount = booking.finalAmount || booking.amount || 0;
  
  // Two-decimal monetary rounding: round to 2 decimal places
  const rawRefund = (bookingAmount * applicablePercentage) / 100;
  const refundAmount = Math.round(rawRefund * 100) / 100;
  const cancellationFee = Math.round((bookingAmount - refundAmount) * 100) / 100;

  result.bookingAmount = bookingAmount;
  result.refundPercentage = applicablePercentage;
  result.refundAmount = refundAmount;
  result.cancellationFee = cancellationFee;

  return result;
}

async function nextInvoiceNo() {
  const now = new Date();
  const prefix = `INV-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const count = await Invoice.countDocuments();
  return `${prefix}-${String(count + 1).padStart(3, '0')}`;
}

async function createPaidInvoice(booking) {
  const existing = await Invoice.findOne({
    customer: booking.customer,
    email: booking.email,
    package: booking.package,
    amount: booking.amount
  });
  if (existing) return existing;
  const due = new Date();
  due.setDate(due.getDate() + 7);
  const invoice = new Invoice({
    invoiceNo: await nextInvoiceNo(),
    customer: booking.customer,
    email: booking.email,
    package: booking.package || booking.hotelName || '',
    hotelName: booking.hotelName || '',
    amount: booking.amount,
    status: 'paid',
    dueDate: due
  });
    await invoice.save();
    return invoice;
  }

  // --- Stripe webhook event handler ---
  async function handleStripeEvent(event) {
    const eventType = event.type;
    const session = event.data.object;

    // Idempotency: ignore already-processed events by checking session status
    if (eventType === 'checkout.session.completed' ||
        eventType === 'checkout.session.async_payment_succeeded') {
      if (session.payment_status !== 'paid') return;
      await finalizeStripePayment(session);
    } else if (eventType === 'checkout.session.async_payment_failed') {
      await markStripeSessionFailed(session, 'failed');
    } else if (eventType === 'checkout.session.expired') {
      await markStripeSessionFailed(session, 'expired');
    }
  }

  async function finalizeStripePayment(session) {
    const bookingId = session.metadata?.bookingId;
    const customerId = session.client_reference_id;
    if (!bookingId || !customerId) {
      console.error('Stripe session missing metadata:', session.id);
      return;
    }

    const booking = await Booking.findOne({ _id: bookingId, customerId });
    if (!booking) {
      console.error('Stripe booking not found:', bookingId);
      return;
    }

    // Verify expected amount/currency before marking paid
    const amountPaid = Math.round((session.amount_total || 0) / 100); // smallest unit -> major
    const currency = (session.currency || 'inr').toLowerCase();
    const totalDue = Math.ceil((booking.finalAmount || booking.amount || 0) - (booking.paidAmount || 0));
    if (currency !== 'inr' || amountPaid < totalDue) {
      console.error('Stripe amount/currency mismatch:', { amountPaid, currency, totalDue });
      return;
    }

    if (booking.paymentStatus === 'paid') {
      // Already processed — idempotent
      return;
    }

    booking.paymentStatus = 'paid';
    booking.status = 'confirmed';
    booking.paidAmount = booking.finalAmount || booking.amount;
    booking.stripeSessionStatus = 'paid';
    booking.stripePaymentIntent = session.payment_intent || null;
    booking.timeline.push({
      status: 'paid',
      date: new Date(),
      note: `Stripe webhook confirmed payment of ₹${booking.paidAmount} via session ${session.id}`,
    });

    const invoice = await createPaidInvoice(booking);

    await Notification.create({
      userId: customerId,
      type: 'payment',
      title: 'Payment Confirmed',
      message: `Stripe payment of ₹${booking.paidAmount} received. Your booking (${booking.bookingId}) is now confirmed.`,
      relatedId: booking._id,
      read: false,
    });

    if (booking.email) {
      try {
        const pdfBuffer = await generateInvoicePDF(invoice, booking);
        await sendCardEmailWithAttachment(
          booking.email,
          'Payment Confirmation & Invoice',
          'Payment Confirmed!',
          `Stripe payment of ₹${booking.paidAmount} received. Your booking <strong>${booking.bookingId}</strong> is now confirmed. Invoice: ${invoice.invoiceNo || 'N/A'}.`,
          [{ name: `invoice_${invoice.invoiceNo || 'invoice'}.pdf`, content: pdfBuffer }]
        );
      } catch (err) {
        console.error('Invoice email failed:', err.message);
      }
    }

    await booking.save();
  }

  async function markStripeSessionFailed(session, status) {
    const bookingId = session.metadata?.bookingId;
    const customerId = session.client_reference_id;
    if (!bookingId || !customerId) return;
    const booking = await Booking.findOne({ _id: bookingId, customerId });
    if (!booking) return;
    if (booking.paymentStatus === 'paid') return;
    booking.stripeSessionStatus = status;
    if (status === 'failed') {
      booking.paymentStatus = 'failed';
    }
    booking.timeline.push({
      status: status,
      date: new Date(),
      note: `Stripe session ${status}: ${session.id}`,
    });
    await booking.save();
  }

  async function refreshPackageRating(packageName) {
  if (!packageName) return;
  const approved = await Review.find({ package: packageName, status: 'approved' });
  const avg = approved.length
    ? approved.reduce((sum, review) => sum + review.rating, 0) / approved.length
    : 0;
  await Package.findOneAndUpdate({ name: packageName }, { rating: Number(avg.toFixed(1)) });
}


console.log('User collection name:', User.collection.name);

// --- Google OAuth ---
// Only initialize Google OAuth if credentials are provided; otherwise
// skip it so the server can start in development without Google credentials.
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback',
      proxy: true,
    },
    async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value;
      if (!email) return done(new Error('No email from Google'));
       let user = await User.findOne({ email });
      if (!user) {
        user = new User({
          fullName: profile.displayName || email.split('@')[0],
          email,
          phone: '0000000000',
          password: crypto.randomBytes(32).toString('hex'),
          role: 'customer',
        });
        await user.save();
      }
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
));
}

// The OAuth callback redirects with the JWT in the query string, so the
// frontend origin that starts the flow must be resolved against an allowlist.
// Anything else is replaced with the primary FRONTEND_URL, otherwise a crafted
// `state` could send the token to an attacker's site.
const trustedFrontendOrigins = () => {
  const configured = [process.env.FRONTEND_URL, ...(process.env.FRONTEND_URLS || '').split(',')];
  return configured
    .map((value) => (value || '').trim())
    .filter(Boolean)
    .map((value) => {
      try {
        return new URL(value).origin;
      } catch {
        return null;
      }
    })
    .filter(Boolean);
};

const resolveFrontendOrigin = (candidate) => {
  const trusted = trustedFrontendOrigins();
  const fallback = trusted[0] || 'http://localhost:5173';
  if (!candidate) return fallback;
  try {
    const { origin } = new URL(String(candidate));
    return trusted.includes(origin) ? origin : fallback;
  } catch {
    return fallback;
  }
};

app.get('/api/auth/google', (req, res, next) => {
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
    // Carry the resolved frontend origin through Google so the callback can
    // return the visitor to the host they signed in from.
    state: resolveFrontendOrigin(req.query.state)
  })(req, res, next);
});

app.get(
  '/api/auth/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=oauth` }),
  async (req, res) => {
    const token = await issueAuthToken(req.user, req);
    // The state carries the frontend origin from the start of the flow; it is
    // allowlist-checked so the token is never redirected to an untrusted host.
    const frontend = resolveFrontendOrigin(req.query.state);
    res.redirect(`${frontend}/login?token=${token}&role=${req.user.role}`);
  }
);

// Routes

// Signup Route
app.post('/api/signup', async (req, res) => {
  try {
    const { fullName, email, phone, password, role } = req.body;

    const settings = await Settings.findOne({});
    if (settings && settings.allowRegistration === false) {
      return res.status(403).json({ message: 'Registration is currently disabled' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    const contactCheck = validateContactDetails({ fullName, email, phone });
    if (!contactCheck.valid) {
      return res.status(400).json({ message: contactCheck.message });
    }

    const strength = validatePasswordStrength(password);
    if (!strength.valid) {
      return res.status(400).json({ message: strength.message });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      fullName,
      email,
      phone,
      password: hashedPassword,
      role,
      status: settings?.requireApproval ? 'inactive' : 'active',
      passwordChangedAt: new Date()
    });

    await newUser.save();

    const message = settings?.requireApproval
      ? 'Account created. Wait for admin approval before logging in.'
      : 'User created successfully';

    res.status(201).json({ message, user: { fullName, email, role, status: newUser.status } });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Server error during signup' });
  }
});

// Login Route
app.post('/api/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;

    // Find user by email and role
    const user = await User.findOne({ email, role });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials or role' });
    }

    if (user.status === 'inactive') {
      return res.status(403).json({ message: 'Account is inactive. Contact an administrator.' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Update last login timestamp in MongoDB
    user.lastLogin = new Date();
    await user.save();
    console.log(`User ${email} logged in successfully at ${user.lastLogin}`);

    // Generate JWT token and record the session it belongs to
    const token = await issueAuthToken(user, req);

    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        lastLogin: user.lastLogin
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// In-memory OTP store (email â†’ { otp, expiresAt })
const otpStore = new Map();

// Helper: send email via Brevo (REST API or SMTP)

// Tracks a broken Brevo credential so a rejected API key is reported once
// instead of failing (and logging) on every single alert.
let brevoAuthFailure = null;

async function sendEmailViaBrevo(to, subject, htmlContent) {
  const brevoKey = process.env.BREVO_API_KEY;
  if (!brevoKey) {
    throw new Error('BREVO_API_KEY not configured');
  }
  if (brevoAuthFailure) {
    return false;
  }
  const senderEmail = process.env.BREVO_SENDER_EMAIL || 'anjaiahgiddala@gmail.com';
  const senderName = process.env.BREVO_SENDER_NAME || 'Teja.com';

  const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': brevoKey,
    },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName },
      to: [{ email: to }],
      subject,
      htmlContent,
    }),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    if (resp.status === 401 || resp.status === 403) {
      brevoAuthFailure = `Brevo API error ${resp.status}: ${txt}`;
      console.error(`[EMAIL DISABLED] ${brevoAuthFailure} — check BREVO_API_KEY in backend/.env`);
    }
    throw new Error(`Brevo API error ${resp.status}: ${txt}`);
  }
  return resp.json();
}

async function sendNotificationEmail(to, title, message) {
  if (!to) return false;
  const htmlContent = cardEmailTemplate(title, message);
  try {
    const result = await sendEmailViaBrevo(to, title, htmlContent);
    if (result === false) return false; // Brevo auth known broken — skip silently
    return true;
  } catch (err) {
    if (/Brevo API error (401|403)/.test(err.message)) return false; // log once only
    console.error('Email notification failed:', err.message);
    return false;
  }
}

function cardEmailTemplate(title, message) {
  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8fafc;">
      <div style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); padding: 20px; border-radius: 10px; text-align: center; color: white; margin-bottom: 5px;">
        <h2 style="margin: 0; font-size: 20px;">TravelTour Notifications</h2>
      </div>
      <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <h3 style="margin-top: 0; color: #1e293b; font-size: 18px;">${title}</h3>
        <div style="color: #333; line-height: 1.6; font-size: 15px;">${message}</div>
        <div style="color: #94a3b8; font-size: 12px; margin-top: 20px;">This is an automated message. Please do not reply.</div>
      </div>
      <div style="text-align: center; padding: 15px; color: #94a3b8; font-size: 12px;">
        Â© ${new Date().getFullYear()} TravelTour. All rights reserved.
      </div>
    </div>
  `;
}

async function sendCardEmailWithAttachment(to, subject, title, message, attachments) {
  const cardHtml = cardEmailTemplate(title, message);
  return sendEmailWithAttachment(to, subject, cardHtml, attachments);
}

async function sendEmailWithAttachment(to, subject, htmlContent, attachments) {
  const brevoKey = process.env.BREVO_API_KEY;
  if (!brevoKey) {
    throw new Error('BREVO_API_KEY not configured');
  }
  const senderEmail = process.env.BREVO_SENDER_EMAIL || 'anjaiahgiddala@gmail.com';
  const senderName = process.env.BREVO_SENDER_NAME || 'Teja.com';
  const body = {
    sender: { email: senderEmail, name: senderName },
    to: [{ email: to }],
    subject,
    htmlContent,
  };
  if (attachments && attachments.length) {
    body.attachments = attachments.map(att => ({
      name: att.name,
      content: att.content.toString('base64'),
    }));
  }
  const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': brevoKey,
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Brevo API error ${resp.status}: ${txt}`);
  }
  return resp.json();
}

// --- Notification service -------------------------------------------------
// Central place that decides whether an alert should reach a traveller, so
// booking/payment/itinerary/departure/disruption alerts all respect the same
// preferences, de-duplication and email rules.

const NOTIFICATION_TYPES = [
  'booking',
  'payment',
  'review',
  'system',
  'offer',
  'availability',
  'itinerary_change',
  'departure_reminder',
  'disruption',
  'ticket_reply'
];

const TRIP_ALERT_TYPES = [
  'booking',
  'payment',
  'itinerary_change',
  'departure_reminder',
  'disruption'
];

async function getNotificationPreference(userId) {
  try {
    let pref = await NotificationPreference.findOne({ userId });
    if (!pref) {
      pref = await NotificationPreference.create({ userId });
    }
    return pref;
  } catch (error) {
    console.error('Failed to load notification preferences:', error.message);
    return null;
  }
}

function isNotificationTypeEnabled(pref, type) {
  if (!pref) return true;
  const source = typeof pref.toObject === 'function' ? pref.toObject() : pref;
  if (Object.prototype.hasOwnProperty.call(source, type)) {
    return source[type] !== false;
  }
  return true;
}

// Creates a notification for a user. Returns the stored document, or null when
// the alert was suppressed (preference off or already delivered).
async function createNotification({
  userId,
  type,
  title,
  message,
  relatedId,
  bookingId,
  severity = 'info',
  actionUrl,
  dedupeKey,
  email = true,
  emailSubject
}) {
  if (!userId || !type) return null;

  try {
    const pref = await getNotificationPreference(userId);
    const typeEnabled = isNotificationTypeEnabled(pref, type);
    const emailEnabled = email && pref?.email !== false;
    const inAppEnabled = pref?.inApp !== false;

    // A muted alert class (or in-app channel) still reaches the traveller by
    // email when that channel is on — only the channel that is off is skipped.
    if (!typeEnabled || !inAppEnabled) {
      if (emailEnabled) {
        const user = await User.findById(userId).select('email fullName');
        if (user?.email) {
          await sendNotificationEmail(user.email, emailSubject || title || 'TravelTour Alert', message || '')
            .catch(err => console.error('Notification email failed:', err.message));
        }
      }
      return null;
    }

    if (dedupeKey) {
      const existing = await Notification.findOne({ userId, dedupeKey }).select('_id');
      if (existing) return null;
    }

    const notification = await Notification.create({
      userId,
      type,
      title,
      message,
      relatedId,
      bookingId,
      severity,
      actionUrl,
      dedupeKey,
      read: false,
      acknowledged: false
    });

    if (emailEnabled) {
      const user = await User.findById(userId).select('email fullName');
      if (user?.email) {
        await sendNotificationEmail(user.email, emailSubject || title || 'TravelTour Alert', message || '')
          .catch(err => console.error('Notification email failed:', err.message));
      }
    }

    return notification;
  } catch (error) {
    console.error('Failed to create notification:', error.message);
    return null;
  }
}

// Creates the same alert for many users at once.
async function createNotificationsForUsers(userIds, payload) {
  const unique = [...new Set((userIds || []).filter(Boolean).map(String))];
  const created = [];
  for (const userId of unique) {
    const notification = await createNotification({ ...payload, userId });
    if (notification) created.push(notification);
  }
  return created;
}

function statusChangedLabel(status) {
  const labels = {
    confirmed: 'Booking Confirmed',
    cancelled: 'Booking Cancelled',
    rejected: 'Booking Rejected',
    completed: 'Trip Completed',
    pending: 'Booking Awaiting Confirmation'
  };
  return labels[status] || 'Booking Status Updated';
}

// --- Trip date helpers ----------------------------------------------------

// Resolves the date a trip starts. Package bookings store a plain "YYYY-MM-DD"
// travel date, hotel bookings store a check-in date, and a package whose
// booking has no date falls back to day 1 of its itinerary.
function parseTripStart(booking) {
  if (!booking) return null;

  if (booking.checkInDate) {
    const checkIn = new Date(booking.checkInDate);
    if (!Number.isNaN(checkIn.getTime())) return checkIn;
  }

  if (booking.dates) {
    const raw = String(booking.dates).trim();
    const iso = raw.match(/(\d{4}-\d{2}-\d{2})/);
    if (iso) {
      const parsed = new Date(iso[1]);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    const direct = new Date(raw);
    if (!Number.isNaN(direct.getTime())) return direct;
    const ddmmyyyy = raw.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (ddmmyyyy) {
      const parsed = new Date(
        Number(ddmmyyyy[3]),
        Number(ddmmyyyy[2]) - 1,
        Number(ddmmyyyy[1])
      );
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
  }

  return null;
}

function startOfDay(value) {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysUntil(value) {
  const diff = startOfDay(value).getTime() - startOfDay(new Date()).getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

function formatTripDate(value) {
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

// ISO "YYYY-MM-DD" is the format the travel-date input stores, so string
// comparison against it is safe for range queries.
function formatIsoDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

async function resolveTripStarts(bookings) {
  const starts = new Map();
  const packageIds = [];

  for (const booking of bookings) {
    const parsed = parseTripStart(booking);
    if (parsed) {
      starts.set(String(booking._id), parsed);
    } else if (booking.packageId) {
      packageIds.push(booking.packageId);
    }
  }

  if (packageIds.length) {
    const itineraries = await Itinerary.find({ packageId: { $in: packageIds } }).select('packageId dayDetails');
    const firstDayByPackage = new Map();
    for (const itinerary of itineraries) {
      const first = [...(itinerary.dayDetails || [])]
        .sort((a, b) => (a.dayNumber || 0) - (b.dayNumber || 0))[0];
      if (first?.date) {
        firstDayByPackage.set(String(itinerary.packageId), new Date(first.date));
      }
    }
    for (const booking of bookings) {
      if (starts.has(String(booking._id))) continue;
      const fallback = firstDayByPackage.get(String(booking.packageId));
      if (fallback && !Number.isNaN(fallback.getTime())) {
        starts.set(String(booking._id), fallback);
      }
    }
  }

  return starts;
}

// --- Departure reminders --------------------------------------------------

const DEPARTURE_REMINDER_STAGES = [
  { key: '3d', days: 3, label: '3 days' },
  { key: '1d', days: 1, label: 'tomorrow' }
];

const DEPARTURE_REMINDER_INTERVAL_MS = 15 * 60 * 1000;

// Walks confirmed/pending bookings that are about to depart and drops a
// reminder for each. Every reminder carries a dedupe key so repeated runs of
// the scheduler never create duplicates.
async function runDepartureReminderJob() {
  try {
    const now = new Date();
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + Math.max(...DEPARTURE_REMINDER_STAGES.map(stage => stage.days)));

    const bookings = await Booking.find({
      status: { $in: ['pending', 'confirmed'] },
      $or: [
        { checkInDate: { $gte: startOfDay(now), $lte: horizon } },
        { dates: { $gte: formatIsoDate(now), $lte: formatIsoDate(horizon) } }
      ]
    })
      .select('customerId email customer package packageId dates checkInDate travelers operatorId hotelName pickupInfo')
      .limit(500);

    if (!bookings.length) return 0;

    const tripStarts = await resolveTripStarts(bookings);
    const packages = await Package.find({
      _id: { $in: [...new Set(bookings.map(b => b.packageId).filter(Boolean))] }
    }).select('name destination pickupInfo startingLocation duration transportType');
    const packageById = new Map(packages.map(pkg => [String(pkg._id), pkg]));

    let created = 0;
    for (const booking of bookings) {
      const tripStart = tripStarts.get(String(booking._id));
      if (!tripStart) continue;
      const remaining = daysUntil(tripStart);
      if (remaining < 0) continue;

      const stage = DEPARTURE_REMINDER_STAGES.find(item => item.days === remaining);
      if (!stage) continue;

      const pkg = booking.packageId ? packageById.get(String(booking.packageId)) : null;
      const tripName = booking.package || pkg?.name || booking.hotelName || 'your trip';
      const pickup = booking.pickupInfo || pkg?.pickupInfo || pkg?.startingLocation || 'the pickup point shared in your itinerary';
      const travellers = booking.travelers || 1;
      const when = remaining === 0 ? 'today' : remaining === 1 ? 'tomorrow' : `in ${remaining} days`;

      const message = `Your trip "${tripName}" departs ${when} (${formatTripDate(tripStart)}). `
        + `Please carry a government photo ID, reach the pickup point "${pickup}" and arrive 30 minutes early. `
        + `You are travelling with ${travellers} ${travellers === 1 ? 'traveller' : 'travellers'}.`;

      const notification = await createNotification({
        userId: booking.customerId,
        type: 'departure_reminder',
        title: remaining === 0 ? 'Your trip departs today' : 'Trip departure reminder',
        message,
        bookingId: booking._id,
        relatedId: booking._id,
        severity: remaining === 0 ? 'critical' : 'info',
        actionUrl: `/customer/bookings/${booking._id}/tracker`,
        dedupeKey: `departure:${stage.key}:${booking._id}:${formatTripDate(tripStart)}`,
        emailSubject: `Trip departure ${when} — ${tripName}`
      });

      if (notification) created += 1;
    }

    if (created) {
      console.log(`[DEPARTURE REMINDERS] Created ${created} reminder(s)`);
    }
    return created;
  } catch (error) {
    console.error('Departure reminder job failed:', error.message);
    return 0;
  }
}

function generateInvoicePDF(invoice, booking) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.fontSize(20).text('INVOICE', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12);
      doc.text(`Invoice No: ${invoice.invoiceNo || 'N/A'}`);
      doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`);
      doc.moveDown();
      doc.text(`Customer: ${booking.customer || 'N/A'}`);
      doc.text(`Email: ${invoice.email || 'N/A'}`);
      doc.moveDown();
      doc.text(`Package: ${invoice.package || 'N/A'}`);
      if (booking.originalAmount && booking.originalAmount !== invoice.amount) {
        doc.text(`Original Amount: ₹${booking.originalAmount.toLocaleString()}`);
      }
      doc.text(`Amount: ₹${invoice.amount || 0}`);
      if (booking.coupon && booking.discountAmount) {
        doc.text(`Coupon (${booking.coupon.code}): -₹${booking.discountAmount.toLocaleString()}`);
      }
      doc.text(`Status: ${invoice.status || 'paid'}`);
      doc.text(`Due Date: ${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-IN') : 'N/A'}`);
      doc.moveDown();
      doc.text('Thank you for your booking!');
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// Forgot Password Route â€” sends OTP to user email
app.post('/api/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found with this email' });
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    otpStore.set(email, { otp, expiresAt: Date.now() + 5 * 60 * 1000 });

    const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; background: #f8fafc;">
      <div style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); padding: 20px; border-radius: 10px; text-align: center; color: white; margin-bottom: 5px;">
        <h1 style="margin: 0; font-size: 24px;">TravelTour</h1>
        <p style="margin: 5px 0 0; font-size: 14px; opacity: 0.9;">Password Reset OTP</p>
      </div>
      <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <h2 style="color: #1e293b; margin-top: 0; font-size: 20px;">Reset Your Password</h2>
        <p style="color: #475569; line-height: 1.6; font-size: 15px;">Hello ${user.fullName || user.email},</p>
        <p style="color: #475569; line-height: 1.6; font-size: 14px; margin-bottom: 25px;">Enter the OTP below to reset your password. This code will expire in <strong>5 minutes</strong>.</p>
        <div style="background: #f1f5f9; border: 2px dashed #cbd5e1; border-radius: 8px; padding: 20px; text-align: center; margin: 25px 0;">
          <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #2563eb;">${otp}</span>
        </div>
        <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 25px;">This is an automated message. If you did not request this, please ignore.</p>
      </div>
      <div style="text-align: center; padding: 15px; color: #94a3b8; font-size: 12px;">
        Â© ${new Date().getFullYear()} TravelTour. All rights reserved.
      </div>
    </div>`;
    const brevoKey = process.env.BREVO_API_KEY;
    let emailOk = false;
    if (brevoKey) {
      try {
        await sendEmailViaBrevo(user.email, 'Password Reset OTP', html);
        emailOk = true;
      } catch (emailErr) {
        console.error('Email send error:', emailErr.message);
      }
    } else {
      console.error('[WARN] BREVO_API_KEY not set â€” OTP is: ' + otp);
    }

    console.log(`[FORGOT PASSWORD] OTP for ${email}: ${otp}`);
    if (!emailOk) {
      return res.status(200).json({
        message: 'OTP generated. Email not sent (Brevo misconfigured) â€” use this test OTP: ' + otp,
      });
    }
    res.status(200).json({ message: 'OTP sent to your email' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Server error during password reset request' });
  }
});

// Verify OTP Route
app.post('/api/verify-otp', (req, res) => {
  try {
    const { email, otp } = req.body;
    const record = otpStore.get(email);
    if (!record) {
      return res.status(400).json({ message: 'OTP not found or expired. Request a new one.' });
    }
    if (record.expiresAt < Date.now()) {
      otpStore.delete(email);
      return res.status(400).json({ message: 'OTP expired. Request a new one.' });
    }
    if (record.otp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }
    // The OTP is single-use: it is consumed as soon as it is verified.
    record.verifiedAt = Date.now();
    res.status(200).json({ message: 'OTP verified successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error during OTP verification' });
  }
});

// Reset Password Route
app.post('/api/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const record = otpStore.get(email);
    if (!record) {
      return res.status(400).json({ message: 'OTP not found or expired. Request a new one.' });
    }
    if (record.expiresAt < Date.now()) {
      otpStore.delete(email);
      return res.status(400).json({ message: 'OTP expired. Request a new one.' });
    }
    if (record.otp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }
    if (record.verifiedAt && Date.now() - record.verifiedAt > 10 * 60 * 1000) {
      otpStore.delete(email);
      return res.status(400).json({ message: 'OTP expired. Request a new one.' });
    }

    const strength = validatePasswordStrength(newPassword);
    if (!strength.valid) {
      return res.status(400).json({ message: strength.message });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.password = await bcrypt.hash(newPassword, 12);
    user.passwordChangedAt = new Date();
    await user.save();
    otpStore.delete(email);
    invalidateSecurityStateCache(user._id);
    // A reset means every existing session on the account is compromised.
    const revoked = await revokeAllSessions(user._id);

    res.status(200).json({ message: 'Password reset successfully', revokedSessions: revoked });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error during password reset' });
  }
});

// Get All Users Route (for debugging)
app.get('/api/users', authenticate, requireAdmin, async (req, res) => {
  try {
    const filter = {};
    const search = searchFilter(['fullName', 'email'], req.query.search);
    if (search) Object.assign(filter, search);
    const { docs, total, page, limit, totalPages, hasNext, hasPrev } = await findPage(User, filter, {
      query: req.query,
      select: '-password',
      defaultSort: { createdAt: -1 }
    });
    console.log('Total users in database:', total);
    console.log('Users:', JSON.stringify(docs, null, 2));
    pagedResponse(res, 'users', { docs, total, page, limit, totalPages, hasNext, hasPrev }, { count: total });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Server error fetching users' });
  }
});

app.use('/api/admin', authenticate, requireAdmin);

// Admin User Management Routes
app.get('/api/admin/users', async (req, res) => {
  try {
    const filter = {};
    if (req.query.role) filter.role = req.query.role;
    const search = searchFilter(['fullName', 'email'], req.query.search);
    if (search) Object.assign(filter, search);
    const { docs, total, page, limit, totalPages, hasNext, hasPrev } = await findPage(User, filter, {
      query: req.query,
      select: '-password',
      defaultSort: { createdAt: -1 }
    });
    const [byCustomer, byOperator, byHotel, byAdmin, active, inactive] = await Promise.all([
      User.countDocuments({ ...filter, role: 'customer' }),
      User.countDocuments({ ...filter, role: 'tour_operator' }),
      User.countDocuments({ ...filter, role: 'hotel_partner' }),
      User.countDocuments({ ...filter, role: 'admin' }),
      User.countDocuments({ ...filter, status: 'active' }),
      User.countDocuments({ ...filter, status: 'inactive' })
    ]);
    pagedResponse(res, 'users', { docs, total, page, limit, totalPages, hasNext, hasPrev }, {
      stats: {
        total,
        byRole: {
          customer: byCustomer,
          tour_operator: byOperator,
          hotel_partner: byHotel,
          admin: byAdmin
        },
        active,
        inactive
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching users' });
  }
});

app.post('/api/admin/users', async (req, res) => {
  try {
    const { fullName, email, phone, password, role } = req.body;

    const contactCheck = validateContactDetails({ fullName, email, phone });
    if (!contactCheck.valid) {
      return res.status(400).json({ message: contactCheck.message });
    }
    const strength = validatePasswordStrength(password);
    if (!strength.valid) {
      return res.status(400).json({ message: strength.message });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const newUser = new User({
      fullName,
      email: String(email).trim().toLowerCase(),
      phone,
      password: hashedPassword,
      role,
      passwordChangedAt: new Date()
    });
    await newUser.save();
    const safeUser = newUser.toObject();
    delete safeUser.password;
    res.status(201).json({ message: 'User created successfully', user: safeUser });
  } catch (error) {
    if (duplicateError(error)) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }
    res.status(500).json({ message: 'Error creating user' });
  }
});

app.put('/api/admin/users/:id', async (req, res) => {
  try {
    const updates = pickUpdates(req.body, ['fullName', 'email', 'phone', 'role', 'status']);
    if (updates.email) updates.email = String(updates.email).trim().toLowerCase();

    const contactCheck = validateContactDetails({
      fullName: updates.fullName,
      email: updates.email,
      phone: updates.phone
    });
    if (!contactCheck.valid) {
      return res.status(400).json({ message: contactCheck.message });
    }
    if (updates.email) {
      const existing = await User.findOne({ email: updates.email, _id: { $ne: req.params.id } });
      if (existing) {
        return res.status(400).json({ message: 'Email already in use' });
      }
    }
    if (req.body.password) {
      const strength = validatePasswordStrength(req.body.password);
      if (!strength.valid) {
        return res.status(400).json({ message: strength.message });
      }
      updates.password = await bcrypt.hash(req.body.password, 12);
      updates.passwordChangedAt = new Date();
    }
    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    invalidateSecurityStateCache(req.params.id);
    // A password set by an admin invalidates every existing session.
    if (updates.password) {
      await revokeAllSessions(user._id);
    }
    const safeUser = user.toObject();
    delete safeUser.password;
    res.status(200).json({ message: 'User updated successfully', user: safeUser });
  } catch (error) {
    res.status(500).json({ message: 'Error updating user' });
  }
});

app.delete('/api/admin/users/:id', async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting user' });
  }
});

// Hotel Partner Management Routes
app.get('/api/admin/hotel-partners', async (req, res) => {
  try {
    const filter = { role: 'hotel_partner' };
    const search = searchFilter(['fullName', 'email'], req.query.search);
    if (search) Object.assign(filter, search);
    const { docs, total, page, limit, totalPages, hasNext, hasPrev } = await findPage(User, filter, {
      query: req.query,
      select: '-password',
      defaultSort: { createdAt: -1 }
    });

    const partners = await Promise.all(docs.map(async (user) => {
      const profile = await HotelProfile.findOne({ userId: user._id });
      const hotelCount = await Hotel.countDocuments({ partner: user.fullName });
      return {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        status: user.status,
        createdAt: user.createdAt,
        profile: profile || {},
        hotelCount
      };
    }));

    const [active, inactive] = await Promise.all([
      User.countDocuments({ ...filter, status: 'active' }),
      User.countDocuments({ ...filter, status: 'inactive' })
    ]);

    pagedResponse(res, 'hotelPartners', { docs: partners, total, page, limit, totalPages, hasNext, hasPrev }, {
      stats: { total, active, inactive }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching hotel partners' });
  }
});

app.put('/api/admin/hotel-partners/:id/approve', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, select: '-password' }
    );
    if (!user) {
      return res.status(404).json({ message: 'Hotel partner not found' });
    }
    res.status(200).json({
      message: `Hotel partner ${status === 'active' ? 'approved' : 'rejected'} successfully`,
      user
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating hotel partner status' });
  }
});

// Support Ticket Administration Routes
app.get('/api/admin/tickets', async (req, res) => {
  try {
    const filter = {};
    const search = searchFilter(['ticketId', 'customerName', 'customerEmail', 'subject', 'description'], req.query.search);
    if (search) Object.assign(filter, search);
    if (req.query.status) filter.status = req.query.status;
    if (req.query.priority) filter.priority = req.query.priority;
    if (req.query.category) filter.category = req.query.category;
    if (req.query.assignedTo) filter.assignedTo = req.query.assignedTo;

    const { docs, total, page, limit, totalPages, hasNext, hasPrev } = await findPage(Ticket, filter, {
      query: req.query,
      select: '-__v',
      defaultSort: { createdAt: -1 }
    });

    const [open, inProgress, resolved, escalated, overdue] = await Promise.all([
      Ticket.countDocuments({ ...filter, status: 'open' }),
      Ticket.countDocuments({ ...filter, status: 'in_progress' }),
      Ticket.countDocuments({ ...filter, status: 'resolved' }),
      Ticket.countDocuments({ ...filter, status: 'escalated' }),
      Ticket.countDocuments({ ...filter, status: { $in: ['open', 'in_progress', 'escalated'] }, responseTarget: { $lt: new Date() } })
    ]);

    pagedResponse(res, 'tickets', { docs, total, page, limit, totalPages, hasNext, hasPrev }, {
      stats: { total, open, inProgress, resolved, escalated, overdue }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching tickets' });
  }
});

app.get('/api/admin/tickets/stats', async (req, res) => {
  try {
    const [total, byStatus, byPriority, byCategory] = await Promise.all([
      Ticket.countDocuments(),
      Ticket.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Ticket.aggregate([{ $group: { _id: '$priority', count: { $sum: 1 } } }]),
      Ticket.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }])
    ]);
    res.status(200).json({
      total,
      byStatus: byStatus.reduce((acc, { _id, count }) => { acc[_id] = count; return acc; }, {}),
      byPriority: byPriority.reduce((acc, { _id, count }) => { acc[_id] = count; return acc; }, {}),
      byCategory: byCategory.reduce((acc, { _id, count }) => { acc[_id] = count; return acc; }, {})
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching ticket stats' });
  }
});

app.get('/api/admin/tickets/:id', async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id).populate('assignedTo', 'fullName email role');
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    res.status(200).json({ ticket });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching ticket' });
  }
});

app.post('/api/admin/tickets', async (req, res) => {
  try {
    const { customerName, customerEmail, subject, description, category, priority, assignedTo, tags } = req.body;
    if (!customerName || !customerEmail || !subject || !description) {
      return res.status(400).json({ message: 'Customer name, email, subject and description are required' });
    }

    const ticketCount = await Ticket.countDocuments();
    const ticketId = `TKT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(ticketCount + 1).padStart(4, '0')}`;
    const responseTarget = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const customerUser = await User.findOne({ email: customerEmail }).select('_id').lean();
    const customerId = customerUser ? customerUser._id : undefined;

    const ticket = new Ticket({
      ticketId,
      customerId,
      customerName,
      customerEmail,
      subject,
      description,
      category: category || 'general',
      priority: priority || 'medium',
      status: 'open',
      assignedTo: assignedTo || null,
      responseTarget,
      tags: Array.isArray(tags) ? tags : [],
      messages: [{
        senderName: customerName,
        senderRole: 'customer',
        message: description,
        createdAt: new Date()
      }]
    });
    await ticket.save();

    res.status(201).json({ message: 'Ticket created successfully', ticket });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Ticket ID already exists' });
    }
    res.status(500).json({ message: 'Error creating ticket' });
  }
});

app.put('/api/admin/tickets/:id', async (req, res) => {
  try {
    const updates = pickUpdates(req.body, ['status', 'priority', 'category', 'assignedTo', 'assignedToName', 'tags', 'satisfactionRating', 'feedback']);
    if (updates.status === 'resolved' && !req.body._skip_resolved_at) {
      updates.resolvedAt = new Date();
    }
    if (updates.status === 'escalated') {
      updates.escalationCount = (req.body.escalationCount || 0) + 1;
    }
    updates.updatedAt = new Date();

    const ticket = await Ticket.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    res.status(200).json({ message: 'Ticket updated successfully', ticket });
  } catch (error) {
    res.status(500).json({ message: 'Error updating ticket' });
  }
});

app.post('/api/admin/tickets/:id/messages', async (req, res) => {
  try {
    const { senderName, senderRole, message, isInternal } = req.body;
    if (!senderName || !senderRole || !message) {
      return res.status(400).json({ message: 'senderName, senderRole and message are required' });
    }

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    ticket.messages.push({
      senderName,
      senderRole,
      message,
      isInternal: isInternal === true,
      createdAt: new Date()
    });

    if (senderRole === 'admin' && ticket.status === 'open') {
      ticket.firstResponseAt = new Date();
      ticket.status = 'in_progress';
    }
    ticket.updatedAt = new Date();
    await ticket.save();

    // Notify the customer when an admin sends a reply
    if (senderRole === 'admin' && ticket.customerId) {
      try {
        await createNotification({
          userId: ticket.customerId,
          type: 'ticket_reply',
          title: `New reply on ticket #${ticket.ticketId}`,
          message: `Your support ticket "${ticket.subject}" has a new reply.`,
          relatedId: ticket._id,
          bookingId: undefined,
          severity: 'info',
          actionUrl: '/customer/support',
          dedupeKey: `ticket_reply_${ticket._id}_${Date.now()}`,
          email: true,
          emailSubject: `New reply on your support ticket #${ticket.ticketId}`
        });
      } catch (notifyErr) {
        console.error('Ticket reply notification failed:', notifyErr.message);
      }
    }

    res.status(200).json({ message: 'Message added successfully', ticket });
  } catch (error) {
    res.status(500).json({ message: 'Error adding message' });
  }
});

app.delete('/api/admin/tickets/:id', async (req, res) => {
  try {
    const ticket = await Ticket.findByIdAndDelete(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    res.status(200).json({ message: 'Ticket deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting ticket' });
  }
});

// Operator Management Routes
app.get('/api/admin/operators', async (req, res) => {
  try {
    const filter = { role: 'tour_operator' };
    const search = searchFilter(['fullName', 'email', 'companyName'], req.query.search);
    if (search) Object.assign(filter, search);
    const { docs, total, page, limit, totalPages, hasNext, hasPrev } = await findPage(User, filter, {
      query: req.query,
      select: '-password',
      defaultSort: { createdAt: -1 }
    });
    const [active, inactive] = await Promise.all([
      User.countDocuments({ ...filter, status: 'active' }),
      User.countDocuments({ ...filter, status: 'inactive' })
    ]);
    pagedResponse(res, 'users', { docs, total, page, limit, totalPages, hasNext, hasPrev }, {
      stats: { total, active, inactive }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching operators' });
  }
});

app.get('/api/admin/operators/:id', async (req, res) => {
  try {
    const operator = await User.findById(req.params.id).select('-password');
    if (!operator || operator.role !== 'tour_operator') {
      return res.status(404).json({ message: 'Operator not found' });
    }
    const profile = await OperatorProfile.findOne({ userId: req.params.id });
    const [packages, bookings, reviews] = await Promise.all([
      Package.countDocuments({ operatorId: req.params.id }),
      Booking.countDocuments({ operatorId: req.params.id }),
      Review.countDocuments({ operatorId: req.params.id })
    ]);
    const revenueAgg = await Booking.aggregate([
      { $match: { operatorId: new mongoose.Types.ObjectId(req.params.id) } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]);
    const revenue = revenueAgg[0]?.total || 0;
    const bookingCount = revenueAgg[0]?.count || 0;
    res.status(200).json({
      operator,
      profile: profile || {},
      stats: {
        packages,
        bookings: bookingCount,
        reviews,
        revenue,
        totalBookings: bookings
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching operator details' });
  }
});

app.put('/api/admin/operators/:id', async (req, res) => {
  try {
    const { fullName, email, phone, status, commissionRate, commissionType, verificationStatus } = req.body;
    const userUpdates = pickUpdates(req.body, ['fullName', 'email', 'phone', 'status']);
    if (userUpdates.email) userUpdates.email = String(userUpdates.email).trim().toLowerCase();

    const contactCheck = validateContactDetails({
      fullName: userUpdates.fullName,
      email: userUpdates.email,
      phone: userUpdates.phone
    });
    if (!contactCheck.valid) {
      return res.status(400).json({ message: contactCheck.message });
    }
    if (userUpdates.email) {
      const existing = await User.findOne({ email: userUpdates.email, _id: { $ne: req.params.id } });
      if (existing) {
        return res.status(400).json({ message: 'Email already in use' });
      }
    }

    const operator = await User.findById(req.params.id);
    if (!operator || operator.role !== 'tour_operator') {
      return res.status(404).json({ message: 'Operator not found' });
    }

    if (userUpdates.status && userUpdates.status !== operator.status) {
      if (userUpdates.status === 'inactive') {
        await revokeAllSessions(operator._id);
      }
    }

    const updatedOperator = await User.findByIdAndUpdate(req.params.id, userUpdates, { new: true, runValidators: true }).select('-password');

    const profileUpdates = {};
    if (commissionRate !== undefined) profileUpdates.commissionRate = Number(commissionRate);
    if (commissionType !== undefined) profileUpdates.commissionType = commissionType;
    if (verificationStatus !== undefined) profileUpdates.verificationStatus = verificationStatus;
    if (Object.keys(profileUpdates).length > 0) {
      profileUpdates.updatedAt = new Date();
      await OperatorProfile.findOneAndUpdate(
        { userId: req.params.id },
        profileUpdates,
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
    }

    res.status(200).json({ message: 'Operator updated successfully', operator: updatedOperator });
  } catch (error) {
    res.status(500).json({ message: 'Error updating operator' });
  }
});

app.delete('/api/admin/operators/:id', async (req, res) => {
  try {
    const operator = await User.findById(req.params.id);
    if (!operator || operator.role !== 'tour_operator') {
      return res.status(404).json({ message: 'Operator not found' });
    }
    await User.findByIdAndDelete(req.params.id);
    await OperatorProfile.deleteOne({ userId: req.params.id });
    res.status(200).json({ message: 'Operator deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting operator' });
  }
});

// Package Management Routes
app.get('/api/admin/packages', async (req, res) => {
  try {
    const filter = {};
    const search = searchFilter(['name', 'destination', 'category'], req.query.search);
    if (search) Object.assign(filter, search);
    const { docs, total, page, limit, totalPages, hasNext, hasPrev } = await findPage(Package, filter, {
      query: req.query,
      defaultSort: { createdAt: -1 }
    });
    const [published, draft] = await Promise.all([
      Package.countDocuments({ ...filter, publishedStatus: 'published' }),
      Package.countDocuments({ ...filter, publishedStatus: 'draft' })
    ]);
    pagedResponse(res, 'packages', { docs, total, page, limit, totalPages, hasNext, hasPrev }, {
      stats: { total, published, draft }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching packages' });
  }
});

app.post('/api/admin/packages', async (req, res) => {
  try {
    const newPackage = new Package({ ...req.body, operatorId: req.body.operatorId || req.user.userId });
    await newPackage.save();
    console.log('Package created with _id:', newPackage._id);
    res.status(201).json({ message: 'Package created successfully', package: newPackage });
  } catch (error) {
    console.error('Error creating package:', error);
    res.status(500).json({ message: 'Error creating package', error: error.message });
  }
});

app.put('/api/admin/packages/:id', async (req, res) => {
  try {
    const updates = pickUpdates(req.body, ['name', 'destination', 'duration', 'price', 'rating', 'bookings', 'status', 'description', 'inclusions', 'image', 'cancellationPolicy', 'images', 'category', 'shortDescription', 'highlights', 'exclusions', 'terms', 'pickupInfo', 'startingLocation', 'transportType', 'minTravelers', 'maxTravelers', 'publishedStatus']);
    console.log('PUT package id:', req.params.id, 'updates:', updates);
    const pkg = await Package.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!pkg) {
      console.error('Package not found, id:', req.params.id);
      return res.status(404).json({ message: 'Package not found', id: req.params.id });
    }
    res.status(200).json({ message: 'Package updated successfully', package: pkg });
  } catch (error) {
    console.error('Error updating package:', error);
    res.status(500).json({ message: 'Error updating package', error: error.message });
  }
});

app.delete('/api/admin/packages/:id', async (req, res) => {
  try {
    await Package.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Package deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting package' });
  }
});

// --- Itinerary builder helpers ---------------------------------------------
// The builder sends a rich day structure: activities with timestamps, hotel
// details and transport legs. Older clients still send flat strings, so every
// incoming day is normalised into the shape the schema expects. Keeping the
// two forms interchangeable also stops Mongoose from failing a save with a
// cast error when a plain string is posted for an object field.

const ITINERARY_ACTIVITY_TYPES = ['activity', 'meal', 'transport', 'hotel', 'sightseeing', 'other'];

function cleanText(value, maxLength = 500) {
  if (value === undefined || value === null) return '';
  return String(value).trim().slice(0, maxLength);
}

// Accepts "9:30" and "09:30" and always returns "HH:MM"; anything that is
// not a valid 24 hour time becomes an empty string.
function normalizeTime(value) {
  const match = cleanText(value, 10).match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return '';
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return '';
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function normalizeActivities(value) {
  const list = Array.isArray(value) ? value : (typeof value === 'string' ? value.split(',') : []);

  const activities = list.map(entry => {
    if (typeof entry === 'string') {
      const text = cleanText(entry, 200);
      if (!text) return null;
      // "09:00 - Sightseeing" keeps the time that was written inline.
      const timed = text.match(/^(\d{1,2}:\d{2})\s*[-–—]\s*(.+)$/);
      if (timed) {
        return {
          time: normalizeTime(timed[1]),
          name: cleanText(timed[2], 120),
          description: '',
          location: '',
          type: 'activity'
        };
      }
      return { time: '', name: cleanText(text, 120), description: '', location: '', type: 'activity' };
    }

    if (!entry || typeof entry !== 'object') return null;
    const name = cleanText(entry.name || entry.title || entry.description, 120);
    if (!name) return null;
    return {
      time: normalizeTime(entry.time),
      name,
      description: cleanText(entry.description, 500),
      location: cleanText(entry.location, 200),
      type: ITINERARY_ACTIVITY_TYPES.includes(entry.type) ? entry.type : 'activity'
    };
  }).filter(Boolean);

  // Timed activities come first in clock order, untimed ones keep their order
  // and sit at the end of the day.
  return activities.sort((a, b) => {
    if (!a.time && !b.time) return 0;
    if (!a.time) return 1;
    if (!b.time) return -1;
    return a.time.localeCompare(b.time);
  });
}

function normalizeAccommodation(value) {
  if (!value) return undefined;
  if (typeof value === 'string') {
    const name = cleanText(value, 200);
    return name ? { name } : undefined;
  }
  if (typeof value !== 'object') return undefined;

  return {
    name: cleanText(value.name || value.hotelName, 200),
    hotelName: cleanText(value.hotelName, 200),
    checkInTime: normalizeTime(value.checkInTime),
    checkOutTime: normalizeTime(value.checkOutTime),
    roomType: cleanText(value.roomType, 100),
    location: cleanText(value.location || value.address, 250),
    notes: cleanText(value.notes, 500)
  };
}

function normalizeTransportation(value) {
  if (!value) return undefined;
  if (typeof value === 'string') {
    const mode = cleanText(value, 200);
    return mode ? { mode } : undefined;
  }
  if (typeof value !== 'object') return undefined;

  return {
    mode: cleanText(value.mode, 100),
    vehicle: cleanText(value.vehicle, 120),
    departureTime: normalizeTime(value.departureTime),
    arrivalTime: normalizeTime(value.arrivalTime),
    departureLocation: cleanText(value.departureLocation, 250),
    arrivalLocation: cleanText(value.arrivalLocation, 250),
    details: cleanText(value.details, 500)
  };
}

function normalizeTransportLegs(value) {
  const list = Array.isArray(value) ? value : [];
  return list.map(leg => ({
    time: normalizeTime(leg?.time),
    mode: cleanText(leg?.mode, 100),
    from: cleanText(leg?.from, 250),
    to: cleanText(leg?.to, 250),
    details: cleanText(leg?.details, 500)
  })).filter(leg => leg.time || leg.mode || leg.from || leg.to);
}

function normalizeItineraryDay(day, index) {
  const source = day && typeof day === 'object' ? day : {};

  const normalized = {
    dayNumber: index + 1,
    title: cleanText(source.title, 160),
    description: cleanText(source.description, 1000),
    location: cleanText(source.location, 250),
    notes: cleanText(source.notes, 1000),
    meals: (Array.isArray(source.meals)
      ? source.meals
      : (typeof source.meals === 'string' ? source.meals.split(',') : [])
    ).map(meal => cleanText(meal, 60)).filter(Boolean),
    activities: normalizeActivities(source.activities),
    images: (Array.isArray(source.images) ? source.images : [])
      .map(image => cleanText(image, 500))
      .filter(Boolean)
  };

  if (source.date) {
    const date = new Date(source.date);
    if (!Number.isNaN(date.getTime())) normalized.date = date;
  }

  const accommodation = normalizeAccommodation(source.accommodation);
  if (accommodation) normalized.accommodation = accommodation;

  const hotel = normalizeAccommodation(source.hotel);
  if (hotel) normalized.hotel = hotel;

  const transportation = normalizeTransportation(source.transportation);
  if (transportation) normalized.transportation = transportation;

  const transport = normalizeTransportLegs(source.transport);
  if (transport.length) normalized.transport = transport;

  return normalized;
}

// Turns a builder payload into the document shape, keeping the day count and
// the hotel count in step with the days that were actually submitted.
function normalizeItineraryPayload(body = {}) {
  const source = body && typeof body === 'object' ? body : {};
  const days = Array.isArray(source.dayDetails) ? source.dayDetails : [];
  const dayDetails = days.map(normalizeItineraryDay);

  const payload = {
    name: cleanText(source.name, 160),
    packageName: cleanText(source.packageName, 160),
    days: Math.max(1, dayDetails.length),
    status: source.status === 'inactive' ? 'inactive' : 'active',
    dayDetails,
    hotels: dayDetails.filter(day => day.accommodation?.name || day.hotel?.name).length
  };

  const highlights = Array.isArray(source.highlights)
    ? source.highlights.map(item => cleanText(item, 160)).filter(Boolean)
    : [];
  if (highlights.length) payload.highlights = highlights;

  return payload;
}

// Itinerary Management Routes
app.get('/api/admin/itineraries', async (req, res) => {
  try {
    const filter = {};
    const search = searchFilter(['name', 'packageName'], req.query.search);
    if (search) Object.assign(filter, search);
    const { docs, total, page, limit, totalPages, hasNext, hasPrev } = await findPage(Itinerary, filter, {
      query: req.query,
      defaultSort: { createdAt: -1 }
    });
    pagedResponse(res, 'itineraries', { docs, total, page, limit, totalPages, hasNext, hasPrev }, {
      stats: { total }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching itineraries' });
  }
});

// A single itinerary, so the builder can load the days it has to edit.
app.get('/api/admin/itineraries/:id', async (req, res) => {
  try {
    const itinerary = await Itinerary.findById(req.params.id);
    if (!itinerary) {
      return res.status(404).json({ message: 'Itinerary not found' });
    }
    res.status(200).json({ itinerary });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching itinerary' });
  }
});

app.post('/api/admin/itineraries', async (req, res) => {
  try {
    const payload = normalizeItineraryPayload(req.body);
    if (!payload.name) {
      return res.status(400).json({ message: 'Itinerary name is required' });
    }
    if (req.body.packageId) {
      payload.packageId = req.body.packageId;
    } else if (payload.packageName) {
      const pkg = await Package.findOne({ name: payload.packageName });
      if (pkg) payload.packageId = pkg._id;
    }
    if (!payload.packageId) {
      return res.status(400).json({ message: 'Select a package for this itinerary' });
    }
    const newItinerary = new Itinerary(payload);
    await newItinerary.save();
    res.status(201).json({ message: 'Itinerary created successfully', itinerary: newItinerary });
  } catch (error) {
    console.error('Error creating itinerary:', error.message);
    res.status(500).json({ message: 'Error creating itinerary' });
  }
});

app.put('/api/admin/itineraries/:id', async (req, res) => {
  try {
    const updates = normalizeItineraryPayload(req.body);
    if (req.body.packageId) {
      updates.packageId = req.body.packageId;
    } else if (updates.packageName) {
      const pkg = await Package.findOne({ name: updates.packageName });
      if (pkg) updates.packageId = pkg._id;
    }
    if (updates.packageId) {
      const pkg = await Package.findById(updates.packageId).select('name');
      if (pkg && !updates.packageName) updates.packageName = pkg.name;
    }
    const itinerary = await Itinerary.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!itinerary) {
      return res.status(404).json({ message: 'Itinerary not found' });
    }
    // Notify customers with bookings for this package about itinerary changes
    try {
      if (itinerary.packageId) {
        const bookings = await Booking.find({ packageId: itinerary.packageId, status: { $in: ['pending', 'confirmed'] } })
          .select('customerId package');
        const seen = new Set();
        for (const booking of bookings) {
          if (!booking.customerId) continue;
          const customerId = String(booking.customerId);
          if (seen.has(customerId)) continue;
          seen.add(customerId);
          await createNotification({
            userId: customerId,
            type: 'itinerary_change',
            title: 'Itinerary Updated',
            message: `The itinerary for ${itinerary.packageName || booking.package || 'your package'} has been updated. Please check your travel plan.`,
            relatedId: itinerary._id,
            bookingId: booking._id,
            severity: 'warning',
            actionUrl: `/customer/bookings/${booking._id}/tracker`,
            emailSubject: 'Your itinerary has been updated'
          });
        }
      }
    } catch (e) {
      console.error('Failed to notify customers of itinerary change:', e.message);
    }
    res.status(200).json({ message: 'Itinerary updated successfully', itinerary });
  } catch (error) {
    res.status(500).json({ message: 'Error updating itinerary' });
  }
});

app.delete('/api/admin/itineraries/:id', async (req, res) => {
  try {
    await Itinerary.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Itinerary deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting itinerary' });
  }
});

// Hotel Management Routes
app.get('/api/admin/hotels', async (req, res) => {
  try {
    const filter = {};
    const search = searchFilter(['name', 'location', 'partner'], req.query.search);
    if (search) Object.assign(filter, search);
    const { docs, total, page, limit, totalPages, hasNext, hasPrev } = await findPage(Hotel, filter, {
      query: req.query,
      defaultSort: { createdAt: -1 }
    });
    pagedResponse(res, 'hotels', { docs, total, page, limit, totalPages, hasNext, hasPrev });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching hotels' });
  }
});

app.post('/api/admin/hotels', async (req, res) => {
  try {
    const newHotel = new Hotel(req.body);
    await newHotel.save();
    res.status(201).json({ message: 'Hotel created successfully', hotel: newHotel });
  } catch (error) {
    res.status(500).json({ message: 'Error creating hotel' });
  }
});

app.put('/api/admin/hotels/:id', async (req, res) => {
  try {
    const updates = pickUpdates(req.body, ['name', 'location', 'rooms', 'rating', 'partner', 'status', 'cancellationPolicy']);
    const hotel = await Hotel.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!hotel) {
      return res.status(404).json({ message: 'Hotel not found' });
    }
    res.status(200).json({ message: 'Hotel updated successfully', hotel });
  } catch (error) {
    res.status(500).json({ message: 'Error updating hotel' });
  }
});

app.delete('/api/admin/hotels/:id', async (req, res) => {
  try {
    await Hotel.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Hotel deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting hotel' });
  }
});

// Room Management Routes
app.get('/api/admin/rooms', async (req, res) => {
  try {
    const filter = {};
    const search = searchFilter(['hotel', 'type'], req.query.search);
    if (search) Object.assign(filter, search);
    const { docs, total, page, limit, totalPages, hasNext, hasPrev } = await findPage(Room, filter, {
      query: req.query,
      defaultSort: { createdAt: -1 }
    });
    const available = await Room.countDocuments({ ...filter, status: 'active' });
    const maintenance = await Room.countDocuments({ ...filter, status: 'inactive' });
    pagedResponse(res, 'rooms', { docs, total, page, limit, totalPages, hasNext, hasPrev }, {
      stats: { total, available, occupied: Math.max(0, total - available - maintenance), maintenance }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching rooms' });
  }
});

app.post('/api/admin/rooms', async (req, res) => {
  try {
    const newRoom = new Room(req.body);
    await newRoom.save();
    res.status(201).json({ message: 'Room created successfully', room: newRoom });
  } catch (error) {
    res.status(500).json({ message: 'Error creating room' });
  }
});

app.put('/api/admin/rooms/:id', async (req, res) => {
  try {
    const updates = pickUpdates(req.body, ['hotel', 'type', 'total', 'available', 'booked', 'price', 'status']);
    const room = await Room.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }
    res.status(200).json({ message: 'Room updated successfully', room });
  } catch (error) {
    res.status(500).json({ message: 'Error updating room' });
  }
});

app.delete('/api/admin/rooms/:id', async (req, res) => {
  try {
    await Room.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Room deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting room' });
  }
});

// Booking Management Routes
app.get('/api/admin/bookings', async (req, res) => {
  try {
    const filter = {};
    const search = searchFilter(['bookingId', 'customer', 'package', 'email'], req.query.search);
    if (search) Object.assign(filter, search);
    if (req.query.operatorId) filter.operatorId = req.query.operatorId;
    if (req.query.status) filter.status = req.query.status;
    const { docs, total, page, limit, totalPages, hasNext, hasPrev } = await findPage(Booking, filter, {
      query: req.query,
      defaultSort: { bookingDate: -1 }
    });
    const byStatusAgg = await Booking.aggregate([
      { $match: filter },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const byPaymentAgg = await Booking.aggregate([
      { $match: filter },
      { $group: { _id: '$paymentStatus', count: { $sum: 1 } } }
    ]);
    const revenueAgg = await Booking.aggregate([
      { $match: { ...filter, paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const byStatus = {};
    for (const row of byStatusAgg) byStatus[row._id || 'unknown'] = row.count;
    const byPaymentStatus = {};
    for (const row of byPaymentAgg) byPaymentStatus[row._id || 'unknown'] = row.count;
    pagedResponse(res, 'bookings', { docs, total, page, limit, totalPages, hasNext, hasPrev }, {
      stats: {
        total,
        byStatus,
        byPaymentStatus,
        totalRevenue: revenueAgg[0]?.total || 0
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching bookings' });
  }
});

app.post('/api/admin/bookings', async (req, res) => {
  try {
    const payload = { ...req.body };
    if (payload.paymentStatus === 'paid' && !payload.status) {
      payload.status = 'confirmed';
    }
    const newBooking = new Booking(payload);
    await newBooking.save();
    if (newBooking.package) {
      await Package.findOneAndUpdate({ name: newBooking.package }, { $inc: { bookings: 1 } });
    }
    if (newBooking.paymentStatus === 'paid') {
      await createPaidInvoice(newBooking);
    }
    res.status(201).json({ message: 'Booking created successfully', booking: newBooking });
  } catch (error) {
    res.status(500).json({ message: 'Error creating booking' });
  }
});

app.put('/api/admin/bookings/:id', async (req, res) => {
  try {
    const updates = pickUpdates(req.body, ['customer', 'email', 'package', 'dates', 'amount', 'status', 'paymentStatus']);
    if (updates.paymentStatus === 'paid' && !updates.status) {
      updates.status = 'confirmed';
    }
    const prev = await Booking.findById(req.params.id);
    const booking = await Booking.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (booking && prev && updates.status && updates.status !== prev.status) {
      booking.timeline = booking.timeline || [];
      booking.timeline.push({ status: updates.status, date: new Date(), note: 'Status updated by admin' });
      await booking.save();
    }
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
     if (booking.paymentStatus === 'paid') {
      const invoice = await createPaidInvoice(booking);
      if (booking.email) {
        const pdfBuffer = await generateInvoicePDF(invoice, booking);
        await sendCardEmailWithAttachment(
          booking.email,
          'Booking Confirmed & Invoice',
          'Booking Confirmed!',
          `Your booking <strong>${booking.bookingId}</strong> has been confirmed by the admin. Invoice: ${invoice.invoiceNo || 'N/A'}.`,
          [{ name: `invoice_${invoice.invoiceNo || 'invoice'}.pdf`, content: pdfBuffer }]
        ).catch(err => console.error('Admin invoice email failed:', err.message));
      }
    }
    res.status(200).json({ message: 'Booking updated successfully', booking });
  } catch (error) {
    res.status(500).json({ message: 'Error updating booking' });
  }
});

app.delete('/api/admin/bookings/:id', async (req, res) => {
  try {
    await Booking.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Booking deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting booking' });
  }
});

// Invoice Management Routes
app.get('/api/admin/invoices', async (req, res) => {
  try {
    const filter = {};
    const search = searchFilter(['invoiceNo', 'customer', 'email'], req.query.search);
    if (search) Object.assign(filter, search);
    const { docs, total, page, limit, totalPages, hasNext, hasPrev } = await findPage(Invoice, filter, {
      query: req.query,
      defaultSort: { date: -1 }
    });
    const [amountAgg, byStatusAgg] = await Promise.all([
      Invoice.aggregate([
        { $match: filter },
        { $group: { _id: null, totalAmount: { $sum: '$amount' } } }
      ]),
      Invoice.aggregate([
        { $match: filter },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ])
    ]);
    const byStatus = {};
    for (const row of byStatusAgg) byStatus[row._id || 'unknown'] = row.count;
    pagedResponse(res, 'invoices', { docs, total, page, limit, totalPages, hasNext, hasPrev }, {
      stats: {
        total,
        totalAmount: amountAgg[0]?.totalAmount || 0,
        byStatus
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching invoices' });
  }
});

app.post('/api/admin/invoices', async (req, res) => {
  try {
    const payload = { ...req.body };
    if (!payload.invoiceNo) {
      payload.invoiceNo = await nextInvoiceNo();
    }
    const newInvoice = new Invoice(payload);
    await newInvoice.save();
    res.status(201).json({ message: 'Invoice created successfully', invoice: newInvoice });
  } catch (error) {
    if (duplicateError(error)) {
      return res.status(400).json({ message: 'Invoice number already exists' });
    }
    res.status(500).json({ message: 'Error creating invoice' });
  }
});

app.put('/api/admin/invoices/:id', async (req, res) => {
  try {
    const updates = pickUpdates(req.body, ['invoiceNo', 'customer', 'email', 'package', 'amount', 'status', 'date', 'dueDate']);
    const invoice = await Invoice.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }
    res.status(200).json({ message: 'Invoice updated successfully', invoice });
  } catch (error) {
    res.status(500).json({ message: 'Error updating invoice' });
  }
});

app.delete('/api/admin/invoices/:id', async (req, res) => {
  try {
    await Invoice.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Invoice deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting invoice' });
  }
});

// Refund Management Routes
app.get('/api/admin/refunds', async (req, res) => {
  try {
    const filter = {};
    const search = searchFilter(['bookingId', 'customer', 'package', 'email'], req.query.search);
    if (search) Object.assign(filter, search);
    if (req.query.refundStatus) filter['refund.status'] = req.query.refundStatus;
    if (req.query.paymentStatus) filter.paymentStatus = req.query.paymentStatus;
    if (req.query.operatorId) filter.operatorId = req.query.operatorId;
    const hasRefund = { $or: [{ 'refund.status': { $ne: 'not_applicable' } }, { paymentStatus: { $in: ['refunded', 'failed'] } }] };
    let finalFilter = filter;
    if (Object.keys(filter).length > 0) {
      finalFilter = { $and: [hasRefund, filter] };
    } else {
      finalFilter = { ...hasRefund };
    }
    const { docs, total, page, limit, totalPages, hasNext, hasPrev } = await findPage(Booking, finalFilter, { query: req.query, defaultSort: { bookingDate: -1 } });
    const [pendingRefunds, completedRefunds, failedRefunds, refundedAmount] = await Promise.all([
      Booking.countDocuments({ ...filter, 'refund.status': 'pending' }),
      Booking.countDocuments({ ...filter, 'refund.status': 'completed' }),
      Booking.countDocuments({ ...filter, 'refund.status': 'failed' }),
      Booking.aggregate([{ $match: { ...filter, paymentStatus: 'refunded' } }, { $group: { _id: null, total: { $sum: '$amount' } } }])
    ]);
    pagedResponse(res, 'refunds', { docs, total, page, limit, totalPages, hasNext, hasPrev }, { stats: { pendingRefunds, completedRefunds, failedRefunds, refundedAmount: refundedAmount[0]?.total || 0 } });
  } catch (error) {
    console.error('Error fetching refunds:', error);
    res.status(500).json({ message: 'Error fetching refund requests' });
  }
});

app.get('/api/admin/refunds/reconcile', async (req, res) => {
  try {
    const pendingRefunds = await Booking.find({ 'refund.status': 'pending', 'refund.amount': { $gt: 0 } }).select('bookingId customer email amount refund paidAmount bookingDate');
    const refundedIncomplete = await Booking.find({ paymentStatus: 'refunded', 'refund.status': { $ne: 'completed' } }).select('bookingId customer email amount refund paidAmount');
    const failedRefunds = await Booking.find({ 'refund.status': 'failed' }).select('bookingId customer email amount refund paidAmount');
    const amountMismatches = await Booking.find({ 'refund.status': { $ne: 'not_applicable' }, $expr: { $gt: ['$refund.amount', '$paidAmount'] } }).select('bookingId customer email amount refund paidAmount');
    res.status(200).json({ pendingRefunds: { count: pendingRefunds.length, items: pendingRefunds }, refundedIncomplete: { count: refundedIncomplete.length, items: refundedIncomplete }, failedRefunds: { count: failedRefunds.length, items: failedRefunds }, amountMismatches: { count: amountMismatches.length, items: amountMismatches } });
  } catch (error) {
    console.error('Error reconciling refunds:', error);
    res.status(500).json({ message: 'Error reconciling refund records' });
  }
});

app.get('/api/admin/refunds/:id', async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    res.status(200).json({ booking });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching refund details' });
  }
});

app.put('/api/admin/refunds/:id/process', async (req, res) => {
  try {
    const { transactionId, notes } = req.body || {};
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (!booking.refund || booking.refund.status === 'not_applicable') return res.status(400).json({ message: 'No refund applicable for this booking' });
    booking.refund.status = 'completed';
    booking.refund.processedAt = new Date();
    booking.refund.transactionId = transactionId || null;
    if (notes) { booking.timeline = booking.timeline || []; booking.timeline.push({ status: 'refund_completed', date: new Date(), note: notes }); }
    booking.paymentStatus = 'refunded';
    booking.status = 'cancelled';
    await booking.save();
    await createNotification({ userId: booking.customerId, type: 'payment', title: 'Refund Processed', message: `Your refund of ₹${booking.refund.amount.toLocaleString()} for booking ${booking.bookingId} has been processed.`, bookingId: booking._id, relatedId: booking._id, severity: 'info' });
    res.status(200).json({ message: 'Refund processed successfully', booking });
  } catch (error) {
    console.error('Error processing refund:', error);
    res.status(500).json({ message: 'Error processing refund' });
  }
});

app.put('/api/admin/refunds/:id/reject', async (req, res) => {
  try {
    const { reason, notes } = req.body || {};
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (!booking.refund || booking.refund.status === 'not_applicable') return res.status(400).json({ message: 'No refund applicable for this booking' });
    booking.refund.status = 'failed';
    booking.refund.processedAt = new Date();
    booking.paymentStatus = 'failed';
    if (notes) { booking.timeline = booking.timeline || []; booking.timeline.push({ status: 'refund_rejected', date: new Date(), note: notes || reason || 'Refund rejected by admin' }); }
    await booking.save();
    await createNotification({ userId: booking.customerId, type: 'payment', title: 'Refund Declined', message: `Your refund request for booking ${booking.bookingId} has been declined. Reason: ${reason || 'Not specified'}`, bookingId: booking._id, relatedId: booking._id, severity: 'warning' });
    res.status(200).json({ message: 'Refund rejected', booking });
  } catch (error) {
    console.error('Error rejecting refund:', error);
    res.status(500).json({ message: 'Error rejecting refund' });
  }
});

// Review Management Routes
app.get('/api/admin/reviews', async (req, res) => {
  try {
    const filter = {};
    const search = searchFilter(['customer', 'comment', 'package'], req.query.search);
    if (search) Object.assign(filter, search);
    const { docs, total, page, limit, totalPages, hasNext, hasPrev } = await findPage(Review, filter, {
      query: req.query,
      defaultSort: { date: -1 }
    });
    const ratingAgg = await Review.aggregate([
      { $match: filter },
      { $group: { _id: null, averageRating: { $avg: '$rating' } } }
    ]);
    pagedResponse(res, 'reviews', { docs, total, page, limit, totalPages, hasNext, hasPrev }, {
      stats: {
        total,
        averageRating: ratingAgg[0]?.averageRating
          ? Math.round(ratingAgg[0].averageRating * 10) / 10
          : 0
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching reviews' });
  }
});

app.post('/api/admin/reviews', async (req, res) => {
  try {
    const payload = { ...req.body };
    if (!payload.status) payload.status = 'approved';
    const newReview = new Review(payload);
    await newReview.save();
    if (newReview.status === 'approved') {
      await refreshPackageRating(newReview.package);
    }
    res.status(201).json({ message: 'Review created successfully', review: newReview });
  } catch (error) {
    res.status(500).json({ message: 'Error creating review' });
  }
});

app.put('/api/admin/reviews/:id', async (req, res) => {
  try {
    const updates = pickUpdates(req.body, ['customer', 'package', 'rating', 'comment', 'status']);
    const review = await Review.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }
    await refreshPackageRating(review.package);
    if (updates.status && (updates.status === 'approved' || updates.status === 'rejected')) {
      await Notification.create({
        userId: review.customerId,
        type: 'review',
        title: 'Review Status Updated',
        message: `Your review for "${review.package}" has been ${updates.status} by admin.`,
        relatedId: review._id,
        read: false
      });
      if (review.customerId) {
        const cust = await User.findById(review.customerId).select('email fullName');
        if (cust?.email) {
          await sendNotificationEmail(
            cust.email,
            `Review ${updates.status === 'approved' ? 'Approved' : 'Rejected'}`,
            `Your review for "${review.package}" has been ${updates.status} by the admin. Thank you for your feedback!`
          );
        }
      }
    }
    res.status(200).json({ message: 'Review updated successfully', review });
  } catch (error) {
    res.status(500).json({ message: 'Error updating review' });
  }
});

app.delete('/api/admin/reviews/:id', async (req, res) => {
  try {
    await Review.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Review deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting review' });
  }
});

// Coupon Management Routes
app.get('/api/admin/coupons', async (req, res) => {
  try {
    const filter = {};
    const search = searchFilter(['code', 'description', 'type'], req.query.search);
    if (search) Object.assign(filter, search);
    const { docs, total, page, limit, totalPages, hasNext, hasPrev } = await findPage(Coupon, filter, {
      query: req.query,
      defaultSort: { createdAt: -1 }
    });
    pagedResponse(res, 'coupons', { docs, total, page, limit, totalPages, hasNext, hasPrev });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching coupons' });
  }
});

app.post('/api/admin/coupons', async (req, res) => {
  try {
    const body = req.body || {};
    const code = String(body.code || '').toUpperCase().trim();
    const type = body.type;
    const discount = Number(body.discount);
    const minPurchase = Number(body.minPurchase);
    const maxUsage = Number(body.maxUsage);
    const expiry = body.expiry ? new Date(body.expiry) : null;
    const startDate = body.startDate ? new Date(body.startDate) : new Date();
    const applicableTo = body.applicableTo || 'both';
    const packageIds = Array.isArray(body.packageIds) ? body.packageIds : [];
    const perUserLimit = Number(body.perUserLimit ?? 1);

    if (!code) return res.status(400).json({ message: 'Coupon code is required' });
    if (!type || !['percentage', 'flat'].includes(type)) return res.status(400).json({ message: 'Invalid discount type' });
    if (Number.isNaN(discount) || discount <= 0) return res.status(400).json({ message: 'Discount value must be greater than 0' });
    if (type === 'percentage' && discount > 100) return res.status(400).json({ message: 'Percentage discount cannot exceed 100' });
    if (Number.isNaN(minPurchase) || minPurchase < 0) return res.status(400).json({ message: 'Minimum booking amount cannot be negative' });
    const maxDiscount = body.maxDiscount !== undefined ? Number(body.maxDiscount) : undefined;
    if (maxDiscount !== undefined && (Number.isNaN(maxDiscount) || maxDiscount < 0)) return res.status(400).json({ message: 'Maximum discount cannot be negative' });
    if (!expiry) return res.status(400).json({ message: 'Expiry date is required' });
    if (startDate > expiry) return res.status(400).json({ message: 'Start date cannot be after expiry date' });
    if (Number.isNaN(maxUsage) || maxUsage < 0) return res.status(400).json({ message: 'Usage limit cannot be negative' });
    if (Number.isNaN(perUserLimit) || perUserLimit < 0) return res.status(400).json({ message: 'Per user limit cannot be negative' });
    if (!['package', 'hotel', 'both'].includes(applicableTo)) {
      return res.status(400).json({ message: 'Invalid applicableTo value' });
    }
    if (applicableTo === 'package' && packageIds.length === 0) {
      return res.status(400).json({ message: 'Select at least one package for package-only coupons' });
    }

    const existing = await Coupon.findOne({ code });
    if (existing) return res.status(400).json({ message: 'Coupon code already exists' });

    const newCoupon = new Coupon({
      code,
      description: body.description || '',
      discount,
      type,
      minPurchase,
      maxDiscount,
      applicableTo,
      packageIds,
      startDate,
      expiry,
      maxUsage,
      perUserLimit,
      status: body.status || 'active',
      createdBy: req.user.userId
    });
    await newCoupon.save();
    res.status(201).json({ message: 'Coupon created successfully', coupon: newCoupon });
  } catch (error) {
    if (duplicateError(error)) {
      return res.status(400).json({ message: 'Coupon code already exists' });
    }
    res.status(500).json({ message: 'Error creating coupon', details: error.message });
  }
});

app.put('/api/admin/coupons/:id', async (req, res) => {
  try {
    const updates = pickUpdates(req.body, ['code', 'discount', 'type', 'minPurchase', 'maxDiscount', 'status', 'expiry', 'usage', 'maxUsage', 'description', 'applicableTo', 'packageIds', 'startDate', 'perUserLimit']);
    if (updates.code) updates.code = String(updates.code).toUpperCase().trim();
    if (updates.type && !['percentage', 'flat'].includes(updates.type)) return res.status(400).json({ message: 'Invalid discount type' });
    if (updates.discount !== undefined) {
      const d = Number(updates.discount);
      if (Number.isNaN(d) || d <= 0) return res.status(400).json({ message: 'Discount value must be greater than 0' });
      if (updates.type === 'percentage' && d > 100) return res.status(400).json({ message: 'Percentage discount cannot exceed 100' });
    }
    if (updates.minPurchase !== undefined) {
      const m = Number(updates.minPurchase);
      if (Number.isNaN(m) || m < 0) return res.status(400).json({ message: 'Minimum booking amount cannot be negative' });
    }
    if (updates.maxDiscount !== undefined) {
      const m = Number(updates.maxDiscount);
      if (Number.isNaN(m) || m < 0) return res.status(400).json({ message: 'Maximum discount cannot be negative' });
    }
    if (updates.expiry) updates.expiry = new Date(updates.expiry);
    if (updates.startDate) updates.startDate = new Date(updates.startDate);
    if (updates.startDate && updates.expiry && updates.startDate > updates.expiry) {
      return res.status(400).json({ message: 'Start date cannot be after expiry date' });
    }
    if (updates.applicableTo && !['package', 'hotel', 'both'].includes(updates.applicableTo)) {
      return res.status(400).json({ message: 'Invalid applicableTo value' });
    }
    if (updates.applicableTo === 'package' && (!updates.packageIds || !Array.isArray(updates.packageIds) || updates.packageIds.length === 0)) {
      return res.status(400).json({ message: 'Select at least one package for package-only coupons' });
    }
    if (updates.packageIds !== undefined && !Array.isArray(updates.packageIds)) {
      return res.status(400).json({ message: 'packageIds must be an array' });
    }
    const coupon = await Coupon.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }
    res.status(200).json({ message: 'Coupon updated successfully', coupon });
  } catch (error) {
    if (duplicateError(error)) {
      return res.status(400).json({ message: 'Coupon code already exists' });
    }
    res.status(500).json({ message: 'Error updating coupon', details: error.message });
  }
});

app.patch('/api/admin/coupons/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ message: 'Status must be active or inactive' });
    }
    const coupon = await Coupon.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }
    res.status(200).json({ message: 'Coupon status updated', coupon });
  } catch (error) {
    res.status(500).json({ message: 'Error updating coupon status' });
  }
});

app.delete('/api/admin/coupons/:id', async (req, res) => {
  try {
    await Coupon.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Coupon deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting coupon' });
  }
});

// Settings Management Routes
app.get('/api/admin/settings', async (req, res) => {
  try {
    let settings = await Settings.findOne({});
    if (!settings) {
      settings = new Settings();
      await settings.save();
    }
    res.status(200).json({ settings });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching settings' });
  }
});

app.put('/api/admin/settings', async (req, res) => {
  try {
    const updates = pickUpdates(req.body, [
      'siteName', 'siteEmail', 'sitePhone', 'currency', 'timezone',
      'maintenanceMode', 'allowRegistration', 'requireApproval', 'taxRate',
      'cancellationPolicy', 'refundPolicy'
    ]);
    updates.updatedAt = new Date();
    let settings = await Settings.findOneAndUpdate({}, updates, { new: true, upsert: true, setDefaultsOnInsert: true });
    res.status(200).json({ message: 'Settings updated successfully', settings });
  } catch (error) {
    res.status(500).json({ message: 'Error updating settings' });
  }
});

// Analytics Routes
app.get('/api/admin/analytics', async (req, res) => {
  try {
    const since = rangeStart(req.query.range || 'month');
    const totalUsers = await User.countDocuments();
    const activeTours = await Package.countDocuments({ status: 'active' });
    const partnerHotels = await Hotel.countDocuments({ status: 'active' });
    const totalBookings = await Booking.countDocuments();

    // Use aggregation instead of loading all documents into memory
    const revenueAgg = await Booking.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $group: {
          _id: null,
          totalRevenue: { $sum: { $ifNull: ['$amount', 0] } },
          totalDiscount: { $sum: { $ifNull: ['$discountAmount', 0] } },
          grossRevenue: { $sum: { $ifNull: ['$originalAmount', { $ifNull: ['$amount', 0] }] } }
      }
      }
    ]);
    const { totalRevenue = 0, totalDiscount = 0, grossRevenue = 0 } = revenueAgg[0] || {};

    // Average rating via aggregation
    const ratingAgg = await Review.aggregate([
      { $group: { _id: null, avgRating: { $avg: '$rating' } } }
    ]);
    const avgRating = ratingAgg[0]?.avgRating || 0;

    // Booking status counts via single aggregation
    const bookingStatusAgg = await Booking.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const bookingStats = {
      confirmed: bookingStatusAgg.find((b) => b._id === 'confirmed')?.count || 0,
      pending: bookingStatusAgg.find((b) => b._id === 'pending')?.count || 0,
      cancelled: bookingStatusAgg.find((b) => b._id === 'cancelled')?.count || 0
    };

    const topTours = await Package.find({}).sort({ bookings: -1, price: -1 }).limit(5).lean();
    const recentUsers = await User.find({}).sort({ createdAt: -1 }).limit(4).select('-password').lean();
    const recentBookings = await Booking.find({}).sort({ bookingDate: -1 }).limit(6).lean();
    const recentReviews = await Review.find({}).sort({ date: -1 }).limit(4).lean();
    const recentInvoices = await Invoice.find({}).sort({ date: -1 }).limit(3).lean();
    const roomSummary = await Room.aggregate([
      { $group: { _id: null, total: { $sum: '$total' }, available: { $sum: '$available' }, booked: { $sum: '$booked' } } }
    ]);

    // Monthly revenue and user growth via single aggregation each (replaces 12 queries)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5, 1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const monthlyRevenueAgg = await Booking.aggregate([
      { $match: { paymentStatus: 'paid', bookingDate: { $gte: sixMonthsAgo } } },
      { $group: {
          _id: {
            year: { $year: '$bookingDate' },
            month: { $month: '$bookingDate' }
          },
          revenue: { $sum: { $ifNull: ['$amount', 0] } }
      }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Fill in all 6 months, including empty months
    const monthlyRevenue = [];
    const userGrowth = [];
    for (let i = 5; i >= 0; i--) {
      const start = new Date();
      start.setMonth(start.getMonth() - i, 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setMonth(end.getMonth() + 1);

      const monthData = monthlyRevenueAgg.find(
        (m) => m._id.year === start.getFullYear() && m._id.month === (start.getMonth() + 1)
      );
      monthlyRevenue.push(monthData ? monthData.revenue : 0);
      userGrowth.push(await User.countDocuments({ createdAt: { $lt: end } }));
    }

    const rangeBookings = await Booking.countDocuments({ bookingDate: { $gte: since } });
    const rangeUsers = await User.countDocuments({ createdAt: { $gte: since } });
    const rangeRevenueAgg = await Booking.aggregate([
      { $match: { paymentStatus: 'paid', bookingDate: { $gte: since } } },
      { $group: { _id: null, revenue: { $sum: { $ifNull: ['$amount', 0] } } } }
    ]);
    const rangeRevenue = rangeRevenueAgg[0]?.revenue || 0;

    // Refund statistics
    const refundStatusAgg = await Booking.aggregate([
      {
        $group: {
          _id: { $ifNull: ['$refund.status', 'not_applicable'] },
          count: { $sum: 1 },
          amount: { $sum: { $ifNull: ['$refund.amount', 0] } }
        }
      }
    ]);
    const refundStats = {
      pending: refundStatusAgg.find((r) => r._id === 'pending')?.count || 0,
      completed: refundStatusAgg.find((r) => r._id === 'completed')?.count || 0,
      failed: refundStatusAgg.find((r) => r._id === 'failed')?.count || 0,
      notApplicable: refundStatusAgg.find((r) => r._id === 'not_applicable')?.count || 0,
      totalRefundedAmount: refundStatusAgg.reduce((sum, r) => sum + (r.amount || 0), 0)
    };

    // Commission breakdown by operator (paid bookings only)
    const commissionAgg = await Booking.aggregate([
      { $match: { paymentStatus: 'paid', operatorId: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: '$operatorId',
          totalBookings: { $sum: 1 },
          totalRevenue: { $sum: { $ifNull: ['$amount', 0] } }
        }
      }
    ]);
    const operatorIds = commissionAgg.map((c) => c._id);
    const operatorProfiles = await OperatorProfile.find({ userId: { $in: operatorIds } }).lean();
    const operatorMap = {};
    operatorProfiles.forEach((op) => {
      operatorMap[op.userId.toString()] = op;
    });
    const commissionBreakdown = commissionAgg.map((c) => {
      const profile = operatorMap[c._id.toString()];
      const rate = profile ? profile.commissionRate || 0 : 0;
      const type = profile ? profile.commissionType || 'percentage' : 'percentage';
      const commission = type === 'fixed' ? rate : (c.totalRevenue * rate) / 100;
      return {
        operatorId: c._id,
        operatorName: profile ? profile.fullName || 'Unknown' : 'Unknown',
        totalBookings: c.totalBookings,
        totalRevenue: c.totalRevenue,
        commissionRate: rate,
        commissionType: type,
        commissionAmount: Math.round(commission * 100) / 100
      };
    });
    const totalCommissions = commissionBreakdown.reduce((sum, c) => sum + c.commissionAmount, 0);

    // Package performance breakdown
    const packageAgg = await Booking.aggregate([
      { $group: { _id: '$package', bookings: { $sum: 1 }, revenue: { $sum: { $ifNull: ['$amount', 0] } } } },
      { $sort: { revenue: -1 } },
      { $limit: 10 }
    ]);
    const packagePerformance = await Promise.all(packageAgg.map(async (p) => {
      const pkg = await Package.findOne({ name: p._id }).select('name destination price').lean();
      return {
        packageName: p._id || 'Unknown',
        destination: pkg?.destination || '—',
        bookings: p.bookings,
        revenue: p.revenue
      };
    }));

    // Destination performance breakdown
    const destinationAgg = await Booking.aggregate([
      {
        $lookup: {
          from: 'packages',
          localField: 'packageId',
          foreignField: '_id',
          as: 'pkg'
        }
      },
      { $unwind: { path: '$pkg', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { $ifNull: ['$pkg.destination', 'Unknown'] },
          bookings: { $sum: 1 },
          revenue: { $sum: { $ifNull: ['$amount', 0] } }
        }
      },
      { $sort: { revenue: -1 } },
      { $limit: 10 }
    ]);
    const destinationPerformance = destinationAgg.map((d) => ({
      destination: d._id,
      bookings: d.bookings,
      revenue: d.revenue
    }));

    res.status(200).json({
      totalUsers,
      activeTours,
      partnerHotels,
      totalBookings,
      totalRevenue,
      totalDiscount,
      grossRevenue,
      avgRating: Number(avgRating.toFixed(1)),
      bookingStats,
      refundStats,
      totalCommissions,
      commissionBreakdown,
      packagePerformance,
      destinationPerformance,
      topTours: topTours.map((pkg) => ({
        name: pkg.name,
        bookings: pkg.bookings || 0,
        revenue: (pkg.bookings || 0) * (pkg.price || 0)
      })),
      recentActivity: [
        ...recentUsers.map((u) => ({ type: 'user', text: `New user: ${u.fullName} (${u.role})` })),
        ...recentBookings.map((b) => ({ type: 'booking', text: `Booking: ${b.package} by ${b.customer}` })),
        ...recentReviews.map((r) => ({ type: 'review', text: `Review: ${r.rating}â˜… for ${r.package}` })),
        ...recentInvoices.map((inv) => ({ type: 'invoice', text: `Invoice ${inv.invoiceNo} for ${inv.customer}` }))
      ].slice(0, 8),
      monthlyRevenue,
      userGrowth,
      upcomingBookings: recentBookings.slice(0, 5).map((booking) => ({
        customer: booking.customer,
        package: booking.package,
        dates: booking.dates,
        status: booking.status
      })),
      rooms: roomSummary[0] || { total: 0, available: 0, booked: 0 },
      range: {
        bookings: rangeBookings,
        users: rangeUsers,
        revenue: rangeRevenue
      }
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ message: 'Error fetching analytics' });
  }
});

// Admin Reports Summary Route
app.get('/api/admin/reports/summary', async (req, res) => {
  try {
    const range = req.query.range || 'month';
    const since = rangeStart(range);

    // Use aggregation instead of loading all bookings into memory
    const bookingsByPaymentAgg = await Booking.aggregate([
      { $group: { _id: '$paymentStatus', count: { $sum: 1 } } }
    ]);
    const bookingsByPayment = Object.fromEntries(
      bookingsByPaymentAgg.map((b) => [b._id, b.count])
    );

    const revenueByCategory = await Package.aggregate([
      {
        $lookup: {
          from: 'bookings',
          localField: '_id',
          foreignField: 'packageId',
          as: 'bookings'
        }
      },
      {
        $group: {
          _id: '$category',
          name: { $first: '$category' },
          revenue: { $sum: { $sum: '$bookings.amount' } }
        }
      },
      { $sort: { revenue: -1 } },
      { $limit: 10 }
    ]);

    const revenueByDestination = await Package.aggregate([
      {
        $lookup: {
          from: 'bookings',
          localField: '_id',
          foreignField: 'packageId',
          as: 'bookings'
        }
      },
      {
        $group: {
          _id: '$destination',
          name: { $first: '$destination' },
          revenue: { $sum: { $sum: '$bookings.amount' } }
        }
      },
      { $sort: { revenue: -1 } },
      { $limit: 10 }
    ]);

    const rangeRevenue = await Booking.aggregate([
      { $match: { bookingDate: { $gte: since } } },
      { $group: { _id: null, revenue: { $sum: { $ifNull: ['$amount', 0] } }, count: { $sum: 1 } } }
    ]);

     res.status(200).json({
       bookingsByPayment,
       revenueByCategory,
       revenueByDestination,
       range: {
         bookings: rangeRevenue[0]?.count || 0,
         revenue: rangeRevenue[0]?.revenue || 0
       }
     });
  } catch (error) {
    console.error('Reports summary error:', error);
    res.status(500).json({ message: 'Error fetching reports summary' });
  }
});

// Admin Notification Routes
app.get('/api/admin/notifications', async (req, res) => {
  try {
    const olderThan = parseInt(req.query.olderThan);
    const filter = olderThan ? { createdAt: { $lt: new Date(Date.now() - olderThan * 24 * 60 * 60 * 1000) } } : {};
    const { docs, total, page, limit, totalPages, hasNext, hasPrev } = await findPage(Notification, filter, {
      query: req.query,
      populate: { path: 'userId', select: 'fullName email role' },
      sort: { createdAt: -1 },
      defaultLimit: 200
    });
    const unread = await Notification.countDocuments({ ...filter, read: false });
    const recipientIds = await Notification.distinct('userId', filter);
    const byType = {};
    for (const t of ['booking', 'payment', 'review', 'system', 'offer', 'availability', 'itinerary_change', 'departure_reminder', 'disruption']) {
      byType[t] = await Notification.countDocuments({ ...filter, type: t });
    }
    pagedResponse(res, 'notifications', { docs, total, page, limit, totalPages, hasNext, hasPrev }, {
      stats: { total, unread, recipients: recipientIds.length, byType }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching notifications' });
  }
});

app.post('/api/admin/notifications', async (req, res) => {
  try {
    const { title, message, type, role: roleQuery, userIds, alsoEmail } = req.body;
    let users;
    if (roleQuery === 'all') {
      users = await User.find({});
    } else if (roleQuery) {
      users = await User.find({ role: roleQuery });
    } else if (userIds && userIds.length) {
      users = await User.find({ _id: { $in: userIds } });
    } else {
      return res.status(400).json({ message: 'role or userIds required' });
    }
    const notifications = [];
    for (const u of users) {
      notifications.push(new Notification({
        userId: u._id,
        type: type || 'system',
        title,
        message,
      }));
    }
    await Notification.insertMany(notifications);
    if (alsoEmail) {
      let emailSuccess = 0;
      for (const u of users) {
        if (u.email) {
          const ok = await sendNotificationEmail(u.email, title, message);
          if (ok) emailSuccess++;
        }
      }
      res.status(201).json({ count: notifications.length, emailsSent: emailSuccess });
    } else {
      res.status(201).json({ count: notifications.length });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error creating notifications' });
  }
});

app.delete('/api/admin/notifications/:id', async (req, res) => {
  try {
    const notification = await Notification.findByIdAndDelete(req.params.id);
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    res.status(200).json({ message: 'Notification deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting notification' });
  }
});

// Sends a disruption alert (weather, strike, transport change, ...) to the
// travellers actually affected by it, rather than to a generic audience.
app.post('/api/admin/disruptions', async (req, res) => {
  try {
    const {
      title,
      message,
      severity = 'warning',
      packageId,
      destination,
      bookingIds,
      role = 'customer',
      affectedFrom,
      affectedTo
    } = req.body;

    if (!title || !message) {
      return res.status(400).json({ message: 'title and message are required' });
    }

    const filter = { status: { $in: ['pending', 'confirmed'] } };
    if (packageId) filter.packageId = packageId;
    if (bookingIds && bookingIds.length) filter._id = { $in: bookingIds };

    let bookings = await Booking.find(filter).select('customerId email customer package packageId dates checkInDate status');
    if (destination) {
      const destinationRx = new RegExp(escapeRegExp(String(destination).trim()), 'i');
      const matching = await Package.find({ destination: destinationRx }).select('_id');
      const ids = matching.map(pkg => String(pkg._id));
      bookings = bookings.filter(booking => ids.includes(String(booking.packageId)));
    }

    if (affectedFrom || affectedTo) {
      const tripStarts = await resolveTripStarts(bookings);
      bookings = bookings.filter(booking => {
        const tripStart = tripStarts.get(String(booking._id));
        if (!tripStart) return false;
        if (affectedFrom && tripStart < new Date(affectedFrom)) return false;
        if (affectedTo && tripStart > new Date(affectedTo)) return false;
        return true;
      });
    }

    const customerIds = [...new Set(bookings.map(b => b.customerId?.toString()).filter(Boolean))];
    if (!customerIds.length) {
      return res.status(404).json({ message: 'No matching trips found for this alert' });
    }

    const recipients = await User.find({ _id: { $in: customerIds } }).select('email fullName role');
    const allowed = recipients.filter(user => role === 'all' || user.role === role);
    if (!allowed.length) {
      return res.status(404).json({ message: 'No matching recipients for this alert' });
    }

    const bookingByCustomer = new Map();
    for (const booking of bookings) {
      if (booking.customerId) {
        bookingByCustomer.set(String(booking.customerId), booking);
      }
    }

    let created = 0;
    for (const user of allowed) {
      const booking = bookingByCustomer.get(String(user._id));
      const notification = await createNotification({
        userId: user._id,
        type: 'disruption',
        title,
        message,
        severity,
        bookingId: booking?._id,
        relatedId: booking?._id,
        actionUrl: booking ? `/customer/bookings/${booking._id}/tracker` : '/customer/trip-alerts',
        emailSubject: `Travel alert: ${title}`
      });
      if (notification) created += 1;
    }

    res.status(201).json({ message: 'Disruption alert sent', count: created, affectedBookings: bookings.length });
  } catch (error) {
    console.error('Error sending disruption alert:', error);
    res.status(500).json({ message: 'Error sending disruption alert' });
  }
});

app.post('/api/admin/send-email', async (req, res) => {
  try {
    const { subject, message, role: roleQuery, userIds, email } = req.body;
    let users = [];
    if (roleQuery) {
      users = await User.find({ role: roleQuery }).select('email fullName');
    } else if (userIds && userIds.length) {
      users = await User.find({ _id: { $in: userIds } }).select('email fullName');
    } else if (email) {
      users = [{ email, fullName: 'Recipient' }];
    } else {
      return res.status(400).json({ message: 'role, userIds, or email required' });
    }
    let success = 0;
    let fail = 0;
    for (const u of users) {
      if (u.email) {
        const ok = await sendNotificationEmail(u.email, subject, message);
        if (ok) success++; else fail++;
      } else {
        fail++;
      }
    }
    await Notification.create(users.map(u => ({
      userId: u._id || users[0]._id,
      type: 'system',
      title: subject,
      message: message,
    })).filter(n => n.userId));
    res.status(200).json({ message: 'Email sent', success, fail });
  } catch (error) {
    res.status(500).json({ message: 'Error sending email' });
  }
});

// --- Public Contact Form ---
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    const adminEmail = process.env.ADMIN_EMAIL || 'anjaiahgiddala@gmail.com';
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #e5e7eb;border-radius:8px;">
        <h2 style="color:#1e3a5f;margin-bottom:8px;">New Contact Form Submission</h2>
        <p><strong>From:</strong> ${name} &lt;${email}&gt;</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <hr style="border-color:#e5e7eb;" />
        <p style="white-space:pre-line;">${message}</p>
        <hr style="border-color:#e5e7eb;" />
        <p style="color:#6b7280;font-size:12px;">Sent via Travel Tour Management System website</p>
      </div>
    `;
    let emailSent = false;
    try {
      await sendEmailViaBrevo(adminEmail, `Contact Form: ${subject}`, html);
      emailSent = true;
    } catch (e) {
      console.error('Contact email send failed:', e.message);
    }
    // Also send an auto-reply to the user
    try {
      const replyHtml = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #e5e7eb;border-radius:8px;">
          <h2 style="color:#4f46e5;">Thank you for reaching out!</h2>
          <p>Hi ${name},</p>
          <p>We've received your message and our team will get back to you within 24 hours.</p>
          <p><strong>Your subject:</strong> ${subject}</p>
          <hr style="border-color:#e5e7eb;" />
          <p style="color:#6b7280;font-size:12px;">Travel Tour Management System</p>
        </div>
      `;
      await sendEmailViaBrevo(email, 'Re: Your message to Travel Tour Management System', replyHtml);
    } catch (e) {
      console.error('Auto-reply failed:', e.message);
    }
    res.status(200).json({ message: emailSent ? 'Message sent successfully! Check your email for confirmation.' : 'Message received. We will get back to you soon.' });
  } catch (error) {
    console.error('Contact form error:', error);
    res.status(500).json({ message: 'Error sending message' });
  }
});

app.put('/api/admin/notifications/:id/read', async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { read: true },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    res.status(200).json({ message: 'Notification marked as read' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating notification' });
  }
});

// Tour Operator Routes
app.use('/api/operator', authenticate, requireTourOperator);

// Operator Profile Routes
app.get('/api/operator/profile', async (req, res) => {
  try {
    let profile = await OperatorProfile.findOne({ userId: req.user.userId });
    if (!profile) {
      profile = new OperatorProfile({ userId: req.user.userId });
      await profile.save();
    }
    const user = await User.findById(req.user.userId).select('-password');
    res.status(200).json({ profile, user });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching profile' });
  }
});

app.put('/api/operator/profile', async (req, res) => {
  try {
    const updates = pickUpdates(req.body, [
      'companyName', 'logo', 'businessAddress', 'city', 'state', 'country',
      'postalCode', 'website', 'description', 'businessRegNumber', 'alternatePhone',
      'licenseNumber', 'taxId'
    ]);
    updates.updatedAt = new Date();
    let profile = await OperatorProfile.findOneAndUpdate(
      { userId: req.user.userId },
      updates,
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    if (req.body.fullName || req.body.email || req.body.phone) {
      const userUpdates = pickUpdates(req.body, ['fullName', 'email', 'phone']);
      if (userUpdates.email) userUpdates.email = String(userUpdates.email).trim().toLowerCase();

      const contactCheck = validateContactDetails({
        fullName: userUpdates.fullName,
        email: userUpdates.email,
        phone: userUpdates.phone
      });
      if (!contactCheck.valid) {
        return res.status(400).json({ message: contactCheck.message });
      }
      if (userUpdates.email) {
        const existing = await User.findOne({ email: userUpdates.email, _id: { $ne: req.user.userId } });
        if (existing) {
          return res.status(400).json({ message: 'Email already in use' });
        }
      }

      // The password is intentionally not handled here: changing it requires
      // the current password and goes through the account security endpoint.
      const user = await User.findByIdAndUpdate(req.user.userId, userUpdates, { new: true });
      invalidateSecurityStateCache(req.user.userId);

      if (user && userUpdates.email) {
        await revokeOtherSessions(req.user.userId, req.user.jti);
      }
    }

    res.status(200).json({ message: 'Profile updated successfully', profile });
  } catch (error) {
    res.status(500).json({ message: 'Error updating profile' });
  }
});

// --- Operator profile image upload ---
app.post('/api/operator/profile/image', authenticate, requireTourOperator, async (req, res) => {
  uploadAvatar(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'Image must be smaller than 5 MB' });
      }
      return res.status(400).json({ message: err.message || 'Upload failed' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }

    const profile = await OperatorProfile.findOne({ userId: req.user.userId });
    if (!profile) {
      fs.unlink(req.file.path, () => {});
      return res.status(404).json({ message: 'Operator profile not found' });
    }

    const prevLogo = profile.logo || '';
    if (prevLogo && prevLogo.includes('/api/uploads/avatars/')) {
      const prevFileName = path.basename(prevLogo);
      const prevPath = path.join(AVATAR_DIR, prevFileName);
      fs.unlink(prevPath, () => {});
    }

    const logoUrl = `/api/uploads/avatars/${req.file.filename}`;
    profile.logo = logoUrl;
    await profile.save();
    invalidateSecurityStateCache(req.user.userId);

    res.status(200).json({
      message: 'Profile image uploaded successfully',
      profile,
      avatarUrl: logoUrl,
    });
  });
});

// Remove operator profile image
app.delete('/api/operator/profile/image', authenticate, requireTourOperator, async (req, res) => {
  try {
    const profile = await OperatorProfile.findOne({ userId: req.user.userId });
    if (!profile) {
      return res.status(404).json({ message: 'Operator profile not found' });
    }

    const prevLogo = profile.logo || '';
    if (prevLogo && prevLogo.includes('/api/uploads/avatars/')) {
      const prevFileName = path.basename(prevLogo);
      const prevPath = path.join(AVATAR_DIR, prevFileName);
      fs.unlink(prevPath, () => {});
    }

    profile.logo = '';
    await profile.save();
    invalidateSecurityStateCache(req.user.userId);

    res.status(200).json({
      message: 'Profile image removed',
      profile,
    });
  } catch (error) {
    console.error('Error removing operator profile image:', error);
    res.status(500).json({ message: 'Error removing profile image' });
  }
});

// --- Account security ---
registerAccountSecurityRoutes('/api/operator');

// Operator Package Routes
app.get('/api/operator/packages', async (req, res) => {
  try {
    const filter = {};
    const search = searchFilter(['name', 'destination', 'category'], req.query.search);
    if (search) Object.assign(filter, search);
    const { docs, total, page, limit, totalPages, hasNext, hasPrev } = await findPage(Package, filter, {
      query: req.query,
      sort: { createdAt: -1 }
    });
    pagedResponse(res, 'packages', { docs, total, page, limit, totalPages, hasNext, hasPrev });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching packages' });
  }
});

app.post('/api/operator/packages', async (req, res) => {
  try {
    const newPackage = new Package({
      ...req.body,
      operatorId: req.user.userId,
      updatedAt: new Date()
    });
    await newPackage.save();
    res.status(201).json({ message: 'Package created successfully', package: newPackage });
  } catch (error) {
    res.status(500).json({ message: 'Error creating package' });
  }
});

app.get('/api/operator/packages/:id', async (req, res) => {
  try {
    const pkg = await Package.findById(req.params.id);
    if (!pkg) {
      return res.status(404).json({ message: 'Package not found' });
    }
    res.status(200).json({ package: pkg });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching package' });
  }
});

app.put('/api/operator/packages/:id', async (req, res) => {
  try {
    const updates = pickUpdates(req.body, [
      'name', 'destination', 'duration', 'price', 'status', 'description',
      'inclusions', 'image', 'images', 'category', 'shortDescription', 'highlights',
      'exclusions', 'terms', 'cancellationPolicy', 'pickupInfo', 'startingLocation',
      'transportType', 'minTravelers', 'maxTravelers', 'publishedStatus'
    ]);
    updates.updatedAt = new Date();
    const pkg = await Package.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!pkg) {
      return res.status(404).json({ message: 'Package not found' });
    }
    res.status(200).json({ message: 'Package updated successfully', package: pkg });
  } catch (error) {
    res.status(500).json({ message: 'Error updating package' });
  }
});

app.delete('/api/operator/packages/:id', async (req, res) => {
  try {
    const pkg = await Package.findByIdAndDelete(req.params.id);
    if (!pkg) {
      return res.status(404).json({ message: 'Package not found' });
    }
    res.status(200).json({ message: 'Package deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting package' });
  }
});

// Operator Itinerary Routes
app.get('/api/operator/itineraries', async (req, res) => {
  try {
    const filter = { operatorId: req.user.userId };
    const search = searchFilter(['name', 'packageName'], req.query.search);
    if (search) Object.assign(filter, search);
    const { docs, total, page, limit, totalPages, hasNext, hasPrev } = await findPage(Itinerary, filter, {
      query: req.query,
      sort: { createdAt: -1 }
    });
    pagedResponse(res, 'itineraries', { docs, total, page, limit, totalPages, hasNext, hasPrev });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching itineraries' });
  }
});

app.get('/api/operator/itineraries/package/:packageId', async (req, res) => {
  try {
    const itinerary = await Itinerary.findOne({ packageId: req.params.packageId, operatorId: req.user.userId });
    res.status(200).json({ itinerary });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching itinerary' });
  }
});

// A single itinerary, so the builder can load the days it has to edit.
app.get('/api/operator/itineraries/:id', async (req, res) => {
  try {
    const itinerary = await Itinerary.findOne({ _id: req.params.id, operatorId: req.user.userId });
    if (!itinerary) {
      return res.status(404).json({ message: 'Itinerary not found' });
    }
    res.status(200).json({ itinerary });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching itinerary' });
  }
});

app.post('/api/operator/itineraries', async (req, res) => {
  try {
    const payload = normalizeItineraryPayload(req.body);
    if (!payload.name) {
      return res.status(400).json({ message: 'Itinerary name is required' });
    }
    if (req.body.packageId) {
      payload.packageId = req.body.packageId;
    } else if (payload.packageName) {
      const pkg = await Package.findOne({ name: payload.packageName, operatorId: req.user.userId });
      if (pkg) payload.packageId = pkg._id;
    }
    if (!payload.packageId) {
      return res.status(400).json({ message: 'Select a package for this itinerary' });
    }

    const newItinerary = new Itinerary({
      ...payload,
      operatorId: req.user.userId,
      updatedAt: new Date()
    });
    await newItinerary.save();
    res.status(201).json({ message: 'Itinerary created successfully', itinerary: newItinerary });
  } catch (error) {
    console.error('Error creating itinerary:', error.message);
    res.status(500).json({ message: 'Error creating itinerary' });
  }
});

app.put('/api/operator/itineraries/:id', async (req, res) => {
  try {
    const updates = normalizeItineraryPayload(req.body);
    updates.updatedAt = new Date();
    if (req.body.packageId) {
      updates.packageId = req.body.packageId;
    } else if (updates.packageName) {
      const pkg = await Package.findOne({ name: updates.packageName, operatorId: req.user.userId });
      if (pkg) updates.packageId = pkg._id;
    }
    if (updates.packageId) {
      const pkg = await Package.findById(updates.packageId).select('name');
      if (pkg && !updates.packageName) updates.packageName = pkg.name;
    }
    const itinerary = await Itinerary.findOneAndUpdate(
      { _id: req.params.id, operatorId: req.user.userId },
      updates,
      { new: true }
    );
    if (!itinerary) {
      return res.status(404).json({ message: 'Itinerary not found' });
    }
    try {
      if (itinerary.packageId) {
        const bookings = await Booking.find({ packageId: itinerary.packageId, status: { $in: ['pending', 'confirmed'] } })
          .select('customerId package');
        const seen = new Set();
        for (const booking of bookings) {
          if (!booking.customerId) continue;
          const customerId = String(booking.customerId);
          if (seen.has(customerId)) continue;
          seen.add(customerId);
          await createNotification({
            userId: customerId,
            type: 'itinerary_change',
            title: 'Itinerary Updated',
            message: `The itinerary for ${itinerary.packageName || booking.package || 'your package'} has been updated. Check for changes.`,
            relatedId: itinerary._id,
            bookingId: booking._id,
            severity: 'warning',
            actionUrl: `/customer/bookings/${booking._id}/tracker`,
            emailSubject: 'Your itinerary has been updated'
          });
        }
      }
    } catch (e) {
      console.error('Failed to notify customers:', e.message);
    }
    res.status(200).json({ message: 'Itinerary updated successfully', itinerary });
  } catch (error) {
    res.status(500).json({ message: 'Error updating itinerary' });
  }
});

app.delete('/api/operator/itineraries/:id', async (req, res) => {
  try {
    const itinerary = await Itinerary.findOneAndDelete({ _id: req.params.id, operatorId: req.user.userId });
    if (!itinerary) {
      return res.status(404).json({ message: 'Itinerary not found' });
    }
    res.status(200).json({ message: 'Itinerary deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting itinerary' });
  }
});

// Operator Pricing Routes
app.get('/api/operator/pricing/package/:packageId', async (req, res) => {
  try {
    const pricing = await Pricing.findOne({ packageId: req.params.packageId, operatorId: req.user.userId });
    res.status(200).json({ pricing });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching pricing' });
  }
});

app.post('/api/operator/pricing', async (req, res) => {
  try {
    const newPricing = new Pricing({
      ...req.body,
      operatorId: req.user.userId,
      updatedAt: new Date()
    });
    await newPricing.save();
    res.status(201).json({ message: 'Pricing created successfully', pricing: newPricing });
  } catch (error) {
    res.status(500).json({ message: 'Error creating pricing' });
  }
});

app.put('/api/operator/pricing/:id', async (req, res) => {
  try {
    const updates = pickUpdates(req.body, [
      'basePrice', 'adultPrice', 'childPrice', 'infantPrice', 'singleOccupancyPrice',
      'groupPricing', 'discount', 'promotionalPrice', 'tax', 'serviceFee',
      'validFrom', 'validUntil'
    ]);
    updates.updatedAt = new Date();
    const pricing = await Pricing.findOneAndUpdate(
      { _id: req.params.id, operatorId: req.user.userId },
      updates,
      { new: true }
    );
    if (!pricing) {
      return res.status(404).json({ message: 'Pricing not found' });
    }
    res.status(200).json({ message: 'Pricing updated successfully', pricing });
  } catch (error) {
    res.status(500).json({ message: 'Error updating pricing' });
  }
});

// Operator Availability Routes
app.get('/api/operator/availability', async (req, res) => {
  try {
    const filter = { operatorId: req.user.userId };
    const { docs, total, page, limit, totalPages, hasNext, hasPrev } = await findPage(Availability, filter, {
      query: req.query,
      defaultSort: { startDate: -1 }
    });
    pagedResponse(res, 'availability', { docs, total, page, limit, totalPages, hasNext, hasPrev });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching availability' });
  }
});

app.get('/api/operator/availability/package/:packageId', async (req, res) => {
  try {
    const filter = { packageId: req.params.packageId, operatorId: req.user.userId };
    const { docs, total, page, limit, totalPages, hasNext, hasPrev } = await findPage(Availability, filter, {
      query: req.query,
      defaultSort: { startDate: -1 }
    });
    pagedResponse(res, 'availability', { docs, total, page, limit, totalPages, hasNext, hasPrev });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching availability' });
  }
});

app.post('/api/operator/availability', async (req, res) => {
  try {
    const { totalSeats, availableSeats } = req.body;
    if (availableSeats !== undefined && totalSeats !== undefined && Number(availableSeats) > Number(totalSeats)) {
      return res.status(400).json({ message: 'Available seats cannot exceed total seats' });
    }
    const newAvailability = new Availability({
      ...req.body,
      operatorId: req.user.userId,
      updatedAt: new Date()
    });
    await newAvailability.save();
    res.status(201).json({ message: 'Availability created successfully', availability: newAvailability });
  } catch (error) {
    res.status(500).json({ message: 'Error creating availability' });
  }
});

app.put('/api/operator/availability/:id', async (req, res) => {
  try {
    const updates = pickUpdates(req.body, [
      'startDate', 'endDate', 'totalSeats', 'availableSeats', 'soldSeats',
      'bookingCutoffDate', 'minGroupSize', 'maxGroupSize', 'status'
    ]);
    if (updates.availableSeats !== undefined && updates.totalSeats !== undefined && Number(updates.availableSeats) > Number(updates.totalSeats)) {
      return res.status(400).json({ message: 'Available seats cannot exceed total seats' });
    }
    updates.updatedAt = new Date();
    const availability = await Availability.findOneAndUpdate(
      { _id: req.params.id, operatorId: req.user.userId },
      updates,
      { new: true }
    );
    if (!availability) {
      return res.status(404).json({ message: 'Availability not found' });
    }
    res.status(200).json({ message: 'Availability updated successfully', availability });
  } catch (error) {
    res.status(500).json({ message: 'Error updating availability' });
  }
});

app.delete('/api/operator/availability/:id', async (req, res) => {
  try {
    const availability = await Availability.findOneAndDelete({ _id: req.params.id, operatorId: req.user.userId });
    if (!availability) {
      return res.status(404).json({ message: 'Availability not found' });
    }
    res.status(200).json({ message: 'Availability deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting availability' });
  }
});

// Operator Booking Routes
app.get('/api/operator/bookings', async (req, res) => {
  try {
    const filter = { operatorId: req.user.userId };
    const search = searchFilter(['bookingId', 'customer', 'package', 'email'], req.query.search);
    if (search) Object.assign(filter, search);
    const { docs, total, page, limit, totalPages, hasNext, hasPrev } = await findPage(Booking, filter, {
      query: req.query,
      sort: { bookingDate: -1 }
    });
    const [byStatusAgg, revenueAgg] = await Promise.all([
      Booking.aggregate([
        { $match: filter },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Booking.aggregate([
        { $match: filter },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ])
    ]);
    const byStatus = {};
    for (const row of byStatusAgg) byStatus[row._id || 'unknown'] = row.count;
    pagedResponse(res, 'bookings', { docs, total, page, limit, totalPages, hasNext, hasPrev }, {
      stats: {
        total,
        byStatus,
        totalRevenue: revenueAgg[0]?.total || 0
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching bookings' });
  }
});

app.get('/api/operator/bookings/:id', async (req, res) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, operatorId: req.user.userId });
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    res.status(200).json({ booking });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching booking' });
  }
});

app.put('/api/operator/bookings/:id', async (req, res) => {
  try {
    const previous = await Booking.findOne({
      _id: req.params.id,
      operatorId: req.user.userId
    }).select('status paymentStatus dates checkInDate customerId package packageId');
    if (!previous) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const updates = pickUpdates(req.body, ['status', 'paymentStatus', 'dates', 'checkInDate', 'notes']);
    const booking = await Booking.findOneAndUpdate(
      { _id: req.params.id, operatorId: req.user.userId },
      updates,
      { new: true }
    );
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    
    // Add timeline entry
    if (updates.status) {
      booking.timeline.push({
        status: updates.status,
        date: new Date(),
        note: `Status changed to ${updates.status}`
      });
    }
    
    await booking.save();

    const statusChanged = updates.status && updates.status !== previous.status;
    const paymentChanged = updates.paymentStatus && updates.paymentStatus !== previous.paymentStatus;
    const tripDateChanged = (updates.dates && updates.dates !== previous.dates)
      || (updates.checkInDate && String(updates.checkInDate) !== String(previous.checkInDate));

    if (statusChanged) {
      await createNotification({
        userId: booking.customerId,
        type: 'booking',
        title: statusChangedLabel(updates.status),
        message: `Your booking (${booking.bookingId || booking._id}) for ${booking.package || 'your trip'} is now "${updates.status}".`,
        bookingId: booking._id,
        relatedId: booking._id,
        severity: updates.status === 'cancelled' || updates.status === 'rejected' ? 'warning' : 'info',
        actionUrl: `/customer/bookings/${booking._id}/tracker`,
        emailSubject: `Booking status updated — ${updates.status}`,
        email: false
      });
    }

    if (paymentChanged) {
      await createNotification({
        userId: booking.customerId,
        type: 'payment',
        title: 'Payment Status Updated',
        message: `The payment for your booking (${booking.bookingId || booking._id}) is now "${updates.paymentStatus}".`,
        bookingId: booking._id,
        relatedId: booking._id,
        actionUrl: `/customer/bookings/${booking._id}/tracker`,
        emailSubject: 'Payment status updated'
      });
    }

    if (tripDateChanged) {
      await createNotification({
        userId: booking.customerId,
        type: 'itinerary_change',
        title: 'Your trip date has changed',
        message: `The travel date for your booking (${booking.bookingId || booking._id}) was updated to ${booking.dates || booking.checkInDate || 'the new schedule'}. Please review your itinerary.`,
        bookingId: booking._id,
        relatedId: booking._id,
        severity: 'warning',
        actionUrl: `/customer/bookings/${booking._id}/tracker`,
        emailSubject: 'Your trip schedule changed'
      });
    }

    if (updates.status && updates.status !== 'pending' && booking.email) {
      await sendNotificationEmail(
        booking.email,
        'Booking Status Update',
        `Your booking <strong>${booking.bookingId || booking._id}</strong> status has been updated to "${updates.status}" by the tour operator.`
      ).catch(err => console.error('Operator booking email failed:', err.message));
    }
    res.status(200).json({ message: 'Booking updated successfully', booking });
  } catch (error) {
    res.status(500).json({ message: 'Error updating booking' });
  }
});

// Operator Customer Routes
app.get('/api/operator/customers', async (req, res) => {
  try {
    const operatorId = new mongoose.Types.ObjectId(req.user.userId);
    const { page, limit, skip } = getPagination(req.query);
    const pageStages = [{ $sort: { fullName: 1 } }];
    if (limit > 0) {
      pageStages.push({ $skip: skip }, { $limit: limit });
    }
    const [facet] = await User.aggregate([
      {
        $lookup: {
          from: 'bookings',
          let: {},
          pipeline: [
            { $match: { operatorId, customerId: { $ne: null } } },
            { $group: { _id: '$customerId' } }
          ],
          as: '__customerIds'
        }
      },
      { $addFields: { __customerIds: { $map: { input: '$__customerIds', as: 'c', in: '$$c._id' } } } },
      { $match: { _id: { $in: '$__customerIds' } } },
      {
        $lookup: {
          from: 'bookings',
          let: { cid: '$_id' },
          pipeline: [
            { $match: { $expr: { $and: [ { $eq: ['$customerId', '$$cid'] }, { $eq: ['$operatorId', operatorId] } ] } } },
            { $project: { _id: 0, bookingDate: 1, paidAmount: 1 } }
          ],
          as: '__bookings'
        }
      },
      {
        $addFields: {
          totalBookings: { $size: '$__bookings' },
          totalSpent: { $sum: '$__bookings.paidAmount' },
          lastBooking: { $max: '$__bookings.bookingDate' }
        }
      },
      { $project: { password: '$$REMOVE', __customerIds: '$$REMOVE', __bookings: '$$REMOVE' } },
      { $facet: { data: pageStages, total: [{ $count: 'count' }] } }
    ]);
    const docs = facet?.data || [];
    const total = facet?.total?.[0]?.count || 0;
    const totalPages = limit > 0 ? Math.max(1, Math.ceil(total / limit)) : 1;
    pagedResponse(res, 'customers', {
      docs,
      total,
      page,
      limit,
      totalPages,
      hasNext: limit > 0 ? page * limit < total : false,
      hasPrev: page > 1
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching customers' });
  }
});

app.get('/api/operator/customers/:id', async (req, res) => {
  try {
    const customer = await User.findById(req.params.id).select('-password');
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Privacy-aware access control: operator may only view customers
    // who have an existing booking relationship with them.
    const bookings = await Booking.find({ customerId: req.params.id, operatorId: req.user.userId });
    if (!bookings || bookings.length === 0) {
      return res.status(403).json({ message: 'Access denied: no booking relationship' });
    }
    const reviews = await Review.find({ customerId: req.params.id, operatorId: req.user.userId });

    // Mask sensitive contact fields for privacy
    const masked = customer.toObject();
    if (masked.phone) masked.phone = masked.phone.replace(/.(?=.{4})/g, '*');
    if (masked.email) {
      const [local, domain] = masked.email.split('@');
      masked.email = (local.slice(0, 2) + '***@' + domain);
    }

    res.status(200).json({
      customer: masked,
      bookings,
      reviews,
      totalBookings: bookings.length,
      totalSpent: bookings.reduce((sum, b) => sum + (b.paidAmount || 0), 0)
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching customer details' });
  }
});

// Operator Review Routes
app.get('/api/operator/reviews', async (req, res) => {
  try {
    const filter = { operatorId: req.user.userId };
    const search = searchFilter(['customer', 'comment', 'package'], req.query.search);
    if (search) Object.assign(filter, search);
    const { docs, total, page, limit, totalPages, hasNext, hasPrev } = await findPage(Review, filter, {
      query: req.query,
      sort: { date: -1 }
    });
    const ratingAgg = await Review.aggregate([
      { $match: filter },
      { $group: { _id: null, averageRating: { $avg: '$rating' } } }
    ]);
    pagedResponse(res, 'reviews', { docs, total, page, limit, totalPages, hasNext, hasPrev }, {
      stats: {
        total,
        averageRating: ratingAgg[0]?.averageRating
          ? Math.round(ratingAgg[0].averageRating * 10) / 10
          : 0
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching reviews' });
  }
});

app.put('/api/operator/reviews/:id/respond', async (req, res) => {
  try {
    const review = await Review.findOneAndUpdate(
      { _id: req.params.id, operatorId: req.user.userId },
      {
        response: {
          text: req.body.response,
          date: new Date()
        }
      },
      { new: true }
    );
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }
    if (review.customerId) {
      const cust = await User.findById(review.customerId).select('email fullName');
      if (cust?.email) {
        await sendNotificationEmail(
          cust.email,
          'New Response to Your Review',
          `The tour operator has responded to your review for "${review.package}". Check your notifications for details.`
        ).catch(() => {});
      }
    }
    res.status(200).json({ message: 'Response added successfully', review });
  } catch (error) {
    res.status(500).json({ message: 'Error adding response' });
  }
});

// Operator Revenue Routes
app.get('/api/operator/revenue', async (req, res) => {
  try {
    const range = req.query.range || 'month';
    const since = rangeStart(range);
    const operatorId = new mongoose.Types.ObjectId(req.user.userId);

    // Single aggregation for all payment-status-based revenue sums
    const revenueAgg = await Booking.aggregate([
      { $match: { operatorId } },
      { $group: {
          _id: null,
          totalRevenue: { $sum: { $ifNull: ['$paidAmount', '$amount'] } },
          totalBookings: { $sum: 1 },
          rangeRevenue: { $sum: { $cond: [{ $gte: ['$bookingDate', since] }, { $ifNull: ['$paidAmount', '$amount'] }, 0] } },
          rangeBookings: { $sum: { $cond: [{ $gte: ['$bookingDate', since] }, 1, 0] } },
          pendingRevenue: { $sum: { $cond: [{ $in: ['$paymentStatus', ['pending', 'partial']] }, { $subtract: ['$amount', { $ifNull: ['$paidAmount', 0] }] }, 0] } },
          refundedRevenue: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'refunded'] }, '$amount', 0] } }
      }
      }
    ]);
    const agg = revenueAgg[0] || {};
    const totalRevenue = agg.totalRevenue || 0;
    const rangeRevenue = agg.rangeRevenue || 0;
    const pendingRevenue = agg.pendingRevenue || 0;
    const refundedRevenue = agg.refundedRevenue || 0;
    const totalBookings = agg.totalBookings || 0;
    const rangeBookings = agg.rangeBookings || 0;

    // Revenue by package
    const revenueByPackage = await Booking.aggregate([
      { $match: { operatorId, paymentStatus: 'paid' } },
      { $group: { _id: '$package', revenue: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { revenue: -1 } }
    ]);

    // Monthly revenue via single aggregation (12 months)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11, 1);
    twelveMonthsAgo.setHours(0, 0, 0, 0);

    const monthlyRevenueAgg = await Booking.aggregate([
      { $match: { operatorId, paymentStatus: 'paid', bookingDate: { $gte: twelveMonthsAgo } } },
      { $group: {
          _id: { year: { $year: '$bookingDate' }, month: { $month: '$bookingDate' } },
          revenue: { $sum: { $ifNull: ['$paidAmount', '$amount'] } }
      }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    const monthlyRevenue = [];
    for (let i = 11; i >= 0; i--) {
      const start = new Date();
      start.setMonth(start.getMonth() - i, 1);
      start.setHours(0, 0, 0, 0);
      const monthData = monthlyRevenueAgg.find(
        (m) => m._id.year === start.getFullYear() && m._id.month === (start.getMonth() + 1)
      );
      monthlyRevenue.push(monthData ? monthData.revenue : 0);
    }

    res.status(200).json({
      totalRevenue,
      rangeRevenue,
      pendingRevenue,
      refundedRevenue,
      totalBookings,
      rangeBookings,
      averageBookingValue: totalBookings > 0 ? totalRevenue / totalBookings : 0,
      revenueByPackage,
      monthlyRevenue
    });
  } catch (error) {
    console.error('Revenue error:', error);
    res.status(500).json({ message: 'Error fetching revenue data' });
  }
});

// Operator Notification Routes
app.get('/api/operator/notifications', async (req, res) => {
  try {
    const filter = { userId: req.user.userId };
    const { docs, total, page, limit, totalPages, hasNext, hasPrev } = await findPage(Notification, filter, {
      query: req.query,
      sort: { createdAt: -1 },
      defaultLimit: 50
    });
    const unreadCount = await Notification.countDocuments({ userId: req.user.userId, read: false });
    pagedResponse(res, 'notifications', { docs, total, page, limit, totalPages, hasNext, hasPrev }, { unreadCount });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching notifications' });
  }
});

app.put('/api/operator/notifications/:id/read', async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.userId },
      { read: true },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    res.status(200).json({ message: 'Notification marked as read' });
  } catch (error) {
    res.status(500).json({ message: 'Error marking notification as read' });
  }
});

app.put('/api/operator/notifications/read-all', async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user.userId, read: false },
      { read: true }
    );
    res.status(200).json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ message: 'Error marking all notifications as read' });
  }
});

app.delete('/api/operator/notifications/:id', async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    res.status(200).json({ message: 'Notification deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting notification' });
  }
});

// Operator broadcast for disruption alerts (weather, strike, transport change).
// Only travellers holding a live booking on one of the operator's packages are
// alerted, so the message stays relevant to the trip they are taking.
app.post('/api/operator/disruptions', async (req, res) => {
  try {
    const {
      title,
      message,
      severity = 'warning',
      packageId,
      affectedFrom,
      affectedTo
    } = req.body;

    if (!title || !message) {
      return res.status(400).json({ message: 'title and message are required' });
    }

    const packageFilter = { operatorId: req.user.userId };
    if (packageId) packageFilter._id = packageId;
    const packages = await Package.find(packageFilter).select('_id name');
    const packageIds = packages.map(pkg => pkg._id);
    if (!packageIds.length) {
      return res.status(404).json({ message: 'No packages found for this operator' });
    }

    let bookings = await Booking.find({
      packageId: { $in: packageIds },
      status: { $in: ['pending', 'confirmed'] }
    }).select('customerId customer package packageId dates checkInDate');

    if (affectedFrom || affectedTo) {
      const tripStarts = await resolveTripStarts(bookings);
      bookings = bookings.filter(booking => {
        const tripStart = tripStarts.get(String(booking._id));
        if (!tripStart) return false;
        if (affectedFrom && tripStart < new Date(affectedFrom)) return false;
        if (affectedTo && tripStart > new Date(affectedTo)) return false;
        return true;
      });
    }

    const customerIds = [...new Set(bookings.map(b => b.customerId?.toString()).filter(Boolean))];
    if (!customerIds.length) {
      return res.status(404).json({ message: 'No matching trips found for this alert' });
    }

    const bookingByCustomer = new Map();
    for (const booking of bookings) {
      if (booking.customerId) {
        bookingByCustomer.set(String(booking.customerId), booking);
      }
    }

    let created = 0;
    for (const customerId of customerIds) {
      const booking = bookingByCustomer.get(String(customerId));
      const notification = await createNotification({
        userId: customerId,
        type: 'disruption',
        title,
        message,
        severity,
        bookingId: booking?._id,
        relatedId: booking?._id,
        actionUrl: booking ? `/customer/bookings/${booking._id}/tracker` : '/customer/trip-alerts',
        emailSubject: `Travel alert: ${title}`
      });
      if (notification) created += 1;
    }

    res.status(201).json({ message: 'Disruption alert sent', count: created, affectedBookings: bookings.length });
  } catch (error) {
    console.error('Error sending disruption alert:', error);
    res.status(500).json({ message: 'Error sending disruption alert' });
  }
});

// =============================================================================
// Customer Communication — operator sends booking/itinerary updates to
// customers through the platform with a full audit trail.
// =============================================================================
app.get('/api/operator/communication', async (req, res) => {
  try {
    const filter = { operatorId: req.user.userId };
    const search = searchFilter(['title', 'message'], req.query.search);
    if (search) Object.assign(filter, search);
    if (req.query.type) filter.type = req.query.type;
    if (req.query.channel) filter.channel = req.query.channel;
    if (req.query.status) filter.status = req.query.status;

    const { docs, total, page, limit, totalPages, hasNext, hasPrev } = await findPage(Communication, filter, {
      query: req.query,
      sort: { sentAt: -1 }
    });
    pagedResponse(res, 'communications', { docs, total, page, limit, totalPages, hasNext, hasPrev });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching communications' });
  }
});

app.get('/api/operator/communication/:id', async (req, res) => {
  try {
    const communication = await Communication.findOne({
      _id: req.params.id,
      operatorId: req.user.userId
    });
    if (!communication) {
      return res.status(404).json({ message: 'Communication not found' });
    }
    res.status(200).json({ communication });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching communication' });
  }
});

app.post('/api/operator/communication', async (req, res) => {
  try {
    const {
      type,
      channel,
      title,
      message,
      recipientType,
      customerId,
      bookingId,
      packageId
    } = req.body;

    if (!type || !channel || !title || !message || !recipientType) {
      return res.status(400).json({ message: 'type, channel, title, message and recipientType are required' });
    }

    let customerIds = [];
    let relatedBooking = null;
    let relatedPackage = null;

    if (recipientType === 'single') {
      if (!customerId) {
        return res.status(400).json({ message: 'customerId is required for single recipient' });
      }
      customerIds = [customerId];
    } else if (recipientType === 'booking') {
      if (!bookingId) {
        return res.status(400).json({ message: 'bookingId is required for booking recipient' });
      }
      relatedBooking = await Booking.findOne({ _id: bookingId, operatorId: req.user.userId });
      if (!relatedBooking) {
        return res.status(404).json({ message: 'Booking not found' });
      }
      customerIds = relatedBooking.customerId ? [relatedBooking.customerId.toString()] : [];
    } else if (recipientType === 'package') {
      if (!packageId) {
        return res.status(400).json({ message: 'packageId is required for package recipient' });
      }
      relatedPackage = await Package.findOne({ _id: packageId, operatorId: req.user.userId });
      if (!relatedPackage) {
        return res.status(404).json({ message: 'Package not found' });
      }
      const packageBookings = await Booking.find({ packageId: relatedPackage._id, status: { $in: ['pending', 'confirmed'] } }).select('customerId');
      customerIds = [...new Set(packageBookings.map(b => b.customerId?.toString()).filter(Boolean))];
    } else if (recipientType === 'all_confirmed') {
      const confirmedBookings = await Booking.find({ operatorId: req.user.userId, status: 'confirmed' }).select('customerId');
      customerIds = [...new Set(confirmedBookings.map(b => b.customerId?.toString()).filter(Boolean))];
    } else {
      return res.status(400).json({ message: 'Invalid recipientType' });
    }

    if (!customerIds.length) {
      return res.status(404).json({ message: 'No customers found for the selected recipients' });
    }

    let inAppSent = false;
    let emailSent = channel === 'email' || channel === 'both';
    let errorMessage = null;
    let successCount = 0;

    const notificationType = type === 'itinerary_update' ? 'itinerary_change'
      : type === 'booking_update' ? 'booking'
      : type === 'disruption' ? 'disruption' : 'system';

    for (const custId of customerIds) {
      try {
        const notification = await createNotification({
          userId: custId,
          type: notificationType,
          title,
          message,
          relatedId: relatedBooking ? relatedBooking._id : undefined,
          bookingId: relatedBooking ? relatedBooking._id : undefined,
          actionUrl: relatedBooking ? `/customer/bookings/${relatedBooking._id}/tracker` : '/customer/trip-alerts',
          severity: type === 'disruption' ? 'warning' : 'info',
          email: channel === 'email' || channel === 'both',
          emailSubject: title
        });
        if (notification) {
          inAppSent = true;
          successCount += 1;
        }
      } catch (err) {
        console.error('Communication in-app failed for', custId, err.message);
        errorMessage = errorMessage || err.message;
      }
    }

    const status = successCount === customerIds.length ? 'sent' : successCount > 0 ? 'partial' : 'failed';

    const communication = new Communication({
      operatorId: req.user.userId,
      type,
      channel,
      title,
      message,
      recipientType,
      recipientCount: customerIds.length,
      relatedBookingId: relatedBooking ? relatedBooking._id : undefined,
      relatedPackageId: relatedPackage ? relatedPackage._id : undefined,
      status,
      emailSent,
      inAppSent,
      errorMessage
    });
    await communication.save();

    res.status(201).json({
      message: 'Communication sent',
      communication,
      recipientCount: customerIds.length,
      successCount
    });
  } catch (error) {
    console.error('Error sending communication:', error);
    res.status(500).json({ message: 'Error sending communication' });
  }
});

// =============================================================================
// Public Routes
// =============================================================================

// Public Package Routes (no auth required)
app.get('/api/packages', async (req, res) => {
  try {
    const { publishedOnly, category, search } = req.query;
    const filter = {};
    if (publishedOnly === 'true') {
      filter.publishedStatus = 'published';
    }
    if (category && category !== 'all') {
      filter.category = category;
    }
    if (search) {
      const rx = new RegExp(escapeRegExp(search), 'i');
      filter.$or = [{ name: rx }, { destination: rx }, { category: rx }];
    }
    const { docs, total, page, limit, totalPages, hasNext, hasPrev } = await findPage(Package, filter, {
      query: req.query,
      sort: { createdAt: -1 }
    });
    pagedResponse(res, 'packages', { docs, total, page, limit, totalPages, hasNext, hasPrev });
  } catch (error) {
    console.error('Error fetching packages:', error);
    res.status(500).json({ message: 'Error fetching packages' });
  }
});

app.get('/api/packages/:id', async (req, res) => {
  try {
    const pkg = await Package.findById(req.params.id).populate('operatorId', 'companyName').lean();
    if (!pkg) {
      return res.status(404).json({ message: 'Package not found' });
    }
    res.status(200).json({ package: pkg });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching package' });
  }
});

// Public Hotel Routes
app.get('/api/public/hotels', async (req, res) => {
  try {
    const { location, search } = req.query;
    const filter = { status: 'active' };
    if (location && location !== 'all') {
      filter.location = location;
    }
    if (search) {
      const rx = new RegExp(escapeRegExp(search), 'i');
      filter.$or = [{ name: rx }, { location: rx }, { partner: rx }];
    }
    const { docs, total, page, limit, totalPages, hasNext, hasPrev } = await findPage(Hotel, filter, {
      query: req.query,
      sort: { createdAt: -1 }
    });

    // Batch-fetch all rooms for matched hotels in a single query (N+1 fix)
    const allRooms = await Room.find({ hotel: { $in: docs.map((h) => h.name) } }).lean();
    const roomsByHotel = {};
    allRooms.forEach((r) => {
      if (!roomsByHotel[r.hotel]) roomsByHotel[r.hotel] = [];
      roomsByHotel[r.hotel].push(r);
    });

    const hotelsWithMinPrice = docs.map((hotel) => {
      const rooms = roomsByHotel[hotel.name] || [];
      const minPrice = rooms.length > 0 ? Math.min(...rooms.map((r) => r.price)) : 0;
      return {
        ...hotel,
        minPrice,
        rooms
      };
    });
    pagedResponse(res, 'hotels', { docs: hotelsWithMinPrice, total, page, limit, totalPages, hasNext, hasPrev });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching hotels' });
  }
});

app.get('/api/public/hotels/:id', async (req, res) => {
  try {
    const hotel = await Hotel.findById(req.params.id);
    if (!hotel) {
      return res.status(404).json({ message: 'Hotel not found' });
    }
    const rooms = await Room.find({ hotel: hotel.name }).lean();
    const minPrice = rooms.length > 0 ? Math.min(...rooms.map((r) => r.price)) : 0;
    res.status(200).json({ hotel: { ...hotel.toObject(), minPrice, rooms } });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching hotel' });
  }
});

// Public Destination Routes (aggregated destinations from packages)
app.get('/api/public/destinations', async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req.query, { defaultLimit: 20 });
    const pageStages = [{ $sort: { count: -1 } }];
    if (limit > 0) {
      pageStages.push({ $skip: skip }, { $limit: limit });
    }
    const [facet] = await Package.aggregate([
      { $match: { publishedStatus: 'published' } },
      { $sort: { rating: -1 } },
      {
        $group: {
          _id: '$destination',
          name: { $first: '$destination' },
          count: { $sum: 1 },
          image: { $first: { $ifNull: ['$$ROOT.image', { $arrayElemAt: ['$images', 0] }] } },
          packages: { $push: { _id: '$_id', name: '$name', price: '$price', rating: '$rating' } },
          rating: { $avg: '$rating' }
        }
      },
      {
        $project: {
          packageCount: '$count',
          packages: { $slice: ['$packages', 5] }
        }
      },
      { $facet: { data: pageStages, total: [{ $count: 'count' }] } }
    ]);
    const docs = facet?.data || [];
    const total = facet?.total?.[0]?.count || 0;
    const totalPages = limit > 0 ? Math.max(1, Math.ceil(total / limit)) : 1;
    pagedResponse(res, 'destinations', {
      docs,
      total,
      page,
      limit,
      totalPages,
      hasNext: limit > 0 ? page * limit < total : false,
      hasPrev: page > 1
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching destinations' });
  }
});

// =============================================================================
// Customer Routes (require authenticate + requireCustomer)
// =============================================================================
app.use('/api/customer', authenticate, requireCustomer);

// --- Profile ---
function serializeProfile(user) {
  return {
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    alternatePhone: user.alternatePhone || '',
    address: user.address || '',
    avatar: user.avatar || '',
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    lastLogin: user.lastLogin,
    passwordChangedAt: user.passwordChangedAt
  };
}

app.get('/api/customer/profile', async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json({ profile: serializeProfile(user) });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching profile' });
  }
});

app.put('/api/customer/profile', async (req, res) => {
  try {
    const updates = pickUpdates(req.body, ['fullName', 'email', 'phone', 'alternatePhone', 'address', 'avatar']);
    if (!Object.keys(updates).length) {
      return res.status(400).json({ message: 'No profile changes to save' });
    }

    if (updates.email) updates.email = String(updates.email).trim().toLowerCase();
    if (updates.phone) updates.phone = String(updates.phone).trim();
    if (updates.alternatePhone) updates.alternatePhone = String(updates.alternatePhone).trim();

    const contactCheck = validateContactDetails({
      fullName: updates.fullName,
      email: updates.email,
      phone: updates.phone
    });
    if (!contactCheck.valid) {
      return res.status(400).json({ message: contactCheck.message });
    }
    if (updates.alternatePhone && !PHONE_PATTERN.test(updates.alternatePhone)) {
      return res.status(400).json({ message: 'Alternate phone number is not valid' });
    }

    const previous = await User.findById(req.user.userId).select('email').lean();
    const emailChanged = Boolean(updates.email) && updates.email !== previous?.email;

    if (emailChanged) {
      const existing = await User.findOne({ email: updates.email, _id: { $ne: req.user.userId } });
      if (existing) {
        return res.status(400).json({ message: 'Email already in use' });
      }
    }

    const user = await User.findByIdAndUpdate(req.user.userId, updates, { new: true }).select('-password');
    invalidateSecurityStateCache(req.user.userId);

    // Changing the sign-in address ends every other session, so a stolen token
    // cannot outlive the change.
    let revokedSessions = 0;
    if (emailChanged) {
      revokedSessions = await revokeOtherSessions(req.user.userId, req.user.jti);
      if (previous?.email) {
        await sendNotificationEmail(
          previous.email,
          'Your account email was changed',
          `The sign-in email on your TravelTour account was changed to ${updates.email}. If this was not you, reset your password immediately.`
        ).catch(err => console.error('Profile change email failed:', err.message));
      }
      await sendNotificationEmail(
        updates.email,
        'Your account email was updated',
        `The sign-in email on your TravelTour account is now ${updates.email}. Other devices have been signed out.`
      ).catch(err => console.error('Profile change email failed:', err.message));
    }

    res.status(200).json({
      message: emailChanged
        ? 'Profile updated. Other devices have been signed out.'
        : 'Profile updated successfully',
      profile: serializeProfile(user),
      revokedSessions
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ message: 'Error updating profile' });
  }
});

// --- Customer profile image upload ---
app.post('/api/customer/profile/image', authenticate, requireCustomer, async (req, res) => {
  uploadAvatar(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'Image must be smaller than 5 MB' });
      }
      return res.status(400).json({ message: err.message || 'Upload failed' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      // Clean up the orphaned file
      fs.unlink(req.file.path, () => {});
      return res.status(404).json({ message: 'User not found' });
    }

    // Remove the previous avatar file if it is a locally stored one
    const prevAvatar = user.avatar || '';
    if (prevAvatar && prevAvatar.includes('/api/uploads/avatars/')) {
      const prevFileName = path.basename(prevAvatar);
      const prevPath = path.join(AVATAR_DIR, prevFileName);
      fs.unlink(prevPath, () => {});
    }

    const avatarUrl = `/api/uploads/avatars/${req.file.filename}`;
    user.avatar = avatarUrl;
    await user.save();
    invalidateSecurityStateCache(req.user.userId);

    res.status(200).json({
      message: 'Profile image uploaded successfully',
      profile: serializeProfile(user),
      avatarUrl,
    });
  });
});

// Remove customer profile image
app.delete('/api/customer/profile/image', authenticate, requireCustomer, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const prevAvatar = user.avatar || '';
    if (prevAvatar && prevAvatar.includes('/api/uploads/avatars/')) {
      const prevFileName = path.basename(prevAvatar);
      const prevPath = path.join(AVATAR_DIR, prevFileName);
      fs.unlink(prevPath, () => {});
    }

    user.avatar = '';
    await user.save();
    invalidateSecurityStateCache(req.user.userId);

    res.status(200).json({
      message: 'Profile image removed',
      profile: serializeProfile(user),
    });
  } catch (error) {
    console.error('Error removing profile image:', error);
    res.status(500).json({ message: 'Error removing profile image' });
  }
});

// =============================================================================
// Admin Profile (require authenticate + requireAdmin)
// =============================================================================
app.get('/api/admin/profile', async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json({ profile: serializeProfile(user) });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching profile' });
  }
});

app.put('/api/admin/profile', async (req, res) => {
  try {
    const updates = pickUpdates(req.body, ['fullName', 'email', 'phone', 'alternatePhone', 'address', 'avatar']);
    if (!Object.keys(updates).length) {
      return res.status(400).json({ message: 'No profile changes to save' });
    }

    if (updates.email) updates.email = String(updates.email).trim().toLowerCase();
    if (updates.phone) updates.phone = String(updates.phone).trim();
    if (updates.alternatePhone) updates.alternatePhone = String(updates.alternatePhone).trim();

    const contactCheck = validateContactDetails({
      fullName: updates.fullName,
      email: updates.email,
      phone: updates.phone
    });
    if (!contactCheck.valid) {
      return res.status(400).json({ message: contactCheck.message });
    }
    if (updates.alternatePhone && !PHONE_PATTERN.test(updates.alternatePhone)) {
      return res.status(400).json({ message: 'Alternate phone number is not valid' });
    }

    const previous = await User.findById(req.user.userId).select('email').lean();
    const emailChanged = Boolean(updates.email) && updates.email !== previous?.email;

    if (emailChanged) {
      const existing = await User.findOne({ email: updates.email, _id: { $ne: req.user.userId } });
      if (existing) {
        return res.status(400).json({ message: 'Email already in use' });
      }
    }

    const user = await User.findByIdAndUpdate(req.user.userId, updates, { new: true }).select('-password');
    invalidateSecurityStateCache(req.user.userId);

    let revokedSessions = 0;
    if (emailChanged) {
      revokedSessions = await revokeOtherSessions(req.user.userId, req.user.jti);
      if (previous?.email) {
        await sendNotificationEmail(
          previous.email,
          'Your admin account email was changed',
          `The sign-in email on your TravelTour admin account was changed to ${updates.email}. If this was not you, reset your password immediately.`
        ).catch(err => console.error('Admin profile change email failed:', err.message));
      }
      await sendNotificationEmail(
        updates.email,
        'Your admin account email was updated',
        `The sign-in email on your TravelTour admin account is now ${updates.email}. Other devices have been signed out.`
      ).catch(err => console.error('Admin profile change email failed:', err.message));
    }

    res.status(200).json({
      message: emailChanged
        ? 'Profile updated. Other devices have been signed out.'
        : 'Profile updated successfully',
      profile: serializeProfile(user),
      revokedSessions
    });
  } catch (error) {
    console.error('Error updating admin profile:', error);
    res.status(500).json({ message: 'Error updating profile' });
  }
});

// --- Admin profile image upload ---
app.post('/api/admin/profile/image', authenticate, requireAdmin, async (req, res) => {
  uploadAvatar(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'Image must be smaller than 5 MB' });
      }
      return res.status(400).json({ message: err.message || 'Upload failed' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      fs.unlink(req.file.path, () => {});
      return res.status(404).json({ message: 'User not found' });
    }

    const prevAvatar = user.avatar || '';
    if (prevAvatar && prevAvatar.includes('/api/uploads/avatars/')) {
      const prevFileName = path.basename(prevAvatar);
      const prevPath = path.join(AVATAR_DIR, prevFileName);
      fs.unlink(prevPath, () => {});
    }

    const avatarUrl = `/api/uploads/avatars/${req.file.filename}`;
    user.avatar = avatarUrl;
    await user.save();
    invalidateSecurityStateCache(req.user.userId);

    res.status(200).json({
      message: 'Profile image uploaded successfully',
      profile: serializeProfile(user),
      avatarUrl,
    });
  });
});

// Remove admin profile image
app.delete('/api/admin/profile/image', authenticate, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const prevAvatar = user.avatar || '';
    if (prevAvatar && prevAvatar.includes('/api/uploads/avatars/')) {
      const prevFileName = path.basename(prevAvatar);
      const prevPath = path.join(AVATAR_DIR, prevFileName);
      fs.unlink(prevPath, () => {});
    }

    user.avatar = '';
    await user.save();
    invalidateSecurityStateCache(req.user.userId);

    res.status(200).json({
      message: 'Profile image removed',
      profile: serializeProfile(user),
    });
  } catch (error) {
    console.error('Error removing admin profile image:', error);
    res.status(500).json({ message: 'Error removing profile image' });
  }
});

// --- Account security ---
registerAccountSecurityRoutes('/api/customer');
registerAccountSecurityRoutes('/api/admin');

// --- Packages (customer view of published packages) ---
app.get('/api/customer/packages', async (req, res) => {
  try {
    const { category, search, bestseller } = req.query;
    const filter = { publishedStatus: 'published' };
    if (category && category !== 'all') filter.category = category;
    if (search) {
      const rx = new RegExp(escapeRegExp(search), 'i');
      filter.$or = [{ name: rx }, { destination: rx }, { category: rx }];
    }
    if (bestseller === 'true') filter.rating = { $gte: 4 };
    const { docs, total, page, limit, totalPages, hasNext, hasPrev } = await findPage(Package, filter, {
      query: req.query,
      sort: { createdAt: -1 },
      defaultLimit: 50
    });
    pagedResponse(res, 'packages', { docs, total, page, limit, totalPages, hasNext, hasPrev });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching packages' });
  }
});

// --- Bookings ---
app.get('/api/customer/bookings', async (req, res) => {
  try {
    const filter = { customerId: req.user.userId };
    const search = searchFilter(['bookingId', 'package', 'customer', 'email'], req.query.search);
    if (search) Object.assign(filter, search);
    const { docs, total, page, limit, totalPages, hasNext, hasPrev } = await findPage(Booking, filter, {
      query: req.query,
      populate: { path: 'packageId', select: 'name destination image price' },
      sort: { bookingDate: -1 }
    });
    const spentAgg = await Booking.aggregate([
      { $match: { customerId: new mongoose.Types.ObjectId(req.user.userId) } },
      { $group: { _id: null, totalSpent: { $sum: { $ifNull: ['$paidAmount', 0] } } } }
    ]);
    pagedResponse(res, 'bookings', { docs, total, page, limit, totalPages, hasNext, hasPrev }, {
      stats: {
        total,
        totalSpent: spentAgg[0]?.totalSpent || 0
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching bookings' });
  }
});

// Reserves seats from availability records covering the booking date.
// Decrements availableSeats and increments soldSeats atomically. Returns the
// matched availability document, or throws when seats are insufficient.
async function reservePackageSeats(packageId, bookingDate, travelers) {
  if (!packageId || !travelers || travelers <= 0) return null;
  let tripDate = null;
  if (bookingDate) {
    const raw = String(bookingDate).trim();
    const iso = raw.match(/(\d{4}-\d{2}-\d{2})/);
    if (iso) {
      tripDate = new Date(iso[1]);
    } else {
      tripDate = new Date(raw);
    }
  }
  if (!tripDate || isNaN(tripDate.getTime())) return null;
  const startOfDay = new Date(tripDate.getFullYear(), tripDate.getMonth(), tripDate.getDate());
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);
  const availability = await Availability.findOne({
    packageId,
    operatorId: { $exists: true },
    startDate: { $lte: endOfDay },
    endDate: { $gte: startOfDay },
    status: { $in: ['active', 'available', 'limited'] },
    availableSeats: { $gte: travelers }
  }).sort({ availableSeats: 1 });
  if (!availability) {
    console.warn(`[reservePackageSeats] No availability record for package ${packageId} on ${startOfDay.toISOString().split('T')[0]} — proceeding without seat deduction`);
    return null;
  }
  if ((availability.availableSeats || 0) < travelers) {
    console.warn(`[reservePackageSeats] Insufficient seats for package ${packageId} on ${startOfDay.toISOString().split('T')[0]} (available=${availability.availableSeats}, requested=${travelers}) — proceeding without seat deduction`);
    return null;
  }
  availability.availableSeats = (availability.availableSeats || 0) - travelers;
  availability.soldSeats = ((availability.soldSeats || 0) + travelers);
  if (availability.availableSeats <= 0) {
    availability.status = 'inactive';
  } else if (availability.availableSeats <= Math.ceil((availability.totalSeats || 0) * 0.2)) {
    availability.status = 'active';
  }
  await availability.save();
  return availability;
}

// Releases previously reserved seats when a booking is cancelled.
async function releasePackageSeats(booking) {
  if (!booking.packageId || !booking.travelers || booking.travelers <= 0) return;
  const tripDate = booking.dates ? new Date(String(booking.dates).match(/(\d{4}-\d{2}-\d{2})/)?.[1] || String(booking.dates)) : null;
  if (!tripDate || isNaN(tripDate.getTime())) return;
  const startOfDay = new Date(tripDate.getFullYear(), tripDate.getMonth(), tripDate.getDate());
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);
  const availability = await Availability.findOne({
    packageId: booking.packageId,
    startDate: { $lte: endOfDay },
    endDate: { $gte: startOfDay }
  });
  if (!availability) return;
  availability.availableSeats = Math.max(0, (availability.availableSeats || 0) + booking.travelers);
  availability.soldSeats = Math.max(0, (availability.soldSeats || 0) - booking.travelers);
  if (availability.availableSeats > 0) {
    availability.status = 'active';
  }
  await availability.save();
}

app.post('/api/customer/bookings', async (req, res) => {
  let seatsReserved = false;
  let packageId = null, dates = null, travelers = null;
  try {
    const { package: packageName, hotelId, hotelName, amount, email, phone, customer, coupon } = req.body;
    packageId = req.body.packageId;
    dates = req.body.dates;
    travelers = req.body.travelers;
    const originalAmount = Number(amount) || 0;
    let finalAmount = originalAmount;
    let discountAmount = 0;
    let couponInfo = null;

    if (coupon && coupon.code) {
      const bookingType = coupon.bookingType || (packageId ? 'package' : 'hotel');
      const validation = await validateCouponForRequest({
        code: coupon.code,
        bookingType,
        packageId: coupon.packageId || packageId,
        hotelId: coupon.hotelId,
        amount: originalAmount,
        userId: req.user.userId
      });
      if (!validation.success) {
        return res.status(400).json({ message: validation.message });
      }
      discountAmount = validation.discountAmount;
      finalAmount = validation.finalAmount;
      couponInfo = validation.coupon;
    }

    const payload = {
      customerId: req.user.userId,
      customer: customer || req.user.userId,
      email: email || req.user.email,
      package: packageName || '',
      dates: dates || '',
      travelers: travelers || 1,
      amount: finalAmount,
      originalAmount,
      discountAmount,
      finalAmount,
      status: 'pending',
      paymentStatus: 'pending',
      bookingId: `BKG-${Date.now().toString().slice(-8)}`
    };
    if (couponInfo) {
      payload.coupon = couponInfo;
    }

    // Apply membership discount on top of coupon discount (no stacking beyond max)
    try {
      const membershipDiscount = await applyMembershipDiscount(req.user.userId, finalAmount, true);
      if (membershipDiscount.membershipId) {
        payload.membershipId = membershipDiscount.membershipId;
        payload.membershipDiscountPercentage = membershipDiscount.discountPercentage;
        payload.membershipDiscountAmount = membershipDiscount.discountAmount;
        // Recompute final amount after membership discount (coupon already applied)
        finalAmount = membershipDiscount.finalAmount;
        payload.amount = finalAmount;
        payload.finalAmount = finalAmount;
        payload.discountAmount = (payload.discountAmount || 0) + membershipDiscount.discountAmount;
      }
    } catch (membershipErr) {
      console.error('Membership discount error:', membershipErr.message);
      // Non-fatal: proceed without membership discount
    }

    if (packageId) {
      payload.packageId = packageId;
      const pkg = await Package.findById(packageId);
      if (pkg) {
        payload.operatorId = pkg.operatorId;
        payload.package = pkg.name;
        if (pkg.cancellationPolicy && pkg.cancellationPolicy.enabled && pkg.cancellationPolicy.rules && pkg.cancellationPolicy.rules.length > 0) {
          payload.cancellationPolicySnapshot = {
            enabled: pkg.cancellationPolicy.enabled,
            rules: pkg.cancellationPolicy.rules.map(rule => ({
              minDaysBeforeTrip: rule.minDaysBeforeTrip,
              refundPercentage: rule.refundPercentage
            }))
          };
        }
      }
      // Enforce inventory control: reject booking when seats are insufficient
      // for the selected travel date, otherwise reserve them.
      const numTravelers = Number(travelers) || 1;
      await reservePackageSeats(packageId, dates, numTravelers);
      seatsReserved = true;
    }
    // Persist hotel references so hotel booking history (used by the
    // recommendation engine) is complete for customer-initiated stays.
    if (hotelId && mongoose.Types.ObjectId.isValid(hotelId)) {
      payload.hotelId = hotelId;
    }
    if (hotelName) {
      payload.hotelName = String(hotelName).slice(0, 200);
    }
    payload.timeline = [{ status: 'pending', date: new Date(), note: 'Booking created' }];
    const newBooking = new Booking(payload);
    await newBooking.save();
    if (packageId) {
      await Package.findByIdAndUpdate(packageId, { $inc: { bookings: 1 } }).catch(() => {});
    }
    await Notification.create({
      userId: req.user.userId,
      type: 'booking',
      title: 'Booking Confirmed',
      message: `Your booking for ${payload.package || 'hotel'} (${payload.bookingId}) has been received and is pending confirmation. Amount: ₹${finalAmount || 0}.`,
      relatedId: newBooking._id,
      read: false
    });
    if (req.user.email) {
      await sendNotificationEmail(
        req.user.email,
        'Booking Confirmation',
        `Your booking <strong>${payload.bookingId}</strong> for ${payload.package || 'hotel'} has been received and is pending confirmation. Amount: ₹${finalAmount || 0}.`
      );
    }
    if (payload.operatorId) {
      const opUser = await User.findById(payload.operatorId).select('email');
      if (opUser?.email) {
        await sendNotificationEmail(
          opUser.email,
          'New Booking Received',
          `A new booking <strong>${payload.bookingId}</strong> has been placed for your package "${payload.package}". Amount: ₹${finalAmount || 0}.`
        );
      }
      // In-app alert so the operator sees the booking without waiting for mail.
      await createNotification({
        userId: payload.operatorId,
        type: 'booking',
        title: 'New Booking Received',
        message: `${payload.customer || 'A customer'} booked "${payload.package || 'your package'}" (${payload.bookingId}) for ${payload.dates || 'the scheduled date'}. Amount: ₹${finalAmount || 0}.`,
        bookingId: newBooking._id,
        relatedId: newBooking._id,
        severity: 'info',
        actionUrl: `/tour-operator/bookings`,
        email: false
      });
    }
    res.status(201).json({ message: 'Booking created successfully', booking: newBooking });
  } catch (error) {
    if (seatsReserved && packageId) {
      try {
        await releasePackageSeats({ packageId, travelers: Number(travelers) || 1, dates });
      } catch (releaseErr) {
        console.error('Failed to release reserved seats:', releaseErr.message);
      }
    }
    console.error('Error creating booking:', error);
    const status = error.statusCode || 500;
    res.status(status).json({ message: error.message || 'Error creating booking' });
  }
});

app.get('/api/customer/bookings/:id', async (req, res) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, customerId: req.user.userId })
      .populate('packageId', 'name destination image price operatorId');
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    res.status(200).json({ booking });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching booking' });
  }
});

app.put('/api/customer/bookings/:id', async (req, res) => {
  try {
    const updates = pickUpdates(req.body, ['dates', 'travelers', 'phone', 'status', 'paymentStatus']);
    if (req.body.status) {
      updates.$push = { timeline: { status: req.body.status, date: new Date(), note: 'Status updated by customer' } };
    }
    const booking = await Booking.findOneAndUpdate(
      { _id: req.params.id, customerId: req.user.userId },
      updates,
      { new: true }
    );
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    if (req.body.status && req.body.status !== booking.status) {
      await Notification.create({
        userId: req.user.userId,
        type: 'booking',
        title: 'Booking Status Updated',
        message: `Your booking (${booking.bookingId}) status has been updated to "${req.body.status}".`,
        relatedId: booking._id,
        read: false
      });
      if (req.user.email) {
        if (req.body.status === 'cancelled') {
          await sendNotificationEmail(
            req.user.email,
            'Booking Cancelled',
            `Your booking <strong>${booking.bookingId}</strong> for ${booking.package || 'package'} has been cancelled. If a refund is applicable, it will be processed within 5-7 business days.`
          );
        } else {
          await sendNotificationEmail(
            req.user.email,
            'Booking Status Updated',
            `Your booking <strong>${booking.bookingId}</strong> status has been updated to "${req.body.status}".`
          );
        }
      }
    }
    if (req.body.paymentStatus && (req.body.paymentStatus === 'refunded' || req.body.paymentStatus === 'failed')) {
      await Notification.create({
        userId: req.user.userId,
        type: 'payment',
        title: 'Payment Cancelled',
        message: `Your payment for booking (${booking.bookingId}) has been ${req.body.paymentStatus}. A refund will be initiated if applicable.`,
        relatedId: booking._id,
        read: false
      });
      if (req.user.email) {
        await sendNotificationEmail(
          req.user.email,
          'Payment Cancelled',
          `Your payment for booking <strong>${booking.bookingId}</strong> has been ${req.body.paymentStatus}. A refund will be initiated if applicable.`
        );
      }
    }
    res.status(200).json({ message: 'Booking updated', booking });
  } catch (error) {
    res.status(500).json({ message: 'Error updating booking' });
  }
});

app.put('/api/customer/bookings/:id/pay', async (req, res) => {
  try {
    const { amount } = req.body;
    const booking = await Booking.findOne({ _id: req.params.id, customerId: req.user.userId });
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    const totalDue = booking.finalAmount || booking.amount;
    const paymentAmount = Math.min(amount || 0, totalDue - (booking.paidAmount || 0));
    booking.paidAmount = (booking.paidAmount || 0) + paymentAmount;
    if (booking.paidAmount >= totalDue) {
      booking.paymentStatus = 'paid';
      booking.status = 'confirmed';
    } else if (booking.paidAmount > 0) {
      booking.paymentStatus = 'partial';
    }
    booking.timeline.push({ status: booking.paymentStatus, date: new Date(), note: `Payment of ₹${paymentAmount} received` });
    await booking.save();
    if (booking.paymentStatus === 'paid') {
      if (booking.coupon && booking.coupon.couponId) {
        const existingUsage = await CouponUsage.findOne({ couponId: booking.coupon.couponId, userId: booking.customerId || req.user.userId, bookingId: booking._id }).catch(() => null)
        if (!existingUsage) {
          await Coupon.findByIdAndUpdate(booking.coupon.couponId, { $inc: { usage: 1 } }).catch(() => {})
          await CouponUsage.create({
            couponId: booking.coupon.couponId,
            userId: booking.customerId || req.user.userId,
            bookingId: booking._id,
            discountAmount: booking.coupon.discountAmount || 0
          }).catch(() => {})
        }
      }
      const invoice = await createPaidInvoice(booking);
      await Notification.create({
          userId: req.user.userId,
          type: 'payment',
          title: 'Payment Confirmed',
          message: `Payment of ₹${paymentAmount} received. Your booking (${booking.bookingId}) is now fully confirmed.`,
          relatedId: booking._id,
          read: false
        });
      if (req.user.email) {
        const pdfBuffer = await generateInvoicePDF(invoice, booking);
        await sendCardEmailWithAttachment(
          req.user.email,
          'Payment Confirmation & Invoice',
          'Payment Confirmed!',
          `Payment of ₹${paymentAmount} received. Your booking <strong>${booking.bookingId}</strong> is now fully confirmed. Invoice: ${invoice.invoiceNo || 'N/A'}.`,
          [{ name: `invoice_${invoice.invoiceNo || 'invoice'}.pdf`, content: pdfBuffer }]
        ).catch(err => console.error('Invoice email failed:', err.message));
      }
    } else if (booking.paymentStatus === 'partial') {
      await Notification.create({
        userId: req.user.userId,
        type: 'payment',
        title: 'Partial Payment Received',
        message: `Payment of ₹${paymentAmount} received. Remaining balance: ₹${booking.amount - booking.paidAmount}.`,
        relatedId: booking._id,
        read: false
      });
      if (req.user.email) {
        await sendNotificationEmail(
          req.user.email,
          'Partial Payment Received',
          `Payment of ₹${paymentAmount} received for booking <strong>${booking.bookingId}</strong>. Remaining balance: ₹${booking.amount - booking.paidAmount}.`
        );
      }
    }
    res.status(200).json({ message: 'Payment processed', booking });
  } catch (error) {
    res.status(500).json({ message: 'Error processing payment' });
  }
});

// --- Stripe Checkout Session ---
app.post('/api/customer/bookings/:id/stripe-checkout', authenticate, requireCustomer, async (req, res) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, customerId: req.user.userId });
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    if (booking.status === 'cancelled' || booking.status === 'rejected') {
      return res.status(400).json({ message: 'Booking is not payable' });
    }
    if (booking.paymentStatus === 'paid') {
      return res.status(400).json({ message: 'Booking is already paid' });
    }

    const totalDue = Math.ceil((booking.finalAmount || booking.amount || 0) - (booking.paidAmount || 0));
    if (totalDue <= 0) {
      return res.status(400).json({ message: 'No amount due' });
    }

    // Reuse existing pending stripe session if present
    if (booking.stripeSessionId && booking.stripeSessionStatus === 'pending') {
      try {
        const existing = await getStripe().checkout.sessions.retrieve(booking.stripeSessionId);
        if (existing.payment_status === 'unpaid') {
          return res.status(200).json({
            checkoutUrl: existing.url,
            sessionId: existing.id,
            bookingId: booking._id,
            message: 'Reusing existing checkout session',
          });
        }
      } catch (err) {
        // Session may be expired; fall through to create a new one
      }
    }

    const session = await getStripe().checkout.sessions.create({
      payment_method_types: ['card', 'upi'],
      line_items: [{
        price_data: {
          currency: 'inr',
          product_data: {
            name: booking.package || booking.hotelName || 'Travel Tour Booking',
            description: booking.bookingId,
          },
          unit_amount: totalDue * 100, // INR -> paise
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/customer/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/customer/bookings`,
      metadata: {
        bookingId: booking._id.toString(),
        customerId: req.user.userId,
        bookingReference: booking.bookingId,
      },
      client_reference_id: req.user.userId,
    });

    booking.stripeSessionId = session.id;
    booking.stripeSessionStatus = 'pending';
    booking.stripeAmount = totalDue;
    booking.stripeCurrency = 'inr';
    booking.stripeCreatedAt = new Date();
    await booking.save();

    res.status(200).json({
      message: 'Checkout session created',
      checkoutUrl: session.url,
      sessionId: session.id,
      bookingId: booking._id,
      bookingReference: booking.bookingId,
      amount: totalDue,
    });
  } catch (error) {
    console.error('Stripe checkout error:', error.message);
    res.status(500).json({ message: 'Error creating checkout session' });
  }
});

// --- Stripe Session Verify ---
app.get('/api/customer/bookings/:id/stripe-verify/:sessionId', authenticate, requireCustomer, async (req, res) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, customerId: req.user.userId });
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const session = await getStripe().checkout.sessions.retrieve(req.params.sessionId);

    // Verify session belongs to this booking/customer
    if (session.metadata.bookingId !== booking._id.toString()) {
      return res.status(400).json({ message: 'Session does not match this booking' });
    }
    if (session.client_reference_id !== req.user.userId) {
      return res.status(400).json({ message: 'Session does not belong to this customer' });
    }

    // Update booking based on session status (idempotent)
    const sessionStatus = session.payment_status;
    let changed = false;
    if (sessionStatus === 'paid' && booking.paymentStatus !== 'paid') {
      booking.paymentStatus = 'paid';
      booking.status = 'confirmed';
      booking.paidAmount = booking.finalAmount || booking.amount;
      booking.stripeSessionStatus = 'paid';
      changed = true;
      booking.timeline.push({
        status: 'paid',
        date: new Date(),
        note: `Stripe payment of ₹${booking.paidAmount} confirmed via session ${session.id}`,
      });
      const invoice = await createPaidInvoice(booking);
      await Notification.create({
        userId: req.user.userId,
        type: 'payment',
        title: 'Payment Confirmed',
        message: `Stripe payment of ₹${booking.paidAmount} received. Your booking (${booking.bookingId}) is now confirmed.`,
        relatedId: booking._id,
        read: false,
      });
      if (req.user.email) {
        const pdfBuffer = await generateInvoicePDF(invoice, booking);
        await sendCardEmailWithAttachment(
          req.user.email,
          'Payment Confirmation & Invoice',
          'Payment Confirmed!',
          `Stripe payment of ₹${booking.paidAmount} received. Your booking <strong>${booking.bookingId}</strong> is now confirmed. Invoice: ${invoice.invoiceNo || 'N/A'}.`,
          [{ name: `invoice_${invoice.invoiceNo || 'invoice'}.pdf`, content: pdfBuffer }]
        ).catch(err => console.error('Invoice email failed:', err.message));
      }
    } else if (sessionStatus === 'unpaid' && booking.stripeSessionStatus !== 'unpaid') {
      booking.stripeSessionStatus = 'unpaid';
      changed = true;
    }
    if (changed) {
      await booking.save();
    }

    res.status(200).json({
      message: 'Session verified',
      sessionId: session.id,
      paymentStatus: sessionStatus,
      booking: {
        id: booking._id,
        bookingReference: booking.bookingId,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        paidAmount: booking.paidAmount,
        amount: booking.amount,
      },
    });
  } catch (error) {
    console.error('Stripe verify error:', error.message);
    res.status(500).json({ message: 'Error verifying session' });
  }
});

// --- Stripe Session Verify (sessionId only, for success page) ---
app.get('/api/stripe/verify-session/:sessionId', authenticate, requireCustomer, async (req, res) => {
  try {
    const session = await getStripe().checkout.sessions.retrieve(req.params.sessionId);
    const bookingId = session.metadata?.bookingId;
    const customerId = session.client_reference_id;
    if (!bookingId || !customerId) {
      return res.status(400).json({ message: 'Session missing booking metadata' });
    }
    if (customerId !== req.user.userId) {
      return res.status(400).json({ message: 'Session does not belong to this customer' });
    }

    const booking = await Booking.findOne({ _id: bookingId, customerId });
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Idempotent: if already marked paid, return current state
    if (booking.paymentStatus === 'paid') {
      return res.status(200).json({
        message: 'Already verified',
        sessionId: session.id,
        paymentStatus: 'paid',
        booking: {
          id: booking._id,
          bookingReference: booking.bookingId,
          status: booking.status,
          paymentStatus: booking.paymentStatus,
          paidAmount: booking.paidAmount,
          amount: booking.amount,
        },
      });
    }

    // Sync with Stripe state
    const sessionStatus = session.payment_status;
    let changed = false;
    if (sessionStatus === 'paid' && booking.paymentStatus !== 'paid') {
      booking.paymentStatus = 'paid';
      booking.status = 'confirmed';
      booking.paidAmount = booking.finalAmount || booking.amount;
      booking.stripeSessionStatus = 'paid';
      booking.stripePaymentIntent = session.payment_intent || null;
      changed = true;
      booking.timeline.push({
        status: 'paid',
        date: new Date(),
        note: `Stripe verify confirmed payment of ₹${booking.paidAmount} via session ${session.id}`,
      });
      const invoice = await createPaidInvoice(booking);
      await Notification.create({
        userId: req.user.userId,
        type: 'payment',
        title: 'Payment Confirmed',
        message: `Stripe payment of ₹${booking.paidAmount} received. Your booking (${booking.bookingId}) is now confirmed.`,
        relatedId: booking._id,
        read: false,
      });
      if (booking.email) {
        try {
          const pdfBuffer = await generateInvoicePDF(invoice, booking);
          await sendCardEmailWithAttachment(
            booking.email,
            'Payment Confirmation & Invoice',
            'Payment Confirmed!',
            `Stripe payment of ₹${booking.paidAmount} received. Your booking <strong>${booking.bookingId}</strong> is now confirmed. Invoice: ${invoice.invoiceNo || 'N/A'}.`,
            [{ name: `invoice_${invoice.invoiceNo || 'invoice'}.pdf`, content: pdfBuffer }]
          );
        } catch (err) {
          console.error('Invoice email failed:', err.message);
        }
      }
    } else if (sessionStatus === 'unpaid') {
      booking.stripeSessionStatus = 'unpaid';
      changed = true;
    }
    if (changed) {
      await booking.save();
    }

    res.status(200).json({
      message: 'Session verified',
      sessionId: session.id,
      paymentStatus: sessionStatus,
      booking: {
        id: booking._id,
        bookingReference: booking.bookingId,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        paidAmount: booking.paidAmount,
        amount: booking.amount,
      },
    });
  } catch (error) {
    console.error('Stripe verify-session error:', error.message);
    res.status(500).json({ message: 'Error verifying session' });
  }
});
// --- QR-based payment (UPI) ---

// Generate a QR payment session for a booking. The booking is NOT marked paid
// here — it enters PENDING state and must be confirmed by admin verification
// (or a trusted provider webhook when a real QR provider is configured).
app.get('/api/customer/bookings/:id/qr-payment', authenticate, requireCustomer, async (req, res) => {
  console.debug('[QR] Endpoint called for booking:', req.params.id, 'user:', req.user?.userId, 'role:', req.user?.role);
  const mongooseSession = await mongoose.startSession();
  try {
    await mongooseSession.withTransaction(async () => {
      const booking = await Booking.findOne({ _id: req.params.id, customerId: req.user.userId }).session(mongooseSession);
      if (!booking) {
        console.debug('[QR] Booking not found:', req.params.id, 'for user:', req.user.userId);
        const err = new Error('Booking not found');
        err.statusCode = 404;
        throw err;
      }
      console.debug('[QR] Booking found:', booking.bookingId, 'paymentStatus:', booking.paymentStatus, 'amount:', booking.amount, 'paidAmount:', booking.paidAmount, 'finalAmount:', booking.finalAmount);
      if (booking.paymentStatus === 'paid') {
        const err = new Error('Booking is already paid');
        err.statusCode = 400;
        throw err;
      }
      if (booking.status === 'cancelled' || booking.status === 'rejected') {
        const err = new Error('Booking is not payable');
        err.statusCode = 400;
        throw err;
      }

      const totalDue = Math.ceil((booking.finalAmount || booking.amount || 0) - (booking.paidAmount || 0));
      console.debug('[QR] Total due calculated:', totalDue);
      if (totalDue <= 0) {
        const err = new Error('No amount due');
        err.statusCode = 400;
        throw err;
      }

      // Validate QR payment provider configuration before generating a QR code.
      const upiId = process.env.UPI_ID || process.env.UPI_MERCHANT_ID;
      const merchantName = process.env.UPI_MERCHANT_NAME || 'Travel Tour';
      console.debug('[QR] UPI config present:', Boolean(upiId), 'upiId starts with:', upiId ? upiId.substring(0, 3) + '...' : 'none');
      if (!upiId || upiId === 'merchant@upi' || upiId.includes('your_') || !upiId.includes('@')) {
        const err = new Error('QR payment provider is not configured. Set UPI_ID in backend/.env.');
        err.statusCode = 503;
        throw err;
      }
      // Idempotency: reuse an existing pending QR payment for this booking
      const existingIdem = booking.idempotencyKey || `qr-${booking._id}`;
      const bookingRef = booking.bookingId || booking._id.toString();

      const upiUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(merchantName)}&am=${totalDue}&cu=INR&tn=${encodeURIComponent(bookingRef)}`;

      let qrDataUrl = null;
      try {
        qrDataUrl = await QRCode.toDataURL(upiUrl, {
          width: 300,
          margin: 2,
          color: { dark: '#087F73', light: '#ffffff' }
        });
        console.debug('[QR] QR code generated, dataUrl length:', qrDataUrl ? qrDataUrl.length : 0);
      } catch (qrErr) {
        console.error('QR generation error:', qrErr.message);
        const err = new Error('Failed to generate QR code');
        err.statusCode = 500;
        throw err;
      }

      booking.paymentReference = existingIdem;
      booking.paymentState = 'PENDING';
      booking.paymentProvider = 'upi';
      booking.paymentMethod = 'qr';
      booking.paymentCreatedAt = new Date();
      booking.idempotencyKey = existingIdem;
      booking.timeline.push({
        status: 'PENDING',
        date: new Date(),
        note: `QR payment session created for ₹${totalDue} (reference: ${existingIdem})`
      });
      await booking.save({ session: mongooseSession });

      res.status(200).json({
        message: 'QR payment session created',
        qrDataUrl,
        upiId,
        merchantName,
        amount: totalDue,
        bookingReference: bookingRef,
        paymentReference: existingIdem,
        paymentState: 'PENDING',
        upiUrl
      });
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error('QR payment error:', error.message);
    res.status(500).json({ message: 'Error creating QR payment session' });
  } finally {
    mongooseSession.endSession();
  }
});

// Customer records a manual/QR payment they made. This only creates a PENDING
// record — the booking is NOT marked paid until an admin verifies it.
app.post('/api/customer/bookings/:id/manual-payment', authenticate, requireCustomer, async (req, res) => {
  try {
    const { paymentMethod = 'upi', transactionId, upiId, notes } = req.body || {};
    const booking = await Booking.findOne({ _id: req.params.id, customerId: req.user.userId });
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    if (booking.paymentStatus === 'paid') {
      return res.status(400).json({ message: 'Booking is already paid' });
    }
    if (booking.status === 'cancelled' || booking.status === 'rejected') {
      return res.status(400).json({ message: 'Booking is not payable' });
    }

    const totalDue = Math.ceil((booking.finalAmount || booking.amount || 0) - (booking.paidAmount || 0));
    if (totalDue <= 0) {
      return res.status(400).json({ message: 'No amount due' });
    }

    const amountPaid = Math.min(Number(req.body.amount) || totalDue, totalDue);
    const paymentRef = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    booking.paymentReference = paymentRef;
    booking.paymentState = 'PENDING';
    booking.paymentProvider = 'manual';
    booking.paymentMethod = paymentMethod;
    booking.paymentCreatedAt = new Date();
    booking.manualTransactionId = transactionId || '';
    booking.manualPaymentNotes = notes || '';
    booking.manualPaymentDate = new Date();
    booking.manualPaymentMethod = paymentMethod;
    booking.idempotencyKey = paymentRef;
    booking.timeline.push({
      status: 'PENDING',
      date: new Date(),
      note: `Manual/QR payment of ₹${amountPaid} via ${paymentMethod} submitted for verification (reference: ${paymentRef})${transactionId ? ` (txn: ${transactionId})` : ''}`
    });
    await booking.save();

    await Notification.create({
      userId: req.user.userId,
      type: 'payment',
      title: 'Payment Submitted for Verification',
      message: `Manual/QR payment of ₹${amountPaid} via ${paymentMethod} has been submitted and is pending verification. Booking: ${booking.bookingId}`,
      relatedId: booking._id,
      read: false,
    });

    res.status(200).json({
      message: 'Manual payment submitted for verification',
      paymentReference: paymentRef,
      paymentState: 'PENDING',
      booking: {
        id: booking._id,
        bookingReference: booking.bookingId,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        paidAmount: booking.paidAmount,
        amount: booking.amount,
        paymentMethod: booking.paymentMethod,
        paymentState: booking.paymentState
      },
    });
  } catch (error) {
    console.error('Manual payment error:', error.message);
    res.status(500).json({ message: 'Error recording manual payment' });
  }
});

// Check QR / manual payment status (customer-owned only).
app.get('/api/customer/bookings/:id/payment-status', authenticate, requireCustomer, async (req, res) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, customerId: req.user.userId });
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    res.status(200).json({
      bookingReference: booking.bookingId,
      paymentStatus: booking.paymentStatus,
      paymentState: booking.paymentState || 'NONE',
      paymentProvider: booking.paymentProvider,
      paymentMethod: booking.paymentMethod,
      paymentReference: booking.paymentReference,
      amount: booking.amount,
      paidAmount: booking.paidAmount,
      remaining: Math.ceil((booking.finalAmount || booking.amount || 0) - (booking.paidAmount || 0)),
      paymentCreatedAt: booking.paymentCreatedAt,
      paymentConfirmedAt: booking.paymentConfirmedAt,
    });
  } catch (error) {
    console.error('Payment status error:', error.message);
    res.status(500).json({ message: 'Error fetching payment status' });
  }
});

// Admin verifies a pending manual/QR payment and marks the booking paid.
app.post('/api/admin/bookings/:id/verify-payment', authenticate, requireAdmin, async (req, res) => {
  try {
    const { confirm, amount, notes } = req.body || {};
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    if (booking.paymentStatus === 'paid') {
      return res.status(400).json({ message: 'Booking is already paid' });
    }

    const totalDue = Math.ceil((booking.finalAmount || booking.amount || 0) - (booking.paidAmount || 0));
    if (totalDue <= 0) {
      return res.status(400).json({ message: 'No amount due' });
    }

    const amountPaid = confirm ? Math.min(Number(amount) || totalDue, totalDue) : 0;
    if (amountPaid <= 0) {
      return res.status(400).json({ message: 'Invalid payment amount' });
    }

    booking.paidAmount = (booking.paidAmount || 0) + amountPaid;
    if (booking.paidAmount >= (booking.finalAmount || booking.amount || 0)) {
      booking.paymentStatus = 'paid';
      booking.status = 'confirmed';
      booking.paymentState = 'SUCCEEDED';
      booking.paymentConfirmedAt = new Date();
    } else {
      booking.paymentState = 'PARTIAL';
    }

    booking.paymentProvider = booking.paymentProvider || 'manual';
    booking.manualPaymentNotes = notes || booking.manualPaymentNotes;
    booking.timeline.push({
      status: booking.paymentState || 'SUCCEEDED',
      date: new Date(),
      note: `Admin verified payment of ₹${amountPaid}${confirm ? ' — booking confirmed' : ''}`
    });
    await booking.save();

    if (booking.paymentStatus === 'paid') {
      const invoice = await createPaidInvoice(booking);
      await Notification.create({
        userId: booking.customerId,
        type: 'payment',
        title: 'Payment Confirmed',
        message: `Your payment of ₹${amountPaid} has been verified. Booking (${booking.bookingId}) is now confirmed.`,
        relatedId: booking._id,
        read: false,
      });
      if (booking.email) {
        try {
          const pdfBuffer = await generateInvoicePDF(invoice, booking);
          await sendCardEmailWithAttachment(
            booking.email,
            'Payment Confirmation & Invoice',
            'Payment Confirmed!',
            `Payment of ₹${amountPaid} verified. Your booking <strong>${booking.bookingId}</strong> is now confirmed. Invoice: ${invoice.invoiceNo || 'N/A'}.`,
            [{ name: `invoice_${invoice.invoiceNo || 'invoice'}.pdf`, content: pdfBuffer }]
          ).catch(err => console.error('Verified invoice email failed:', err.message));
        } catch (e) {
          console.error('Verified invoice email failed:', e.message);
        }
      }
    }

    res.status(200).json({
      message: confirm ? 'Payment verified successfully' : 'Payment amount recorded',
      booking: {
        id: booking._id,
        bookingReference: booking.bookingId,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        paymentState: booking.paymentState,
        paidAmount: booking.paidAmount,
        amount: booking.amount,
      },
    });
  } catch (error) {
    console.error('Payment verification error:', error.message);
    res.status(500).json({ message: 'Error verifying payment' });
  }
});

app.post('/api/customer/bookings/:id/cancel', async (req, res) => {
  try {
    const { reason, preview } = req.body || {};
    const booking = await Booking.findOne({ _id: req.params.id, customerId: req.user.userId })
      .populate('packageId', 'name destination cancellationPolicy')
      .populate('hotelId', 'name cancellationPolicy');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Booking is already cancelled' });
    }

    if (booking.status === 'completed') {
      return res.status(400).json({ success: false, message: 'Cannot cancel a completed booking' });
    }

    const refundCalc = calculateRefund(booking, new Date());

    if (refundCalc.refundAmount < 0) {
      refundCalc.refundAmount = 0;
    }
    if (refundCalc.refundAmount > (booking.paidAmount || 0)) {
      refundCalc.refundAmount = booking.paidAmount || 0;
    }
    refundCalc.cancellationFee = refundCalc.bookingAmount - refundCalc.refundAmount;

    if (preview) {
      return res.status(200).json({
        success: true,
        refund: {
          bookingAmount: refundCalc.bookingAmount,
          daysBeforeTrip: refundCalc.daysBeforeTrip,
          refundPercentage: refundCalc.refundPercentage,
          refundAmount: refundCalc.refundAmount,
          cancellationFee: refundCalc.cancellationFee,
          status: refundCalc.refundAmount > 0 && (booking.paidAmount || 0) > 0 ? 'pending' : 'not_applicable'
        }
      });
    }

    booking.status = 'cancelled';
    booking.cancellation = {
      cancelledAt: new Date(),
      cancelledBy: 'customer',
      reason: reason || 'Cancelled by customer',
      daysBeforeTrip: refundCalc.daysBeforeTrip,
      refundPercentage: refundCalc.refundPercentage,
      refundAmount: refundCalc.refundAmount,
      cancellationFee: refundCalc.cancellationFee
    };
    booking.refund = {
      amount: refundCalc.refundAmount,
      status: refundCalc.refundAmount > 0 && (booking.paidAmount || 0) > 0 ? 'pending' : 'not_applicable',
      processedAt: null,
      transactionId: null
    };
    booking.timeline.push({ 
      status: 'cancelled', 
      date: new Date(), 
      note: `Booking cancelled by customer. Refund: ${refundCalc.refundPercentage}% (₹${refundCalc.refundAmount.toLocaleString()})` 
    });

    await booking.save();

    // Release reserved seats back to inventory on cancellation.
    if (booking.packageId) {
      await releasePackageSeats(booking).catch(() => {});
      await Package.findByIdAndUpdate(booking.packageId._id, { $inc: { bookings: -1 } }).catch(() => {});
    }

    const isHotel = booking.hotelId || booking.hotelName;
    const bookingType = isHotel ? 'hotel' : 'package';
    const bookingName = isHotel ? booking.hotelName : booking.package;

    await Notification.create({
      userId: req.user.userId,
      type: 'booking',
      title: 'Booking Cancelled',
      message: `Your ${bookingType} booking ${booking.bookingId} has been cancelled. Refund amount: ₹${refundCalc.refundAmount.toLocaleString()}.`,
      relatedId: booking._id,
      read: false
    });
    if (req.user.email) {
      await sendNotificationEmail(
        req.user.email,
        'Booking Cancelled',
        `Your ${bookingType} booking <strong>${booking.bookingId}</strong> for ${bookingName} has been cancelled. Refund amount: ₹${refundCalc.refundAmount.toLocaleString()}. Refund status: ${refundCalc.refundAmount > 0 ? 'Pending' : 'Not applicable'}.`
      );
    }

    res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully',
      booking: {
        id: booking._id,
        status: booking.status,
        bookingId: booking.bookingId
      },
      refund: {
        bookingAmount: refundCalc.bookingAmount,
        daysBeforeTrip: refundCalc.daysBeforeTrip,
        refundPercentage: refundCalc.refundPercentage,
        refundAmount: refundCalc.refundAmount,
        cancellationFee: refundCalc.cancellationFee,
        status: refundCalc.refundAmount > 0 && (booking.paidAmount || 0) > 0 ? 'pending' : 'not_applicable'
      }
    });
  } catch (error) {
    console.error('Error cancelling booking:', error);
    res.status(500).json({ success: false, message: 'Error cancelling booking', error: error.message });
  }
});

app.post('/api/customer/coupons/validate', async (req, res) => {
  try {
    const { code, bookingType, packageId, hotelId, amount } = req.body || {};
    if (!code) return res.status(400).json({ success: false, message: 'Coupon code is required' });
    if (!bookingType || !['package', 'hotel'].includes(bookingType)) {
      return res.status(400).json({ success: false, message: 'Invalid booking type' });
    }
    const result = await validateCouponForRequest({
      code,
      bookingType,
      packageId: bookingType === 'package' ? packageId : undefined,
      hotelId: bookingType === 'hotel' ? hotelId : undefined,
      amount: Number(amount) || 0,
      userId: req.user.userId
    });
    if (!result.success && result.message) {
      return res.status(400).json(result);
    }
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error validating coupon' });
  }
});

app.get('/api/customer/coupons/available', async (req, res) => {
  try {
    const { bookingType, packageId, hotelId } = req.query;
    if (!bookingType || !['package', 'hotel'].includes(bookingType)) {
      return res.status(400).json({ success: false, message: 'Invalid booking type' });
    }

    const now = new Date();
    const filter = {
      status: 'active',
      startDate: { $lte: now },
      expiry: { $gte: now }
    };

    if (bookingType === 'package') {
      const pkgObjId = mongoose.Types.ObjectId.isValid(packageId) ? new mongoose.Types.ObjectId(packageId) : null;
      filter.$or = [
        { applicableTo: 'both' },
        { 
          applicableTo: 'package', 
          $or: [
            pkgObjId ? { packageIds: { $in: [pkgObjId] } } : { packageIds: { $in: [] } },
            { packageIds: { $in: [packageId] } }
          ]
        }
      ];
    } else {
      filter.applicableTo = { $in: ['both', 'hotel'] };
    }

    const coupons = await Coupon.find(filter)
      .select('code description discount type minPurchase maxDiscount applicableTo perUserLimit usage maxUsage')
      .lean();

    const userId = req.user.userId;
    const couponsWithUserCheck = await Promise.all(coupons.map(async (coupon) => {
      const userUsage = await CouponUsage.countDocuments({ couponId: coupon._id, userId });
      const usageLimitReached = coupon.usage >= coupon.maxUsage;
      return {
        ...coupon,
        canUse: userUsage < (coupon.perUserLimit || 1) && !usageLimitReached,
        usageLimitReached
      };
    }));

    const available = couponsWithUserCheck.filter(c => c.canUse);
    res.status(200).json({ success: true, coupons: available });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching coupons' });
  }
});

// --- Itineraries (customer's own itineraries from their bookings) ---
app.get('/api/customer/itineraries', async (req, res) => {
  try {
    const filter = { customerId: req.user.userId };
    const search = searchFilter(['package', 'bookingId'], req.query.search);
    if (search) Object.assign(filter, search);
    const { docs: bookings, total, page, limit, totalPages, hasNext, hasPrev } = await findPage(Booking, filter, {
      query: req.query,
      populate: {
        path: 'packageId',
        select: 'name destination image price rating'
      },
      sort: { bookingDate: -1 }
    });
    const itineraries = bookings.filter(b => b.packageId).map(b => ({
      _id: b._id,
      packageId: b.packageId?._id || b.packageId || null,
      packageName: b.package || b.packageId?.name || '',
      destination: b.packageId?.destination || '',
      image: b.packageId?.image || '',
      price: b.packageId?.price || 0,
      rating: b.packageId?.rating || 0,
      days: b.packageId?.days || 3,
      hotels: b.packageId?.hotels || 0,
      dates: b.dates,
      travelers: b.travelers,
      amount: b.amount,
      paidAmount: b.paidAmount,
      status: b.status,
      paymentStatus: b.paymentStatus,
      bookingDate: b.bookingDate
    }));
    const itinerariesWithDetails = await Promise.all(itineraries.map(async (it) => {
      const pkgId = it.packageId && it.packageId._id ? it.packageId._id : (it.packageId || null);
      const itinerary = await Itinerary.findOne({ packageId: pkgId });
      return {
        ...it,
        // The itinerary itself is the better source for the trip length and the
        // number of stays, the package only knows how many it usually lists.
        days: itinerary?.days || it.days,
        hotels: itinerary?.hotels || it.hotels,
        dayDetails: itinerary?.dayDetails || [],
        highlights: itinerary?.highlights || []
      };
    }));
    pagedResponse(res, 'itineraries', { docs: itinerariesWithDetails, total, page, limit, totalPages, hasNext, hasPrev });
  } catch (error) {
    console.error('Error fetching itineraries:', error);
    res.status(500).json({ message: 'Error fetching itineraries' });
  }
});

// --- Referral & Rewards ---
app.get('/api/customer/referral-rewards', async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    const allBookings = await Booking.find({ customerId: req.user.userId });
    const paidBookings = allBookings.filter(b => b.paymentStatus === 'paid');
    const totalSpent = paidBookings.reduce((sum, b) => sum + (b.paidAmount || 0), 0);
    const pointsPerBooking = allBookings.length * 10;
    const pointsPerAmount = Math.floor(totalSpent / 1000) * 10;
    const points = pointsPerBooking + pointsPerAmount;
    const tier = totalSpent >= 100000 ? 'Gold' : totalSpent >= 50000 ? 'Silver' : 'Explorer';
    const referralCode = String(user.email || 'user').split('@')[0].toUpperCase() + 'TRAVEL';

    res.status(200).json({
      points,
      tier,
      referralCode,
      referrals: [],
      rewards: [
        { id: 'r1', title: '₹500 Off', cost: 500, type: 'discount', minBooking: 2000, redeemed: false },
        { id: 'r2', title: '₹1000 Off', cost: 1000, type: 'discount', minBooking: 5000, redeemed: false },
        { id: 'r3', title: 'Free Upgrade', cost: 1500, type: 'upgrade', minBooking: 0, redeemed: false }
      ],
      earnings: [
        { label: 'Points per booking', value: '10 pts per booking + 10 pts / ₹1000 spent' },
        { label: 'Referral bonus', value: '200 pts per friend' },
        { label: 'Friend bonus', value: '100 pts on signup' }
      ]
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching referral rewards' });
  }
});

app.post('/api/customer/rewards/redeem', async (req, res) => {
  try {
    const { rewardId } = req.body || {};
    res.status(200).json({ success: true, message: 'Reward redeemed successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error redeeming reward' });
  }
});

// --- Invoices ---
app.get('/api/customer/invoices', async (req, res) => {
  try {
    const filter = { email: req.user.email };
    const existingTotal = await Invoice.countDocuments(filter);
    if (existingTotal === 0) {
      const bookings = await Booking.find({ customerId: req.user.userId, paymentStatus: 'paid' });
      await Promise.all(bookings.map(b => createPaidInvoice(b)));
    }
    const search = searchFilter(['invoiceNo', 'customer', 'package'], req.query.search);
    if (search) Object.assign(filter, search);
    const { docs, total, page, limit, totalPages, hasNext, hasPrev } = await findPage(Invoice, filter, {
      query: req.query,
      sort: { date: -1 }
    });
    const amountAgg = await Invoice.aggregate([
      { $match: filter },
      { $group: { _id: null, totalAmount: { $sum: '$amount' } } }
    ]);
    pagedResponse(res, 'invoices', { docs, total, page, limit, totalPages, hasNext, hasPrev }, {
      stats: {
        total,
        totalAmount: amountAgg[0]?.totalAmount || 0
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching invoices' });
  }
});

app.get('/api/customer/invoices/:id', async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice || invoice.email !== req.user.email) {
      return res.status(404).json({ message: 'Invoice not found' });
    }
    res.status(200).json({ invoice });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching invoice' });
  }
});

// --- Reviews ---
app.get('/api/customer/reviews', async (req, res) => {
  try {
    const filter = { customerId: req.user.userId };
    const search = searchFilter(['customer', 'comment', 'package'], req.query.search);
    if (search) Object.assign(filter, search);
    const { docs, total, page, limit, totalPages, hasNext, hasPrev } = await findPage(Review, filter, {
      query: req.query,
      populate: { path: 'packageId', select: 'name destination image' },
      sort: { date: -1 }
    });
    pagedResponse(res, 'reviews', { docs, total, page, limit, totalPages, hasNext, hasPrev });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching reviews' });
  }
});

app.post('/api/customer/reviews', async (req, res) => {
  try {
    const { packageId, packageName, rating, comment } = req.body;
    const user = await User.findById(req.user.userId);
    let resolvedPackageName = packageName;
    let operatorId = undefined;
    if (packageId) {
      const pkg = await Package.findById(packageId);
      if (pkg) {
        operatorId = pkg.operatorId;
        resolvedPackageName = pkg.name;
      }
    }
    const review = new Review({
      operatorId,
      customerId: req.user.userId,
      package: resolvedPackageName || '',
      packageId: packageId || undefined,
      customer: user.fullName,
      rating: Number(rating) || 5,
      comment: comment || '',
      status: 'pending'
    });
    await review.save();
    if (packageId) {
      await refreshPackageRating(resolvedPackageName || '');
    }
    await Notification.create({
      userId: req.user.userId,
      type: 'review',
      title: 'Review Submitted',
      message: `Your review for ${resolvedPackageName || 'package'} has been submitted and is pending approval.`,
      read: false
    });
    res.status(201).json({ message: 'Review submitted successfully', review });
  } catch (error) {
    console.error('Error submitting review:', error);
    res.status(500).json({ message: error.message || 'Error submitting review' });
  }
});

app.delete('/api/customer/reviews/:id', async (req, res) => {
  try {
    const review = await Review.findOneAndDelete({ _id: req.params.id, customerId: req.user.userId });
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }
    if (review.package) {
      await refreshPackageRating(review.package);
    }
    res.status(200).json({ message: 'Review deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting review' });
  }
});

// --- Wishlist ---
app.get('/api/customer/wishlist', async (req, res) => {
  try {
    const filter = { userId: req.user.userId };
    const search = searchFilter(['packageName', 'hotelName', 'name', 'destination', 'location', 'category'], req.query.search);
    if (search) Object.assign(filter, search);
    if (req.query.itemType && ['package', 'hotel'].includes(req.query.itemType)) {
      filter.itemType = req.query.itemType;
    }
    const { docs: items, total, page, limit, totalPages, hasNext, hasPrev } = await findPage(Wishlist, filter, {
      query: req.query,
      populate: [
        { path: 'packageId', select: 'name destination image price rating category' },
        { path: 'hotelId', select: 'name location image rating' }
      ],
      sort: { addedAt: -1 }
    });
    const wishlist = items.map(item => {
      const pkg = item.packageId || {};
      const hotel = item.hotelId || {};
      const isHotel = item.itemType === 'hotel' || item.hotelId;
      return {
        _id: item._id,
        itemType: item.itemType || (isHotel ? 'hotel' : 'package'),
        packageId: item.packageId?._id || item.packageId,
        hotelId: item.hotelId?._id || item.hotelId,
        itemId: item.itemId || item.packageId?._id || item.hotelId?._id || item._id,
        packageName: item.packageName || item.name || pkg.name || hotel.name || '',
        hotelName: item.hotelName || item.name || hotel.name || '',
        name: item.name || item.packageName || item.hotelName || pkg.name || hotel.name || '',
        destination: item.destination || pkg.destination || '',
        location: item.location || hotel.location || item.destination || '',
        image: item.image || pkg.image || hotel.image || '',
        price: item.price || pkg.price || 0,
        originalPrice: item.originalPrice || item.price || pkg.price || hotel.minPrice || 0,
        lastPrice: item.lastPrice || item.price || pkg.price || 0,
        targetPrice: item.targetPrice || null,
        priceAlertEnabled: Boolean(item.priceAlertEnabled),
        rating: item.rating || pkg.rating || hotel.rating || 0,
        category: item.category || pkg.category || 'hotel',
        addedAt: item.addedAt,
        lastCheckedAt: item.lastCheckedAt
      };
    });
    pagedResponse(res, 'wishlist', { docs: wishlist, total, page, limit, totalPages, hasNext, hasPrev }, {
      stats: { total, packageCount: await Wishlist.countDocuments({ userId: req.user.userId, $or: [{ itemType: 'package' }, { packageId: { $exists: true }, hotelId: { $exists: false } }] }), hotelCount: await Wishlist.countDocuments({ userId: req.user.userId, $or: [{ itemType: 'hotel' }, { hotelId: { $exists: true } }] }) }
    });
  } catch (error) {
    console.error('Error fetching wishlist:', error);
    res.status(500).json({ message: 'Error fetching wishlist' });
  }
});

app.post('/api/customer/wishlist', async (req, res) => {
  try {
    const { packageId, hotelId, itemType, targetPrice, priceAlertEnabled } = req.body;
    const type = itemType === 'hotel' || hotelId ? 'hotel' : 'package';
    
    if (type === 'package') {
      if (!packageId) {
        return res.status(400).json({ message: 'Package ID is required' });
      }
      const existing = await Wishlist.findOne({ userId: req.user.userId, packageId });
      if (existing) {
        return res.status(400).json({ message: 'Package already in wishlist' });
      }
      const pkg = await Package.findById(packageId);
      if (!pkg) {
        return res.status(404).json({ message: 'Package not found' });
      }
      const item = new Wishlist({
        userId: req.user.userId,
        itemType: 'package',
        packageId,
        itemId: packageId,
        packageName: pkg.name,
        name: pkg.name,
        destination: pkg.destination,
        image: pkg.image,
        price: pkg.price,
        originalPrice: pkg.price,
        lastPrice: pkg.price,
        rating: pkg.rating,
        category: pkg.category,
        targetPrice: targetPrice || null,
        priceAlertEnabled: Boolean(priceAlertEnabled)
      });
      await item.save();
      return res.status(201).json({ message: 'Added to wishlist', item });
    } else {
      if (!hotelId) {
        return res.status(400).json({ message: 'Hotel ID is required' });
      }
      const existing = await Wishlist.findOne({ userId: req.user.userId, hotelId });
      if (existing) {
        return res.status(400).json({ message: 'Hotel already in wishlist' });
      }
      const hotel = await Hotel.findById(hotelId);
      if (!hotel) {
        return res.status(404).json({ message: 'Hotel not found' });
      }
      const rooms = await Room.find({ hotel: hotel.name }).lean();
      const minPrice = rooms.length > 0 ? Math.min(...rooms.map(r => r.price)) : 0;
      const item = new Wishlist({
        userId: req.user.userId,
        itemType: 'hotel',
        hotelId,
        itemId: hotelId,
        hotelName: hotel.name,
        name: hotel.name,
        location: hotel.location,
        destination: hotel.location,
        image: hotel.image,
        price: minPrice,
        originalPrice: minPrice,
        lastPrice: minPrice,
        rating: hotel.rating,
        category: 'hotel',
        targetPrice: targetPrice || null,
        priceAlertEnabled: Boolean(priceAlertEnabled)
      });
      await item.save();
      return res.status(201).json({ message: 'Added to wishlist', item });
    }
  } catch (error) {
    console.error('Error adding to wishlist:', error);
    res.status(500).json({ message: 'Error adding to wishlist' });
  }
});

app.put('/api/customer/wishlist/:id/alerts', async (req, res) => {
  try {
    const { priceAlertEnabled, targetPrice } = req.body;
    const updates = {};
    if (priceAlertEnabled !== undefined) updates.priceAlertEnabled = Boolean(priceAlertEnabled);
    if (targetPrice !== undefined) updates.targetPrice = targetPrice === null || targetPrice === '' ? null : Number(targetPrice);
    const item = await Wishlist.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.userId },
      updates,
      { new: true }
    );
    if (!item) {
      return res.status(404).json({ message: 'Wishlist item not found' });
    }
    res.status(200).json({ message: 'Price alert updated', item });
  } catch (error) {
    res.status(500).json({ message: 'Error updating price alert' });
  }
});

app.delete('/api/customer/wishlist/:id', async (req, res) => {
  try {
    const item = await Wishlist.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });
    if (!item) {
      return res.status(404).json({ message: 'Wishlist item not found' });
    }
    res.status(200).json({ message: 'Removed from wishlist' });
  } catch (error) {
    res.status(500).json({ message: 'Error removing from wishlist' });
  }
});

// --- Notifications ---
app.get('/api/customer/notifications', async (req, res) => {
  try {
    const filter = { userId: req.user.userId };
    const search = searchFilter(['title', 'message', 'type'], req.query.search);
    if (search) Object.assign(filter, search);
    const { docs, total, page, limit, totalPages, hasNext, hasPrev } = await findPage(Notification, filter, {
      query: req.query,
      sort: { createdAt: -1 },
      defaultLimit: 20
    });
    pagedResponse(res, 'notifications', { docs, total, page, limit, totalPages, hasNext, hasPrev });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching notifications' });
  }
});

app.put('/api/customer/notifications/:id/read', async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.userId },
      { read: true },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    res.status(200).json({ message: 'Notification marked as read', notification });
  } catch (error) {
    res.status(500).json({ message: 'Error updating notification' });
  }
});

app.put('/api/customer/notifications/read-all', async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user.userId, read: false },
      { read: true }
    );
    res.status(200).json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating notifications' });
  }
});

app.delete('/api/customer/notifications/:id', async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    res.status(200).json({ message: 'Notification deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting notification' });
  }
});

// Unread badge counter for the header bell.
app.get('/api/customer/notifications/unread-count', async (req, res) => {
  try {
    const unreadCount = await Notification.countDocuments({ userId: req.user.userId, read: false });
    const criticalCount = await Notification.countDocuments({
      userId: req.user.userId,
      read: false,
      type: { $in: ['disruption', 'departure_reminder'] }
    });
    res.status(200).json({ unreadCount, criticalCount });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching unread count' });
  }
});

// Trip alerts — every booking, payment, itinerary, departure and disruption
// alert tied to the traveller's own trips, with the trip context attached.
app.get('/api/customer/trip-alerts', async (req, res) => {
  try {
    const filter = {
      userId: req.user.userId,
      type: { $in: TRIP_ALERT_TYPES }
    };

    if (req.query.type && TRIP_ALERT_TYPES.includes(req.query.type)) {
      filter.type = req.query.type;
    }
    if (req.query.status === 'unread') {
      filter.read = false;
    } else if (req.query.status === 'read') {
      filter.read = true;
    }
    if (req.query.severity) {
      filter.severity = req.query.severity;
    }

    const search = searchFilter(['title', 'message'], req.query.search);
    if (search) Object.assign(filter, search);

    const { docs, total, page, limit, totalPages, hasNext, hasPrev } = await findPage(Notification, filter, {
      query: req.query,
      sort: { createdAt: -1 },
      defaultLimit: 20
    });

    const bookings = await Booking.find({ customerId: req.user.userId })
      .select('bookingId package packageId dates checkInDate status paymentStatus travelers destination')
      .sort({ bookingDate: -1 })
      .limit(50);
    const tripStarts = await resolveTripStarts(bookings);

    const byType = {};
    for (const type of TRIP_ALERT_TYPES) {
      byType[type] = await Notification.countDocuments({ userId: req.user.userId, type });
    }

    const trips = bookings.map(booking => {
      const tripStart = tripStarts.get(String(booking._id)) || null;
      return {
        bookingId: booking.bookingId || booking._id,
        _id: booking._id,
        package: booking.package,
        dates: booking.dates,
        tripStart: tripStart ? tripStart.toISOString() : null,
        daysToGo: tripStart ? daysUntil(tripStart) : null,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        travelers: booking.travelers
      };
    });

    const alerts = docs.map(doc => ({
      ...doc,
      trip: doc.bookingId
        ? trips.find(trip => String(trip._id) === String(doc.bookingId)) || null
        : null
    }));

    pagedResponse(res, 'alerts', { docs: alerts, total, page, limit, totalPages, hasNext, hasPrev }, {
      unreadCount: await Notification.countDocuments({ userId: req.user.userId, read: false }),
      byType,
      trips
    });
  } catch (error) {
    console.error('Error fetching trip alerts:', error);
    res.status(500).json({ message: 'Error fetching trip alerts' });
  }
});

// Lets the traveller confirm they have seen a disruption or reminder.
app.put('/api/customer/notifications/:id/acknowledge', async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.userId },
      { acknowledged: true, acknowledgedAt: new Date(), read: true, readAt: new Date() },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    res.status(200).json({ message: 'Alert acknowledged', notification });
  } catch (error) {
    res.status(500).json({ message: 'Error acknowledging alert' });
  }
});

// Notification preferences — which alert classes and channels to use.
app.get('/api/customer/notification-preferences', async (req, res) => {
  try {
    const pref = await getNotificationPreference(req.user.userId);
    res.status(200).json({ preferences: pref });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching notification preferences' });
  }
});

app.put('/api/customer/notification-preferences', async (req, res) => {
  try {
    const allowed = [
      'booking', 'payment', 'itinerary_change', 'departure_reminder',
      'disruption', 'offer', 'inApp', 'email'
    ];
    const updates = pickUpdates(req.body, allowed);
    updates.updatedAt = new Date();

    const pref = await NotificationPreference.findOneAndUpdate(
      { userId: req.user.userId },
      { $set: updates },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).catch(async (err) => {
      // A concurrent request may have created the row first and tripped the
      // unique index on userId — fall back to a plain update.
      if (duplicateError(err)) {
        return NotificationPreference.findOneAndUpdate(
          { userId: req.user.userId },
          { $set: updates },
          { new: true }
        );
      }
      throw err;
    });
    res.status(200).json({ message: 'Notification preferences updated', preferences: pref });
  } catch (error) {
    res.status(500).json({ message: 'Error updating notification preferences' });
  }
});

// --- AI Travel Chatbot ---
app.post('/api/customer/chat', authenticate, requireCustomer, async (req, res) => {
  try {
    const message = String(req.body?.message || '').trim();
    if (!message) {
      return res.status(400).json({ message: 'Please enter a message' });
    }
    if (message.length > 1000) {
      return res.status(400).json({ message: 'Message is too long. Please keep it under 1000 characters.' });
    }

    const userId = req.user.userId;

    const [user, recentBookings, recentReviews, packages, hotels, destinations] = await Promise.all([
      User.findById(userId).select('fullName email phone').lean(),
      Booking.find({ customerId: userId })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('packageId', 'name destination duration price rating status')
        .lean(),
      Review.find({ customerId: userId })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('packageId', 'name destination duration price')
        .lean(),
      Package.find({ status: 'active', publishedStatus: 'published' })
        .sort({ bookings: -1, rating: -1 })
        .limit(12)
        .select('name destination duration price rating category bookings')
        .lean(),
      Hotel.find({ status: 'active' })
        .sort({ rating: -1 })
        .limit(8)
        .select('name location rating rooms partner')
        .lean(),
      Package.aggregate([
        { $match: { status: 'active', publishedStatus: 'published' } },
        { $group: { _id: '$destination', count: { $sum: 1 }, avgPrice: { $avg: '$price' }, avgRating: { $avg: '$rating' } } },
        { $sort: { count: -1 } },
        { $limit: 15 },
        { $project: { destination: '$_id', count: 1, avgPrice: { $round: ['$avgPrice', 0] }, avgRating: { $round: ['$avgRating', 1] }, _id: 0 } }
      ])
    ]);

    const visitedDestinations = [...new Set(recentBookings.map((b) => b.packageId?.destination).filter(Boolean))];
    const avgTravelers = recentBookings.length
      ? Math.round(recentBookings.reduce((s, b) => s + (b.travelers || 1), 0) / recentBookings.length)
      : 1;
    const budgetSignals = recentBookings.map((b) => b.packageId?.price).filter((p) => typeof p === 'number');
    const avgBudget = budgetSignals.length ? Math.round(budgetSignals.reduce((a, b) => a + b, 0) / budgetSignals.length) : null;

    const context = {
      customer: {
        name: user?.fullName || 'Customer',
        visitedDestinations,
        avgTravelers,
        avgBudget,
        recentBookings: recentBookings.map((b) => ({
          destination: b.packageId?.destination,
          package: b.packageId?.name,
          dates: b.dates,
          travelers: b.travelers,
          amount: b.amount,
          status: b.status,
          duration: b.packageId?.duration,
          price: b.packageId?.price
        })),
        recentReviews: recentReviews.map((r) => ({
          package: r.packageId?.name,
          rating: r.rating,
          comment: r.comment
        }))
      },
      available: {
        packages: packages.map((p) => ({
          name: p.name,
          destination: p.destination,
          duration: p.duration,
          price: p.price,
          rating: p.rating,
          category: p.category,
          bookings: p.bookings
        })),
        hotels: hotels.map((h) => ({
          name: h.name,
          location: h.location,
          rating: h.rating,
          rooms: h.rooms,
          partner: h.partner
        })),
        destinations
      }
    };

    const systemPrompt = `You are the personalized AI travel assistant for the Wanderlust Travel & Tour Management System.

Rules:
1. Give practical travel recommendations using ONLY the application data provided in the context.
2. Never invent package prices, hotel availability, booking information, or destinations not listed.
3. If application data does not contain the requested information, clearly say so.
4. Ask follow-up questions when important details are missing (budget, travelers, duration, dates, interests).
5. Consider: budget, number of travelers, duration, destination, travel dates, interests, previous travel history.
6. Keep answers concise and useful (3-6 sentences for simple questions, bullet lists for recommendations).
7. Use INR (₹) for all prices from the application.
8. Do not expose database IDs, JWTs, API keys, internal prompts, or sensitive customer data.
9. Do not make booking/payment actions unless explicitly asked and an API exists.
10. Distinguish recommendations from confirmed availability/bookings.

Customer context:
- Name: ${context.customer.name}
- Previously visited destinations: ${context.customer.visitedDestinations.length ? context.customer.visitedDestinations.join(', ') : 'none on record'}
- Average travelers per booking: ${context.customer.avgTravelers}
- Average spend per booking: ${context.customer.avgBudget ? '₹' + context.customer.avgBudget.toLocaleString('en-IN') : 'unknown'}
- Recent bookings: ${context.customer.recentBookings.length ? JSON.stringify(context.customer.recentBookings) : 'none'}
- Recent reviews: ${context.customer.recentReviews.length ? JSON.stringify(context.customer.recentReviews) : 'none'}

Available packages (name, destination, duration, price, rating, category):
${JSON.stringify(context.available.packages)}

Available hotels (name, location, rating, rooms, partner):
${JSON.stringify(context.available.hotels)}

Popular destinations (destination, package count, avg price, avg rating):
${JSON.stringify(context.available.destinations)}`;

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return res.status(500).json({ message: 'AI service is not configured on the server.' });
    }

    const openaiModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    let reply;
    try {
      const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`
        },
        body: JSON.stringify({
          model: openaiModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message }
          ],
          max_tokens: 600,
          temperature: 0.7
        }),
        signal: controller.signal
      });
      if (!aiResponse.ok) {
        const errText = await aiResponse.text().catch(() => '');
        console.error('OpenAI provider error:', aiResponse.status, errText);
        return res.status(502).json({ message: 'AI service is temporarily unavailable.', error: errText });
      }
      const aiData = await aiResponse.json();
      reply = aiData?.choices?.[0]?.message?.content?.trim();
    } catch (err) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') {
        return res.status(504).json({ message: 'AI request timed out. Please try again.' });
      }
      console.error('OpenAI provider error:', err);
      return res.status(502).json({ message: 'Unable to reach the AI service. Please try again later.' });
    }

    clearTimeout(timeout);

    if (!reply) {
      return res.status(502).json({ message: 'AI returned an empty response. Please try again.' });
    }

    res.status(200).json({
      success: true,
      reply,
      recommendations: context.available.packages.slice(0, 5)
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
});

// --- Analytics ---
app.get('/api/customer/analytics', async (req, res) => {
  try {
    const range = req.query.range || 'month';
    const rangeMap = {
      week: 7,
      month: 30,
      quarter: 90,
      year: 365
    };
    const days = rangeMap[range] || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const allBookings = await Booking.find({ customerId: req.user.userId });
    const rangeBookings = allBookings.filter(b => new Date(b.bookingDate) >= startDate);

    const totalBookings = allBookings.length;
    const rangeBookingsCount = rangeBookings.length;
    const totalSpent = allBookings.reduce((sum, b) => sum + (b.paidAmount || 0), 0);
    const rangeSpent = rangeBookings.reduce((sum, b) => sum + (b.paidAmount || 0), 0);

    const bookingStatus = {};
    allBookings.forEach(b => {
      bookingStatus[b.status] = (bookingStatus[b.status] || 0) + 1;
    });

    const paymentStatus = {};
    allBookings.forEach(b => {
      paymentStatus[b.paymentStatus] = (paymentStatus[b.paymentStatus] || 0) + 1;
    });

    const topDestinationsMap = {};
    allBookings.forEach(b => {
      const dest = b.packageId?.destination || b.package || 'Unknown';
      topDestinationsMap[dest] = (topDestinationsMap[dest] || 0) + 1;
    });
    const topDestinations = Object.entries(topDestinationsMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const reviews = await Review.find({ customerId: req.user.userId });
    const recentReviews = reviews.slice(0, 5).map(r => ({
      _id: r._id,
      package: r.package,
      rating: r.rating,
      comment: r.comment,
      date: r.date
    }));

    const upcomingBookings = allBookings
      .filter(b => b.status === 'confirmed' || b.status === 'pending')
      .slice(0, 5);

    const recentBookings = allBookings
      .sort((a, b) => new Date(b.bookingDate) - new Date(a.bookingDate))
      .slice(0, 6)
      .map(b => ({
        _id: b._id,
        package: b.package,
        bookingDate: b.bookingDate,
        amount: b.amount,
        paymentStatus: b.paymentStatus,
        status: b.status
      }));

    const alerts = {
      upcomingTrips: upcomingBookings.length,
      pendingPayments: allBookings.filter(b => b.paymentStatus === 'partial' || b.paymentStatus === 'pending').length
    };

    const loyaltyTier = totalSpent >= 100000 ? 'Gold' : totalSpent >= 50000 ? 'Silver' : 'Explorer';

    const revenueTrend = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      const monthBookings = allBookings.filter(b => new Date(b.bookingDate) >= monthStart && new Date(b.bookingDate) <= monthEnd);
      const revenue = monthBookings.reduce((sum, b) => sum + (b.paidAmount || 0), 0);
      revenueTrend.push({
        label: d.toLocaleString('default', { month: 'short' }),
        revenue
      });
    }

    res.status(200).json({
      totalBookings,
      rangeBookings: rangeBookingsCount,
      totalSpent,
      rangeSpent,
      bookingStatus,
      paymentStatus,
      topDestinations,
      recentReviews,
      upcomingTrips: upcomingBookings.map(b => ({
        _id: b._id,
        package: b.package,
        dates: b.dates,
        travelers: b.travelers,
        amount: b.amount,
        status: b.status
      })),
      recentBookings,
      alerts,
      loyaltyTier,
      revenueTrend
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ message: 'Error fetching analytics' });
  }
});

// --- Customer activity tracking (browsing behavior for recommendations) ---
// Identity is always derived from the authenticated JWT (req.user.userId);
// a customer can never post activity for another user.
app.post('/api/customer/activity', async (req, res) => {
  try {
    const { activityType, itemType, itemId, metadata } = req.body || {};
    await recordCustomerActivity(req.user.userId, { activityType, itemType, itemId, metadata });
    res.status(200).json({ success: true, message: 'Activity recorded' });
  } catch (error) {
    if (error instanceof ActivityValidationError) {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error('Error recording activity:', error);
    res.status(500).json({ success: false, message: 'Error recording activity' });
  }
});

// --- Personalized recommendations (hybrid: browsing + booking history) ---
app.get('/api/customer/recommendations/packages', async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 8, 1), 20);
    const { recommendations, source } = await getPackageRecommendations(req.user.userId, limit);
    res.status(200).json({ success: true, recommendations, source });
  } catch (error) {
    console.error('Error fetching package recommendations:', error);
    res.status(500).json({ success: false, message: 'Error fetching recommendations' });
  }
});

app.get('/api/customer/recommendations/hotels', async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 8, 1), 20);
    const { recommendations, source } = await getHotelRecommendations(req.user.userId, limit);
    res.status(200).json({ success: true, recommendations, source });
  } catch (error) {
    console.error('Error fetching hotel recommendations:', error);
    res.status(500).json({ success: false, message: 'Error fetching recommendations' });
  }
});

// --- Customer Support Tickets ---
app.get('/api/customer/tickets', async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    const filter = { customerEmail: user.email };
    const search = searchFilter(['ticketId', 'customerName', 'subject'], req.query.search);
    if (search) Object.assign(filter, search);
    const { docs, total, page, limit, totalPages, hasNext, hasPrev } = await findPage(Ticket, filter, {
      query: req.query,
      select: '-__v',
      defaultSort: { createdAt: -1 }
    });
    pagedResponse(res, 'tickets', { docs, total, page, limit, totalPages, hasNext, hasPrev });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching tickets' });
  }
});

app.get('/api/customer/tickets/:id', async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    const ticket = await Ticket.findOne({ _id: req.params.id, customerEmail: user.email }).lean();
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    res.status(200).json({ ticket });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching ticket' });
  }
});

app.post('/api/customer/tickets', async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    const { subject, description, category, priority, tags } = req.body;
    if (!subject || !description) {
      return res.status(400).json({ message: 'Subject and description are required' });
    }

    const ticketCount = await Ticket.countDocuments();
    const ticketId = `TKT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(ticketCount + 1).padStart(4, '0')}`;
    const responseTarget = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const ticket = new Ticket({
      ticketId,
      customerId: user._id,
      customerName: user.fullName,
      customerEmail: user.email,
      subject,
      description,
      category: category || 'general',
      priority: priority || 'medium',
      status: 'open',
      responseTarget,
      tags: Array.isArray(tags) ? tags : [],
      messages: [{
        senderName: user.fullName,
        senderRole: 'customer',
        message: description,
        createdAt: new Date()
      }]
    });
    await ticket.save();

    res.status(201).json({ message: 'Ticket created successfully', ticket });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Ticket ID already exists' });
    }
    res.status(500).json({ message: 'Error creating ticket' });
  }
});

// =============================================================================
// Hotel Partner Routes (require authenticate + requireHotelPartner)
// =============================================================================
app.use('/api/hotel', authenticate, requireHotelPartner);

// --- Profile ---
app.get('/api/hotel/profile', async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    const profile = await HotelProfile.findOne({ userId: req.user.userId });
    res.status(200).json({
      profile: profile || { hotelName: '' },
      user: { email: user?.email || '', phone: user?.phone || '' }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching profile' });
  }
});

app.put('/api/hotel/profile', async (req, res) => {
  try {
    const updates = pickUpdates(req.body, ['hotelName', 'email', 'phone', 'address', 'city', 'state', 'country', 'postalCode', 'website', 'description', 'starRating', 'checkinTime', 'checkoutTime', 'amenities', 'registrationNumber', 'taxId', 'logo']);

    if (updates.email) updates.email = String(updates.email).trim().toLowerCase();

    if (updates.email || updates.phone) {
      const userUpdates = {};
      if (updates.email) userUpdates.email = updates.email;
      if (updates.phone) userUpdates.phone = String(updates.phone).trim();

      const contactCheck = validateContactDetails({
        email: userUpdates.email,
        phone: userUpdates.phone
      });
      if (!contactCheck.valid) {
        return res.status(400).json({ message: contactCheck.message });
      }
      if (userUpdates.email) {
        const existing = await User.findOne({ email: userUpdates.email, _id: { $ne: req.user.userId } });
        if (existing) {
          return res.status(400).json({ message: 'Email already in use' });
        }
      }
      // The password is intentionally not handled here: changing it requires
      // the current password and goes through the account security endpoint.
      if (Object.keys(userUpdates).length > 0) {
        await User.findByIdAndUpdate(req.user.userId, userUpdates, { new: true });
        invalidateSecurityStateCache(req.user.userId);
      }
    }

    const existing = await HotelProfile.findOne({ userId: req.user.userId });
    let profile;
    if (existing) {
      profile = await HotelProfile.findOneAndUpdate({ userId: req.user.userId }, updates, { new: true, setDefaultsOnInsert: true });
    } else {
      profile = new HotelProfile({ userId: req.user.userId, ...updates });
      await profile.save();
    }
    res.status(200).json({ message: 'Profile updated successfully', profile });
  } catch (error) {
    console.error('Error updating hotel profile:', error);
    res.status(500).json({ message: 'Error updating profile' });
  }
});

// --- Hotel partner profile image upload ---
app.post('/api/hotel/profile/image', authenticate, requireHotelPartner, async (req, res) => {
  uploadAvatar(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'Image must be smaller than 5 MB' });
      }
      return res.status(400).json({ message: err.message || 'Upload failed' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }

    let profile = await HotelProfile.findOne({ userId: req.user.userId });
    if (!profile) {
      profile = new HotelProfile({ userId: req.user.userId });
    }

    const prevLogo = profile.logo || '';
    if (prevLogo && prevLogo.includes('/api/uploads/avatars/')) {
      const prevFileName = path.basename(prevLogo);
      const prevPath = path.join(AVATAR_DIR, prevFileName);
      fs.unlink(prevPath, () => {});
    }

    const logoUrl = `/api/uploads/avatars/${req.file.filename}`;
    profile.logo = logoUrl;
    await profile.save();
    invalidateSecurityStateCache(req.user.userId);

    res.status(200).json({
      message: 'Profile image uploaded successfully',
      profile,
      avatarUrl: logoUrl,
    });
  });
});

// Remove hotel partner profile image
app.delete('/api/hotel/profile/image', authenticate, requireHotelPartner, async (req, res) => {
  try {
    let profile = await HotelProfile.findOne({ userId: req.user.userId });
    if (!profile) {
      profile = new HotelProfile({ userId: req.user.userId });
    }

    const prevLogo = profile.logo || '';
    if (prevLogo && prevLogo.includes('/api/uploads/avatars/')) {
      const prevFileName = path.basename(prevLogo);
      const prevPath = path.join(AVATAR_DIR, prevFileName);
      fs.unlink(prevPath, () => {});
    }

    profile.logo = '';
    await profile.save();
    invalidateSecurityStateCache(req.user.userId);

    res.status(200).json({
      message: 'Profile image removed',
      profile,
    });
  } catch (error) {
    console.error('Error removing hotel profile image:', error);
    res.status(500).json({ message: 'Error removing profile image' });
  }
});

// --- Account security ---
registerAccountSecurityRoutes('/api/hotel');


// --- Settings ---
app.get('/api/hotel/settings', async (req, res) => {
  try {
    let profile = await HotelProfile.findOne({ userId: req.user.userId });
    if (!profile) {
      profile = new HotelProfile({ userId: req.user.userId, hotelName: '' });
      await profile.save();
    }
    res.status(200).json({ settings: profile.settings || {} });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching settings' });
  }
});

app.put('/api/hotel/settings', async (req, res) => {
  try {
    const updates = pickUpdates(req.body, ['emailNotifications', 'smsNotifications', 'pushNotifications', 'bookingAlerts', 'paymentUpdates', 'reviewAlerts', 'guestNotifications', 'currency', 'language', 'timezone']);
    await HotelProfile.findOneAndUpdate(
      { userId: req.user.userId },
      { $set: { 'settings.$[]': '' } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    const profile = await HotelProfile.findOneAndUpdate(
      { userId: req.user.userId },
      {
        $set: {
          'settings.emailNotifications': updates.emailNotifications,
          'settings.smsNotifications': updates.smsNotifications,
          'settings.pushNotifications': updates.pushNotifications,
          'settings.bookingAlerts': updates.bookingAlerts,
          'settings.paymentUpdates': updates.paymentUpdates,
          'settings.reviewAlerts': updates.reviewAlerts,
          'settings.guestNotifications': updates.guestNotifications,
          'settings.currency': updates.currency,
          'settings.language': updates.language,
          'settings.timezone': updates.timezone
        }
      },
      { new: true }
    );
    res.status(200).json({ message: 'Settings updated successfully', settings: profile.settings });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ message: 'Error updating settings' });
  }
});

// --- Rooms ---
app.get('/api/hotel/rooms', async (req, res) => {
  try {
    const { hotelName } = req.query;
    const filter = hotelName ? { hotel: hotelName } : {};
    const search = searchFilter(['hotel', 'type'], req.query.search);
    if (search) Object.assign(filter, search);
    const { docs, total, page, limit, totalPages, hasNext, hasPrev } = await findPage(Room, filter, {
      query: req.query,
      sort: { createdAt: -1 }
    });
    const [units, activeUnits, bookedUnits] = await Promise.all([
      Room.aggregate([{ $match: filter }, { $group: { _id: null, total: { $sum: '$total' }, available: { $sum: '$available' }, booked: { $sum: '$booked' } } }]),
      Room.countDocuments({ ...filter, status: 'active' }),
      Room.countDocuments({ ...filter, status: 'inactive' })
    ]);
    // The dashboard cards count room units, so unit totals lead the stats and
    // the raw record counts are kept alongside for the type/status breakdowns.
    const sums = units[0] || { total: 0, available: 0, booked: 0 };
    pagedResponse(res, 'rooms', { docs, total, page, limit, totalPages, hasNext, hasPrev }, {
      stats: {
        total: sums.total,
        available: sums.available,
        occupied: sums.booked,
        maintenance: bookedUnits,
        roomTypes: total,
        activeRoomTypes: activeUnits
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching rooms' });
  }
});

app.post('/api/hotel/rooms', async (req, res) => {
  try {
    const room = new Room({ ...req.body });
    await room.save();
    res.status(201).json({ message: 'Room created successfully', room });
  } catch (error) {
    res.status(500).json({ message: 'Error creating room' });
  }
});

app.put('/api/hotel/rooms/:id', async (req, res) => {
  try {
    const updates = pickUpdates(req.body, ['type', 'total', 'available', 'booked', 'price', 'status', 'hotel']);
    const room = await Room.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }
    res.status(200).json({ message: 'Room updated successfully', room });
  } catch (error) {
    res.status(500).json({ message: 'Error updating room' });
  }
});

app.delete('/api/hotel/rooms/:id', async (req, res) => {
  try {
    await Room.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Room deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting room' });
  }
});

// --- Pricing (alias for rooms, focused on price updates) ---
app.get('/api/hotel/pricing', async (req, res) => {
  try {
    const { hotelName } = req.query;
    const filter = hotelName ? { hotel: hotelName } : {};
    const search = searchFilter(['hotel', 'type'], req.query.search);
    if (search) Object.assign(filter, search);
    const { docs, total, page, limit, totalPages, hasNext, hasPrev } = await findPage(Room, filter, {
      query: req.query,
      sort: { createdAt: -1 }
    });
    pagedResponse(res, 'rooms', { docs, total, page, limit, totalPages, hasNext, hasPrev });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching pricing' });
  }
});

app.put('/api/hotel/pricing/:id', async (req, res) => {
  try {
    const { price } = req.body;
    const room = await Room.findByIdAndUpdate(req.params.id, { price }, { new: true });
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }
    res.status(200).json({ message: 'Price updated successfully', room });
  } catch (error) {
    res.status(500).json({ message: 'Error updating price' });
  }
});

// --- Availability ---
app.get('/api/hotel/availability', async (req, res) => {
  try {
    const { hotelName } = req.query;
    const filter = hotelName ? { hotel: hotelName } : {};
    const search = searchFilter(['hotel', 'type'], req.query.search);
    if (search) Object.assign(filter, search);
    const { docs, total, page, limit, totalPages, hasNext, hasPrev } = await findPage(Room, filter, {
      query: req.query,
      sort: { createdAt: -1 }
    });
    pagedResponse(res, 'rooms', { docs, total, page, limit, totalPages, hasNext, hasPrev });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching availability' });
  }
});

app.put('/api/hotel/availability/bulk', async (req, res) => {
  try {
    const { updates } = req.body;
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ message: 'No updates provided' });
    }
    const promises = updates.map(u => Room.findByIdAndUpdate(u.id, { ...u, id: undefined }, { new: true }));
    await Promise.all(promises);
    res.status(200).json({ message: 'Bulk availability updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating availability' });
  }
});

// --- Bookings ---
app.get('/api/hotel/bookings', async (req, res) => {
  try {
    const { hotelName } = req.query;
    const filter = hotelName ? { hotelName } : { hotelName: { $exists: true, $ne: '' } };
    const search = searchFilter(['bookingId', 'guestName', 'guestEmail', 'guestPhone', 'roomType', 'hotelName', 'notes'], req.query.search);
    if (search) Object.assign(filter, search);
    const { docs, total, page, limit, totalPages, hasNext, hasPrev } = await findPage(Booking, filter, {
      query: req.query,
      sort: { bookingDate: -1 }
    });
    const [byStatusAgg, revenueAgg] = await Promise.all([
      Booking.aggregate([
        { $match: filter },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Booking.aggregate([
        { $match: { ...filter, paymentStatus: 'paid' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ])
    ]);
    const byStatus = {};
    for (const row of byStatusAgg) byStatus[row._id || 'unknown'] = row.count;
    pagedResponse(res, 'bookings', { docs, total, page, limit, totalPages, hasNext, hasPrev }, {
      stats: {
        total,
        byStatus,
        totalRevenue: revenueAgg[0]?.total || 0
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching bookings' });
  }
});

app.post('/api/hotel/bookings', async (req, res) => {
  try {
    const payload = {
      ...req.body,
      userId: req.user.userId,
      status: req.body.status || 'pending',
      bookingId: `HBK-${Date.now().toString().slice(-8)}`,
      timeline: [{ status: req.body.status || 'pending', date: new Date(), note: 'Booking created' }]
    };
    const booking = new Booking(payload);
    await booking.save();
    await Notification.create({
      userId: req.user.userId,
      type: 'booking',
      title: 'New Booking',
      message: `New booking ${payload.bookingId} for ${payload.guestName || 'guest'} has been created.`,
      relatedId: booking._id,
      read: false
    });
    if (payload.guestEmail) {
      await sendNotificationEmail(
        payload.guestEmail,
        'Booking Confirmation',
        `Your hotel booking <strong>${payload.bookingId}</strong> has been created. Check-in: ${payload.checkInDate || 'TBD'}. Amount: ₹${payload.amount || 0}.`
      );
    }
    res.status(201).json({ message: 'Booking created successfully', booking });
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ message: 'Error creating booking' });
  }
});

app.put('/api/hotel/bookings/:id', async (req, res) => {
  try {
    const updates = pickUpdates(req.body, ['guestName', 'guestEmail', 'guestPhone', 'roomType', 'rooms', 'guests', 'checkInDate', 'checkOutDate', 'amount', 'paidAmount', 'status', 'paymentStatus', 'notes', 'hotelName']);
    if (updates.status) {
      updates.$push = { timeline: { status: updates.status, date: new Date(), note: 'Status updated by hotel partner' } };
    }
    const booking = await Booking.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
     if (updates.status === 'checked_in') {
      await Notification.create({
        userId: req.user.userId,
        type: 'booking',
        title: 'Guest Checked In',
        message: `${booking.guestName || 'Guest'} has checked in (Room: ${booking.roomType || 'N/A'}).`,
        relatedId: booking._id,
        read: false
      });
      if (booking.guestEmail) {
        await sendNotificationEmail(
          booking.guestEmail,
          'Check-in Confirmation',
          `Hello ${booking.guestName || 'Guest'}, your check-in at ${booking.hotelName || 'our hotel'} is confirmed. Room: ${booking.roomType || 'N/A'}. Enjoy your stay!`
        ).catch(() => {});
      }
    }
    if (updates.status === 'checked_out') {
      await Notification.create({
        userId: req.user.userId,
        type: 'payment',
        title: 'Guest Checked Out',
        message: `${booking.guestName || 'Guest'} has checked out. Total: ₹${booking.amount || 0}, Paid: ₹${booking.paidAmount || 0}.`,
        relatedId: booking._id,
        read: false
      });
      if (booking.guestEmail) {
        await sendNotificationEmail(
          booking.guestEmail,
          'Check-out Confirmation',
          `Thank you for staying at ${booking.hotelName || 'our hotel'}. Total: ₹${booking.amount || 0}, Paid: ₹${booking.paidAmount || 0}.`
        ).catch(() => {});
      }
    }
    res.status(200).json({ message: 'Booking updated', booking });
  } catch (error) {
    res.status(500).json({ message: 'Error updating booking' });
  }
});

app.delete('/api/hotel/bookings/:id', async (req, res) => {
  try {
    await Booking.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Booking deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting booking' });
  }
});

app.put('/api/hotel/bookings/:id/pay', async (req, res) => {
  try {
    const { amount } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    const paymentAmount = Math.min(amount || 0, booking.amount - (booking.paidAmount || 0));
    booking.paidAmount = (booking.paidAmount || 0) + paymentAmount;
    if (booking.paidAmount >= booking.amount) {
      booking.paymentStatus = 'paid';
    } else if (booking.paidAmount > 0) {
      booking.paymentStatus = 'partial';
    }
    booking.timeline.push({ status: 'payment', date: new Date(), note: `Payment of ₹${paymentAmount} recorded` });
    await booking.save();
    await Notification.create({
      userId: req.user.userId,
      type: 'payment',
      title: 'Payment Recorded',
      message: `Payment of ₹${paymentAmount} recorded for ${booking.guestName || 'guest'} (${booking.bookingId}).`,
      relatedId: booking._id,
      read: false
    });
    res.status(200).json({ message: 'Payment recorded', booking });
  } catch (error) {
    res.status(500).json({ message: 'Error recording payment' });
  }
});

// --- Guests ---
app.get('/api/hotel/guests', async (req, res) => {
  try {
    const { hotelName } = req.query;
    const filter = hotelName ? { hotelName } : { hotelName: { $exists: true, $ne: '' } };
    const search = searchFilter(['guestName', 'guestEmail', 'guestPhone'], req.query.search);
    if (search) Object.assign(filter, search);
    const { page, limit, skip } = getPagination(req.query);
    const pageStages = [{ $sort: { totalSpent: -1 } }];
    if (limit > 0) {
      pageStages.push({ $skip: skip }, { $limit: limit });
    }
    const [facet] = await Booking.aggregate([
      { $match: filter },
      {
        $addFields: {
          __guestKey: {
            $cond: [
              { $ne: [{ $ifNull: ['$guestEmail', ''] }, ''] },
              '$guestEmail',
              { $cond: [{ $ne: [{ $ifNull: ['$guestPhone', ''] }, ''] }, '$guestPhone', '$guestName'] }
            ]
          }
        }
      },
      { $match: { __guestKey: { $nin: [null, ''] } } },
      {
        $group: {
          _id: '$__guestKey',
          bookingId: { $first: '$_id' },
          name: { $first: { $ifNull: ['$guestName', ''] } },
          email: { $first: { $ifNull: ['$guestEmail', ''] } },
          phone: { $first: { $ifNull: ['$guestPhone', ''] } },
          totalStays: { $sum: 1 },
          totalSpent: { $sum: { $ifNull: ['$paidAmount', 0] } },
          lastStay: { $max: '$bookingDate' }
        }
      },
      {
        $project: {
          _id: '$bookingId',
          name: 1,
          email: 1,
          phone: 1,
          totalStays: 1,
          totalSpent: 1,
          lastStay: 1
        }
      },
      { $facet: { data: pageStages, total: [{ $count: 'count' }] } }
    ]);
    const docs = facet?.data || [];
    const total = facet?.total?.[0]?.count || 0;
    const totalPages = limit > 0 ? Math.max(1, Math.ceil(total / limit)) : 1;
    pagedResponse(res, 'guests', {
      docs,
      total,
      page,
      limit,
      totalPages,
      hasNext: limit > 0 ? page * limit < total : false,
      hasPrev: page > 1
    }, {
      stats: { totalGuests: total }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching guests' });
  }
});

// --- Reviews ---
app.get('/api/hotel/reviews', async (req, res) => {
  try {
    const { hotelName, packageId, operatorId } = req.query;
    const filter = {};
    if (packageId) filter.packageId = packageId;

    if (operatorId) {
      // Operator view: reviews of that operator's packages plus their own.
      filter.$or = [{ operatorId }, { customerId: req.user.userId }];
    } else if (hotelName) {
      // Hotel partner view: reviews only for packages this hotel has bookings
      // for. Reviews are attached to packages, so this is the only link a
      // hotel has to them - scoping on it stops the route leaking every
      // review in the database.
      // Use aggregation with $lookup instead of N+1 Booking.find
      const pkgIdAgg = await Booking.aggregate([
        { $match: { hotelName, packageId: { $exists: true, $ne: null } } },
        { $group: { _id: null, ids: { $addToSet: '$packageId' } } },
        { $project: { _id: 0, ids: 1 } }
      ]);
      const packageIds = pkgIdAgg[0]?.ids || [];
      if (packageIds.length === 0) return pagedResponse(res, 'reviews', { docs: [], total: 0, page: 1, limit: getPagination(req.query).limit, totalPages: 1, hasNext: false, hasPrev: false });
      filter.packageId = { $in: packageIds };
    } else {
      // No hotel context supplied: fall back to the partner's own reviews
      // rather than returning the full collection.
      filter.customerId = req.user.userId;
    }

    const search = searchFilter(['customer', 'comment', 'package'], req.query.search);
    if (search) filter.$and = [{ $or: search.$or }];
    const { docs, total, page, limit, totalPages, hasNext, hasPrev } = await findPage(Review, filter, {
      query: req.query,
      populate: { path: 'packageId', select: 'name destination image' },
      sort: { date: -1 }
    });
    pagedResponse(res, 'reviews', { docs, total, page, limit, totalPages, hasNext, hasPrev });
  } catch (error) {
    console.error('Error fetching hotel reviews:', error);
    res.status(500).json({ message: 'Error fetching reviews' });
  }
});

app.put('/api/hotel/reviews/:id/respond', async (req, res) => {
  try {
    const { response } = req.body;
    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { 'response.text': response, 'response.date': new Date() },
      { new: true }
    );
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }
    if (review.customerId) {
      const cust = await User.findById(review.customerId).select('email');
      if (cust?.email) {
        await sendNotificationEmail(
          cust.email,
          'New Response to Your Review',
          `The hotel partner has responded to your review for "${review.package}". Check your notifications for details.`
        ).catch(() => {});
      }
    }
    res.status(200).json({ message: 'Response submitted', review });
  } catch (error) {
    res.status(500).json({ message: 'Error responding to review' });
  }
});

app.put('/api/hotel/reviews/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const review = await Review.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }
    if (review.customerId && (status === 'approved' || status === 'rejected')) {
      const cust = await User.findById(review.customerId).select('email');
      if (cust?.email) {
        await sendNotificationEmail(
          cust.email,
          `Review ${status === 'approved' ? 'Approved' : 'Rejected'}`,
          `Your review for "${review.package}" has been ${status === 'approved' ? 'approved' : 'rejected'} by the hotel partner.`
        ).catch(() => {});
      }
    }
    res.status(200).json({ message: 'Review status updated', review });
  } catch (error) {
    res.status(500).json({ message: 'Error updating review status' });
  }
});

app.delete('/api/hotel/reviews/:id', async (req, res) => {
  try {
    await Review.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Review deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting review' });
  }
});

// --- Revenue ---
app.get('/api/hotel/revenue', async (req, res) => {
  try {
    const range = req.query.range || 'month';
    const since = rangeStart(range);
    const { hotelName } = req.query;
    const filter = hotelName ? { hotelName } : { hotelName: { $exists: true, $ne: '' } };

    // Single aggregation replaces countDocuments + find + 6 monthly queries
    const revenueAgg = await Booking.aggregate([
      { $match: { ...filter } },
      { $group: {
          _id: null,
          totalBookings: { $sum: 1 },
          totalRevenue: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$amount', 0] } },
          rangeRevenue: { $sum: { $cond: [{ $and: [{ $eq: ['$paymentStatus', 'paid'] }, { $gte: ['$bookingDate', since] }] }, '$amount', 0] } }
      }
      }
    ]);
    const agg = revenueAgg[0] || {};
    const totalBookings = agg.totalBookings || 0;
    const totalRevenue = agg.totalRevenue || 0;
    const rangeRevenue = agg.rangeRevenue || 0;

    // Monthly revenue via single aggregation (6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5, 1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const monthlyRevenueAgg = await Booking.aggregate([
      { $match: { ...filter, paymentStatus: 'paid', bookingDate: { $gte: sixMonthsAgo } } },
      { $group: {
          _id: { year: { $year: '$bookingDate' }, month: { $month: '$bookingDate' } },
          revenue: { $sum: '$amount' }
      }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    const monthlyRevenue = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i, 1);
      d.setHours(0, 0, 0, 0);
      const monthData = monthlyRevenueAgg.find(
        (m) => m._id.year === d.getFullYear() && m._id.month === (d.getMonth() + 1)
      );
      monthlyRevenue.push(monthData ? monthData.revenue : 0);
    }

    res.status(200).json({
      totalRevenue,
      rangeRevenue,
      totalBookings,
      monthlyRevenue
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching revenue data' });
  }
});

// --- Notifications ---
app.get('/api/hotel/notifications', async (req, res) => {
  try {
    const filter = { userId: req.user.userId };
    const search = searchFilter(['title', 'message', 'type'], req.query.search);
    if (search) Object.assign(filter, search);
    const { docs, total, page, limit, totalPages, hasNext, hasPrev } = await findPage(Notification, filter, {
      query: req.query,
      sort: { createdAt: -1 },
      defaultLimit: 20
    });
    const unreadCount = await Notification.countDocuments({ userId: req.user.userId, read: false });
    pagedResponse(res, 'notifications', { docs, total, page, limit, totalPages, hasNext, hasPrev }, { unreadCount });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching notifications' });
  }
});

app.put('/api/hotel/notifications/read-all', async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user.userId, read: false },
      { read: true }
    );
    res.status(200).json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating notifications' });
  }
});

app.put('/api/hotel/notifications/:id/read', async (req, res) => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.userId },
      { read: true }
    );
    res.status(200).json({ message: 'Notification marked as read' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating notification' });
  }
});

app.delete('/api/hotel/notifications/:id', async (req, res) => {
  try {
    await Notification.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });
    res.status(200).json({ message: 'Notification deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting notification' });
  }
});

// --- Analytics ---
app.get('/api/hotel/analytics', async (req, res) => {
  try {
    const range = req.query.range || 'month';
    const since = rangeStart(range);
    const { hotelName, starRating } = req.query;

    const user = await User.findById(req.user.userId);
    const profile = await HotelProfile.findOne({ userId: req.user.userId }).catch(() => null);

    const roomFilter = profile?.hotelName ? { hotel: profile.hotelName } : {};
    const rooms = await Room.find(roomFilter);
    const totalRooms = rooms.reduce((sum, r) => sum + (r.total || 0), 0);
    const availableRooms = rooms.reduce((sum, r) => sum + (r.available || 0), 0);
    const bookedRooms = rooms.reduce((sum, r) => sum + (r.booked || 0), 0);
    const occupancyRate = totalRooms > 0 ? Math.round((bookedRooms / totalRooms) * 100) : 0;

    const allBookings = await Booking.find({ hotelName: { $exists: true, $ne: '' } }).sort({ bookingDate: -1 });

    const paidBookings = allBookings.filter(b => b.paymentStatus === 'paid');
    const totalRevenue = paidBookings.reduce((sum, b) => sum + (b.amount || 0), 0);
    const rangeBookings = allBookings.filter(b => new Date(b.bookingDate) >= since);
    const rangeRevenue = rangeBookings.filter(b => b.paymentStatus === 'paid').reduce((sum, b) => sum + (b.amount || 0), 0);

    const bookingStatus = {};
    allBookings.forEach(b => {
      bookingStatus[b.status] = (bookingStatus[b.status] || 0) + 1;
    });

    const paymentBreakdown = {};
    allBookings.forEach(b => {
      paymentBreakdown[b.paymentStatus] = (paymentBreakdown[b.paymentStatus] || 0) + 1;
    });

    const topRoomsMap = {};
    allBookings.forEach(b => {
      const key = b.roomType || 'Unknown';
      if (!topRoomsMap[key]) topRoomsMap[key] = { name: key, revenue: 0 };
      topRoomsMap[key].revenue += (b.paidAmount || 0);
    });
    const topRooms = Object.values(topRoomsMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    const roomStatus = { available: 0, occupied: 0, reserved: 0, maintenance: 0 };
    rooms.forEach(r => {
      roomStatus.available += (r.available || 0);
      roomStatus.occupied += (r.booked || 0);
      roomStatus.maintenance += r.status === 'inactive' ? (r.total || 0) : 0;
      roomStatus.reserved = 0;
    });

    const today = new Date().toISOString().split('T')[0];
    const todayCheckIns = allBookings.filter(b => {
      const ci = b.checkInDate ? new Date(b.checkInDate).toISOString().split('T')[0] : null;
      return ci === today;
    });
    const todayCheckOuts = allBookings.filter(b => {
      const co = b.checkOutDate ? new Date(b.checkOutDate).toISOString().split('T')[0] : null;
      return co === today;
    });

    const totalBookings = allBookings.length;
    const pendingPayments = allBookings
      .filter(b => b.paymentStatus === 'partial' || b.paymentStatus === 'pending')
      .reduce((sum, b) => sum + ((b.amount || 0) - (b.paidAmount || 0)), 0);

    const currentlyCheckedIn = allBookings.filter(b => b.status === 'checked_in').length;

    const operatorReviews = await Review.find({}).sort({ date: -1 }).limit(5);
    const recentReviews = operatorReviews.map(r => ({
      _id: r._id,
      customer: r.customer,
      rating: r.rating,
      comment: r.comment,
      date: r.date
    }));

    const recentBookings = allBookings
      .sort((a, b) => new Date(b.bookingDate) - new Date(a.bookingDate))
      .slice(0, 6)
      .map(b => ({
        _id: b._id,
        guestName: b.guestName,
        roomType: b.roomType,
        checkInDate: b.checkInDate,
        checkOutDate: b.checkOutDate,
        amount: b.amount,
        paymentStatus: b.paymentStatus,
        status: b.status
      }));

    const revenueTrend = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStart = new Date(d.setHours(0, 0, 0, 0));
      const dayEnd = new Date(d.setDate(d.getDate() + 1));
      const dayBookings = paidBookings.filter(b => new Date(b.bookingDate) >= dayStart && new Date(b.bookingDate) < dayEnd);
      const revenue = dayBookings.reduce((sum, b) => sum + (b.amount || 0), 0);
      revenueTrend.push({
        label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        revenue
      });
    }

    const alerts = {
      lowAvailability: totalRooms > 0 && availableRooms < totalRooms * 0.2
    };

    res.status(200).json({
      totalRooms,
      availableRooms,
      bookedRooms,
      occupancyRate,
      totalRevenue,
      rangeRevenue,
      revenueTrend,
      bookingStatus: {
        confirmed: bookingStatus.confirmed || 0,
        checked_in: bookingStatus.checked_in || 0,
        pending: bookingStatus.pending || 0,
        checked_out: bookingStatus.checked_out || 0,
        cancelled: bookingStatus.cancelled || 0
      },
      paymentBreakdown: {
        paid: paymentBreakdown.paid || 0,
        partial: paymentBreakdown.partial || 0,
        pending: paymentBreakdown.pending || 0,
        refunded: paymentBreakdown.refunded || 0
      },
      topRooms,
      roomStatus,
      todayCheckIns: todayCheckIns.map(b => ({
        _id: b._id,
        guestName: b.guestName,
        roomType: b.roomType,
        guests: b.guests || 1,
        amount: b.amount
      })),
      todayCheckOuts: todayCheckOuts.map(b => ({
        _id: b._id,
        guestName: b.guestName,
        roomType: b.roomType,
        guests: b.guests || 1,
        paidAmount: b.paidAmount
      })),
      totalBookings,
      pendingPayments,
      currentlyCheckedIn,
      recentBookings,
      recentReviews,
      alerts
    });
  } catch (error) {
    console.error('Error fetching hotel analytics:', error);
    res.status(500).json({ message: 'Error fetching analytics' });
  }
});

// ============================================
// MEMBERSHIP & SUBSCRIPTION MODELS
// ============================================

// Membership Plan — defines available subscription tiers (Basic, Premium, VIP).
const membershipPlanSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  currency: {
    type: String,
    default: 'INR',
    uppercase: true,
    trim: true
  },
  billingInterval: {
    type: String,
    enum: ['monthly', 'yearly', 'lifetime'],
    default: 'yearly'
  },
  durationMonths: {
    type: Number,
    default: 12,
    min: 0
  },
  discountPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  maxDiscountLimit: {
    type: Number,
    min: 0
  },
  benefits: [{
    type: String,
    trim: true
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  isLifetime: {
    type: Boolean,
    default: false
  },
  isPopular: {
    type: Boolean,
    default: false
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

membershipPlanSchema.index({ slug: 1 });
membershipPlanSchema.index({ isActive: 1, sortOrder: 1 });

const MembershipPlan = mongoose.model('MembershipPlan', membershipPlanSchema);

// Membership Subscription — customer's active/expired subscription record.
const membershipSubscriptionSchema = new mongoose.Schema({
  subscriptionId: {
    type: String,
    required: true,
    unique: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MembershipPlan'
  },
  planNameSnapshot: {
    type: String,
    required: true
  },
  priceSnapshot: {
    type: Number,
    required: true,
    min: 0
  },
  discountSnapshot: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
    default: 0
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'cancelled', 'suspended', 'pending'],
    default: 'pending',
    index: true
  },
  stripeCustomerId: String,
  stripeSubscriptionId: {
    type: String,
    unique: true,
    sparse: true
  },
  autoRenew: {
    type: Boolean,
    default: true
  },
  cancelledAt: Date,
  upiPaymentReference: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

membershipSubscriptionSchema.index({ customerId: 1, status: 1 });
membershipSubscriptionSchema.index({ endDate: 1, status: 1 });

const MembershipSubscription = mongoose.model('MembershipSubscription', membershipSubscriptionSchema);

// Membership Payment — records payments made for membership subscriptions.
const membershipPaymentSchema = new mongoose.Schema({
  paymentId: {
    type: String,
    required: true,
    unique: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  subscriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MembershipSubscription'
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'INR',
    uppercase: true
  },
  paymentProvider: {
    type: String,
    enum: ['stripe', 'upi', 'manual'],
    required: true
  },
  stripePaymentIntentId: {
    type: String,
    sparse: true,
    index: true
  },
  stripeInvoiceId: {
    type: String,
    sparse: true
  },
  paymentStatus: {
    type: String,
    enum: ['paid', 'pending', 'failed', 'refunded'],
    default: 'pending',
    index: true
  },
  paymentReference: String,
  upiTransactionId: {
    type: String,
    sparse: true
  },
  paymentNotes: String,
  paidAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

membershipPaymentSchema.index({ customerId: 1, createdAt: -1 });

const MembershipPayment = mongoose.model('MembershipPayment', membershipPaymentSchema);

// Seed default membership plans if none exist
async function ensureDefaultMembershipPlans() {
  try {
    const count = await MembershipPlan.countDocuments();
    if (count === 0) {
      await seedDefaultMembershipPlans();
    }
  } catch (error) {
    console.error('Error ensuring default membership plans:', error.message);
  }
}

// Try to seed immediately if already connected, otherwise wait for connection
if (mongoose.connection.readyState === 1) {
  ensureDefaultMembershipPlans();
} else {
  mongoose.connection.once('connected', ensureDefaultMembershipPlans);
}

// Also keep the event listener for reconnection scenarios
mongoose.connection.on('connected', seedDefaultMembershipPlans);

function generateMembershipId() {
  return 'MEM-' + Date.now().toString().slice(-8) + '-' + Math.random().toString(36).slice(2, 8);
}

function generatePaymentId() {
  return 'PAY-' + Date.now().toString().slice(-8) + '-' + Math.random().toString(36).slice(2, 8);
}

async function seedDefaultMembershipPlans() {
  try {
    const count = await MembershipPlan.countDocuments();
    if (count > 0) return;

    const plans = [
      {
        name: 'Basic',
        slug: 'basic',
        description: 'Free membership for exploring destinations and booking travel packages.',
        price: 0,
        currency: 'INR',
        billingInterval: 'lifetime',
        durationMonths: 0,
        discountPercentage: 0,
        maxDiscountLimit: 0,
        isLifetime: true,
        benefits: [
          'Browse all travel destinations',
          'View travel packages',
          'Book available travel packages',
          'Access customer dashboard',
          'View booking history',
          'Download booking invoices',
          'Standard customer support',
          'Manage profile and account security'
        ],
        isActive: true,
        isPopular: false,
        sortOrder: 1
      },
      {
        name: 'Premium',
        slug: 'premium',
        description: 'Annual membership with 5% discount on travel packages and priority support.',
        price: 999,
        currency: 'INR',
        billingInterval: 'yearly',
        durationMonths: 12,
        discountPercentage: 5,
        maxDiscountLimit: 5000,
        benefits: [
          'All Basic features',
          '5% discount on eligible travel packages',
          'Priority customer support',
          'Exclusive travel offers',
          'Early access to selected travel packages',
          'Special member-only deals',
          'Membership dashboard',
          'Membership payment history'
        ],
        isActive: true,
        isPopular: true,
        sortOrder: 2
      },
      {
        name: 'VIP / Elite',
        slug: 'vip',
        description: 'Annual membership with 10% discount on travel packages and dedicated assistance.',
        price: 1999,
        currency: 'INR',
        billingInterval: 'yearly',
        durationMonths: 12,
        discountPercentage: 10,
        maxDiscountLimit: 15000,
        benefits: [
          'All Premium features',
          '10% discount on eligible travel packages',
          'Dedicated travel assistance',
          'Complimentary itinerary consultation',
          'Exclusive hotel deals',
          'Priority booking assistance',
          'VIP customer support',
          'Special cancellation benefits where configured',
          'Exclusive member offers'
        ],
        isActive: true,
        isPopular: false,
        sortOrder: 3
      }
    ];

    for (const plan of plans) {
      await MembershipPlan.create(plan);
    }
    console.log('Default membership plans seeded');
  } catch (error) {
    console.error('Error seeding membership plans:', error.message);
  }
}

async function getActiveMembership(customerId) {
  const now = new Date();
  const subscription = await MembershipSubscription.findOne({
    customerId,
    status: 'active',
    endDate: { $gte: now }
  }).sort({ endDate: -1 }).lean();
  return subscription;
}

async function applyMembershipDiscount(customerId, originalAmount, packageEligible = true) {
  if (!packageEligible) return { discountPercentage: 0, discountAmount: 0, finalAmount: originalAmount, membershipId: null };

  const membership = await getActiveMembership(customerId);
  if (!membership || membership.discountSnapshot <= 0) {
    return { discountPercentage: 0, discountAmount: 0, finalAmount: originalAmount, membershipId: null };
  }

  const discountPercentage = membership.discountSnapshot;
  let discountAmount = Math.round((originalAmount * discountPercentage) / 100);

  // Apply max discount limit if configured
  // Find the plan to check maxDiscountLimit
  const plan = await MembershipPlan.findById(membership.planId).lean();
  if (plan && plan.maxDiscountLimit && discountAmount > plan.maxDiscountLimit) {
    discountAmount = plan.maxDiscountLimit;
  }

  const finalAmount = Math.max(0, originalAmount - discountAmount);

  return {
    discountPercentage,
    discountAmount,
    finalAmount,
    membershipId: membership._id,
    planName: membership.planNameSnapshot
  };
}

async function createMembershipNotification(userId, type, title, message, relatedId, actionUrl) {
  const membershipTypes = ['booking', 'payment', 'system', 'offer'];
  if (!membershipTypes.includes(type)) {
    // Use generic system type for membership notifications
    type = 'system';
  }
  return createNotification({
    userId,
    type,
    title,
    message,
    relatedId,
    actionUrl,
    severity: 'info',
    email: true
  }).catch(err => console.error('Membership notification failed:', err.message));
}

// ============================================
// CUSTOMER MEMBERSHIP APIs
// ============================================

// Get all active membership plans for customers.
app.get('/api/customer/membership/plans', authenticate, requireCustomer, async (req, res) => {
  try {
    const plans = await MembershipPlan.find({ isActive: true }).sort({ sortOrder: 1, price: 1 }).lean();
    res.status(200).json({ plans });
  } catch (error) {
    console.error('Fetch membership plans error:', error.message);
    res.status(500).json({ message: 'Error fetching membership plans' });
  }
});

// Get customer's current active membership.
app.get('/api/customer/membership/current', authenticate, requireCustomer, async (req, res) => {
  try {
    const membership = await getActiveMembership(req.user.userId);
    if (!membership) {
      // Check if customer has any subscription (even expired)
      const anySubscription = await MembershipSubscription.findOne({ customerId: req.user.userId })
        .sort({ createdAt: -1 }).lean();
      if (!anySubscription) {
        // Assign Basic plan by default
        const basicPlan = await MembershipPlan.findOne({ slug: 'basic', isActive: true }).lean();
        if (basicPlan) {
          const now = new Date();
          const endDate = new Date(now);
          endDate.setFullYear(endDate.getFullYear() + 100); // Lifetime
          const subscription = new MembershipSubscription({
          _id: new mongoose.Types.ObjectId(),
          subscriptionId: generateMembershipId(),
          customerId: req.user.userId,
          planId: basicPlan._id,
          planNameSnapshot: basicPlan.name,
          priceSnapshot: basicPlan.price,
          discountSnapshot: basicPlan.discountPercentage,
          startDate: now,
          endDate,
          status: 'active',
          autoRenew: false
        });
          await subscription.save();
          return res.status(200).json({ membership: subscription });
        }
        return res.status(200).json({ membership: null });
      }
      return res.status(200).json({ membership: anySubscription });
    }
    res.status(200).json({ membership });
  } catch (error) {
    console.error('Get current membership error:', error.message);
    res.status(500).json({ message: 'Error fetching current membership' });
  }
});

// Get customer's membership payment/subscription history.
app.get('/api/customer/membership/history', authenticate, requireCustomer, async (req, res) => {
  try {
    const subscriptions = await MembershipSubscription.find({ customerId: req.user.userId })
      .sort({ createdAt: -1 })
      .lean();

    const payments = await MembershipPayment.find({ customerId: req.user.userId })
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({ subscriptions, payments });
  } catch (error) {
    console.error('Get membership history error:', error.message);
    res.status(500).json({ message: 'Error fetching membership history' });
  }
});

// Subscribe to a membership plan (creates pending subscription, then checkout).
app.post('/api/customer/membership/subscribe', authenticate, requireCustomer, async (req, res) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const { planId } = req.body || {};

      if (!planId) {
        const err = new Error('Plan ID is required');
        err.statusCode = 400;
        throw err;
      }

      // Accept either MongoDB _id or plan slug.
      // findById throws a CastError when planId is a slug, so catch it.
      let plan = null;
      try {
        plan = await MembershipPlan.findById(planId).session(session);
      } catch (castErr) {
        // Invalid ObjectId format — fall through to slug lookup below
        plan = null;
      }
      if (!plan) {
        plan = await MembershipPlan.findOne({ slug: planId, isActive: true }).session(session);
      }
      if (!plan || !plan.isActive) {
        const err = new Error('Membership plan not found or inactive');
        err.statusCode = 404;
        throw err;
      }

      // Defensive: ensure plan has a valid _id
      if (!plan._id) {
        const err = new Error('Plan ID is invalid');
        err.statusCode = 500;
        throw err;
      }

      // Check for existing active subscription
      const existingActive = await MembershipSubscription.findOne({
        customerId: req.user.userId,
        status: 'active',
        endDate: { $gte: new Date() }
      }).session(session);

      if (existingActive) {
        const err = new Error('You already have an active membership. Cancel or wait for expiry before subscribing to a new plan.');
        err.statusCode = 400;
        throw err;
      }

      // Cancel any existing pending subscriptions
      await MembershipSubscription.updateMany(
        { customerId: req.user.userId, status: 'pending' },
        { status: 'cancelled', cancelledAt: new Date() },
        { session }
      );

      const now = new Date();
      const endDate = new Date(now);
      if (plan.billingInterval === 'lifetime' || plan.isLifetime) {
        endDate.setFullYear(9999);
      } else if (plan.billingInterval === 'yearly') {
        endDate.setFullYear(endDate.getFullYear() + 1);
      } else {
        endDate.setMonth(endDate.getMonth() + 1);
      }

      const subscription = new MembershipSubscription({
        _id: new mongoose.Types.ObjectId(),
        subscriptionId: generateMembershipId(),
        customerId: req.user.userId,
        planId: plan._id,
        planNameSnapshot: plan.name,
        priceSnapshot: plan.price,
        discountSnapshot: plan.discountPercentage,
        startDate: now,
        endDate,
        status: plan.price === 0 ? 'active' : 'pending',
        autoRenew: plan.price === 0 ? false : true
      }, { session });

      await subscription.save();

      // Create payment record for paid plans
      if (plan.price > 0) {
        const payment = new MembershipPayment({
          _id: new mongoose.Types.ObjectId(),
          paymentId: generatePaymentId(),
          customerId: req.user.userId,
          subscriptionId: subscription._id,
          amount: plan.price,
          currency: plan.currency,
          paymentProvider: 'stripe',
          paymentStatus: 'pending',
          paymentReference: subscription.subscriptionId
        }, { session });
        await payment.save();
      }

      res.status(200).json({
        message: plan.price === 0 ? 'Membership activated' : 'Subscription created, proceed to payment',
        subscription: {
          id: subscription._id,
          subscriptionId: subscription.subscriptionId,
          planName: subscription.planNameSnapshot,
          price: subscription.priceSnapshot,
          status: subscription.status,
          startDate: subscription.startDate,
          endDate: subscription.endDate
        },
        requiresPayment: plan.price > 0
      });
    });
  } catch (error) {
    console.error('Subscribe membership error:', error.message);
    console.error('Subscribe membership error stack:', error.stack);
    console.error('Subscribe membership error details:', { planId: req.body?.planId, userId: req.user?.userId, errorName: error.name, errorCode: error.code, errorMessage: error.message });
    if (error.errors) {
      console.error('Subscribe membership validation errors:', JSON.stringify(error.errors, null, 2));
    }
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    res.status(500).json({ message: 'Error subscribing to membership' });
  } finally {
    session.endSession();
  }
});

// Create Stripe checkout session for membership payment.
app.post('/api/customer/membership/checkout', authenticate, requireCustomer, async (req, res) => {
  try {
    const { subscriptionId } = req.body || {};

    if (!subscriptionId) {
      return res.status(400).json({ message: 'Subscription ID is required' });
    }

    const subscription = await MembershipSubscription.findOne({
      _id: subscriptionId,
      customerId: req.user.userId,
      status: 'pending'
    });

    if (!subscription) {
      return res.status(404).json({ message: 'Subscription not found or not pending' });
    }

    const plan = await MembershipPlan.findById(subscription.planId);
    if (!plan || plan.price <= 0) {
      return res.status(400).json({ message: 'Invalid plan or no payment required' });
    }

    // Check for existing Stripe subscription reference
    if (subscription.stripeSubscriptionId) {
      try {
        const existing = await getStripe().checkout.sessions.retrieve(subscription.stripeSubscriptionId);
        if (existing.payment_status === 'unpaid') {
          return res.status(200).json({
            checkoutUrl: existing.url,
            sessionId: existing.id,
            amount: plan.price,
            message: 'Reusing existing checkout session'
          });
        }
      } catch (err) {
        // Session may be expired; fall through
      }
    }

    const stripeSession = await getStripe().checkout.sessions.create({
      payment_method_types: ['card', 'upi'],
      line_items: [{
        price_data: {
          currency: plan.currency.toLowerCase(),
          product_data: {
            name: `Membership: ${plan.name}`,
            description: `${plan.description || ''} - ${plan.durationMonths} months`
          },
          unit_amount: Math.round(plan.price * 100)
        },
        quantity: 1
      }],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/customer/membership/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/customer/membership`,
      metadata: {
        subscriptionId: subscription._id.toString(),
        customerId: req.user.userId,
        planName: plan.name,
        planPrice: plan.price.toString()
      },
      client_reference_id: req.user.userId
    });

    subscription.stripeSubscriptionId = stripeSession.id;
    await subscription.save();

    res.status(200).json({
      message: 'Checkout session created',
      checkoutUrl: stripeSession.url,
      sessionId: stripeSession.id,
      amount: plan.price,
      currency: plan.currency
    });
  } catch (error) {
    console.error('Membership checkout error:', error.message);
    res.status(500).json({ message: 'Error creating membership checkout session' });
  }
});

// Cancel membership subscription.
app.post('/api/customer/membership/cancel', authenticate, requireCustomer, async (req, res) => {
  try {
    const subscription = await MembershipSubscription.findOne({
      customerId: req.user.userId,
      status: 'active'
    });

    if (!subscription) {
      return res.status(404).json({ message: 'No active membership found' });
    }

    subscription.status = 'cancelled';
    subscription.cancelledAt = new Date();
    subscription.autoRenew = false;
    await subscription.save();

    await createMembershipNotification(
      req.user.userId,
      'system',
      'Membership Cancelled',
      `Your ${subscription.planNameSnapshot} membership has been cancelled.`,
      subscription._id,
      '/customer/membership'
    );

    res.status(200).json({ message: 'Membership cancelled successfully', subscription });
  } catch (error) {
    console.error('Cancel membership error:', error.message);
    res.status(500).json({ message: 'Error cancelling membership' });
  }
});

// Renew membership subscription.
app.post('/api/customer/membership/renew', authenticate, requireCustomer, async (req, res) => {
  try {
    const subscription = await MembershipSubscription.findOne({
      customerId: req.user.userId,
      status: { $in: ['expired', 'cancelled'] }
    }).sort({ createdAt: -1 });

    if (!subscription) {
      return res.status(404).json({ message: 'No expired or cancelled membership found to renew' });
    }

    const plan = await MembershipPlan.findById(subscription.planId);
    if (!plan || !plan.isActive) {
      return res.status(400).json({ message: 'Membership plan is no longer available' });
    }

    // Reactivate with new dates
    const now = new Date();
    const endDate = new Date(now);
    if (plan.billingInterval === 'lifetime') {
      endDate.setFullYear(endDate.getFullYear() + 100);
    } else if (plan.billingInterval === 'yearly') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    subscription.status = plan.price === 0 ? 'active' : 'pending';
    subscription.startDate = now;
    subscription.endDate = endDate;
    subscription.cancelledAt = undefined;
    subscription.priceSnapshot = plan.price;
    subscription.discountSnapshot = plan.discountPercentage;
    subscription.planNameSnapshot = plan.name;
    await subscription.save();

    if (plan.price > 0) {
      const payment = new MembershipPayment({
        paymentId: generatePaymentId(),
        customerId: req.user.userId,
        subscriptionId: subscription._id,
        amount: plan.price,
        currency: plan.currency,
        paymentProvider: 'stripe',
        paymentStatus: 'pending',
        paymentReference: subscription.subscriptionId
      });
      await payment.save();
    }

    res.status(200).json({
      message: plan.price === 0 ? 'Membership renewed' : 'Renewal created, proceed to payment',
      subscription: {
        id: subscription._id,
        subscriptionId: subscription.subscriptionId,
        planName: subscription.planNameSnapshot,
        status: subscription.status,
        startDate: subscription.startDate,
        endDate: subscription.endDate
      },
      requiresPayment: plan.price > 0
    });
  } catch (error) {
    console.error('Renew membership error:', error.message);
    res.status(500).json({ message: 'Error renewing membership' });
  }
});

// Generate UPI QR for membership payment.
app.post('/api/customer/membership/upi-qr', authenticate, requireCustomer, async (req, res) => {
  const mongooseSession = await mongoose.startSession();
  try {
    await mongooseSession.withTransaction(async () => {
      const { subscriptionId } = req.body || {};

      if (!subscriptionId) {
        const err = new Error('Subscription ID is required');
        err.statusCode = 400;
        throw err;
      }

      const subscription = await MembershipSubscription.findOne({
        _id: subscriptionId,
        customerId: req.user.userId,
        status: 'pending'
      }).session(mongooseSession);

      if (!subscription) {
        const err = new Error('Subscription not found or not pending');
        err.statusCode = 404;
        throw err;
      }

      const plan = await MembershipPlan.findById(subscription.planId).session(mongooseSession);
      if (!plan || plan.price <= 0) {
        const err = new Error('Invalid plan or no payment required');
        err.statusCode = 400;
        throw err;
      }

      const amount = subscription.priceSnapshot;
      const paymentRef = `upi-mem-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

      const upiId = process.env.UPI_ID || process.env.UPI_MERCHANT_ID;
      const merchantName = process.env.UPI_MERCHANT_NAME || 'Travel Tour';
      if (!upiId || upiId === 'merchant@upi' || upiId.includes('your_') || !upiId.includes('@')) {
        const err = new Error('QR payment provider is not configured. Set UPI_ID in backend/.env.');
        err.statusCode = 503;
        throw err;
      }

      const upiUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(merchantName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(`Membership ${plan.name}`)}`;

      let qrDataUrl;
      try {
        qrDataUrl = await QRCode.toDataURL(upiUrl, {
          width: 300,
          margin: 2,
          color: { dark: '#087F73', light: '#ffffff' }
        });
        if (!qrDataUrl) {
          throw new Error('QR code generation returned empty data');
        }
      } catch (qrErr) {
        console.error('QR generation error:', qrErr.message);
        const err = new Error('Failed to generate QR code');
        err.statusCode = 500;
        throw err;
      }

      let payment = await MembershipPayment.findOne({
        subscriptionId: subscription._id,
        paymentProvider: 'upi',
        paymentStatus: 'pending'
      }).session(mongooseSession);

      if (!payment) {
        payment = new MembershipPayment({
          _id: new mongoose.Types.ObjectId(),
          paymentId: paymentRef,
          customerId: req.user.userId,
          subscriptionId: subscription._id,
          amount,
          currency: plan.currency,
          paymentProvider: 'upi',
          paymentStatus: 'pending',
          paymentReference: paymentRef
        }, { session: mongooseSession });
        await payment.save();
      }

      subscription.upiPaymentReference = paymentRef;
      await subscription.save({ session: mongooseSession });

      res.status(200).json({
        message: 'UPI QR payment session created',
        qrDataUrl,
        upiId,
        merchantName,
        amount,
        currency: plan.currency,
        bookingReference: subscription.subscriptionId,
        paymentReference: paymentRef,
        paymentState: 'PENDING',
        upiUrl,
        planName: plan.name
      });
    });
  } catch (error) {
    console.error('Membership UPI QR error:', error.message);
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    res.status(500).json({ message: 'Error creating membership UPI QR payment' });
  } finally {
    mongooseSession.endSession();
  }
});

// Customer submits UPI transaction reference for membership payment verification.
app.post('/api/customer/membership/verify-upi', authenticate, requireCustomer, async (req, res) => {
  try {
    const { subscriptionId, transactionId, notes } = req.body || {};

    if (!subscriptionId) {
      return res.status(400).json({ message: 'Subscription ID is required' });
    }
    if (!transactionId) {
      return res.status(400).json({ message: 'UPI transaction reference is required' });
    }

    const subscription = await MembershipSubscription.findOne({
      _id: subscriptionId,
      customerId: req.user.userId,
      status: 'pending'
    });

    if (!subscription) {
      return res.status(404).json({ message: 'Subscription not found or not pending' });
    }

    const payment = await MembershipPayment.findOne({
      subscriptionId: subscription._id,
      paymentProvider: 'upi',
      paymentStatus: 'pending'
    });

    if (!payment) {
      return res.status(404).json({ message: 'No pending UPI payment found for this subscription' });
    }

    // Idempotency: if already submitted with same txn, return current state
    if (payment.upiTransactionId === transactionId) {
      return res.status(200).json({
        message: 'Payment already submitted for verification',
        paymentState: 'PENDING',
        paymentReference: payment.paymentReference,
        upiTransactionId: payment.upiTransactionId
      });
    }

    payment.upiTransactionId = transactionId.trim();
    payment.paymentReference = transactionId.trim();
    payment.paymentNotes = notes || '';
    await payment.save();

    await createMembershipNotification(
      req.user.userId,
      'payment',
      'Membership Payment Submitted for Verification',
      `Your UPI payment of ₹${payment.amount} for ${subscription.planNameSnapshot} membership has been submitted and is pending admin verification. Transaction: ${transactionId}`,
      subscription._id,
      '/customer/membership'
    );

    res.status(200).json({
      message: 'UPI payment submitted for verification',
      paymentState: 'PENDING',
      paymentReference: payment.paymentReference,
      upiTransactionId: payment.upiTransactionId
    });
  } catch (error) {
    console.error('Membership verify UPI error:', error.message);
    res.status(500).json({ message: 'Error submitting UPI payment for verification' });
  }
});

// ============================================
// ADMIN MEMBERSHIP APIs
// ============================================

// Get all membership plans (admin).
app.get('/api/admin/membership/plans', authenticate, requireAdmin, async (req, res) => {
  try {
    const plans = await MembershipPlan.find().sort({ sortOrder: 1, createdAt: -1 }).lean();
    res.status(200).json({ plans });
  } catch (error) {
    console.error('Admin fetch plans error:', error.message);
    res.status(500).json({ message: 'Error fetching membership plans' });
  }
});

// Create membership plan (admin).
app.post('/api/admin/membership/plans', authenticate, requireAdmin, async (req, res) => {
  try {
    const {
      name, slug, description, price, currency, billingInterval,
      durationMonths, discountPercentage, maxDiscountLimit,
      benefits, isActive, isPopular, sortOrder
    } = req.body || {};

    if (!name || !slug) {
      return res.status(400).json({ message: 'Name and slug are required' });
    }

    const existing = await MembershipPlan.findOne({ slug });
    if (existing) {
      return res.status(400).json({ message: 'Plan slug already exists' });
    }

    const plan = new MembershipPlan({
      name,
      slug,
      description,
      price: Number(price) || 0,
      currency: currency || 'INR',
      billingInterval: billingInterval || 'yearly',
      durationMonths: Number(durationMonths) || 12,
      discountPercentage: Number(discountPercentage) || 0,
      maxDiscountLimit: maxDiscountLimit ? Number(maxDiscountLimit) : undefined,
      benefits: Array.isArray(benefits) ? benefits : [],
      isActive: isActive !== false,
      isPopular: isPopular === true,
      sortOrder: Number(sortOrder) || 0
    });

    await plan.save();
    res.status(201).json({ message: 'Membership plan created', plan });
  } catch (error) {
    console.error('Admin create plan error:', error.message);
    res.status(500).json({ message: 'Error creating membership plan' });
  }
});

// Update membership plan (admin).
app.put('/api/admin/membership/plans/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const updates = pickUpdates(req.body, [
      'name', 'slug', 'description', 'price', 'currency', 'billingInterval',
      'durationMonths', 'discountPercentage', 'maxDiscountLimit',
      'benefits', 'isActive', 'isPopular', 'sortOrder'
    ]);
    updates.updatedAt = new Date();

    const plan = await MembershipPlan.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!plan) {
      return res.status(404).json({ message: 'Membership plan not found' });
    }

    res.status(200).json({ message: 'Membership plan updated', plan });
  } catch (error) {
    console.error('Admin update plan error:', error.message);
    res.status(500).json({ message: 'Error updating membership plan' });
  }
});

// Delete membership plan (admin).
app.delete('/api/admin/membership/plans/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const plan = await MembershipPlan.findByIdAndDelete(req.params.id);
    if (!plan) {
      return res.status(404).json({ message: 'Membership plan not found' });
    }
    res.status(200).json({ message: 'Membership plan deleted' });
  } catch (error) {
    console.error('Admin delete plan error:', error.message);
    res.status(500).json({ message: 'Error deleting membership plan' });
  }
});

// Get all customer membership subscriptions (admin).
app.get('/api/admin/membership/subscriptions', authenticate, requireAdmin, async (req, res) => {
  try {
    const { search, status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (search) {
      const customers = await User.find({
        $or: [
          { fullName: new RegExp(search, 'i') },
          { email: new RegExp(search, 'i') }
        ]
      }).select('_id').lean();
      filter.customerId = { $in: customers.map(c => c._id) };
    }

    const subscriptions = await MembershipSubscription.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .lean();

    const total = await MembershipSubscription.countDocuments(filter);

    // Enrich with customer details
    const enriched = await Promise.all(subscriptions.map(async (sub) => {
      const customer = await User.findById(sub.customerId).select('fullName email').lean();
      return {
        ...sub,
        customerName: customer ? customer.fullName : 'Unknown',
        customerEmail: customer ? customer.email : 'Unknown'
      };
    }));

    res.status(200).json({
      subscriptions: enriched,
      pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) }
    });
  } catch (error) {
    console.error('Admin fetch subscriptions error:', error.message);
    res.status(500).json({ message: 'Error fetching subscriptions' });
  }
});

// Get membership analytics (admin).
app.get('/api/admin/membership/analytics', authenticate, requireAdmin, async (req, res) => {
  try {
    const now = new Date();

    const totalMembers = await MembershipSubscription.countDocuments({});
    const basicMembers = await MembershipSubscription.countDocuments({
      planNameSnapshot: 'Basic',
      status: 'active',
      endDate: { $gte: now }
    });
    const premiumMembers = await MembershipSubscription.countDocuments({
      planNameSnapshot: 'Premium',
      status: 'active',
      endDate: { $gte: now }
    });
    const vipMembers = await MembershipSubscription.countDocuments({
      planNameSnapshot: /VIP|Elite/i,
      status: 'active',
      endDate: { $gte: now }
    });
    const activeSubscriptions = await MembershipSubscription.countDocuments({
      status: 'active',
      endDate: { $gte: now }
    });
    const expiredSubscriptions = await MembershipSubscription.countDocuments({
      status: 'expired'
    });
    const revenueAgg = await MembershipPayment.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const membershipRevenue = revenueAgg[0]?.total || 0;
    const renewals = await MembershipSubscription.countDocuments({
      status: 'active',
      autoRenew: true
    });

    res.status(200).json({
      totalMembers,
      basicMembers,
      premiumMembers,
      vipMembers,
      activeSubscriptions,
      expiredSubscriptions,
      membershipRevenue,
      renewals
    });
  } catch (error) {
    console.error('Admin membership analytics error:', error.message);
    res.status(500).json({ message: 'Error fetching membership analytics' });
  }
});

// Get subscription details (admin).
app.get('/api/admin/membership/subscriptions/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const subscription = await MembershipSubscription.findById(req.params.id).lean();
    if (!subscription) {
      return res.status(404).json({ message: 'Subscription not found' });
    }

    const customer = await User.findById(subscription.customerId).select('fullName email phone').lean();
    const payments = await MembershipPayment.find({ subscriptionId: subscription._id }).sort({ createdAt: -1 }).lean();

    res.status(200).json({
      ...subscription,
      customer,
      payments
    });
  } catch (error) {
    console.error('Admin get subscription error:', error.message);
    res.status(500).json({ message: 'Error fetching subscription details' });
  }
});

// Update subscription status (admin - suspend/reactivate/cancel).
app.put('/api/admin/membership/subscriptions/:id/status', authenticate, requireAdmin, async (req, res) => {
  try {
    const { status, notes } = req.body || {};

    const validStatuses = ['active', 'expired', 'cancelled', 'suspended'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const subscription = await MembershipSubscription.findById(req.params.id);
    if (!subscription) {
      return res.status(404).json({ message: 'Subscription not found' });
    }

    subscription.status = status;
    if (status === 'cancelled' || status === 'suspended') {
      subscription.cancelledAt = new Date();
      subscription.autoRenew = false;
    } else if (status === 'active') {
      subscription.cancelledAt = undefined;
    }
    await subscription.save();

    await createMembershipNotification(
      subscription.customerId,
      'system',
      `Membership ${status.charAt(0).toUpperCase() + status.slice(1)}`,
      `Your ${subscription.planNameSnapshot} membership has been ${status}.${notes ? ' ' + notes : ''}`,
      subscription._id,
      '/customer/membership'
    );

    res.status(200).json({ message: `Membership ${status} successfully`, subscription });
  } catch (error) {
    console.error('Admin update subscription status error:', error.message);
    res.status(500).json({ message: 'Error updating subscription status' });
  }
});

// List pending UPI membership payments for admin verification.
app.get('/api/admin/membership/payments', authenticate, requireAdmin, async (req, res) => {
  try {
    const { status = 'pending', page = 1, limit = 50 } = req.query || {};
    const filter = { paymentProvider: 'upi' };
    if (status) filter.paymentStatus = status;

    const skip = (Number(page) - 1) * Number(limit);
    const [payments, total] = await Promise.all([
      MembershipPayment.find(filter)
        .populate('customerId', 'fullName email phone')
        .populate('subscriptionId', 'planNameSnapshot priceSnapshot status startDate endDate subscriptionId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      MembershipPayment.countDocuments(filter)
    ]);

    res.status(200).json({
      payments,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit))
    });
  } catch (error) {
    console.error('Admin membership UPI payments error:', error.message);
    res.status(500).json({ message: 'Error fetching membership UPI payments' });
  }
});

// Admin verifies/approves or rejects a pending UPI membership payment.
app.post('/api/admin/membership/payments/:id/verify', authenticate, requireAdmin, async (req, res) => {
  const mongooseSession = await mongoose.startSession();
  try {
    await mongooseSession.withTransaction(async () => {
      const { action, notes } = req.body || {};

      if (!action || !['approve', 'reject'].includes(action)) {
        const err = new Error('Invalid action. Use "approve" or "reject".');
        err.statusCode = 400;
        throw err;
      }

      const payment = await MembershipPayment.findById(req.params.id).session(mongooseSession);
      if (!payment) {
        const err = new Error('Payment not found');
        err.statusCode = 404;
        throw err;
      }
      if (payment.paymentProvider !== 'upi') {
        const err = new Error('Payment is not a UPI payment');
        err.statusCode = 400;
        throw err;
      }
      if (payment.paymentStatus !== 'pending') {
        const err = new Error('Payment is not in pending state');
        err.statusCode = 400;
        throw err;
      }

      const subscription = await MembershipSubscription.findById(payment.subscriptionId).session(mongooseSession);
      if (!subscription) {
        const err = new Error('Subscription not found');
        err.statusCode = 404;
        throw err;
      }

      if (action === 'approve') {
        payment.paymentStatus = 'paid';
        payment.paidAt = new Date();
        payment.paymentNotes = notes || '';
        await payment.save();

        subscription.status = 'active';
        subscription.paymentConfirmedAt = new Date();
        await subscription.save();

        await createMembershipNotification(
          subscription.customerId,
          'payment',
          'Membership Activated',
          `Your ${subscription.planNameSnapshot} membership payment of ₹${payment.amount} has been verified and activated.`,
          subscription._id,
          '/customer/membership'
        );
      } else {
        payment.paymentStatus = 'failed';
        payment.paymentNotes = notes || 'Rejected by admin';
        await payment.save();

        subscription.status = 'cancelled';
        subscription.cancelledAt = new Date();
        await subscription.save();

        await createMembershipNotification(
          subscription.customerId,
          'payment',
          'Membership Payment Rejected',
          `Your UPI payment for ${subscription.planNameSnapshot} membership has been rejected.${notes ? ' Reason: ' + notes : ''}`,
          subscription._id,
          '/customer/membership'
        );
      }

      res.status(200).json({
        message: `Payment ${action}d successfully`,
        payment,
        subscription
      });
    });
  } catch (error) {
    console.error('Admin verify membership UPI payment error:', error.message);
    if (error.statusCode) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    res.status(500).json({ message: 'Error verifying membership UPI payment' });
  } finally {
    mongooseSession.endSession();
  }
});

// List all pending UPI payments (membership + booking) for admin verification.
app.get('/api/admin/upi-payments', authenticate, requireAdmin, async (req, res) => {
  try {
    const { status = 'pending', page = 1, limit = 50, type } = req.query || {};
    const filter = { paymentProvider: 'upi' };
    if (status) filter.paymentStatus = status;

    const skip = (Number(page) - 1) * Number(limit);

    let membershipQuery = MembershipPayment.find(filter)
      .populate('customerId', 'fullName email phone')
      .populate({
        path: 'subscriptionId',
        select: 'planNameSnapshot priceSnapshot status subscriptionId'
      })
      .sort({ createdAt: -1 });

    let bookingQuery = Booking.find({
      paymentProvider: 'upi',
      paymentStatus: status
    })
      .populate('customerId', 'fullName email phone')
      .sort({ createdAt: -1 });

    const [membershipPayments, bookingPayments, totalMembership, totalBookings] =
      await Promise.all([
        membershipQuery.skip(skip).limit(Number(limit)).lean(),
        bookingQuery.skip(skip).limit(Number(limit)).lean(),
        MembershipPayment.countDocuments(filter),
        Booking.countDocuments({ paymentProvider: 'upi', paymentStatus: status })
      ]);

    const allPayments = [
      ...membershipPayments.map(p => ({
        ...p,
        paymentType: 'Membership',
        itemName: p.subscriptionId?.planNameSnapshot || 'Membership',
        originalAmount: p.amount,
        discountAmount: 0,
        finalAmount: p.amount,
        customerName: p.customerId?.fullName || 'Unknown',
        customerEmail: p.customerId?.email || '—',
        upiTransactionRef: p.upiTransactionId || p.paymentReference,
        paymentDate: p.createdAt
      })),
      ...bookingPayments.map(b => ({
        ...b,
        paymentType: 'Travel Booking',
        itemName: b.package || b.hotelName || 'Booking',
        originalAmount: b.originalAmount || b.amount,
        discountAmount: b.discountAmount || 0,
        finalAmount: b.finalAmount || b.amount,
        customerName: b.customer || 'Unknown',
        customerEmail: b.email || '—',
        upiTransactionRef: b.manualTransactionId || b.paymentReference,
        paymentDate: b.paymentCreatedAt || b.createdAt
      }))
    ].sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));

    res.status(200).json({
      payments: allPayments.slice(skip, skip + Number(limit)),
      total: totalMembership + totalBookings,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil((totalMembership + totalBookings) / Number(limit))
    });
  } catch (error) {
    console.error('Admin UPI payments error:', error.message);
    res.status(500).json({ message: 'Error fetching UPI payments' });
  }
});

// ============================================
// STRIPE WEBHOOK EXTENSION FOR MEMBERSHIPS
// ============================================

// Extend handleStripeEvent to handle membership checkout sessions.
// The existing handleStripeEvent handles booking payments; we add membership
// checkout.session.completed handling here without modifying the original logic.

const originalHandleStripeEvent = handleStripeEvent;
async function handleStripeEventWithMembership(event) {
  const eventType = event.type;
  const session = event.data.object;

  // Handle membership checkout sessions
  if (eventType === 'checkout.session.completed' || eventType === 'checkout.session.async_payment_succeeded') {
    const subscriptionId = session.metadata?.subscriptionId;
    const customerId = session.client_reference_id;
    if (subscriptionId && customerId && session.payment_status === 'paid') {
      try {
        const subscription = await MembershipSubscription.findById(subscriptionId);
        if (!subscription) {
          console.error('Membership subscription not found:', subscriptionId);
          return;
        }
        if (subscription.status === 'active') {
          // Already processed — idempotent
          return;
        }

        const amountPaid = Math.round((session.amount_total || 0) / 100);
        if (amountPaid < subscription.priceSnapshot) {
          console.error('Membership payment amount mismatch:', { amountPaid, expected: subscription.priceSnapshot });
          return;
        }

        subscription.status = 'active';
        subscription.paymentConfirmedAt = new Date();
        await subscription.save();

        // Record payment
        await MembershipPayment.findOneAndUpdate(
          { subscriptionId: subscription._id, paymentStatus: 'pending' },
          {
            paymentStatus: 'paid',
            paidAt: new Date(),
            stripePaymentIntentId: session.payment_intent || null,
            paymentReference: session.id
          }
        );

        await createMembershipNotification(
          customerId,
          'payment',
          'Membership Activated',
          `Your ${subscription.planNameSnapshot} membership is now active.`,
          subscription._id,
          '/customer/membership'
        );
      } catch (err) {
        console.error('Membership webhook processing error:', err.message);
      }
      return;
    }
  }

  // Fall through to original handler for booking payments
  return originalHandleStripeEvent(event);
}

// Replace the global handleStripeEvent reference used by the webhook route.
// We redefine it so the existing /api/stripe/webhook route picks up membership handling.
globalThis.handleStripeEvent = handleStripeEventWithMembership;

// ============================================
// MEMBERSHIP EXPIRY & RENEWAL SCHEDULER
// ============================================

function startMembershipExpiryScheduler() {
  const run = async () => {
    if (mongoose.connection.readyState !== 1) return;
    try {
      const now = new Date();

      // Expire memberships whose endDate has passed
      const expired = await MembershipSubscription.updateMany(
        {
          status: 'active',
          endDate: { $lt: now }
        },
        {
          $set: { status: 'expired' }
        }
      );

      if (expired.modifiedCount > 0) {
        console.log(`Membership scheduler: expired ${expired.modifiedCount} subscription(s)`);
      }

      // Send renewal reminders for memberships expiring in 7 days
      const reminderDate = new Date(now);
      reminderDate.setDate(reminderDate.getDate() + 7);

      const expiringSoon = await MembershipSubscription.find({
        status: 'active',
        endDate: { $gte: now, $lte: reminderDate },
        autoRenew: true
      }).lean();

      for (const sub of expiringSoon) {
        await createMembershipNotification(
          sub.customerId,
          'system',
          'Membership Expiring Soon',
          `Your ${sub.planNameSnapshot} membership expires on ${sub.endDate.toISOString().split('T')[0]}. Renew to continue enjoying benefits.`,
          sub._id,
          '/customer/membership'
        ).catch(() => {});
      }
    } catch (error) {
      console.error('Membership expiry scheduler error:', error.message);
    }
  };

  setTimeout(run, 30000);
  const timer = setInterval(run, 24 * 60 * 60 * 1000); // Run every 24 hours
  if (typeof timer.unref === 'function') timer.unref();
}

mongoose.connection.on('connected', startMembershipExpiryScheduler);

// Seed default plans on connection
mongoose.connection.on('connected', seedDefaultMembershipPlans);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// --- Scheduled trip alerts ---
// The departure reminder job runs on a fixed interval once Mongo is connected.
// It is idempotent: every reminder carries a dedupe key, so a restart or a
// second run never produces a duplicate alert.
function startDepartureReminderScheduler() {
  const run = () => {
    if (mongoose.connection.readyState !== 1) return;
    runDepartureReminderJob();
  };

  setTimeout(run, 15000);
  const timer = setInterval(run, DEPARTURE_REMINDER_INTERVAL_MS);
  if (typeof timer.unref === 'function') timer.unref();
}

mongoose.connection.on('connected', startDepartureReminderScheduler);
mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});






