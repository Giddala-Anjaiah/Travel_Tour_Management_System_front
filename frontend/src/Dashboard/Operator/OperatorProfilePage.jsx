import OperatorLayout from './OperatorLayout'
import OperatorProfileContent from './OperatorProfileContent'

const OperatorProfilePage = () => {
  return (
    <OperatorLayout active="profile" title="Operator Profile">
      <OperatorProfileContent />
    </OperatorLayout>
  )
}

export default OperatorProfilePage
