import OperatorLayout from './OperatorLayout'
import OperatorItineraryBuilder from './OperatorItineraryBuilder'

const OperatorItineraryBuilderPage = () => {
  return (
    <OperatorLayout active="itineraries" title="Itinerary Builder">
      <OperatorItineraryBuilder />
    </OperatorLayout>
  )
}

export default OperatorItineraryBuilderPage
