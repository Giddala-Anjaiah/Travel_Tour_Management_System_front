const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const wb = XLSX.utils.book_new();

// Read once so the documented Auth and pagination notes cannot drift away from
// the implementation.
const serverSource = fs.readFileSync(path.join(__dirname, 'backend/server.js'), 'utf8');

const authData = [
  ['S.No', 'Type of Dashboard', 'HTTP Method', 'API Path', 'Description', 'Sample Request Body (JSON)', 'Sample Response (JSON)', 'Success Status Code', 'Error Status Codes'],
  [1, 'Auth/Public', 'POST', '/api/signup', 'Register a new user', '{ "fullName": "John Doe", "email": "john@test.com", "phone": "8000000001", "password": "Pass123", "role": "customer" }', '{ "message": "User registered successfully", "userId": "6abc123..." }', 201, '400/409'],
  [2, 'Auth/Public', 'POST', '/api/login', 'Login and get JWT token', '{ "email": "john@test.com", "password": "Pass123", "role": "customer" }', '{ "message": "Login successful", "token": "eyJhbG..." }', 200, '401/403'],
  [3, 'Auth/Public', 'POST', '/api/forgot-password', 'Request password reset OTP', '{ "email": "john@test.com" }', '{ "message": "OTP sent to your email" }', 200, '404'],
  [4, 'Auth/Public', 'POST', '/api/verify-otp', 'Verify OTP for password reset', '{ "email": "john@test.com", "otp": "123456" }', '{ "message": "OTP verified successfully" }', 200, '400'],
  [5, 'Auth/Public', 'POST', '/api/reset-password', 'Reset password using valid OTP', '{ "email": "john@test.com", "otp": "123456", "newPassword": "NewPass@123" }', '{ "message": "Password reset successfully" }', 200, '400/404/500'],
  [6, 'Public', 'GET', '/api/packages', 'List all published packages', '?publishedOnly=true', '{ "packages": [{ "_id": "..." }] }', 200, '500'],
  [7, 'Public', 'GET', '/api/packages/:id', 'Get a single package', '/{packageId}', '{ "package": { "_id": "..." } }', 200, '404/500'],
  [8, 'Public', 'GET', '/api/public/hotels', 'List all hotels (public)', '', '{ "hotels": [...] }', 200, '500'],
  [9, 'Public', 'GET', '/api/public/hotels/:id', 'Get hotel details (public)', '/{hotelId}', '{ "hotel": { "name": "Grand Hotel" } }', 200, '404/500'],
  [10, 'Public', 'GET', '/api/public/destinations', 'List all destinations (public)', '', '{ "destinations": [...] }', 200, '500']
];

