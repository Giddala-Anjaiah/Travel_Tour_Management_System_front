const API_HOST = import.meta.env.VITE_API_URL || 'http://localhost:5000'
export const API_BASE = `${API_HOST}/api`

export async function api(path, options = {}) {
  const token = localStorage.getItem('token')
  const { headers, ...rest } = options
  const response = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers
    }
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.message || 'Request failed')
  }
  return data
}

export function formValues(form) {
  return Object.fromEntries(new FormData(form).entries())
}

export function downloadCsv(filename, headers, rows) {
  const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`
  const csv = [headers.map(escape).join(','), ...rows.map((row) => row.map(escape).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function formatCurrency(amount) {
  const value = Number(amount) || 0
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`
  if (value >= 1000) return `₹${(value / 1000).toFixed(0)}K`
  return `₹${value.toLocaleString()}`
}

export function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toISOString().split('T')[0]
}
