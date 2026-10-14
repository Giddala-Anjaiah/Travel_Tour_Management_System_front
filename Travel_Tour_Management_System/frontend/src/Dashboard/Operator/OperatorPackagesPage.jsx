import OperatorLayout from './OperatorLayout'
import OperatorPackages from './OperatorPackages'

const OperatorPackagesPage = () => {
  return (
    <OperatorLayout active="packages" title="Package Management">
      <OperatorPackages />
    </OperatorLayout>
  )
}

export default OperatorPackagesPage