const adminData = [
  ['S.No', 'Type of Dashboard', 'HTTP Method', 'API Path', 'Description', 'Sample Request Body (JSON)', 'Sample Response (JSON)', 'Success Status Code', 'Error Status Codes'],
  [12, 'Admin', 'GET', '/api/admin/users', 'List all users', '', '{ "users": [{ "id": "..." }] }', 200, '401/403/500'],
  [13, 'Admin', 'POST', '/api/admin/users', 'Create new user', '{ "fullName": "Jane Admin", "email": "jane@test.com", "phone": "8000000002", "password": "Pass123", "role": "tour_operator" }', '{ "message": "User created successfully" }', 201, '400/401/403/500'],
  [14, 'Admin', 'PUT', '/api/admin/users/:id', 'Update user', '/{userId}', '{ "fullName": "Jane", "phone": "8000000099" }', '{ "message": "User updated successfully" }', 200, '404/401/403/500'],
  [15, 'Admin', 'DELETE', '/api/admin/users/:id', 'Delete user', '/{userId}', '', '{ "message": "User deleted successfully" }', 200, '404/401/403/500'],
  [16, 'Admin', 'GET', '/api/admin/packages', 'List all packages', '', '{ "packages": [{ "_id": "..." }] }', 200, '401/403/500'],
  [17, 'Admin', 'POST', '/api/admin/packages', 'Create new package', '{ "name": "Manali Trip", "destination": "Manali", "duration": "4 Days", "price": 12000, "rating": 4, "status": "active", "publishedStatus": "published", "description": "Adventure trip", "inclusions": ["Stay"], "image": "https://via.placeholder.com/400x300", "category": "Adventure", "shortDescription": "Short desc" }', '{ "message": "Package created successfully" }', 201, '400/401/403/500'],
  [18, 'Admin', 'PUT', '/api/admin/packages/:id', 'Update package', '/{packageId}', '{ "price": 15000, "status": "inactive" }', '{ "message": "Package updated successfully" }', 200, '404/401/403/500'],
  [19, 'Admin', 'DELETE', '/api/admin/packages/:id', 'Delete package', '/{packageId}', '', '{ "message": "Package deleted successfully" }', 200, '404/401/403/500'],
  [20, 'Admin', 'GET', '/api/admin/itineraries', 'List all itineraries', '', '{ "itineraries": [...] }', 200, '401/403/500'],
  [21, 'Admin', 'POST', '/api/admin/itineraries', 'Create itinerary', '{ "name": "Day 1", "packageId": "<pkgId>", "packageName": "Manali Trip", "days": 4, "hotels": ["Hotel A"], "status": "active" }', '{ "message": "Itinerary created successfully" }', 201, '400/401/403/500'],
  [22, 'Admin', 'PUT', '/api/admin/itineraries/:id', 'Update itinerary', '/{id}', '{ "name": "Updated", "status": "active" }', '{ "message": "Itinerary updated successfully" }', 200, '404/401/403/500'],
  [23, 'Admin', 'DELETE', '/api/admin/itineraries/:id', 'Delete itinerary', '/{id}', '', '{ "message": "Itinerary deleted successfully" }', 200, '404/401/403/500'],
  [24, 'Admin', 'GET', '/api/admin/hotels', 'List all hotels', '', '{ "hotels": [...] }', 200, '401/403/500'],
  [25, 'Admin', 'POST', '/api/admin/hotels', 'Create hotel', '{ "name": "Grand Palace", "location": "Jaipur", "rooms": 10, "rating": 4 }', '{ "message": "Hotel created successfully" }', 201, '400/401/403/500'],
  [26, 'Admin', 'PUT', '/api/admin/hotels/:id', 'Update hotel', '/{id}', '{ "name": "Updated" }', '{ "message": "Hotel updated successfully" }', 200, '404/401/403/500'],
  [27, 'Admin', 'DELETE', '/api/admin/hotels/:id', 'Delete hotel', '/{id}', '', '{ "message": "Hotel deleted successfully" }', 200, '404/401/403/500'],
  [28, 'Admin', 'GET', '/api/admin/rooms', 'List all rooms', '', '{ "rooms": [...] }', 200, '401/403/500'],
  [29, 'Admin', 'POST', '/api/admin/rooms', 'Create room', '{ "hotel": "<hotelId>", "type": "Deluxe", "total": 10, "price": 3500 }', '{ "message": "Room created successfully" }', 201, '400/401/403/500'],
  [30, 'Admin', 'PUT', '/api/admin/rooms/:id', 'Update room', '/{id}', '{ "price": 4000 }', '{ "message": "Room updated successfully" }', 200, '404/401/403/500'],
  [31, 'Admin', 'DELETE', '/api/admin/rooms/:id', 'Delete room', '/{id}', '', '{ "message": "Room deleted successfully" }', 200, '404/401/403/500'],
  [32, 'Admin', 'GET', '/api/admin/bookings', 'List all bookings', '', '{ "bookings": [...] }', 200, '401/403/500'],
  [33, 'Admin', 'POST', '/api/admin/bookings', 'Create booking', '{ "customer": "<custId>", "email": "cust@test.com", "package": "Trip", "amount": 12000 }', '{ "message": "Booking created successfully" }', 201, '400/401/403/500'],
  [34, 'Admin', 'PUT', '/api/admin/bookings/:id', 'Update booking', '/{id}', '{ "status": "confirmed" }', '{ "message": "Booking updated successfully" }', 200, '404/401/403/500'],
  [35, 'Admin', 'DELETE', '/api/admin/bookings/:id', 'Delete booking', '/{id}', '', '{ "message": "Booking deleted successfully" }', 200, '404/401/403/500'],
  [36, 'Admin', 'GET', '/api/admin/invoices', 'List all invoices', '', '{ "invoices": [...] }', 200, '401/403/500'],
  [37, 'Admin', 'POST', '/api/admin/invoices', 'Create invoice', '{ "invoiceNo": "INV001", "customer": "<custId>", "amount": 12000 }', '{ "message": "Invoice created successfully" }', 201, '400/401/403/500'],
  [38, 'Admin', 'PUT', '/api/admin/invoices/:id', 'Update invoice', '/{id}', '{ "status": "paid" }', '{ "message": "Invoice updated successfully" }', 200, '404/401/403/500'],
  [39, 'Admin', 'DELETE', '/api/admin/invoices/:id', 'Delete invoice', '/{id}', '', '{ "message": "Invoice deleted successfully" }', 200, '404/401/403/500'],
  [40, 'Admin', 'GET', '/api/admin/reviews', 'List all reviews', '', '{ "reviews": [...] }', 200, '401/403/500'],
  [41, 'Admin', 'POST', '/api/admin/reviews', 'Create review', '{ "customer": "<custId>", "package": "<pkgId>", "rating": 5 }', '{ "message": "Review created successfully" }', 201, '400/401/403/500'],
  [42, 'Admin', 'PUT', '/api/admin/reviews/:id', 'Update review', '/{id}', '{ "status": "approved" }', '{ "message": "Review updated successfully" }', 200, '404/401/403/500'],
  [43, 'Admin', 'DELETE', '/api/admin/reviews/:id', 'Delete review', '/{id}', '', '{ "message": "Review deleted successfully" }', 200, '404/401/403/500'],
  [44, 'Admin', 'GET', '/api/admin/coupons', 'List all coupons', '', '{ "coupons": [...] }', 200, '401/403/500'],
  [45, 'Admin', 'POST', '/api/admin/coupons', 'Create coupon', '{ "code": "SAVE10", "discount": 10, "type": "percentage", "minPurchase": 5000 }', '{ "message": "Coupon created successfully" }', 201, '400/401/403/500'],
  [46, 'Admin', 'PUT', '/api/admin/coupons/:id', 'Update coupon', '/{id}', '{ "discount": 15 }', '{ "message": "Coupon updated successfully" }', 200, '404/401/403/500'],
  [47, 'Admin', 'DELETE', '/api/admin/coupons/:id', 'Delete coupon', '/{id}', '', '{ "message": "Coupon deleted successfully" }', 200, '404/401/403/500'],
  [48, 'Admin', 'GET', '/api/admin/settings', 'Get admin settings', '', '{ "settings": {...} }', 200, '401/403/500'],
  [49, 'Admin', 'PUT', '/api/admin/settings', 'Update admin settings', '', '{ "currency": "INR", "language": "en" }', '{ "message": "Settings updated" }', 200, '401/403/500'],
  [50, 'Admin', 'GET', '/api/admin/analytics', 'Get admin analytics', '', '{ "totalUsers": 100, "totalRevenue": 500000 }', 200, '401/403/500'],
  [51, 'Admin', 'GET', '/api/admin/reports/summary', 'Get report summary', '', '{ "summary": {...} }', 200, '401/403/500'],
  [52, 'Admin', 'GET', '/api/admin/notifications', 'List admin notifications', '', '{ "notifications": [...] }', 200, '401/403/500'],
  [53, 'Admin', 'POST', '/api/admin/notifications', 'Send notification', '{ "title": "Update", "message": "Maintenance" }', '{ "message": "Notification sent" }', 201, '400/401/403/500'],
  [54, 'Admin', 'DELETE', '/api/admin/notifications/:id', 'Delete notification', '/{id}', '', '{ "message": "Notification deleted" }', 200, '404/401/403/500'],
  [55, 'Admin', 'PUT', '/api/admin/notifications/:id/read', 'Mark notification read', '/{id}', '', '{ "message": "Notification marked as read" }', 200, '404/401/403/500']
];

