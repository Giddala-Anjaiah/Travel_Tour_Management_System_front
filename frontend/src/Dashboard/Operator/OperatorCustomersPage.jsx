import OperatorLayout from './OperatorLayout'
import OperatorCustomers from './OperatorCustomers'

const OperatorCustomersPage = () => {
  return (
    <OperatorLayout active="customers" title="Customer Information">
      <OperatorCustomers />
    </OperatorLayout>
  )
}

export default OperatorCustomersPage
