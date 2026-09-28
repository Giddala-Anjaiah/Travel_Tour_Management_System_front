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

dotenv.config();

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
  console.warn('JWT_SECRET not set — using ephemeral fallback. Set this in production environment.');
}

app.use(cors({
  origin: (origin, callback) => {
    const allowed = normalizeCorsOrigin(origin);
    callback(null, allowed);
  },
  credentials: true,
}));
app.set('trust proxy', 1);
app.use(express.json());
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
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date
  }
});

const User = mongoose.model('User', userSchema);

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
  cancellationPolicy: String,
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
    activities: [String],
    meals: [String],
    accommodation: String,
    transportation: String,
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
  notes: String
});

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

const Review = mongoose.model('Review', reviewSchema);

// Coupon Schema
const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true
  },
  discount: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    enum: ['percentage', 'flat'],
    required: true
  },
  minPurchase: {
    type: Number,
    required: true
  },
  maxDiscount: {
    type: Number
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
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
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Coupon = mongoose.model('Coupon', couponSchema);

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
    enum: ['booking', 'payment', 'review', 'system', 'offer', 'availability'],
    required: true
  },
  title: String,
  message: String,
  relatedId: mongoose.Schema.Types.ObjectId,
  read: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Notification = mongoose.model('Notification', notificationSchema);

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
    enum: ['available', 'limited', 'full', 'closed', 'past'],
    default: 'available'
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

// Wishlist Schema
const wishlistSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  packageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Package',
    required: true
  },
  packageName: String,
  destination: String,
  image: String,
  rating: Number,
  price: Number,
  category: String,
  addedAt: {
    type: Date,
    default: Date.now
  }
});
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
    req.user = jwt.verify(token, jwtSecret);
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
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
    package: booking.package,
    amount: booking.amount,
    status: 'paid',
    dueDate: due
  });
  await invoice.save();
  return invoice;
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