const operatorData = [
  ['S.No', 'Type of Dashboard', 'HTTP Method', 'API Path', 'Description', 'Sample Request Body (JSON)', 'Sample Response (JSON)', 'Success Status Code', 'Error Status Codes'],
  [56, 'Operator', 'GET', '/api/operator/profile', 'Get operator profile', '', '{ "user": {...}, "profile": {...} }', 200, '401/403/500'],
  [57, 'Operator', 'PUT', '/api/operator/profile', 'Update operator profile', '', '{ "fullName": "Updated Name", "phone": "9000000001" }', '{ "message": "Profile updated" }', 200, '401/403/500'],
  [58, 'Operator', 'GET', '/api/operator/packages', 'List operator packages', '', '{ "packages": [{ "_id": "..." }] }', 200, '401/403/500'],
  [59, 'Operator', 'POST', '/api/operator/packages', 'Create package', '{ "name": "Goa Trip", "destination": "Goa", "duration": "3 Days", "price": 8000, "publishedStatus": "published" }', '{ "message": "Package created successfully" }', 201, '400/401/403/500'],
  [60, 'Operator', 'GET', '/api/operator/packages/:id', 'Get single package', '/{packageId}', '{ "package": {...} }', 200, '404/401/403/500'],
  [61, 'Operator', 'PUT', '/api/operator/packages/:id', 'Update package', '/{packageId}', '{ "price": 9500 }', '{ "message": "Package updated successfully" }', 200, '404/401/403/500'],
  [62, 'Operator', 'DELETE', '/api/operator/packages/:id', 'Delete package', '/{packageId}', '', '{ "message": "Package deleted successfully" }', 200, '404/401/403/500'],
  [63, 'Operator', 'GET', '/api/operator/itineraries', 'List itineraries', '', '{ "itineraries": [...] }', 200, '401/403/500'],
  [64, 'Operator', 'GET', '/api/operator/itineraries/package/:packageId', 'Get itineraries by package', '/{packageId}', '{ "itineraries": [...] }', 200, '401/403/500'],
  [65, 'Operator', 'POST', '/api/operator/itineraries', 'Create itinerary', '{ "name": "Day 1", "packageId": "<pkgId>", "days": 4 }', '{ "message": "Itinerary created successfully" }', 201, '400/401/403/500'],
  [66, 'Operator', 'PUT', '/api/operator/itineraries/:id', 'Update itinerary', '/{id}', '{ "name": "Updated" }', '{ "message": "Itinerary updated" }', 200, '404/401/403/500'],
  [67, 'Operator', 'DELETE', '/api/operator/itineraries/:id', 'Delete itinerary', '/{id}', '', '{ "message": "Itinerary deleted" }', 200, '404/401/403/500'],
  [68, 'Operator', 'GET', '/api/operator/pricing/package/:packageId', 'Get pricing', '/{packageId}', '{ "pricing": {...} }', 200, '401/403/500'],
  [69, 'Operator', 'POST', '/api/operator/pricing', 'Create pricing', '{ "packageId": "<pkgId>", "price": 5000 }', '{ "message": "Pricing created" }', 201, '400/401/403/500'],
  [70, 'Operator', 'PUT', '/api/operator/pricing/:id', 'Update pricing', '/{id}', '{ "price": 5500 }', '{ "message": "Pricing updated" }', 200, '404/401/403/500'],
  [71, 'Operator', 'GET', '/api/operator/availability/package/:packageId', 'Get availability', '/{packageId}', '{ "availability": [...] }', 200, '401/403/500'],
  [72, 'Operator', 'POST', '/api/operator/availability', 'Create availability', '{ "packageId": "<pkgId>", "date": "2026-12-25", "available": 20 }', '{ "message": "Availability created" }', 201, '400/401/403/500'],
  [73, 'Operator', 'PUT', '/api/operator/availability/:id', 'Update availability', '/{id}', '{ "available": 15 }', '{ "message": "Availability updated" }', 200, '404/401/403/500'],
  [74, 'Operator', 'DELETE', '/api/operator/availability/:id', 'Delete availability', '/{id}', '', '{ "message": "Availability deleted" }', 200, '404/401/403/500'],
  [75, 'Operator', 'GET', '/api/operator/bookings', 'List bookings', '', '{ "bookings": [...] }', 200, '401/403/500'],
  [76, 'Operator', 'GET', '/api/operator/bookings/:id', 'Get booking details', '/{id}', '{ "booking": {...} }', 200, '404/401/403/500'],
  [77, 'Operator', 'PUT', '/api/operator/bookings/:id', 'Update booking', '/{id}', '{ "status": "confirmed" }', '{ "message": "Booking updated" }', 200, '404/401/403/500'],
  [78, 'Operator', 'GET', '/api/operator/customers', 'List customers', '', '{ "customers": [...] }', 200, '401/403/500'],
  [79, 'Operator', 'GET', '/api/operator/customers/:id', 'Get customer details', '/{id}', '{ "bookings": [...], "reviews": [...] }', 200, '401/403/500'],
  [80, 'Operator', 'GET', '/api/operator/reviews', 'List reviews', '', '{ "reviews": [...] }', 200, '401/403/500'],
  [81, 'Operator', 'PUT', '/api/operator/reviews/:id/respond', 'Respond to review', '/{id}', '{ "response": "Thank you!" }', '{ "message": "Review responded" }', 200, '404/401/403/500'],
  [82, 'Operator', 'GET', '/api/operator/revenue', 'Get revenue report', '', '{ "totalRevenue": 500000, "revenueByPackage": [] }', 200, '401/403/500'],
  [83, 'Operator', 'GET', '/api/operator/notifications', 'List notifications', '', '{ "notifications": [...] }', 200, '401/403/500'],
  [84, 'Operator', 'PUT', '/api/operator/notifications/:id/read', 'Mark notification read', '/{id}', '', '{ "message": "Notification marked as read" }', 200, '404/401/403/500'],
  [85, 'Operator', 'PUT', '/api/operator/notifications/read-all', 'Mark all read', '', '{ "message": "All marked as read" }', 200, '401/403/500'],
  [86, 'Operator', 'DELETE', '/api/operator/notifications/:id', 'Delete notification', '/{id}', '', '{ "message": "Notification deleted" }', 200, '404/401/403/500']
];

