import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { ThemeProvider } from './context/ThemeProvider'
import ThemeToggle from './components/ThemeToggle'
import Login from './Login.jsx'
import Signup from './Signup.jsx'
import ProtectedRoute from './ProtectedRoute.jsx'
import CustomerDashboard from './Dashboard/Customer/CustomerDashboard.jsx'
import OperatorDashboard from './Dashboard/Operator/OperatorDashboard.jsx'
import OperatorProfilePage from './Dashboard/Operator/OperatorProfilePage.jsx'
import OperatorPackagesPage from './Dashboard/Operator/OperatorPackagesPage.jsx'
import OperatorItinerariesPage from './Dashboard/Operator/OperatorItinerariesPage.jsx'
import OperatorPricingPage from './Dashboard/Operator/OperatorPricingPage.jsx'
import OperatorBookingsPage from './Dashboard/Operator/OperatorBookingsPage.jsx'
import OperatorCustomersPage from './Dashboard/Operator/OperatorCustomersPage.jsx'
import OperatorReviewsPage from './Dashboard/Operator/OperatorReviewsPage.jsx'
import OperatorRevenueNotificationsPage from './Dashboard/Operator/OperatorRevenueNotificationsPage.jsx'
import OperatorSettingsPage from './Dashboard/Operator/OperatorSettingsPage.jsx'
import HotelDashboard from './Dashboard/Hotel/HotelDashboard.jsx'
import HotelProfilePage from './Dashboard/Hotel/HotelProfilePage.jsx'
import HotelRoomsPage from './Dashboard/Hotel/HotelRoomsPage.jsx'
import HotelPricingPage from './Dashboard/Hotel/HotelPricingPage.jsx'
import HotelAvailabilityPage from './Dashboard/Hotel/HotelAvailabilityPage.jsx'
import HotelBookingsPage from './Dashboard/Hotel/HotelBookingsPage.jsx'
import HotelCheckInOutPage from './Dashboard/Hotel/HotelCheckInOutPage.jsx'
import HotelGuestsPage from './Dashboard/Hotel/HotelGuestsPage.jsx'
import HotelReviewsRevenuePage from './Dashboard/Hotel/HotelReviewsRevenuePage.jsx'
import HotelSettingsPage from './Dashboard/Hotel/HotelSettingsPage.jsx'
import DashboardAnalytics from './Dashboard/Admin/DashboardAnalytics.jsx'
import UserManagement from './Dashboard/Admin/UserManagement.jsx'
import DestinationManagement from './Dashboard/Admin/DestinationManagement.jsx'
import ItineraryManagement from './Dashboard/Admin/ItineraryManagement.jsx'
import RoomsManagement from './Dashboard/Admin/RoomsManagement.jsx'
import BookingManagement from './Dashboard/Admin/BookingManagement.jsx'
import InvoicesReviews from './Dashboard/Admin/InvoicesReviews.jsx'
import NotificationsManagement from './Dashboard/Admin/NotificationsManagement.jsx'
import ReportsCouponsSettings from './Dashboard/Admin/ReportsCouponsSettings.jsx'
import ProfileManagement from './Dashboard/Customer/ProfileManagement.jsx'
import DestinationExploration from './Dashboard/Customer/DestinationExploration.jsx'
import TourPackages from './Dashboard/Customer/TourPackages.jsx'
import Itineraries from './Dashboard/Customer/Itineraries.jsx'
import HotelSearchAvailability from './Dashboard/Customer/HotelSearchAvailability.jsx'
import BookingsPayments from './Dashboard/Customer/BookingsPayments.jsx'
import InvoicesBookingHistory from './Dashboard/Customer/InvoicesBookingHistory.jsx'
import WishlistReviewsNotifications from './Dashboard/Customer/WishlistReviewsNotifications.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <ThemeToggle className="theme-toggle-fixed" />
        <Routes>
        <Route path="/" element={<App />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        
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
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
)