app.get(
  '/api/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

app.get(
  '/api/auth/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=oauth` }),
  (req, res) => {
    const token = jwt.sign(
      { userId: req.user._id, email: req.user.email, role: req.user.role },
      jwtSecret,
      { expiresIn: '24h' }
    );
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?token=${token}&role=${req.user.role}`);
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

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      fullName,
      email,
      phone,
      password: hashedPassword,
      role,
      status: settings?.requireApproval ? 'inactive' : 'active'
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

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role },
      jwtSecret,
      { expiresIn: '24h' }
    );

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

// In-memory OTP store (email → { otp, expiresAt })
const otpStore = new Map();

// Helper: send email via Brevo (REST API or SMTP)

async function sendEmailViaBrevo(to, subject, htmlContent) {
  const brevoKey = process.env.BREVO_API_KEY;
  if (!brevoKey) {
    throw new Error('BREVO_API_KEY not configured');
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
    throw new Error(`Brevo API error ${resp.status}: ${txt}`);
  }
  return resp.json();
}

async function sendNotificationEmail(to, title, message) {
  if (!to) return false;
  const htmlContent = cardEmailTemplate(title, message);
  try {
    await sendEmailViaBrevo(to, title, htmlContent);
    return true;
  } catch (err) {
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
        © ${new Date().getFullYear()} TravelTour. All rights reserved.
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
      doc.text(`Amount: ₹${invoice.amount || 0}`);
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

// Forgot Password Route — sends OTP to user email
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
        © ${new Date().getFullYear()} TravelTour. All rights reserved.
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
      console.error('[WARN] BREVO_API_KEY not set — OTP is: ' + otp);
    }

    console.log(`[FORGOT PASSWORD] OTP for ${email}: ${otp}`);
    if (!emailOk) {
      return res.status(200).json({
        message: 'OTP generated. Email not sent (Brevo misconfigured) — use this test OTP: ' + otp,
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

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    otpStore.delete(email);

    res.status(200).json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error during password reset' });
  }
});

// Get All Users Route (for debugging)
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({}).select('-password');
    console.log('Total users in database:', users.length);
    console.log('Users:', JSON.stringify(users, null, 2));
    res.status(200).json({ count: users.length, users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Server error fetching users' });
  }
});

app.use('/api/admin', authenticate, requireAdmin);

// Admin User Management Routes
app.get('/api/admin/users', async (req, res) => {
  try {
    const users = await User.find({}).select('-password');
    res.status(200).json({ users });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching users' });
  }
});

app.post('/api/admin/users', async (req, res) => {
  try {
    const { fullName, email, phone, password, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ fullName, email, phone, password: hashedPassword, role });
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
    if (req.body.password) {
      updates.password = await bcrypt.hash(req.body.password, 10);
    }
    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json({ message: 'User updated successfully', user });
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

// Package Management Routes
app.get('/api/admin/packages', async (req, res) => {
  try {
    const packages = await Package.find({});
    res.status(200).json({ packages });
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
    const updates = pickUpdates(req.body, ['name', 'destination', 'duration', 'price', 'rating', 'bookings', 'status', 'description', 'inclusions', 'image']);
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

// Itinerary Management Routes
app.get('/api/admin/itineraries', async (req, res) => {
  try {
    const itineraries = await Itinerary.find({});
    res.status(200).json({ itineraries });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching itineraries' });
  }
});

app.post('/api/admin/itineraries', async (req, res) => {
  try {
    const payload = { ...req.body };
    if (payload.packageName && !payload.packageId) {
      const pkg = await Package.findOne({ name: payload.packageName });
      if (pkg) payload.packageId = pkg._id;
    }
    const newItinerary = new Itinerary(payload);
    await newItinerary.save();
    res.status(201).json({ message: 'Itinerary created successfully', itinerary: newItinerary });
  } catch (error) {
    res.status(500).json({ message: 'Error creating itinerary' });
  }
});

app.put('/api/admin/itineraries/:id', async (req, res) => {
  try {
    const updates = pickUpdates(req.body, ['name', 'packageId', 'packageName', 'days', 'hotels', 'status']);
    if (updates.packageName && !updates.packageId) {
      const pkg = await Package.findOne({ name: updates.packageName });
      if (pkg) updates.packageId = pkg._id;
    }
    const itinerary = await Itinerary.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!itinerary) {
      return res.status(404).json({ message: 'Itinerary not found' });
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
    const hotels = await Hotel.find({});
    res.status(200).json({ hotels });
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
    const updates = pickUpdates(req.body, ['name', 'location', 'rooms', 'rating', 'partner', 'status']);
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
    const rooms = await Room.find({});
    res.status(200).json({ rooms });
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
    const bookings = await Booking.find({});
    res.status(200).json({ bookings });
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
    const booking = await Booking.findByIdAndUpdate(req.params.id, updates, { new: true });
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
    const invoices = await Invoice.find({});
    res.status(200).json({ invoices });
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

// Review Management Routes
app.get('/api/admin/reviews', async (req, res) => {
  try {
    const reviews = await Review.find({});
    res.status(200).json({ reviews });
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
    const coupons = await Coupon.find({});
    res.status(200).json({ coupons });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching coupons' });
  }
});

app.post('/api/admin/coupons', async (req, res) => {
  try {
    const newCoupon = new Coupon(req.body);
    await newCoupon.save();
    res.status(201).json({ message: 'Coupon created successfully', coupon: newCoupon });
  } catch (error) {
    if (duplicateError(error)) {
      return res.status(400).json({ message: 'Coupon code already exists' });
    }
    res.status(500).json({ message: 'Error creating coupon' });
  }
});

app.put('/api/admin/coupons/:id', async (req, res) => {
  try {
    const updates = pickUpdates(req.body, ['code', 'discount', 'type', 'minPurchase', 'maxDiscount', 'status', 'expiry', 'usage', 'maxUsage']);
    const coupon = await Coupon.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }
    res.status(200).json({ message: 'Coupon updated successfully', coupon });
  } catch (error) {
    res.status(500).json({ message: 'Error updating coupon' });
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
    const paidBookings = await Booking.find({ paymentStatus: 'paid' });
    const totalRevenue = paidBookings.reduce((sum, b) => sum + b.amount, 0);
    const reviews = await Review.find({});
    const avgRating = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;

    const bookingStats = {
      confirmed: await Booking.countDocuments({ status: 'confirmed' }),
      pending: await Booking.countDocuments({ status: 'pending' }),
      cancelled: await Booking.countDocuments({ status: 'cancelled' })
    };

    const topTours = await Package.find({}).sort({ bookings: -1, price: -1 }).limit(5).lean();
    const recentUsers = await User.find({}).sort({ createdAt: -1 }).limit(4).select('-password').lean();
    const recentBookings = await Booking.find({}).sort({ bookingDate: -1 }).limit(6).lean();
    const recentReviews = await Review.find({}).sort({ date: -1 }).limit(4).lean();
    const recentInvoices = await Invoice.find({}).sort({ date: -1 }).limit(3).lean();
    const roomSummary = await Room.aggregate([
      { $group: { _id: null, total: { $sum: '$total' }, available: { $sum: '$available' }, booked: { $sum: '$booked' } } }
    ]);

    const monthlyRevenue = [];
    const userGrowth = [];
    for (let i = 5; i >= 0; i--) {
      const start = new Date();
      start.setMonth(start.getMonth() - i, 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setMonth(end.getMonth() + 1);
      const monthPaid = await Booking.find({ paymentStatus: 'paid', bookingDate: { $gte: start, $lt: end } });
      monthlyRevenue.push(monthPaid.reduce((sum, b) => sum + b.amount, 0));
      userGrowth.push(await User.countDocuments({ createdAt: { $lt: end } }));
    }

    const rangeBookings = await Booking.countDocuments({ bookingDate: { $gte: since } });
    const rangeUsers = await User.countDocuments({ createdAt: { $gte: since } });
    const rangeRevenue = (await Booking.find({ paymentStatus: 'paid', bookingDate: { $gte: since } }))
      .reduce((sum, b) => sum + b.amount, 0);

    res.status(200).json({
      totalUsers,
      activeTours,
      partnerHotels,
      totalBookings,
      totalRevenue,
      avgRating: Number(avgRating.toFixed(1)),
      bookingStats,
      topTours: topTours.map((pkg) => ({
        name: pkg.name,
        bookings: pkg.bookings || 0,
        revenue: (pkg.bookings || 0) * (pkg.price || 0)
      })),
      recentActivity: [
        ...recentUsers.map((u) => ({ type: 'user', text: `New user: ${u.fullName} (${u.role})` })),
        ...recentBookings.map((b) => ({ type: 'booking', text: `Booking: ${b.package} by ${b.customer}` })),
        ...recentReviews.map((r) => ({ type: 'review', text: `Review: ${r.rating}★ for ${r.package}` })),
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

    const allBookings = await Booking.find({});

    const bookingsByPayment = {};
    allBookings.forEach(b => {
      const status = b.paymentStatus || 'pending';
      bookingsByPayment[status] = (bookingsByPayment[status] || 0) + 1;
    });

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

    const rangeBookings = allBookings.filter(b => new Date(b.bookingDate) >= since);

    res.status(200).json({
      bookingsByPayment,
      revenueByCategory,
      revenueByDestination,
      range: {
        bookings: rangeBookings.length,
        revenue: rangeBookings.reduce((sum, b) => sum + (b.amount || 0), 0)
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
    const limit = parseInt(req.query.limit) || 200;
    const olderThan = parseInt(req.query.olderThan);
    const filter = olderThan ? { createdAt: { $lt: new Date(Date.now() - olderThan * 24 * 60 * 60 * 1000) } } : {};
    const notifications = await Notification.find(filter)
      .populate('userId', 'fullName email role')
      .sort({ createdAt: -1 })
      .limit(limit);
    const total = await Notification.countDocuments(filter);
    const unread = await Notification.countDocuments({ ...filter, read: false });
    const recipientIds = await Notification.distinct('userId', filter);
    const byType = {};
    for (const t of ['booking', 'payment', 'review', 'system', 'offer', 'availability']) {
      byType[t] = await Notification.countDocuments({ ...filter, type: t });
    }
    res.status(200).json({
      notifications,
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
      if (req.body.password) {
        userUpdates.password = await bcrypt.hash(req.body.password, 10);
      }
      await User.findByIdAndUpdate(req.user.userId, userUpdates);
    }
    
    res.status(200).json({ message: 'Profile updated successfully', profile });
  } catch (error) {
    res.status(500).json({ message: 'Error updating profile' });
  }
});

// Operator Package Routes
app.get('/api/operator/packages', async (req, res) => {
  try {
    const packages = await Package.find({}).sort({ createdAt: -1 });
    res.status(200).json({ packages });
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
    const itineraries = await Itinerary.find({ operatorId: req.user.userId }).sort({ createdAt: -1 });
    res.status(200).json({ itineraries });
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

app.post('/api/operator/itineraries', async (req, res) => {
  try {
    const newItinerary = new Itinerary({
      ...req.body,
      operatorId: req.user.userId,
      updatedAt: new Date()
    });
    await newItinerary.save();
    res.status(201).json({ message: 'Itinerary created successfully', itinerary: newItinerary });
  } catch (error) {
    res.status(500).json({ message: 'Error creating itinerary' });
  }
});

app.put('/api/operator/itineraries/:id', async (req, res) => {
  try {
    const updates = pickUpdates(req.body, ['name', 'packageId', 'packageName', 'days', 'hotels', 'status', 'dayDetails']);
    updates.updatedAt = new Date();
    const itinerary = await Itinerary.findOneAndUpdate(
      { _id: req.params.id, operatorId: req.user.userId },
      updates,
      { new: true }
    );
    if (!itinerary) {
      return res.status(404).json({ message: 'Itinerary not found' });
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
app.get('/api/operator/availability/package/:packageId', async (req, res) => {
  try {
    const availability = await Availability.find({ packageId: req.params.packageId, operatorId: req.user.userId });
    res.status(200).json({ availability });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching availability' });
  }
});

app.post('/api/operator/availability', async (req, res) => {
  try {
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
    const bookings = await Booking.find({ operatorId: req.user.userId }).sort({ bookingDate: -1 });
    res.status(200).json({ bookings });
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
    const updates = pickUpdates(req.body, ['status', 'paymentStatus']);
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
    const bookings = await Booking.find({ operatorId: req.user.userId });
    const customerIds = [...new Set(bookings.map(b => b.customerId))];
    const customers = await User.find({ _id: { $in: customerIds } }).select('-password');
    
    const customersWithStats = await Promise.all(customers.map(async (customer) => {
      const customerBookings = bookings.filter(b => b.customerId.toString() === customer._id.toString());
      const totalSpent = customerBookings.reduce((sum, b) => sum + (b.paidAmount || 0), 0);
      return {
        ...customer.toObject(),
        totalBookings: customerBookings.length,
        totalSpent,
        lastBooking: customerBookings.sort((a, b) => new Date(b.bookingDate) - new Date(a.bookingDate))[0]?.bookingDate
      };
    }));
    
    res.status(200).json({ customers: customersWithStats });
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
    
    const bookings = await Booking.find({ customerId: req.params.id, operatorId: req.user.userId });
    const reviews = await Review.find({ customerId: req.params.id, operatorId: req.user.userId });
    
    res.status(200).json({
      customer,
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
    const reviews = await Review.find({ operatorId: req.user.userId }).sort({ date: -1 });
    res.status(200).json({ reviews });
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
    
    const bookings = await Booking.find({ operatorId: req.user.userId, paymentStatus: 'paid' });
    const totalRevenue = bookings.reduce((sum, b) => sum + (b.paidAmount || b.amount), 0);
    
    const rangeBookings = await Booking.find({ 
      operatorId: req.user.userId, 
      paymentStatus: 'paid',
      bookingDate: { $gte: since } 
    });
    const rangeRevenue = rangeBookings.reduce((sum, b) => sum + (b.paidAmount || b.amount), 0);
    
    const pendingBookings = await Booking.find({ 
      operatorId: req.user.userId, 
      paymentStatus: { $in: ['pending', 'partial'] } 
    });
    const pendingRevenue = pendingBookings.reduce((sum, b) => sum + (b.amount - (b.paidAmount || 0)), 0);
    
    const refundedBookings = await Booking.find({ 
      operatorId: req.user.userId, 
      paymentStatus: 'refunded' 
    });
    const refundedRevenue = refundedBookings.reduce((sum, b) => sum + b.amount, 0);
    
    // Revenue by package
    const revenueByPackage = await Booking.aggregate([
      { $match: { operatorId: new mongoose.Types.ObjectId(req.user.userId), paymentStatus: 'paid' } },
      { $group: { _id: '$package', revenue: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { revenue: -1 } }
    ]);
    
    // Monthly revenue
    const monthlyRevenue = [];
    for (let i = 11; i >= 0; i--) {
      const start = new Date();
      start.setMonth(start.getMonth() - i, 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setMonth(end.getMonth() + 1);
      const monthRevenue = await Booking.find({
        operatorId: req.user.userId,
        paymentStatus: 'paid',
        bookingDate: { $gte: start, $lt: end }
      });
      monthlyRevenue.push(monthRevenue.reduce((sum, b) => sum + (b.paidAmount || b.amount), 0));
    }
    
    res.status(200).json({
      totalRevenue,
      rangeRevenue,
      pendingRevenue,
      refundedRevenue,
      totalBookings: bookings.length,
      rangeBookings: rangeBookings.length,
      averageBookingValue: bookings.length > 0 ? totalRevenue / bookings.length : 0,
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
    const notifications = await Notification.find({ userId: req.user.userId })
      .sort({ createdAt: -1 })
      .limit(50);
    const unreadCount = await Notification.countDocuments({ userId: req.user.userId, read: false });
    res.status(200).json({ notifications, unreadCount });
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

// =============================================================================
// Public Routes
// =============================================================================

// Public Package Routes (no auth required)
app.get('/api/packages', async (req, res) => {
  try {
    const { publishedOnly, category, search, limit, page } = req.query;
    const filter = {};
    if (publishedOnly === 'true') {
      filter.publishedStatus = 'published';
    }
    if (category && category !== 'all') {
      filter.category = category;
    }
    if (search) {
      filter.name = new RegExp(search, 'i');
    }
    let query = Package.find(filter).sort({ createdAt: -1 });
    if (limit) query = query.limit(Number(limit));
    if (page && limit) query = query.skip((Number(page) - 1) * Number(limit));
    const packages = await query.exec();
    res.status(200).json({ packages });
  } catch (error) {
    console.error('Error fetching packages:', error);
    res.status(500).json({ message: 'Error fetching packages' });
  }
});

app.get('/api/packages/:id', async (req, res) => {
  try {
    const pkg = await Package.findById(req.params.id).populate('operatorId', 'companyName');
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
      filter.name = new RegExp(search, 'i');
    }
    const hotels = await Hotel.find(filter).sort({ createdAt: -1 });
    const hotelsWithMinPrice = await Promise.all(hotels.map(async (hotel) => {
      const rooms = await Room.find({ hotel: hotel.name });
      const minPrice = rooms.length > 0 ? Math.min(...rooms.map(r => r.price)) : 0;
      return {
        ...hotel.toObject(),
        minPrice,
        rooms
      };
    }));
    res.status(200).json({ hotels: hotelsWithMinPrice });
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
    const rooms = await Room.find({ hotel: hotel.name });
    const minPrice = rooms.length > 0 ? Math.min(...rooms.map(r => r.price)) : 0;
    res.status(200).json({ hotel: { ...hotel.toObject(), minPrice, rooms } });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching hotel' });
  }
});

// Public Destination Routes (aggregated destinations from packages)
app.get('/api/public/destinations', async (req, res) => {
  try {
    const destinations = await Package.aggregate([
      { $match: { publishedStatus: 'published' } },
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
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]);
    res.status(200).json({ destinations });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching destinations' });
  }
});

// =============================================================================
// Customer Routes (require authenticate + requireCustomer)
// =============================================================================
app.use('/api/customer', authenticate, requireCustomer);

// --- Profile ---
app.get('/api/customer/profile', async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json({
      profile: {
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching profile' });
  }
});

app.put('/api/customer/profile', async (req, res) => {
  try {
    const updates = pickUpdates(req.body, ['fullName', 'email', 'phone']);
    if (updates.email) {
      const existing = await User.findOne({ email: updates.email, _id: { $ne: req.user.userId } });
      if (existing) {
        return res.status(400).json({ message: 'Email already in use' });
      }
    }
    const user = await User.findByIdAndUpdate(req.user.userId, updates, { new: true }).select('-password');
    res.status(200).json({
      message: 'Profile updated successfully',
      profile: {
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating profile' });
  }
});

// --- Packages (customer view of published packages) ---
app.get('/api/customer/packages', async (req, res) => {
  try {
    const { category, search, bestseller, limit } = req.query;
    const filter = { publishedStatus: 'published' };
    if (category && category !== 'all') filter.category = category;
    if (search) filter.name = new RegExp(search, 'i');
    if (bestseller === 'true') filter.rating = { $gte: 4 };
    let query = Package.find(filter).sort({ createdAt: -1 });
    if (limit) query = query.limit(Number(limit));
    const packages = await query.exec();
    res.status(200).json({ packages });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching packages' });
  }
});

// --- Bookings ---
app.get('/api/customer/bookings', async (req, res) => {
  try {
    const bookings = await Booking.find({ customerId: req.user.userId })
      .populate('packageId', 'name destination image price')
      .sort({ bookingDate: -1 });
    res.status(200).json({ bookings });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching bookings' });
  }
});

app.post('/api/customer/bookings', async (req, res) => {
  try {
    const { packageId, package: packageName, dates, travelers, amount, email, phone, customer } = req.body;
    const payload = {
      customerId: req.user.userId,
      customer: customer || req.user.userId,
      email: email || req.user.email,
      package: packageName || '',
      dates: dates || '',
      travelers: travelers || 1,
      amount: amount || 0,
      status: 'pending',
      paymentStatus: 'pending',
      bookingId: `BKG-${Date.now().toString().slice(-8)}`
    };
    if (packageId) {
      payload.packageId = packageId;
      const pkg = await Package.findById(packageId);
      if (pkg) {
        payload.operatorId = pkg.operatorId;
        payload.package = pkg.name;
      }
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
      message: `Your booking for ${payload.package || 'hotel'} (${payload.bookingId}) has been received and is pending confirmation.`,
      relatedId: newBooking._id,
      read: false
    });
    if (req.user.email) {
      await sendNotificationEmail(
        req.user.email,
        'Booking Confirmation',
        `Your booking <strong>${payload.bookingId}</strong> for ${payload.package || 'hotel'} has been received and is pending confirmation. Amount: ₹${payload.amount || 0}.`
      );
    }
    if (payload.operatorId) {
      const opUser = await User.findById(payload.operatorId).select('email');
      if (opUser?.email) {
        await sendNotificationEmail(
          opUser.email,
          'New Booking Received',
          `A new booking <strong>${payload.bookingId}</strong> has been placed for your package "${payload.package}". Amount: ₹${payload.amount || 0}.`
        );
      }
    }
    res.status(201).json({ message: 'Booking created successfully', booking: newBooking });
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ message: 'Error creating booking' });
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
    const paymentAmount = Math.min(amount || 0, booking.amount - (booking.paidAmount || 0));
    booking.paidAmount = (booking.paidAmount || 0) + paymentAmount;
    if (booking.paidAmount >= booking.amount) {
      booking.paymentStatus = 'paid';
      booking.status = 'confirmed';
    } else if (booking.paidAmount > 0) {
      booking.paymentStatus = 'partial';
    }
    booking.timeline.push({ status: booking.paymentStatus, date: new Date(), note: `Payment of ₹${paymentAmount} received` });
    await booking.save();
    if (booking.paymentStatus === 'paid') {
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

// --- Itineraries (customer's own itineraries from their bookings) ---
app.get('/api/customer/itineraries', async (req, res) => {
  try {
    const bookings = await Booking.find({ customerId: req.user.userId })
      .populate({
        path: 'packageId',
        select: 'name destination image price rating'
      });
    const itineraries = bookings.filter(b => b.packageId).map(b => ({
      _id: b._id,
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
      const itinerary = await Itinerary.findOne({ packageId: bookings.find(b => b.packageId && b.packageId._id.toString() === it.packageId?.toString() || b.package) });
      return {
        ...it,
        dayDetails: itinerary?.dayDetails || [],
        highlights: itinerary?.highlights || []
      };
    }));
    res.status(200).json({ itineraries: itinerariesWithDetails });
  } catch (error) {
    console.error('Error fetching itineraries:', error);
    res.status(500).json({ message: 'Error fetching itineraries' });
  }
});

// --- Invoices ---
app.get('/api/customer/invoices', async (req, res) => {
  try {
    const invoices = await Invoice.find({ email: req.user.email })
      .sort({ date: -1 });
    if (invoices.length === 0) {
      const bookings = await Booking.find({ customerId: req.user.userId, paymentStatus: 'paid' });
      const generated = await Promise.all(bookings.map(b => createPaidInvoice(b)));
      const allInvoices = generated.filter(i => i !== null);
      return res.status(200).json({ invoices: allInvoices });
    }
    res.status(200).json({ invoices });
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
    const reviews = await Review.find({ customerId: req.user.userId })
      .populate('packageId', 'name destination image')
      .sort({ date: -1 });
    res.status(200).json({ reviews });
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
    const items = await Wishlist.find({ userId: req.user.userId })
      .populate('packageId', 'name destination image price rating category')
      .sort({ addedAt: -1 });
    const wishlist = items.map(item => {
      const pkg = item.packageId || {};
      return {
        _id: item._id,
        packageId: item.packageId?._id || item.packageId,
        packageName: item.packageName || pkg.name || '',
        destination: item.destination || pkg.destination || '',
        image: item.image || pkg.image || '',
        price: item.price || pkg.price || 0,
        rating: item.rating || pkg.rating || 0,
        category: item.category || pkg.category || 'tour',
        addedAt: item.addedAt
      };
    });
    res.status(200).json({ wishlist });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching wishlist' });
  }
});

app.post('/api/customer/wishlist', async (req, res) => {
  try {
    const { packageId } = req.body;
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
      packageId,
      packageName: pkg.name,
      destination: pkg.destination,
      image: pkg.image,
      price: pkg.price,
      rating: pkg.rating,
      category: pkg.category
    });
    await item.save();
    res.status(201).json({ message: 'Added to wishlist', item });
  } catch (error) {
    res.status(500).json({ message: 'Error adding to wishlist' });
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
    const notifications = await Notification.find({ userId: req.user.userId })
      .sort({ createdAt: -1 })
      .limit(50);
    res.status(200).json({ notifications });
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

    if (updates.email || updates.phone) {
      const userUpdates = {};
      if (updates.email) userUpdates.email = updates.email;
      if (updates.phone) userUpdates.phone = updates.phone;
      if (updates.password) userUpdates.password = await bcrypt.hash(updates.password, 10);
      if (Object.keys(userUpdates).length > 0) {
        await User.findByIdAndUpdate(req.user.userId, userUpdates, { new: true });
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
    console.error('Error updating profile:', error);
    res.status(500).json({ message: 'Error updating profile' });
  }
});

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
    const rooms = await Room.find(filter).sort({ createdAt: -1 });
    res.status(200).json({ rooms });
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
    const rooms = await Room.find(filter).sort({ createdAt: -1 });
    res.status(200).json({ rooms });
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
    const rooms = await Room.find(filter).sort({ createdAt: -1 });
    res.status(200).json({ rooms });
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
    const bookings = await Booking.find(filter).sort({ bookingDate: -1 });
    res.status(200).json({ bookings });
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
    const bookings = await Booking.find(filter);
    const guestMap = {};
    bookings.forEach(b => {
      const key = b.guestEmail || b.guestPhone || b.guestName;
      if (!key) return;
      if (!guestMap[key]) {
        guestMap[key] = {
          _id: b._id,
          name: b.guestName || '',
          email: b.guestEmail || '',
          phone: b.guestPhone || '',
          totalStays: 0,
          totalSpent: 0,
          lastStay: new Date()
        };
      }
      guestMap[key].totalStays += 1;
      guestMap[key].totalSpent += (b.paidAmount || 0);
      if (b.bookingDate && (new Date(b.bookingDate) > new Date(guestMap[key].lastStay))) {
        guestMap[key].lastStay = b.bookingDate;
      }
    });
    const guests = Object.values(guestMap).sort((a, b) => b.totalSpent - a.totalSpent);
    res.status(200).json({ guests });
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
    if (operatorId) filter.$or = [{ operatorId }, { customerId: req.user.userId }];
    const reviews = await Review.find(filter)
      .populate('packageId', 'name destination image')
      .sort({ date: -1 });
    res.status(200).json({ reviews });
  } catch (error) {
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

    const totalBookings = await Booking.countDocuments(filter);
    const revenueBookings = await Booking.find({ ...filter, paymentStatus: 'paid' });
    const totalRevenue = revenueBookings.reduce((sum, b) => sum + (b.amount || 0), 0);
    const rangeBookings = await Booking.find({ ...filter, paymentStatus: 'paid', bookingDate: { $gte: since } });
    const rangeRevenue = rangeBookings.reduce((sum, b) => sum + (b.amount || 0), 0);

    const monthlyRevenue = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i, 1);
      d.setHours(0, 0, 0, 0);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      const monthBookings = await Booking.find({ ...filter, paymentStatus: 'paid', bookingDate: { $gte: d, $lte: end } });
      monthlyRevenue.push(monthBookings.reduce((sum, b) => sum + (b.amount || 0), 0));
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
    const notifications = await Notification.find({ userId: req.user.userId })
      .sort({ createdAt: -1 })
      .limit(50);
    const unreadCount = await Notification.countDocuments({ userId: req.user.userId, read: false });
    res.status(200).json({ notifications, unreadCount });
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

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