const customerData = [
  ['S.No', 'Type of Dashboard', 'HTTP Method', 'API Path', 'Description', 'Sample Request Body (JSON)', 'Sample Response (JSON)', 'Success Status Code', 'Error Status Codes'],
  [87, 'Customer', 'GET', '/api/customer/profile', 'Get customer profile', '', '{ "user": {...} }', 200, '401/403/500'],
  [88, 'Customer', 'PUT', '/api/customer/profile', 'Update profile', '', '{ "fullName": "Jane", "phone": "9000000001" }', '{ "message": "Profile updated" }', 200, '401/403/500'],
  [89, 'Customer', 'GET', '/api/customer/packages', 'List packages for customer', '', '{ "packages": [...] }', 200, '401/403/500'],
  [90, 'Customer', 'GET', '/api/customer/bookings', 'List bookings', '', '{ "bookings": [...] }', 200, '401/403/500'],
  [91, 'Customer', 'POST', '/api/customer/bookings', 'Create booking', '{ "packageId": "<pkgId>", "travelers": 2, "travelDate": "2026-12-25" }', '{ "message": "Booking created" }', 201, '400/401/403/500'],
  [92, 'Customer', 'GET', '/api/customer/bookings/:id', 'Get booking details', '/{id}', '{ "booking": {...} }', 200, '404/401/403/500'],
  [93, 'Customer', 'PUT', '/api/customer/bookings/:id', 'Update booking', '/{id}', '{ "phone": "9000000099" }', '{ "message": "Booking updated" }', 200, '404/401/403/500'],
  [94, 'Customer', 'PUT', '/api/customer/bookings/:id/pay', 'Pay for booking', '/{id}', '{ "paidAmount": 12000 }', '{ "message": "Payment successful" }', 200, '404/401/403/500'],
  [95, 'Customer', 'GET', '/api/customer/itineraries', 'Get itineraries', '', '{ "itineraries": [...] }', 200, '401/403/500'],
  [96, 'Customer', 'GET', '/api/customer/invoices', 'List invoices', '', '{ "invoices": [...] }', 200, '401/403/500'],
  [97, 'Customer', 'GET', '/api/customer/invoices/:id', 'Get invoice details', '/{id}', '{ "invoice": {...} }', 200, '404/401/403/500'],
  [98, 'Customer', 'GET', '/api/customer/reviews', 'List reviews', '', '{ "reviews": [...] }', 200, '401/403/500'],
  [99, 'Customer', 'POST', '/api/customer/reviews', 'Create review', '{ "packageId": "<pkgId>", "rating": 5, "title": "Amazing", "comment": "Great" }', '{ "message": "Review created" }', 201, '400/401/403/500'],
  [100, 'Customer', 'DELETE', '/api/customer/reviews/:id', 'Delete review', '/{id}', '', '{ "message": "Review deleted" }', 200, '404/401/403/500'],
  [101, 'Customer', 'GET', '/api/customer/wishlist', 'List wishlist', '', '{ "wishlist": [...] }', 200, '401/403/500'],
  [102, 'Customer', 'POST', '/api/customer/wishlist', 'Add to wishlist', '{ "packageId": "<pkgId>" }', '{ "message": "Added to wishlist" }', 201, '401/403/400/500'],
  [103, 'Customer', 'DELETE', '/api/customer/wishlist/:id', 'Remove from wishlist', '/{id}', '', '{ "message": "Removed from wishlist" }', 200, '404/401/403/500'],
  [104, 'Customer', 'GET', '/api/customer/notifications', 'List notifications', '', '{ "notifications": [...] }', 200, '401/403/500'],
  [105, 'Customer', 'PUT', '/api/customer/notifications/:id/read', 'Mark notification read', '/{id}', '', '{ "message": "Notification marked as read" }', 200, '404/401/403/500'],
  [106, 'Customer', 'PUT', '/api/customer/notifications/read-all', 'Mark all read', '', '{ "message": "All marked as read" }', 200, '401/403/500'],
  [107, 'Customer', 'DELETE', '/api/customer/notifications/:id', 'Delete notification', '/{id}', '', '{ "message": "Notification deleted" }', 200, '404/401/403/500'],
  [108, 'Customer', 'GET', '/api/customer/analytics', 'Get analytics', '', '{ "stats": {...} }', 200, '401/403/500']
];

