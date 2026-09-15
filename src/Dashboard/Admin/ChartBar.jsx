import { BarChart3, PieChart } from 'lucide-react'
import { formatCurrency } from '../../api'

const ChartBar = ({ type, data, title, height = 160 }) => {
  const isEmpty = Array.isArray(data)
    ? data.length === 0
    : data === null || data === undefined || Object.keys(data).length === 0
  if (!data || isEmpty) {
    return (
      <div className="chart-placeholder-simple">
        <BarChart3 className="chart-icon-simple" />
        <p>No data available</p>
      </div>
    )
  }

  if (type === 'bar') return renderBarChart(data, title, height)
  if (type === 'pie') return renderPieChart(data, title, height)
  if (type === 'line') return renderLineChart(data, title, height)
  return renderBarChart(data, title, height)
}

function renderBarChart(data, title) {
  const max = Math.max(...data.map(d => typeof d === 'number' ? d : (d.value ?? d)), 1)
  const barHeight = 28
  const barGap = 12
  const labelWidth = 100
  const valueWidth = 70
  const chartWidth = 280
  const totalHeight = data.length * (barHeight + barGap) + 24
  const color = '#4f46e5'

  return (
    <div className="chart-wrapper">
      {title && <h4 className="chart-title">{title}</h4>}
      <svg
        width="100%"
        height={totalHeight}
        viewBox={`0 0 ${labelWidth + chartWidth + valueWidth + 20} ${totalHeight}`}
        className="bar-chart-svg"
      >
        {data.map((item, i) => {
          const value = typeof item === 'number' ? item : (item.value ?? item)
          const barWidth = max > 0 ? (value / max) * chartWidth : 0
          const y = i * (barHeight + barGap) + 12
          return (
            <g key={i}>
              <text
                x={labelWidth - 8}
                y={y + barHeight / 2 + 5}
                textAnchor="end"
                fontSize="11"
                fill="#64748b"
              >
                {item.label || item.name || item.month || item._id || ''}
              </text>
              <rect
                x={labelWidth}
                y={y}
                width={barWidth}
                height={barHeight}
                rx="3"
                fill={color}
                opacity="0.85"
                className="bar-rect"
              />
              <text
                x={labelWidth + chartWidth + 12}
                y={y + barHeight / 2 + 5}
                fontSize="11"
                fontWeight="600"
                fill="#1e293b"
              >
                {item.format === 'currency' ? formatCurrency(value) : value}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function renderPieChart(data, title) {
  const entries = Object.entries(data).filter(([, v]) => v > 0)
  if (entries.length === 0) {
    return (
      <div className="chart-placeholder-simple">
        <PieChart className="chart-icon-simple" />
        <p>No data to display</p>
      </div>
    )
  }

  const total = entries.reduce((sum, [, v]) => sum + v, 0)
  const radius = 65
  const centerX = 90
  const centerY = 80
  let offset = 0
  const colors = ['#4f46e5', '#7c3aed', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6', '#3b82f6']

  return (
    <div className="chart-wrapper">
      {title && <h4 className="chart-title">{title}</h4>}
      <svg width="100%" height="180" viewBox="0 0 180 180" className="pie-chart-svg">
        {entries.map(([key, value], i) => {
          const percentage = (value / total) * 100
          const angle = Math.min((value / total) * 360, 359.99)
          const startAngle = (offset / 180) * Math.PI
          const endAngle = ((offset + angle) / 180) * Math.PI
          const x1 = centerX + radius * Math.cos(startAngle)
          const y1 = centerY + radius * Math.sin(startAngle)
          const x2 = centerX + radius * Math.cos(endAngle)
          const y2 = centerY + radius * Math.sin(endAngle)
          const largeArc = angle > 180 ? 1 : 0
          const path = `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`
          offset += angle
          return (
            <g key={key}>
              <path d={path} fill={colors[i % colors.length]} opacity="0.85" />
              {percentage > 8 && (
                <text
                  x={centerX + (radius * 0.6) * Math.cos(startAngle + angle * Math.PI / 360)}
                  y={centerY + (radius * 0.6) * Math.sin(startAngle + angle * Math.PI / 360)}
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="600"
                  fill="white"
                >
                  {percentage.toFixed(0)}%
                </text>
              )}
            </g>
          )
        })}
        <text x={centerX} y={centerY + radius + 24} textAnchor="middle" fontSize="12" fontWeight="600" fill="#1e293b">
          Total: {total}
        </text>
      </svg>
      <div className="pie-legend">
        {entries.map(([key, value], i) => (
          <div key={key} className="legend-item">
            <span className="legend-color" style={{ background: colors[i % colors.length] }} />
            <span>{key.replace('_', ' ')}</span>
            <span className="legend-value">{value} ({(value / total * 100).toFixed(1)}%)</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function renderLineChart(data, title, height) {
  const values = data.map(d => typeof d === 'number' ? d : (d.value ?? d))
  const maxValue = Math.max(...values, 1)
  const chartHeight = height
  const chartWidth = 400
  const padding = { top: 20, right: 20, bottom: 36, left: 40 }
  const innerWidth = chartWidth - padding.left - padding.right
  const innerHeight = chartHeight - padding.top - padding.bottom
  const pointGap = innerWidth / (data.length - 1 || 1)

  const points = data.map((d, i) => {
    const value = typeof d === 'number' ? d : (d.value ?? d)
    return {
      x: padding.left + i * pointGap,
      y: padding.top + innerHeight - (value / maxValue) * innerHeight,
      value
    }
  })

  return (
    <div className="chart-wrapper">
      {title && <h4 className="chart-title">{title}</h4>}
      <svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="line-chart-svg">
        <line x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top + innerHeight} stroke="#e2e8f0" strokeWidth="1" />
        <line x1={padding.left} y1={padding.top + innerHeight} x2={padding.left + innerWidth} y2={padding.top + innerHeight} stroke="#e2e8f0" strokeWidth="1" />
        {points.map((p, i) => (
          <line key={i} x1={p.x} y1={padding.top + innerHeight} x2={p.x} y2={padding.top + innerHeight + 4} stroke="#cbd5e1" strokeWidth="1" />
        ))}
        <polyline
          points={points.map(p => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke="#4f46e5"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="line-path"
        />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="4" fill="#4f46e5" opacity="0.7" />
        ))}
        {points.map((p, i) => (
          <text key={i} x={p.x} y={p.y - 8} textAnchor="middle" fontSize="9" fill="#64748b">
            {p.value > 0 ? (typeof p.value === 'number' && p.value >= 1000 ? formatCurrency(p.value) : p.value) : ''}
          </text>
        ))}
        {data.map((d, i) => (
          <text key={i} x={points[i].x} y={padding.top + innerHeight + 16} textAnchor="middle" fontSize="10" fill="#94a3b8">
            {d.label || ''}
          </text>
        ))}
      </svg>
    </div>
  )
}

export default ChartBar