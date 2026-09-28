import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { ThemeProvider } from './context/ThemeProvider'
import ThemeToggle from './components/ThemeToggle'
import ToastContainer from './components/Toast.jsx'
import Login from './Login.jsx'
import Signup from './Signup.jsx'
import ForgotPassword from './ForgotPassword.jsx'
import ProtectedRoute from './ProtectedRoute.jsx'

// Route-level code splitting: each dashboard chunk loads only when visited
const CustomerDashboard = lazy(() => import('./Dashboard/Customer/CustomerDashboard.jsx'))
const OperatorDashboard = lazy(() => import('./Dashboard/Operator/OperatorDashboard.jsx'))
const OperatorProfilePage = lazy(() => import('./Dashboard/Operator/OperatorProfilePage.jsx'))
const OperatorPackagesPage = lazy(() => import('./Dashboard/Operator/OperatorPackagesPage.jsx'))
const OperatorItinerariesPage = lazy(() => import('./Dashboard/Operator/OperatorItinerariesPage.jsx'))
const OperatorPricingPage = lazy(() => import('./Dashboard/Operator/OperatorPricingPage.jsx'))
const OperatorBookingsPage = lazy(() => import('./Dashboard/Operator/OperatorBookingsPage.jsx'))
const OperatorCustomersPage = lazy(() => import('./Dashboard/Operator/OperatorCustomersPage.jsx'))
const OperatorReviewsPage = lazy(() => import('./Dashboard/Operator/OperatorReviewsPage.jsx'))
const OperatorRevenueNotificationsPage = lazy(() => import('./Dashboard/Operator/OperatorRevenueNotificationsPage.jsx'))
const OperatorSettingsPage = lazy(() => import('./Dashboard/Operator/OperatorSettingsPage.jsx'))
const HotelDashboard = lazy(() => import('./Dashboard/Hotel/HotelDashboard.jsx'))
const HotelProfilePage = lazy(() => import('./Dashboard/Hotel/HotelProfilePage.jsx'))
const HotelRoomsPage = lazy(() => import('./Dashboard/Hotel/HotelRoomsPage.jsx'))
const HotelPricingPage = lazy(() => import('./Dashboard/Hotel/HotelPricingPage.jsx'))
const HotelAvailabilityPage = lazy(() => import('./Dashboard/Hotel/HotelAvailabilityPage.jsx'))
const HotelBookingsPage = lazy(() => import('./Dashboard/Hotel/HotelBookingsPage.jsx'))
const HotelCheckInOutPage = lazy(() => import('./Dashboard/Hotel/HotelCheckInOutPage.jsx'))
const HotelGuestsPage = lazy(() => import('./Dashboard/Hotel/HotelGuestsPage.jsx'))
const HotelReviewsRevenuePage = lazy(() => import('./Dashboard/Hotel/HotelReviewsRevenuePage.jsx'))
const HotelSettingsPage = lazy(() => import('./Dashboard/Hotel/HotelSettingsPage.jsx'))
const DashboardAnalytics = lazy(() => import('./Dashboard/Admin/DashboardAnalytics.jsx'))
const UserManagement = lazy(() => import('./Dashboard/Admin/UserManagement.jsx'))
const DestinationManagement = lazy(() => import('./Dashboard/Admin/DestinationManagement.jsx'))
const ItineraryManagement = lazy(() => import('./Dashboard/Admin/ItineraryManagement.jsx'))
const RoomsManagement = lazy(() => import('./Dashboard/Admin/RoomsManagement.jsx'))
const BookingManagement = lazy(() => import('./Dashboard/Admin/BookingManagement.jsx'))
const InvoicesReviews = lazy(() => import('./Dashboard/Admin/InvoicesReviews.jsx'))
const NotificationsManagement = lazy(() => import('./Dashboard/Admin/NotificationsManagement.jsx'))
const ReportsCouponsSettings = lazy(() => import('./Dashboard/Admin/ReportsCouponsSettings.jsx'))
const ProfileManagement = lazy(() => import('./Dashboard/Customer/ProfileManagement.jsx'))
const DestinationExploration = lazy(() => import('./Dashboard/Customer/DestinationExploration.jsx'))
const TourPackages = lazy(() => import('./Dashboard/Customer/TourPackages.jsx'))
const Itineraries = lazy(() => import('./Dashboard/Customer/Itineraries.jsx'))
const HotelSearchAvailability = lazy(() => import('./Dashboard/Customer/HotelSearchAvailability.jsx'))
const BookingsPayments = lazy(() => import('./Dashboard/Customer/BookingsPayments.jsx'))
const InvoicesBookingHistory = lazy(() => import('./Dashboard/Customer/InvoicesBookingHistory.jsx'))
const WishlistReviewsNotifications = lazy(() => import('./Dashboard/Customer/WishlistReviewsNotifications.jsx'))