const hotelData = [
  ['S.No', 'Type of Dashboard', 'HTTP Method', 'API Path', 'Description', 'Sample Request Body (JSON)', 'Sample Response (JSON)', 'Success Status Code', 'Error Status Codes'],
  [109, 'Hotel Partner', 'GET', '/api/hotel/profile', 'Get hotel profile', '', '{ "user": {...}, "profile": {...} }', 200, '401/403/500'],
  [110, 'Hotel Partner', 'PUT', '/api/hotel/profile', 'Update hotel profile', '', '{ "hotelName": "Grand Palace", "email": "hotel@test.com", "phone": "7000000001", "address": "123 Main St", "city": "Jaipur", "starRating": 4 }', '{ "message": "Profile updated" }', 200, '401/403/500'],
  [111, 'Hotel Partner', 'GET', '/api/hotel/settings', 'Get hotel settings', '', '{ "settings": {...} }', 200, '401/403/500'],
  [112, 'Hotel Partner', 'PUT', '/api/hotel/settings', 'Update hotel settings', '', '{ "emailNotifications": true }', '{ "message": "Settings updated" }', 200, '401/403/500'],
  [113, 'Hotel Partner', 'GET', '/api/hotel/rooms', 'List hotel rooms', '', '{ "rooms": [...] }', 200, '401/403/500'],
  [114, 'Hotel Partner', 'POST', '/api/hotel/rooms', 'Create hotel room', '{ "type": "Deluxe", "total": 10, "price": 3500 }', '{ "message": "Room created" }', 201, '401/403/400/500'],
  [115, 'Hotel Partner', 'PUT', '/api/hotel/rooms/:id', 'Update room', '/{id}', '{ "available": 3 }', '{ "message": "Room updated" }', 200, '404/401/403/500'],
  [116, 'Hotel Partner', 'DELETE', '/api/hotel/rooms/:id', 'Delete room', '/{id}', '', '{ "message": "Room deleted" }', 200, '404/401/403/500'],
  [117, 'Hotel Partner', 'GET', '/api/hotel/pricing', 'Get pricing', '', '{ "pricing": [...] }', 200, '401/403/500'],
  [118, 'Hotel Partner', 'PUT', '/api/hotel/pricing/:id', 'Update pricing', '/{id}', '{ "price": 4000 }', '{ "message": "Pricing updated" }', 200, '404/401/403/500'],
  [119, 'Hotel Partner', 'GET', '/api/hotel/availability', 'Get availability', '', '{ "availability": [...] }', 200, '401/403/500'],
  [120, 'Hotel Partner', 'PUT', '/api/hotel/availability/bulk', 'Update availability (bulk)', '{ "date": "2026-12-25", "availability": [{ "roomType": "Deluxe", "available": 5 }] }', '{ "message": "Availability updated" }', 200, '401/403/400/500'],
  [121, 'Hotel Partner', 'GET', '/api/hotel/bookings', 'List bookings', '', '{ "bookings": [...] }', 200, '401/403/500'],
  [122, 'Hotel Partner', 'POST', '/api/hotel/bookings', 'Create booking', '{ "guestName": "John", "checkInDate": "2026-12-25", "guests": 2, "amount": 12000 }', '{ "message": "Booking created" }', 201, '401/403/400/500'],
  [123, 'Hotel Partner', 'PUT', '/api/hotel/bookings/:id', 'Update booking', '/{id}', '{ "status": "confirmed" }', '{ "message": "Booking updated" }', 200, '404/401/403/500'],
  [124, 'Hotel Partner', 'DELETE', '/api/hotel/bookings/:id', 'Delete booking', '/{id}', '', '{ "message": "Booking deleted" }', 200, '404/401/403/500'],
  [125, 'Hotel Partner', 'PUT', '/api/hotel/bookings/:id/pay', 'Process payment', '/{id}', '{ "paidAmount": 12000 }', '{ "message": "Payment recorded" }', 200, '404/401/403/500'],
  [126, 'Hotel Partner', 'GET', '/api/hotel/guests', 'List guests', '', '{ "bookings": [...] }', 200, '401/403/500'],
  [127, 'Hotel Partner', 'GET', '/api/hotel/reviews', 'List reviews', '', '{ "reviews": [...] }', 200, '401/403/500'],
  [128, 'Hotel Partner', 'PUT', '/api/hotel/reviews/:id/respond', 'Respond to review', '/{id}', '{ "response": "Thank you!" }', '{ "message": "Review responded" }', 200, '404/401/403/500'],
  [129, 'Hotel Partner', 'PUT', '/api/hotel/reviews/:id/status', 'Update review status', '/{id}', '{ "status": "approved" }', '{ "message": "Status updated" }', 200, '404/401/403/500'],
  [130, 'Hotel Partner', 'DELETE', '/api/hotel/reviews/:id', 'Delete review', '/{id}', '', '{ "message": "Review deleted" }', 200, '404/401/403/500'],
  [131, 'Hotel Partner', 'GET', '/api/hotel/revenue', 'Get revenue', '', '{ "totalRevenue": 500000 }', 200, '401/403/500'],
  [132, 'Hotel Partner', 'GET', '/api/hotel/notifications', 'List notifications', '', '{ "notifications": [...] }', 200, '401/403/500'],
  [133, 'Hotel Partner', 'PUT', '/api/hotel/notifications/read-all', 'Mark all read', '', '{ "message": "All marked as read" }', 200, '401/403/500'],
  [134, 'Hotel Partner', 'PUT', '/api/hotel/notifications/:id/read', 'Mark notification read', '/{id}', '', '{ "message": "Notification marked as read" }', 200, '404/401/403/500'],
  [135, 'Hotel Partner', 'DELETE', '/api/hotel/notifications/:id', 'Delete notification', '/{id}', '', '{ "message": "Notification deleted" }', 200, '404/401/403/500'],
  [136, 'Hotel Partner', 'GET', '/api/hotel/analytics', 'Get hotel analytics', '', '{ "stats": {...} }', 200, '401/403/500']
];

