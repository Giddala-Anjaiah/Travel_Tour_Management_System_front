import { useEffect, useState, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { PieChart, Settings, Plus, Pencil as Edit, Trash2, Search, Download, Users, MapPin, Tag, Bell, Shield, Ticket } from 'lucide-react'
import { api, downloadCsv, formValues, formatCurrency, formatDate } from '../../api'
import AdminLayout from './AdminLayout'
import ChartBar from './ChartBar'

const ReportsCouponsSettings = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const tabFromRoute = useCallback(() => {
    if (location.pathname.includes('settings')) return 'settings'
    return new URLSearchParams(location.search).get('tab') || 'reports'
  }, [location.pathname, location.search])

  const [activeTab, setActiveTab] = useState(tabFromRoute)
  const [coupons, setCoupons] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [reportSummary, setReportSummary] = useState(null)
  const [settings, setSettings] = useState({
    siteName: 'Travel Tour Management System',
    siteEmail: '',
    sitePhone: '',
    currency: 'INR',
    timezone: 'Asia/Kolkata',
    maintenanceMode: false,
    allowRegistration: true,
    requireApproval: false,
    taxRate: 18,
    cancellationPolicy: '',
    refundPolicy: ''
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [showAddCouponModal, setShowAddCouponModal] = useState(false)
  const [showEditCouponModal, setShowEditCouponModal] = useState(false)
  const [selectedCoupon, setSelectedCoupon] = useState(null)
  const [error, setError] = useState('')
  const [saveMessage, setSaveMessage] = useState('')

  useEffect(() => {
    Promise.resolve().then(() => setActiveTab(tabFromRoute()))
  }, [tabFromRoute])

  const openTab = (tab) => {
    if (tab === 'settings') navigate('/admin/settings')
    else if (tab === 'coupons') navigate('/admin/reports?tab=coupons')
    else navigate('/admin/reports')
  }

  const load = async () => {
    try {
      setError('')
      const [couponData, analyticsData, summaryData, settingsData] = await Promise.all([
        api('/admin/coupons'),
        api('/admin/analytics?range=month'),
        api('/admin/reports/summary?range=month'),
        api('/admin/settings')
      ])
      setCoupons((couponData.coupons || []).map((coupon) => ({
        id: coupon._id,
        code: coupon.code,
        discount: coupon.discount,
        type: coupon.type,
        minPurchase: coupon.minPurchase,
        maxDiscount: coupon.maxDiscount || coupon.discount,
        status: coupon.status,
        expiry: formatDate(coupon.expiry),
        usage: coupon.usage || 0,
        maxUsage: coupon.maxUsage
      })))
      setAnalytics(analyticsData)
      setReportSummary(summaryData)
      if (settingsData.settings) {
        setSettings((current) => ({ ...current, ...settingsData.settings }))
      }
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    Promise.resolve().then(() => load())
  }, [])

  const filteredCoupons = coupons.filter((coupon) =>
    coupon.code.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (filterStatus === 'all' || coupon.status === filterStatus)
  )

  const handleDeleteCoupon = async (id) => {
    if (!window.confirm('Delete this coupon?')) return
    try {
      await api(`/admin/coupons/${id}`, { method: 'DELETE' })
      setCoupons(coupons.filter((coupon) => coupon.id !== id))
    } catch (err) {
      alert(err.message)
    }
  }

  const handleToggleCouponStatus = async (id) => {
    const coupon = coupons.find((item) => item.id === id)
    const status = coupon.status === 'active' ? 'inactive' : 'active'
    try {
      await api(`/admin/coupons/${id}`, { method: 'PUT', body: JSON.stringify({ status }) })
      setCoupons(coupons.map((item) => item.id === id ? { ...item, status } : item))
    } catch (err) {
      alert(err.message)
    }
  }

  const couponPayload = (values) => ({
    code: values.code.toUpperCase(),
    type: values.type,
    discount: Number(values.discount),
    minPurchase: Number(values.minPurchase),
    maxDiscount: Number(values.maxDiscount || values.discount),
    maxUsage: Number(values.maxUsage),
    expiry: values.expiry,
    status: 'active'
  })

  const handleAddCoupon = async (e) => {
    e.preventDefault()
    try {
      await api('/admin/coupons', { method: 'POST', body: JSON.stringify(couponPayload(formValues(e.target))) })
      setShowAddCouponModal(false)
      load()
    } catch (err) {
      alert(err.message)
    }
  }

  const handleUpdateCoupon = async (e) => {
    e.preventDefault()
    const values = formValues(e.target)
    try {
      await api(`/admin/coupons/${selectedCoupon.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          code: values.code.toUpperCase(),
          type: values.type,
          discount: Number(values.discount),
          minPurchase: Number(values.minPurchase),
          maxUsage: Number(values.maxUsage),
          expiry: values.expiry
        })
      })
      setShowEditCouponModal(false)
      load()
    } catch (err) {
      alert(err.message)
    }
  }

  const saveSettings = async () => {
    try {
      setSaveMessage('')
      await api('/admin/settings', { method: 'PUT', body: JSON.stringify(settings) })
      setSaveMessage('Settings saved to the database.')
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <AdminLayout
      active={location.pathname.includes('settings') ? 'settings' : 'reports'}
      title="Reports, Coupons & Settings"
      actions={
        <button className="action-btn" onClick={() => {
          if (!analytics) return
          downloadCsv('reports.csv', ['Metric', 'Value'], [
            ['Users', analytics.totalUsers],
            ['Bookings', analytics.totalBookings],
            ['Revenue', analytics.totalRevenue],
            ['Active Tours', analytics.activeTours]
          ])
        }}><Download className="h-4 w-4" /> Export Reports</button>
      }
    >
      {error && <div className="error-message">{error}</div>}
      <div className="tabs">
        <button className={`tab ${activeTab === 'reports' ? 'active' : ''}`} onClick={() => openTab('reports')}><PieChart className="h-4 w-4" /> Reports</button>
        <button className={`tab ${activeTab === 'coupons' ? 'active' : ''}`} onClick={() => openTab('coupons')}><Tag className="h-4 w-4" /> Coupons</button>
        <button className={`tab ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => openTab('settings')}><Settings className="h-4 w-4" /> Settings</button>
      </div>

      {activeTab === 'reports' && (
        <div className="dashboard-sections">
          <div className="section-card">
            <h3>Revenue Reports</h3>
            <div className="report-placeholder">
              <PieChart className="chart-icon" />
              <p>{formatCurrency(analytics?.totalRevenue || 0)}</p>
              <small>Paid booking revenue from MongoDB</small>
            </div>
          </div>
          <div className="section-card">
            <h3>Booking Reports</h3>
            <div className="report-placeholder">
              <Ticket className="chart-icon" />
              <p>{analytics?.totalBookings || 0} bookings</p>
              <small>Confirmed {analytics?.bookingStats?.confirmed || 0} · Pending {analytics?.bookingStats?.pending || 0} · Cancelled {analytics?.bookingStats?.cancelled || 0}</small>
            </div>
          </div>
          <div className="section-card">
            <h3>Customer Reports</h3>
            <div className="report-placeholder">
              <Users className="chart-icon" />
              <p>{analytics?.totalUsers || 0} users</p>
              <small>New this month: {analytics?.range?.users || 0}</small>
            </div>
          </div>
          <div className="section-card">
            <h3>Tour Performance</h3>
            <div className="report-placeholder">
              <MapPin className="chart-icon" />
              <p>{analytics?.activeTours || 0} active tours</p>
              <small>{(analytics?.topTours || []).map((tour) => tour.name).join(', ') || 'Add packages to see rankings'}</small>
            </div>
          </div>
          <div className="section-card full-width">
            <h3>Revenue by Package</h3>
            <ChartBar
              type="pie"
              data={Object.fromEntries((analytics?.topTours || []).map((tour) => [tour.name, tour.revenue || 0]))}
              title="Revenue share"
            />
          </div>
          <div className="section-card full-width">
            <h3>Monthly Revenue Trend</h3>
            <ChartBar
              type="line"
              data={(analytics?.monthlyRevenue || []).map((value, index) => {
                const date = new Date()
                date.setMonth(date.getMonth() - ((analytics.monthlyRevenue?.length || 1) - 1 - index))
                return { label: date.toLocaleString('en-US', { month: 'short' }), value, format: 'currency' }
              })}
              height={240}
              title="Revenue over the last 6 months"
            />
          </div>
          <div className="section-card">
            <h3>Booking Status Breakdown</h3>
            <ChartBar type="pie" data={analytics?.bookingStats || {}} />
          </div>
          <div className="section-card">
            <h3>Booking Payment Status</h3>
            <ChartBar type="pie" data={reportSummary?.bookingsByPayment || {}} />
          </div>
          <div className="section-card">
            <h3>Revenue by Category</h3>
            <ChartBar
              type="bar"
              data={(reportSummary?.revenueByCategory || []).map(item => ({ label: item.name, value: item.revenue, format: 'currency' }))}
            />
          </div>
          <div className="section-card">
            <h3>Top Destinations by Revenue</h3>
            <ChartBar
              type="bar"
              data={(reportSummary?.revenueByDestination || []).map(item => ({ label: item.name, value: item.revenue, format: 'currency' }))}
            />
          </div>
        </div>
      )}

      {activeTab === 'coupons' && (
        <>
          <div className="filters-section">
            <div className="search-bar">
              <Search className="search-icon" />
              <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search coupons by code..." />
            </div>
            <div className="filter-controls">
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="filter-select">
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <button className="action-btn" onClick={() => { setSelectedCoupon(null); setShowAddCouponModal(true) }}><Plus className="h-4 w-4" /> Add Coupon</button>
          </div>
          <div className="stats-grid">
            <div className="stat-card"><Tag className="stat-icon" /><div className="stat-content"><h3>Total Coupons</h3><p className="stat-number">{coupons.length}</p></div></div>
            <div className="stat-card"><Tag className="stat-icon" /><div className="stat-content"><h3>Active Coupons</h3><p className="stat-number">{coupons.filter((c) => c.status === 'active').length}</p></div></div>
            <div className="stat-card"><Users className="stat-icon" /><div className="stat-content"><h3>Total Usage</h3><p className="stat-number">{coupons.reduce((sum, c) => sum + c.usage, 0)}</p></div></div>
          </div>
          <div className="section-card full-width">
            <h3>Coupons ({filteredCoupons.length})</h3>
            <div className="coupons-grid">
              {filteredCoupons.length === 0 && <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem' }}>No coupons found</div>}
              {filteredCoupons.map((coupon) => (
                <div key={coupon.id} className="coupon-card">
                  <div className="coupon-header">
                    <div className="coupon-code"><Tag className="h-4 w-4" />{coupon.code}</div>
                    <span className={`status-badge ${coupon.status}`}>{coupon.status}</span>
                  </div>
                  <div className="coupon-discount">{coupon.type === 'percentage' ? `${coupon.discount}% OFF` : `₹${coupon.discount} OFF`}</div>
                  <div className="coupon-details">
                    <p>Min Purchase: ₹{coupon.minPurchase.toLocaleString()}</p>
                    <p>Expires: {coupon.expiry}</p>
                  </div>
                  <div className="coupon-usage">
                    <div className="usage-bar"><div className="usage-fill" style={{ width: `${coupon.maxUsage ? (coupon.usage / coupon.maxUsage) * 100 : 0}%` }}></div></div>
                    <span>{coupon.usage}/{coupon.maxUsage} used</span>
                  </div>
                  <div className="coupon-actions">
                    <button className="icon-btn edit" onClick={() => { setSelectedCoupon(coupon); setShowEditCouponModal(true) }}><Edit className="h-4 w-4" /></button>
                    <button className="icon-btn toggle" onClick={() => handleToggleCouponStatus(coupon.id)}>{coupon.status === 'active' ? '🔴' : '🟢'}</button>
                    <button className="icon-btn delete" onClick={() => handleDeleteCoupon(coupon.id)}><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {activeTab === 'settings' && (
        <div className="dashboard-sections">
          <div className="section-card full-width">
            <h3>General Settings</h3>
            <div className="settings-form">
              <div className="form-row">
                <div className="form-group"><label>Site Name</label><input value={settings.siteName || ''} onChange={(e) => setSettings({ ...settings, siteName: e.target.value })} /></div>
                <div className="form-group"><label>Site Email</label><input type="email" value={settings.siteEmail || ''} onChange={(e) => setSettings({ ...settings, siteEmail: e.target.value })} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Site Phone</label><input value={settings.sitePhone || ''} onChange={(e) => setSettings({ ...settings, sitePhone: e.target.value })} /></div>
                <div className="form-group">
                  <label>Currency</label>
                  <select value={settings.currency} onChange={(e) => setSettings({ ...settings, currency: e.target.value })}>
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Timezone</label>
                <select value={settings.timezone} onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}>
                  <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">America/New_York (EST)</option>
                </select>
              </div>
            </div>
          </div>
          <div className="section-card full-width">
            <h3>System Settings</h3>
            <div className="settings-form">
              <div className="setting-item">
                <div className="setting-info"><Bell className="h-5 w-5" /><div><h4>Maintenance Mode</h4><p>Disable the site for maintenance</p></div></div>
                <label className="toggle-switch"><input type="checkbox" checked={!!settings.maintenanceMode} onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.checked })} /><span className="toggle-slider"></span></label>
              </div>
              <div className="setting-item">
                <div className="setting-info"><Users className="h-5 w-5" /><div><h4>Allow Registration</h4><p>Enable new user registration</p></div></div>
                <label className="toggle-switch"><input type="checkbox" checked={!!settings.allowRegistration} onChange={(e) => setSettings({ ...settings, allowRegistration: e.target.checked })} /><span className="toggle-slider"></span></label>
              </div>
              <div className="setting-item">
                <div className="setting-info"><Shield className="h-5 w-5" /><div><h4>Require Approval</h4><p>Require admin approval for new users</p></div></div>
                <label className="toggle-switch"><input type="checkbox" checked={!!settings.requireApproval} onChange={(e) => setSettings({ ...settings, requireApproval: e.target.checked })} /><span className="toggle-slider"></span></label>
              </div>
            </div>
          </div>
          <div className="section-card full-width">
            <h3>Business Settings</h3>
            <div className="settings-form">
              <div className="form-row">
                <div className="form-group"><label>Tax Rate (%)</label><input type="number" value={settings.taxRate} onChange={(e) => setSettings({ ...settings, taxRate: parseFloat(e.target.value) || 0 })} /></div>
                <div className="form-group"><label>Cancellation Policy</label><input value={settings.cancellationPolicy || ''} onChange={(e) => setSettings({ ...settings, cancellationPolicy: e.target.value })} /></div>
              </div>
              <div className="form-group"><label>Refund Policy</label><input value={settings.refundPolicy || ''} onChange={(e) => setSettings({ ...settings, refundPolicy: e.target.value })} /></div>
            </div>
          </div>
          <div className="section-card full-width">
            <div className="form-actions">
              <button onClick={saveSettings} className="btn-primary">Save Settings</button>
              {saveMessage && <span className="success-message">{saveMessage}</span>}
            </div>
          </div>
        </div>
      )}

      {(showAddCouponModal || showEditCouponModal) && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>{showAddCouponModal ? 'Add New Coupon' : 'Edit Coupon'}</h3>
              <button className="modal-close" onClick={() => { setShowAddCouponModal(false); setShowEditCouponModal(false) }}>×</button>
            </div>
            <div className="modal-body">
              <form className="coupon-form" onSubmit={showAddCouponModal ? handleAddCoupon : handleUpdateCoupon}>
                <div className="form-group"><label>Coupon Code</label><input name="code" defaultValue={selectedCoupon?.code} required /></div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Discount Type</label>
                    <select name="type" defaultValue={selectedCoupon?.type || 'percentage'}>
                      <option value="percentage">Percentage</option>
                      <option value="flat">Flat Amount</option>
                    </select>
                  </div>
                  <div className="form-group"><label>Discount Value</label><input name="discount" type="number" defaultValue={selectedCoupon?.discount} required /></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>Min Purchase (₹)</label><input name="minPurchase" type="number" defaultValue={selectedCoupon?.minPurchase} required /></div>
                  <div className="form-group"><label>Max Usage</label><input name="maxUsage" type="number" defaultValue={selectedCoupon?.maxUsage} required /></div>
                </div>
                <div className="form-group"><label>Expiry Date</label><input name="expiry" type="date" defaultValue={selectedCoupon?.expiry} required /></div>
                <div className="form-actions">
                  <button type="button" className="btn-secondary" onClick={() => { setShowAddCouponModal(false); setShowEditCouponModal(false) }}>Cancel</button>
                  <button type="submit" className="btn-primary">{showAddCouponModal ? 'Add Coupon' : 'Update Coupon'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

export default ReportsCouponsSettings
