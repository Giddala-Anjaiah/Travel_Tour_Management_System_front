import mongoose from 'mongoose';

// ─────────────────────────────────────────────────────────────────────────────
// Personalized recommendation engine (hybrid: behavior + booking history)
//
// Signals come from three places, in priority order:
//   1. CustomerActivity  — browsing behavior (views/searches), stored here
//      because no equivalent history model existed in the app.
//   2. Booking / Review / Wishlist — existing collections, reused directly so
//      booking and rating history is NOT duplicated into a new collection.
//   3. Popularity/quality fallbacks (rating, bookings count, freshness).
//
// No ML framework: a transparent weighted score over the fields that actually
// exist in the Package/Hotel schemas (destination, category, price, duration,
// rating, bookings / location, rating, rooms + room prices).
// ─────────────────────────────────────────────────────────────────────────────

const ACTIVITY_TYPES = new Set(['PACKAGE_VIEW', 'HOTEL_VIEW', 'PACKAGE_SEARCH', 'HOTEL_SEARCH']);
const ITEM_TYPES = new Set(['package', 'hotel']);

// Booking/rating history is deliberately NOT mirrored into this collection:
// only browsing behavior (views and searches) is recorded here.
const activitySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  activityType: {
    type: String,
    required: true,
    enum: [...ACTIVITY_TYPES]
  },
  itemType: {
    type: String,
    required: true,
    enum: [...ITEM_TYPES]
  },
  itemId: {
    type: mongoose.Schema.Types.ObjectId
  },
  metadata: {
    destination: String,
    category: String,
    location: String,
    term: String,
    price: Number
  },
  // Engagement counter. Repeated interactions inside the dedupe window bump
  // this instead of inserting duplicate rows (debounce strategy).
  count: {
    type: Number,
    default: 1,
    min: 1
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Query patterns used below:
//   recent activity per user  -> userId + activityType + createdAt
//   dedupe lookup             -> userId + itemType + itemId + createdAt
activitySchema.index({ userId: 1, activityType: 1, createdAt: -1 });
activitySchema.index({ userId: 1, itemType: 1, itemId: 1, createdAt: -1 });

const CustomerActivity = mongoose.model('CustomerActivity', activitySchema);

class ActivityValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ActivityValidationError';
  }
}

// Same user + activity + item (or search term) inside the window counts as
// one refreshed interaction instead of a new row — caps write volume while
// still accumulating engagement via `count`.
const DEDUP_WINDOW_MS = 5 * 60 * 1000;

function sanitizeMetadata(itemType, metadata = {}) {
  const clean = {};
  const stringKeys = itemType === 'package' ? ['destination', 'category'] : ['location'];
  for (const key of stringKeys) {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim()) {
      clean[key] = value.trim().slice(0, 100);
    }
  }
  if (typeof metadata.price === 'number' && Number.isFinite(metadata.price) && metadata.price >= 0) {
    clean.price = metadata.price;
  }
  if (typeof metadata.term === 'string' && metadata.term.trim()) {
    clean.term = metadata.term.trim().slice(0, 100);
  }
  return clean;
}

async function recordCustomerActivity(userId, { activityType, itemType, itemId, metadata } = {}) {
  if (!ACTIVITY_TYPES.has(activityType)) {
    throw new ActivityValidationError(`Unknown activity type: ${activityType}`);
  }
  if (!ITEM_TYPES.has(itemType)) {
    throw new ActivityValidationError(`Unknown item type: ${itemType}`);
  }

  const filter = {
    userId,
    activityType,
    itemType,
    createdAt: { $gte: new Date(Date.now() - DEDUP_WINDOW_MS) }
  };

  if (activityType.endsWith('_SEARCH')) {
    const term = String(metadata?.term || '').trim();
    if (!term) {
      throw new ActivityValidationError('Search term required for search activities');
    }
    filter['metadata.term'] = term.slice(0, 100);
  } else {
    if (!itemId || !mongoose.Types.ObjectId.isValid(itemId)) {
      throw new ActivityValidationError('Valid itemId required for view activities');
    }
    filter.itemId = itemId;
  }

  // Atomic upsert: one query, dedupes within the window, refreshes recency.
  await CustomerActivity.findOneAndUpdate(
    filter,
    {
      $inc: { count: 1 },
      $set: { createdAt: new Date(), metadata: sanitizeMetadata(itemType, metadata) }
    },
    { upsert: true, new: true }
  );

  invalidateCache(userId);
  return { success: true };
}

