import { useState } from 'react'
import OperatorLayout from './OperatorLayout'
import OperatorRevenue from './OperatorRevenue'
import OperatorNotifications from './OperatorNotifications'

const OperatorRevenueNotificationsPage = () => {
  const [activeTab, setActiveTab] = useState('revenue')

  return (
    <OperatorLayout active="revenue" title="Revenue & Notifications">
      <div className="tabs-container">
        <div className="tabs">
          <button 
            className={`tab ${activeTab === 'revenue' ? 'active' : ''}`}
            onClick={() => setActiveTab('revenue')}
          >
            Revenue
          </button>
          <button 
            className={`tab ${activeTab === 'notifications' ? 'active' : ''}`}
            onClick={() => setActiveTab('notifications')}
          >
            Notifications
          </button>
        </div>
      </div>
      <div className="tab-content">
        {activeTab === 'revenue' && <OperatorRevenue />}
        {activeTab === 'notifications' && <OperatorNotifications />}
      </div>
    </OperatorLayout>
  )
}

export default OperatorRevenueNotificationsPage
