import OperatorLayout from './OperatorLayout'
import OperatorBookings from './OperatorBookings'

const OperatorBookingsPage = () => {
  return (
    <OperatorLayout active="bookings" title="Booking Management">
      <OperatorBookings />
    </OperatorLayout>
  )
}

export default OperatorBookingsPage