// Endpoints added after the first pass of this document.
const addedData = [
  ['S.No', 'Type of Dashboard', 'HTTP Method', 'API Path', 'Description', 'Sample Request Body (JSON)', 'Sample Response (JSON)', 'Success Status Code', 'Error Status Codes'],
  [137, 'Auth/Public', 'GET', '/api/auth/google', 'Start Google OAuth sign-in', '', 'Redirects to accounts.google.com with an OAuth state parameter', 302, '500'],
  [138, 'Auth/Public', 'GET', '/api/auth/google/callback', 'Google OAuth callback, issues a session token', '', '{ "token": "eyJhbG...", "user": { "role": "customer" } }', 200, '401/500'],
  [139, 'Public', 'POST', '/api/contact', 'Submit a public contact form message', '{ "fullName": "John Doe", "email": "john@test.com", "phone": "8000000001", "subject": " enquiry", "message": "Enquiry about Manali packages" }', '{ "message": "Message sent successfully" }', 201, '400/500'],
  [140, 'Admin', 'GET', '/api/users', 'List users (admin scoped)', '', '{ "users": [{ "_id": "..." }] }', 200, '401/403/500'],
  [141, 'Admin', 'POST', '/api/admin/send-email', 'Send an email to a user', '{ "to": "user@test.com", "subject": "Update", "message": "Body copy" }', '{ "message": "Email sent" }', 200, '400/401/403/500']
];

