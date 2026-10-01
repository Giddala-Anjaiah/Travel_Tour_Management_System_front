import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { PAGE_SIZE_OPTIONS } from '../api'
import './Pagination.css'

const PAGE_WINDOW = 1

function pageNumbers(page, totalPages) {
  if (totalPages <= 1) return [1]

  const pages = new Set([1, totalPages])
  for (let offset = -PAGE_WINDOW; offset <= PAGE_WINDOW; offset += 1) {
    const candidate = page + offset
    if (candidate > 1 && candidate < totalPages) pages.add(candidate)
  }
  if (page <= 3) [2, 3, 4].forEach((value) => value < totalPages && pages.add(value))
  if (page >= totalPages - 2) {
    [totalPages - 1, totalPages - 2, totalPages - 3].forEach((value) => value > 1 && pages.add(value))
  }

  const sorted = [...pages].sort((a, b) => a - b)
  const withGaps = []
  sorted.forEach((value, index) => {
    if (index > 0 && value - sorted[index - 1] > 1) withGaps.push('gap')
    withGaps.push(value)
  })
  return withGaps
}

const Pagination = ({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
  onLimitChange,
  itemLabel = 'records',
  disabled = false
}) => {
  const currentPage = Math.min(Math.max(Number(page) || 1, 1), Math.max(totalPages, 1))
  const showControls = totalPages > 1 || Boolean(onLimitChange)
  if (!showControls) return null

  const firstRow = limit > 0 ? (currentPage - 1) * limit + 1 : 0
  const lastRow = limit > 0 ? Math.min(currentPage * limit, total) : total

  return (
    <nav className="pagination" aria-label="Pagination">
      <div className="pagination-summary">
        {limit > 0 && total > 0 ? (
          <span>
            Showing <strong>{firstRow}</strong>–<strong>{lastRow}</strong> of <strong>{total}</strong> {itemLabel}
          </span>
        ) : (
          <span>
            <strong>{total}</strong> {itemLabel}
          </span>
        )}

        {onLimitChange ? (
          <label className="pagination-limit">
            <span>Per page</span>
            <select
              className="pagination-select"
              value={limit}
              disabled={disabled}
              onChange={(event) => onLimitChange(Number(event.target.value))}
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {totalPages > 1 ? (
        <div className="pagination-controls">
          <button
            type="button"
            className="pagination-btn pagination-btn--edge"
            onClick={() => onPageChange(1)}
            disabled={disabled || currentPage === 1}
            aria-label="First page"
          >
            <ChevronsLeft className="pagination-icon" aria-hidden="true" />
          </button>

          <button
            type="button"
            className="pagination-btn pagination-btn--nav"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={disabled || currentPage === 1}
            aria-label="Previous page"
          >
            <ChevronLeft className="pagination-icon" aria-hidden="true" />
            <span className="pagination-btn-text">Previous</span>
          </button>

          {pageNumbers(currentPage, totalPages).map((value, index) =>
            value === 'gap' ? (
              <span key={`gap-${index}`} className="pagination-gap" aria-hidden="true">
                …
              </span>
            ) : (
              <button
                key={value}
                type="button"
                className={`pagination-btn ${value === currentPage ? 'pagination-btn--active' : ''}`.trim()}
                onClick={() => onPageChange(value)}
                disabled={disabled}
                aria-current={value === currentPage ? 'page' : undefined}
              >
                {value}
              </button>
            )
          )}

          <button
            type="button"
            className="pagination-btn pagination-btn--nav"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={disabled || currentPage === totalPages}
            aria-label="Next page"
          >
            <span className="pagination-btn-text">Next</span>
            <ChevronRight className="pagination-icon" aria-hidden="true" />
          </button>

          <button
            type="button"
            className="pagination-btn pagination-btn--edge"
            onClick={() => onPageChange(totalPages)}
            disabled={disabled || currentPage === totalPages}
            aria-label="Last page"
          >
            <ChevronsRight className="pagination-icon" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </nav>
  )
}

export default Pagination
