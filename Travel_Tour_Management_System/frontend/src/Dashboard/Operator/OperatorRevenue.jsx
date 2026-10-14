import { API_BASE } from '../../api'
import { useState, useEffect, useCallback } from 'react'
import usePolling from '../../hooks/usePolling'
import { TrendingUp, DollarSign, Sparkles, Award, CheckCircle, AlertCircle, PieChart, BarChart } from 'lucide-react'
import '../Dashboard.css'

const OperatorRevenue = () => {
  const [revenueData, setRevenueData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [dateRange] = useState('month')

  const fetchRevenue = useCallback(async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE}/operator/revenue?range=${dateRange}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const data = await response.json()
      if (data) {
        setRevenueData(data)
      }
    } catch (error) {
      console.error('Error fetching revenue:', error)
    } finally {
      setLoading(false)
    }
  }, [dateRange])

  useEffect(() => {
    Promise.resolve().then(() => fetchRevenue())
  }, [dateRange, fetchRevenue])

  usePolling(fetchRevenue, 15000)

  const formatCurrency = (amount) => {
    return `₹${(amount / 1000).toFixed(0)}K`
  }

  return (
    <>
          {loading ? (
            <div className="loading-state">Loading revenue data...</div>
          ) : revenueData ? (
            <>
              <div className="stats-grid enhanced">
                <div className="stat-card enhanced">
                  <DollarSign className="stat-icon" />
                  <div className="stat-content">
                    <h3>Total Revenue</h3>
                    <p className="stat-number">{formatCurrency(revenueData.totalRevenue)}</p>
                    <small>All time</small>
                  </div>
                </div>
                <div className="stat-card enhanced">
                  <TrendingUp className="stat-icon" />
                  <div className="stat-content">
                    <h3>Range Revenue</h3>
                    <p className="stat-number">{formatCurrency(revenueData.rangeRevenue)}</p>
                    <small>This {dateRange}</small>
                  </div>
                </div>
                <div className="stat-card enhanced">
                  <CheckCircle className="stat-icon" />
                  <div className="stat-content">
                    <h3>Paid Revenue</h3>
                    <p className="stat-number">{formatCurrency(revenueData.totalRevenue)}</p>
                    <small>Confirmed payments</small>
                  </div>
                </div>
                <div className="stat-card enhanced">
                  <AlertCircle className="stat-icon" />
                  <div className="stat-content">
                    <h3>Pending Revenue</h3>
                    <p className="stat-number">{formatCurrency(revenueData.pendingRevenue)}</p>
                    <small>Awaiting payment</small>
                  </div>
                </div>
                <div className="stat-card enhanced">
                  <Award className="stat-icon" />
                  <div className="stat-content">
                    <h3>Total Bookings</h3>
                    <p className="stat-number">{revenueData.totalBookings}</p>
                    <small>All time</small>
                  </div>
                </div>
                <div className="stat-card enhanced">
                  <Sparkles className="stat-icon" />
                  <div className="stat-content">
                    <h3>Average Booking</h3>
                    <p className="stat-number">{formatCurrency(revenueData.averageBookingValue)}</p>
                    <small>Per booking</small>
                  </div>
                </div>
              </div>

              <div className="dashboard-sections">
                <div className="section-card enhanced">
                  <div className="section-header">
                    <h3>Revenue by Package</h3>
                    <PieChart className="h-5 w-5" />
                  </div>
                  {revenueData.revenueByPackage && revenueData.revenueByPackage.length > 0 ? (
                    <div className="revenue-by-package">
                      {revenueData.revenueByPackage.map((item, index) => (
                        <div key={index} className="package-revenue-item">
                          <div className="package-name">{item._id}</div>
                          <div className="revenue-bar-container">
                            <div 
                              className="revenue-bar-fill" 
                              style={{ 
                                width: `${(item.revenue / Math.max(...revenueData.revenueByPackage.map(r => r.revenue))) * 100}%` 
                              }}
                            />
                          </div>
                          <div className="revenue-amount">{formatCurrency(item.revenue)}</div>
                          <div className="booking-count">{item.count} bookings</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state">
                      <p>No revenue data available</p>
                    </div>
                  )}
                </div>

                <div className="section-card enhanced">
                  <div className="section-header">
                    <h3>Monthly Revenue Trend</h3>
                    <BarChart className="h-5 w-5" />
                  </div>
                  {revenueData.monthlyRevenue && revenueData.monthlyRevenue.length > 0 ? (
                    <div className="monthly-revenue-chart">
                      {revenueData.monthlyRevenue.map((revenue, index) => {
                        const maxRevenue = Math.max(...revenueData.monthlyRevenue)
                        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
                        return (
                          <div key={index} className="month-bar">
                            <div 
                              className="bar" 
                              style={{ 
                                height: `${maxRevenue > 0 ? (revenue / maxRevenue) * 100 : 0}%` 
                              }}
                            />
                            <span className="month-label">{months[index]}</span>
                            <span className="revenue-label">{formatCurrency(revenue)}</span>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="empty-state">
                      <p>No monthly data available</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <DollarSign className="h-12 w-12" />
              <h3>No revenue data available</h3>
              <p>Start accepting bookings to see revenue analytics</p>
            </div>
          )}
      </>
  )
}

export default OperatorRevenue