// ── Scoring helpers ─────────────────────────────────────────────────────────

const RECENCY_HALF_LIFE_DAYS = 14;

// Recent interactions weigh more; weight halves every RECENCY_HALF_LIFE_DAYS.
function recencyDecay(date) {
  const ageDays = Math.max(0, (Date.now() - new Date(date).getTime()) / 86400000);
  return 1 / (1 + ageDays / RECENCY_HALF_LIFE_DAYS);
}

// 1 view → low score, 2-3 views → medium, 4+ views → high.
function viewPoints(count) {
  if (count >= 4) return 4;
  if (count >= 2) return 2.5;
  return 1;
}

function parseDurationDays(duration) {
  const match = String(duration || '').match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

// Case-insensitive alternation for the candidate-pool query, so
// 'Goa' and 'goa' both match stored destination/category values.
function regexAlternate(values) {
  return values
    .map(value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
}

// ── Short-lived cache (60s TTL) so repeated dashboard visits don't
// re-run the aggregation on every render ────────────────────────────────────

const cache = new Map();
const CACHE_TTL_MS = 60 * 1000;
const MAX_CACHE_ENTRIES = 200;

function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

function cacheSet(key, value) {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    cache.delete(cache.keys().next().value);
  }
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

function invalidateCache(userId) {
  cache.delete(`pkg:${userId}`);
  cache.delete(`hotel:${userId}`);
}

// ── Public payload builders (never expose internal scores) ──────────────────

function packagePayload(pkg, reason) {
  return {
    _id: pkg._id,
    name: pkg.name,
    destination: pkg.destination,
    category: pkg.category || null,
    duration: pkg.duration,
    price: pkg.price,
    rating: pkg.rating || 0,
    image: pkg.image || (Array.isArray(pkg.images) && pkg.images[0]) || null,
    bookings: pkg.bookings || 0,
    reason
  };
}

function hotelPayload(hotel, minPrice, reason) {
  return {
    _id: hotel._id,
    name: hotel.name,
    location: hotel.location,
    rating: hotel.rating || 0,
    rooms: hotel.rooms || 0,
    partner: hotel.partner,
    minPrice: minPrice || 0,
    reason
  };
}

const PACKAGE_SELECT = 'name destination category duration price rating bookings image images createdAt';
const HOTEL_SELECT = 'name location rating rooms partner status createdAt';

async function popularPackages(limit, reason = 'Popular with travelers') {
  const Package = mongoose.model('Package');
  const docs = await Package.find({ status: 'active', publishedStatus: 'published' })
    .sort({ rating: -1, bookings: -1, createdAt: -1 })
    .limit(limit)
    .select(PACKAGE_SELECT)
    .lean();
  return docs.map(pkg => packagePayload(pkg, reason));
}

async function popularHotels(limit, reason = 'Popular with travelers') {
  const Hotel = mongoose.model('Hotel');
  const docs = await Hotel.find({ status: 'active' })
    .sort({ rating: -1, rooms: -1 })
    .limit(limit)
    .select(HOTEL_SELECT)
    .lean();
  return docs.map(hotel => hotelPayload(hotel, 0, reason));
}

// ── Package recommendations ─────────────────────────────────────────────────

async function getPackageRecommendations(userId, limit = 8) {
  const cacheKey = `pkg:${userId}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const Package = mongoose.model('Package');
  const Booking = mongoose.model('Booking');
  const Review = mongoose.model('Review');
  const Wishlist = mongoose.model('Wishlist');

  const cutoff = new Date(Date.now() - 90 * 86400000);

  // Single parallel round-trip for every signal source (no N+1).
  const [activities, bookings, reviews, wishlist] = await Promise.all([
    CustomerActivity.find({
      userId,
      activityType: { $in: ['PACKAGE_VIEW', 'PACKAGE_SEARCH'] },
      createdAt: { $gte: cutoff }
    }).sort({ createdAt: -1 }).limit(200).lean(),
    Booking.find({
      customerId: userId,
      packageId: { $exists: true, $ne: null },
      status: { $nin: ['cancelled', 'rejected'] }
    }).populate('packageId', 'name destination category price duration').lean(),
    Review.find({ customerId: userId, status: 'approved' })
      .populate('packageId', 'destination category').lean(),
    Wishlist.find({ userId }).lean()
  ]);

  // A. Browsing behavior: per-package view engagement + recent search terms.
  //    Viewing a package also signals destination/category interest, so
  //    browsing-only customers still get destination-based similarity.
  //    Affinity keys are lower-cased so 'Goa' and 'goa' are the same
  //    place, and the engagement level (view count) scales the weight.
  const viewScoreById = new Map();
  const searchTerms = [];
  const destinationWeights = new Map();
  const categoryWeights = new Map();
  for (const activity of activities) {
    if (activity.activityType === 'PACKAGE_VIEW') {
      const key = String(activity.itemId);
      const decay = recencyDecay(activity.createdAt);
      const engagement = viewPoints(activity.count || 1);
      viewScoreById.set(
        key,
        (viewScoreById.get(key) || 0) + engagement * decay
      );
      if (activity.metadata?.destination) {
        const dest = activity.metadata.destination.toLowerCase();
        destinationWeights.set(dest, (destinationWeights.get(dest) || 0) + 0.6 * engagement * decay);
      }
      if (activity.metadata?.category) {
        const cat = activity.metadata.category.toLowerCase();
        categoryWeights.set(cat, (categoryWeights.get(cat) || 0) + 0.4 * engagement * decay);
      }
    } else if (activity.activityType === 'PACKAGE_SEARCH' && activity.metadata?.term) {
      searchTerms.push({ term: activity.metadata.term.toLowerCase(), decay: recencyDecay(activity.createdAt) });
    }
  }

  // B. Booking history (strongest signal): destination/category affinity,
  //    typical price band and trip length, plus the already-booked set.
  const bookedPackageIds = new Set();
  const prices = [];
  const durations = [];
  for (const booking of bookings) {
    const pkg = booking.packageId;
    if (!pkg) continue;
    bookedPackageIds.add(String(pkg._id));
    const age = recencyDecay(booking.bookingDate || booking.createdAt);
    if (pkg.destination) {
      const dest = pkg.destination.toLowerCase();
      destinationWeights.set(dest, (destinationWeights.get(dest) || 0) + 2 * age);
    }
    if (pkg.category) {
      const cat = pkg.category.toLowerCase();
      categoryWeights.set(cat, (categoryWeights.get(cat) || 0) + age);
    }
    if (typeof pkg.price === 'number') prices.push(pkg.price);
    const days = parseDurationDays(pkg.duration);
    if (days) durations.push(days);
  }

  // Wishlist = strong intent that never converted to a booking.
  const wishlistIds = new Set(wishlist.map(w => String(w.packageId)));
  const wishlistDestinations = new Set(wishlist.map(w => w.destination?.toLowerCase()).filter(Boolean));
  const wishlistCategories = new Set(wishlist.map(w => w.category?.toLowerCase()).filter(Boolean));

  // D. Review affinity: destinations/categories the customer rated 4+.
  const reviewDestinations = new Map();
  const reviewCategories = new Map();
  for (const review of reviews) {
    const pkg = review.packageId;
    if (!pkg) continue;
    const weight = recencyDecay(review.date) * (review.rating >= 4 ? 1 : 0.25);
    if (pkg.destination) {
      const dest = pkg.destination.toLowerCase();
      reviewDestinations.set(dest, (reviewDestinations.get(dest) || 0) + weight);
    }
    if (pkg.category) {
      const cat = pkg.category.toLowerCase();
      reviewCategories.set(cat, (reviewCategories.get(cat) || 0) + weight);
    }
  }

  const hasSignals = activities.length > 0 || bookings.length > 0 || wishlist.length > 0 || reviews.length > 0;

  // Cold start (new customer): no history at all → popular/high-rated items.
  if (!hasSignals) {
    const result = { recommendations: await popularPackages(limit), source: 'popular' };
    cacheSet(cacheKey, result);
    return result;
  }

  // Candidate pool: packages sharing preferred destinations/categories, plus a
  // popular slice so high-quality items the customer hasn't encountered can
  // still surface. Bounded (60 + 20) to keep scoring CPU predictable.
  const orConditions = [];
  if (destinationWeights.size) {
    orConditions.push({ destination: { $regex: regexAlternate([...destinationWeights.keys()]), $options: 'i' } });
  }
  if (categoryWeights.size) {
    orConditions.push({ category: { $regex: regexAlternate([...categoryWeights.keys()]), $options: 'i' } });
  }
  if (wishlistDestinations.size) {
    orConditions.push({ destination: { $regex: regexAlternate([...wishlistDestinations]), $options: 'i' } });
  }

  const candidates = new Map();
  let matched = [];
  if (orConditions.length) {
    matched = await Package.find({
      status: 'active',
      publishedStatus: 'published',
      $or: orConditions
    }).limit(60).select(PACKAGE_SELECT).lean();
    matched.forEach(pkg => candidates.set(String(pkg._id), pkg));
  }  const popular = await Package.find({ status: 'active', publishedStatus: 'published' })
    .sort({ bookings: -1, rating: -1 })
    .limit(20)
    .select(PACKAGE_SELECT)
    .lean();
  popular.forEach(pkg => {
    if (!candidates.has(String(pkg._id))) candidates.set(String(pkg._id), pkg);
  });

  const avgPrice = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null;
  const avgDuration = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null;

  const scored = [];
  for (const pkg of candidates.values()) {
    const id = String(pkg._id);
    // Already booked → prefer new/similar packages instead.
    if (bookedPackageIds.has(id)) continue;

    const destKey = pkg.destination?.toLowerCase();
    const catKey = pkg.category?.toLowerCase();

    let score = 0;
    const reasons = [];

    // A. Browsing behavior score
    const viewScore = viewScoreById.get(id) || 0;
    if (viewScore > 0) {
      score += viewScore;
      if (viewScore > 2) reasons.push('frequently viewed by you');
    }

    // Search relevance (bounded so one obsessed search can't dominate)
    let searchScore = 0;
    const haystack = `${pkg.name} ${pkg.destination} ${pkg.category}`.toLowerCase();
    for (const search of searchTerms) {
      if (search.term && haystack.includes(search.term)) {
        searchScore += 1.5 * search.decay;
      }
    }
    score += Math.min(searchScore, 3);

    // B. Booking-history similarity (destination > category > budget/duration fit)
    let bookingScore = 0;
    if (destKey && destinationWeights.has(destKey)) {
      bookingScore += Math.min(6, destinationWeights.get(destKey) * 3);
      if (!reasons.length) reasons.push(`matches your interest in ${pkg.destination}`);
    }
    if (catKey && categoryWeights.has(catKey)) {
      bookingScore += Math.min(3, categoryWeights.get(catKey) * 2);
    }
    if (avgPrice && typeof pkg.price === 'number') {
      const ratio = pkg.price / avgPrice;
      if (ratio >= 0.7 && ratio <= 1.3) bookingScore += 2;
      else if (ratio >= 0.5 && ratio <= 2) bookingScore += 1;
    }
    if (avgDuration && pkg.duration) {
      if (Math.abs(parseDurationDays(pkg.duration) - avgDuration) <= 1) bookingScore += 1.5;
    }
    score += bookingScore;

    // Wishlist intent
    if (wishlistIds.has(id)) {
      score += 4;
      if (!reasons.length) reasons.push('in your wishlist');
    } else {
      if (destKey && wishlistDestinations.has(destKey)) score += 1.5;
      if (catKey && wishlistCategories.has(catKey)) score += 1;
    }

    // D. Review affinity
    if (destKey && (reviewDestinations.get(destKey) || 0) >= 0.5) score += 2;
    if (catKey && (reviewCategories.get(catKey) || 0) >= 0.5) score += 1;

    // E. Popularity/quality + freshness as a tie-breaker so low-signal
    //    candidates still rank by what travelers broadly enjoy.
    //    Clamped to >= 0 so invalid legacy data (e.g. a negative
    //    bookings counter) can't produce -Infinity and wipe the score.
    score += Math.min(3, Math.log10(1 + Math.max(0, pkg.bookings || 0))) + ((Math.max(0, pkg.rating || 0)) / 5) * 2;
    const ageDays = (Date.now() - new Date(pkg.createdAt).getTime()) / 86400000;
    if (ageDays <= 30) score += 0.5;

    scored.push({ pkg, score, reason: reasons[0] || 'Recommended for you' });
  }

  // Signals existed but nothing survived filtering → fall back to popular.
  if (scored.length === 0) {
    const result = { recommendations: await popularPackages(limit), source: 'popular' };
    cacheSet(cacheKey, result);
    return result;
  }

  scored.sort((a, b) => b.score - a.score);
  const result = {
    recommendations: scored.slice(0, limit).map(({ pkg, reason }) => packagePayload(pkg, reason)),
    source: 'personalized'
  };
  cacheSet(cacheKey, result);
  return result;
}

// ── Hotel recommendations ───────────────────────────────────────────────────

async function getHotelRecommendations(userId, limit = 8) {
  const cacheKey = `hotel:${userId}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const Hotel = mongoose.model('Hotel');
  const Room = mongoose.model('Room');
  const Booking = mongoose.model('Booking');
  const Wishlist = mongoose.model('Wishlist');

  const cutoff = new Date(Date.now() - 90 * 86400000);

  const [activities, packageBookings, hotelBookings, wishlist] = await Promise.all([
    CustomerActivity.find({
      userId,
      activityType: { $in: ['HOTEL_VIEW', 'HOTEL_SEARCH'] },
      createdAt: { $gte: cutoff }
    }).sort({ createdAt: -1 }).limit(200).lean(),
    Booking.find({
      customerId: userId,
      packageId: { $exists: true, $ne: null },
      status: { $nin: ['cancelled', 'rejected'] }
    }).populate('packageId', 'destination price duration').lean(),
    Booking.find({
      customerId: userId,
      hotelId: { $exists: true, $ne: null },
      status: { $nin: ['cancelled', 'rejected'] }
    }).populate('hotelId', 'name location rating').lean(),
    Wishlist.find({ userId }).lean()
  ]);

  // Location affinity. A traveler who books Goa packages wants Goa hotels, so
  // package destinations feed location weights too. Hotel bookings weigh most,
  // package destinations next, wishlist destinations last.
  // Keys are lower-cased so 'Goa' and 'goa' resolve to the same place.
  const locationWeights = new Map();
  const addLocation = (location, weight) => {
    if (!location) return;
    const key = location.toLowerCase();
    locationWeights.set(key, (locationWeights.get(key) || 0) + weight);
  };

  const bookedHotelIds = new Set();
  for (const booking of hotelBookings) {
    if (booking.hotelId) bookedHotelIds.add(String(booking.hotelId._id));
    addLocation(booking.hotelId?.location, 2 * recencyDecay(booking.bookingDate || booking.createdAt));
  }
  const prices = [];
  const durations = [];
  for (const booking of packageBookings) {
    addLocation(booking.packageId?.destination, 1.2 * recencyDecay(booking.bookingDate || booking.createdAt));
    if (typeof booking.packageId?.price === 'number') prices.push(booking.packageId.price);
    const days = parseDurationDays(booking.packageId?.duration);
    if (days) durations.push(days);
  }
  for (const item of wishlist) {
    addLocation(item.destination, 1);
  }

  // A. Browsing behavior on hotels. Hotel views also carry a location
  //    signal (scaled by engagement), so browsing-only customers get
  //    location affinity too.
  const viewScoreById = new Map();
  const searchTerms = [];
  for (const activity of activities) {
    if (activity.activityType === 'HOTEL_VIEW') {
      const key = String(activity.itemId);
      const decay = recencyDecay(activity.createdAt);
      const engagement = viewPoints(activity.count || 1);
      viewScoreById.set(
        key,
        (viewScoreById.get(key) || 0) + engagement * decay
      );
      addLocation(activity.metadata?.location, 0.6 * engagement * decay);
    } else if (activity.activityType === 'HOTEL_SEARCH' && activity.metadata?.term) {
      searchTerms.push({ term: activity.metadata.term.toLowerCase(), decay: recencyDecay(activity.createdAt) });
    }
  }

  const hasSignals = activities.length > 0 || hotelBookings.length > 0 || packageBookings.length > 0 || wishlist.length > 0;

  // Cold start: popular, highly rated properties.
  if (!hasSignals) {
    const result = { recommendations: await popularHotels(limit), source: 'popular' };
    cacheSet(cacheKey, result);
    return result;
  }

  const orConditions = [];
  if (locationWeights.size) {
    orConditions.push({ location: { $regex: regexAlternate([...locationWeights.keys()]), $options: 'i' } });
  }

  const candidates = new Map();
  if (orConditions.length) {
    const matched = await Hotel.find({ status: 'active', $or: orConditions })
      .limit(60)
      .select(HOTEL_SELECT)
      .lean();
    matched.forEach(hotel => candidates.set(String(hotel._id), hotel));
  }
  const popular = await Hotel.find({ status: 'active' })
    .sort({ rating: -1, rooms: -1 })
    .limit(20)
    .select(HOTEL_SELECT)
    .lean();
  popular.forEach(hotel => {
    if (!candidates.has(String(hotel._id))) candidates.set(String(hotel._id), hotel);
  });

  // One query for room data of every candidate: nightly min price and whether
  // the property actually has bookable rooms. Hotels whose rooms are all
  // booked/inactive are treated as unavailable and never recommended.
  const candidateNames = [...candidates.values()].map(h => h.name);
  const priceByHotel = new Map();
  const availabilityByHotel = new Map();
  if (candidateNames.length) {
    const rooms = await Room.find({
      hotel: { $in: candidateNames },
      status: 'active'
    }).select('hotel price available').lean();
    for (const room of rooms) {
      const stats = availabilityByHotel.get(room.hotel) || { minPrice: null, available: 0 };
      if (stats.minPrice === null || room.price < stats.minPrice) stats.minPrice = room.price;
      stats.available += Number(room.available) || 0;
      availabilityByHotel.set(room.hotel, stats);
    }
    for (const [name, stats] of availabilityByHotel) {
      priceByHotel.set(name, stats.minPrice);
    }
  }

  const avgPrice = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null;
  const avgDuration = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null;
  // Nightly budget heuristic from the customer's typical trip spend.
  const nightlyBudget = avgPrice && avgDuration ? avgPrice / Math.max(1, avgDuration) : null;

  const scored = [];
  for (const hotel of candidates.values()) {
    const id = String(hotel._id);
    // Already booked → prefer new stays.
    if (bookedHotelIds.has(id)) continue;

    // Unavailability gate: known rooms exist but none can be booked.
    const roomStats = availabilityByHotel.get(hotel.name);
    if (roomStats && roomStats.available <= 0) continue;

    const locKey = hotel.location?.toLowerCase();

    let score = 0;
    const reasons = [];

    // Location affinity from bookings, package destinations and wishlist.
    if (locKey && locationWeights.has(locKey)) {
      score += Math.min(8, locationWeights.get(locKey) * 4);
      if (!reasons.length) reasons.push(`in ${hotel.location}, where you've shown interest`);
    }

    // A. Browsing behavior score
    const viewScore = viewScoreById.get(id) || 0;
    if (viewScore > 0) {
      score += viewScore;
      if (viewScore > 2) reasons.push('frequently viewed by you');
    }

    // Search relevance on name/location
    let searchScore = 0;
    const haystack = `${hotel.name} ${hotel.location}`.toLowerCase();
    for (const search of searchTerms) {
      if (search.term && haystack.includes(search.term)) {
        searchScore += 1.5 * search.decay;
      }
    }
    score += Math.min(searchScore, 3);

    // B. Quality + popularity (rating, property size) as a tie-breaker.
    //    Clamped to >= 0 so invalid legacy data can't produce -Infinity.
    score += ((Math.max(0, hotel.rating || 0)) / 5) * 3 + Math.min(2, Math.log10(1 + Math.max(0, hotel.rooms || 0)));

    // Price-band proximity to the customer's typical nightly budget.
    const minPrice = priceByHotel.get(hotel.name);
    if (nightlyBudget && minPrice) {
      const ratio = minPrice / nightlyBudget;
      if (ratio >= 0.7 && ratio <= 1.3) score += 1.5;
      else if (ratio >= 0.5 && ratio <= 2) score += 0.75;
    }

    scored.push({ hotel, minPrice, score, reason: reasons[0] || 'Recommended for you' });
  }

  if (scored.length === 0) {
    const result = { recommendations: await popularHotels(limit), source: 'popular' };
    cacheSet(cacheKey, result);
    return result;
  }

  scored.sort((a, b) => b.score - a.score);
  const result = {
    recommendations: scored
      .slice(0, limit)
      .map(({ hotel, minPrice, reason }) => hotelPayload(hotel, minPrice, reason)),
    source: 'personalized'
  };
  cacheSet(cacheKey, result);
  return result;
}

export {
  recordCustomerActivity,
  getPackageRecommendations,
  getHotelRecommendations,
  ActivityValidationError
};