// ---------------------------------------------------------------------------
// Documentation schema
// ---------------------------------------------------------------------------

const HEADERS = [
  'S.No',
  'Dashboard Type',
  'API Endpoint',
  'Method',
  'Auth',
  'Request Body',
  'Sample Response',
  'Status Codes',
  'Notes'
];

const ROLE_BY_PREFIX = [
  ['/api/admin/', 'admin'],
  ['/api/operator/', 'tour_operator'],
  ['/api/customer/', 'customer'],
  ['/api/hotel/', 'hotel_partner']
];

const PUBLIC_PATHS = new Set([
  '/api/signup',
  '/api/login',
  '/api/forgot-password',
  '/api/verify-otp',
  '/api/reset-password',
  '/api/packages',
  '/api/packages/:id',
  '/api/contact'
]);

// Guards are attached to a router mount rather than to each route, so the
// documented Auth column is derived from the real mount points.
const GUARD_BY_MOUNT = {
  '/api/admin': 'admin',
  '/api/operator': 'tour_operator',
  '/api/customer': 'customer',
  '/api/hotel': 'hotel_partner'
};

const mountRe = /app\.use\('(\/api\/[^']*)'\s*,\s*authenticate\s*,\s*require(\w+)\)/g;
let mountMatch;
while ((mountMatch = mountRe.exec(serverSource))) {
  GUARD_BY_MOUNT[mountMatch[1]] = mountMatch[2].toLowerCase();
}

const ROLE_NAME = {
  admin: 'admin',
  touroperator: 'tour_operator',
  customer: 'customer',
  hotelpartner: 'hotel_partner'
};

const guardFor = (path) => {
  const hit = Object.keys(GUARD_BY_MOUNT)
    .filter((mount) => path.startsWith(`${mount}/`))
    .sort((a, b) => b.length - a.length)[0];
  if (!hit) return null;
  return ROLE_NAME[GUARD_BY_MOUNT[hit]] || GUARD_BY_MOUNT[hit];
};

const isPublic = (path) =>
  PUBLIC_PATHS.has(path) || path.startsWith('/api/public/') || path.startsWith('/api/auth/');

const authFor = (path) => {
  if (isPublic(path)) return 'None (public)';
  // /api/users is guarded inline on the route rather than through a mount.
  const role = path === '/api/users' ? 'admin' : guardFor(path);
  return role ? `Bearer JWT (${role})` : 'Bearer JWT';
};

