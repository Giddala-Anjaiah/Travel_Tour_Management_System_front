import OperatorLayout from './OperatorLayout'
import OperatorPricingAvailability from './OperatorPricingAvailability'

const OperatorPricingPage = () => {
  return (
    <OperatorLayout active="pricing" title="Pricing & Availability">
      <OperatorPricingAvailability />
    </OperatorLayout>
  )
}

export default OperatorPricingPage
