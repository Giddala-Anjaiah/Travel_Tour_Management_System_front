const API_HOST = import.meta.env.VITE_API_URL || 'http://localhost:5000'
export const API_BASE = `${API_HOST}/api`

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

export function buildQuery(params = {}) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    search.set(key, String(value))
  })
  const query = search.toString()
  return query ? `?${query}` : ''
}

export async function api(path, options = {}) {
  const token = localStorage.getItem('token')
  const { headers, params, ...rest } = options
  const response = await fetch(`${API_BASE}${path}${buildQuery(params)}`, {
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

// Reads the pagination envelope the API returns and falls back to sane values
// when a route has not been paginated yet.
export function readPagination(data, itemCount = 0) {
  const meta = data?.pagination || {}
  const total = Number(meta.total ?? data?.count ?? itemCount) || 0
  const limit = Number(meta.limit) || 0
  const totalPages = Number(meta.totalPages) || (limit > 0 ? Math.max(1, Math.ceil(total / limit)) : 1)
  return {
    page: Number(meta.page) || 1,
    limit,
    total,
    totalPages,
    hasNext: meta.hasNext ?? (limit > 0 && Number(meta.page) * limit < total),
    hasPrev: meta.hasPrev ?? Number(meta.page) > 1,
    all: Boolean(meta.all)
  }
}

// Walks every page of a list endpoint so CSV export covers the whole dataset,
// not just the rows currently rendered.
export async function fetchAllPages(path, { params = {}, limit = 100, key, maxPages = 50 } = {}) {
  const rows = []
  let page = 1
  let total = Infinity

  while (page <= maxPages && rows.length < total) {
    const data = await api(path, { params: { ...params, page, limit } })
    const items = key ? data?.[key] : Object.values(data || {}).find(Array.isArray)
    if (!Array.isArray(items) || items.length === 0) break
    rows.push(...items)
    total = Number(data?.pagination?.total ?? rows.length)
    if (items.length < limit) break
    page += 1
  }

  return rows
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