const routeIndex = [];
{
  const routeRe = /app\.(get|post|put|patch|delete)\(\s*'([^']+)'/g;
  let match;
  while ((match = routeRe.exec(serverSource))) {
    routeIndex.push({ method: match[1].toUpperCase(), path: match[2], at: match.index });
  }
}

const paginatedRoutes = new Set();
routeIndex.forEach((route, i) => {
  const end = i + 1 < routeIndex.length ? routeIndex[i + 1].at : serverSource.length;
  const handler = serverSource.slice(route.at, end);
  if (/pagedResponse\(|findPage\(/.test(handler)) {
    paginatedRoutes.add(`${route.method} ${route.path}`);
  }
});

const allRoutes = new Set(routeIndex.map((r) => `${r.method} ${r.path}`));

// Legacy rows are either 9 values, or 10 when a path-parameter column such as
// '/{id}' was written in. Both shapes are folded into the documented schema so
// PUT and DELETE rows no longer sit one column to the right of the header.
const toDocumentedRow = (row) => {
  const [sno, type, method, apiPath, description, ...rest] = row;
  let requestBody = '';
  let sampleResponse = '';
  let success = '';
  let errors = '';
  let pathParams = '';

  // 9-value rows leave 4 values after the description; 10-value rows leave 5
  // because of the leading path-parameter value.
  if (rest.length >= 5) {
    [pathParams, requestBody, sampleResponse, success, errors] = rest;
  } else {
    [requestBody, sampleResponse, success, errors] = rest;
  }

  const notes = [];
  if (description) notes.push(description);
  if (pathParams && pathParams !== '/') notes.push(`Path params: ${pathParams.replace(/^\//, '')}`);
  if (paginatedRoutes.has(`${method} ${apiPath}`)) {
    notes.push('Supports ?page & ?limit (?limit=all returns every row); response adds a "pagination" object');
  }

  const statusCodes = [
    success ? `${success} on success` : null,
    errors ? `${errors} on error` : null
  ].filter(Boolean).join('; ');

  return [
    sno,
    type,
    apiPath,
    method,
    authFor(apiPath),
    requestBody || '',
    sampleResponse || '',
    statusCodes,
    notes.join('. ')
  ];
};

const buildSheet = (rows) => {
  const documented = rows.slice(1).map(toDocumentedRow);
  const widths = [6, 15, 34, 9, 24, 46, 46, 22, 52];
  const sheet = XLSX.utils.aoa_to_sheet([HEADERS, ...documented]);
  sheet['!cols'] = widths.map((wch) => ({ wch }));
  sheet['!freeze'] = { xSplit: 0, ySplit: 1 };
  sheet['!autofilter'] = { ref: sheet['!ref'] };
  return { sheet, documented };
};

const sheets = [
  ['Auth & Public', [...authData, ...addedData.filter((r) => r[1] === 'Auth/Public' || r[1] === 'Public')]],
  ['Admin Dashboard', [...adminData, ...addedData.filter((r) => r[1] === 'Admin')]],
  ['Tour Operator', operatorData],
  ['Customer', customerData],
  ['Hotel Partner', hotelData]
];

const documentedKeys = new Set();
const unknown = [];
const flatRows = [];

sheets.forEach(([name, rows]) => {
  const { sheet, documented } = buildSheet(rows);
  documented.forEach((row) => {
    const key = `${row[3]} ${row[2]}`;
    documentedKeys.add(key);
    if (!allRoutes.has(key)) unknown.push(key);
  });
  flatRows.push({ name, rows: documented });
  XLSX.utils.book_append_sheet(wb, sheet, name);
});

const missingFromDocs = [...allRoutes].filter((route) => !documentedKeys.has(route));

const outputPath = path.join(__dirname, 'Project_API_Documentation.xlsx');
XLSX.writeFile(wb, outputPath);

// Keep the flat CSV companion on the same schema as the workbook.
const csvPath = path.join(__dirname, 'Project_API_Documentation.csv');
const csvRows = flatRows.flatMap(({ name, rows }) =>
  rows.map((row) => [row[0], row[1], row[2], row[3], row[4], row[5], row[6], row[7], `${name} — ${row[8]}`]));
const csvBook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(csvBook, XLSX.utils.aoa_to_sheet([HEADERS, ...csvRows]), 'API Documentation');
XLSX.writeFile(csvBook, csvPath, { bookType: 'csv' });

console.log('Excel file created at:', outputPath);
console.log('CSV file created at:', csvPath);
console.log('Sheets:', wb.SheetNames.join(', '));
console.log('Documented endpoints:', documentedKeys.size, '/ backend routes:', allRoutes.size);
if (unknown.length) console.log('WARNING - documented but absent from backend:', unknown);
if (missingFromDocs.length) console.log('WARNING - backend routes not documented:', missingFromDocs);
