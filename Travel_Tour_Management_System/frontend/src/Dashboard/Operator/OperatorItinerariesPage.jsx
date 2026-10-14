import OperatorLayout from './OperatorLayout'
import OperatorItineraries from './OperatorItineraries'

const OperatorItinerariesPage = () => {
  return (
    <OperatorLayout active="itineraries" title="Itinerary Management">
      <OperatorItineraries />
    </OperatorLayout>
  )
}

export default OperatorItinerariesPage