// Lightweight loading fallback so LCP isn't blocked by a heavy spinner
const LoadingFallback = () => null

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <ThemeToggle className="theme-toggle-fixed" />
        <ToastContainer />
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
          <Route path="/" element={<App />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
        
        {/* Admin Routes */}
        <Route 
          path="/admin/dashboard" 
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <DashboardAnalytics />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin/users" 
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <UserManagement />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin/destinations" 
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <DestinationManagement />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin/itinerary" 
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <ItineraryManagement />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin/rooms" 
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <RoomsManagement />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin/bookings" 
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <BookingManagement />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin/invoices" 
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <InvoicesReviews />
            </ProtectedRoute>
          } 
        />
        <Route
          path="/admin/notifications"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <NotificationsManagement />
            </ProtectedRoute>
          }
        />
        <Route 
          path="/admin/reports" 
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <ReportsCouponsSettings />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin/settings" 
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <ReportsCouponsSettings />
            </ProtectedRoute>
          } 
        />
        
        {/* Customer Routes */}
        <Route
          path="/customer/dashboard"
          element={
            <ProtectedRoute allowedRoles={['customer']}>
              <CustomerDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/customer/destinations"
          element={
            <ProtectedRoute allowedRoles={['customer']}>
              <DestinationExploration />
            </ProtectedRoute>
          }
        />
        <Route 
          path="/customer/packages" 
          element={
            <ProtectedRoute allowedRoles={['customer']}>
              <TourPackages />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/customer/itineraries" 
          element={
            <ProtectedRoute allowedRoles={['customer']}>
              <Itineraries />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/customer/hotels" 
          element={
            <ProtectedRoute allowedRoles={['customer']}>
              <HotelSearchAvailability />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/customer/bookings" 
          element={
            <ProtectedRoute allowedRoles={['customer']}>
              <BookingsPayments />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/customer/invoices" 
          element={
            <ProtectedRoute allowedRoles={['customer']}>
              <InvoicesBookingHistory />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/customer/wishlist" 
          element={
            <ProtectedRoute allowedRoles={['customer']}>
              <WishlistReviewsNotifications />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/customer/profile" 
          element={
            <ProtectedRoute allowedRoles={['customer']}>
              <ProfileManagement />
            </ProtectedRoute>
          } 
        />
        
        {/* Tour Operator Routes */}
        <Route 
          path="/tour-operator/dashboard" 
          element={
            <ProtectedRoute allowedRoles={['tour_operator']}>
              <OperatorDashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/tour-operator/profile" 
          element={
            <ProtectedRoute allowedRoles={['tour_operator']}>
              <OperatorProfilePage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/tour-operator/packages" 
          element={
            <ProtectedRoute allowedRoles={['tour_operator']}>
              <OperatorPackagesPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/tour-operator/itineraries" 
          element={
            <ProtectedRoute allowedRoles={['tour_operator']}>
              <OperatorItinerariesPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/tour-operator/pricing" 
          element={
            <ProtectedRoute allowedRoles={['tour_operator']}>
              <OperatorPricingPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/tour-operator/bookings" 
          element={
            <ProtectedRoute allowedRoles={['tour_operator']}>
              <OperatorBookingsPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/tour-operator/customers" 
          element={
            <ProtectedRoute allowedRoles={['tour_operator']}>
              <OperatorCustomersPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/tour-operator/reviews" 
          element={
            <ProtectedRoute allowedRoles={['tour_operator']}>
              <OperatorReviewsPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/tour-operator/revenue" 
          element={
            <ProtectedRoute allowedRoles={['tour_operator']}>
              <OperatorRevenueNotificationsPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/tour-operator/notifications" 
          element={
            <ProtectedRoute allowedRoles={['tour_operator']}>
              <OperatorRevenueNotificationsPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/tour-operator/settings" 
          element={
            <ProtectedRoute allowedRoles={['tour_operator']}>
              <OperatorSettingsPage />
            </ProtectedRoute>
          } 
        />
        
        {/* Hotel Partner Routes */}
        <Route 
          path="/hotel-partner/dashboard" 
          element={
            <ProtectedRoute allowedRoles={['hotel_partner']}>
              <HotelDashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/hotel-partner/profile" 
          element={
            <ProtectedRoute allowedRoles={['hotel_partner']}>
              <HotelProfilePage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/hotel-partner/rooms" 
          element={
            <ProtectedRoute allowedRoles={['hotel_partner']}>
              <HotelRoomsPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/hotel-partner/pricing" 
          element={
            <ProtectedRoute allowedRoles={['hotel_partner']}>
              <HotelPricingPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/hotel-partner/availability" 
          element={
            <ProtectedRoute allowedRoles={['hotel_partner']}>
              <HotelAvailabilityPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/hotel-partner/bookings" 
          element={
            <ProtectedRoute allowedRoles={['hotel_partner']}>
              <HotelBookingsPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/hotel-partner/checkin" 
          element={
            <ProtectedRoute allowedRoles={['hotel_partner']}>
              <HotelCheckInOutPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/hotel-partner/guests" 
          element={
            <ProtectedRoute allowedRoles={['hotel_partner']}>
              <HotelGuestsPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/hotel-partner/reviews" 
          element={
            <ProtectedRoute allowedRoles={['hotel_partner']}>
              <HotelReviewsRevenuePage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/hotel-partner/settings" 
          element={
            <ProtectedRoute allowedRoles={['hotel_partner']}>
              <HotelSettingsPage />
            </ProtectedRoute>
          } 
        />
      </Routes>
        </Suspense>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
)
