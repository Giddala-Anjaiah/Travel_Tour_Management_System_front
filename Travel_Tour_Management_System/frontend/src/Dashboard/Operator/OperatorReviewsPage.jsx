import OperatorLayout from './OperatorLayout'
import OperatorReviews from './OperatorReviews'

const OperatorReviewsPage = () => {
  return (
    <OperatorLayout active="reviews" title="Reviews & Ratings">
      <OperatorReviews />
    </OperatorLayout>
  )
}

export default OperatorReviewsPage
