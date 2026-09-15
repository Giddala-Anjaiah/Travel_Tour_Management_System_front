import { API_BASE } from '../../api'
import { useState, useEffect } from 'react'
import usePolling from '../../hooks/usePolling'
import { Star, Search, MessageSquare, Send, Award } from 'lucide-react'
import '../Dashboard.css'

const OperatorReviews = () => {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRating, setFilterRating] = useState('all')
  const [selectedReview, setSelectedReview] = useState(null)
  const [responseText, setResponseText] = useState('')

  const fetchReviews = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(API_BASE + '/operator/reviews', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const data = await response.json()
      if (data.reviews) {
        setReviews(data.reviews)
      }
    } catch (error) {
      console.error('Error fetching reviews:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    Promise.resolve().then(() => fetchReviews())
  }, [])

  usePolling(fetchReviews, 15000)

  const handleResponse = async (reviewId) => {
    if (!responseText.trim()) {
      alert('Please enter a response')
      return
    }
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE}/operator/reviews/${reviewId}/respond`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ response: responseText })
      })
      if (response.ok) {
        alert('Response added successfully')
        setResponseText('')
        setSelectedReview(null)
        fetchReviews()
      } else {
        alert('Error adding response')
      }
    } catch (error) {
      console.error('Error adding response:', error)
      alert('Error adding response')
    }
  }

  const filteredReviews = reviews.filter(review => {
    const matchesSearch = review.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         review.package.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRating = filterRating === 'all' || review.rating === parseInt(filterRating)
    return matchesSearch && matchesRating
  })

  const renderStars = (rating) => {
    return Array(5).fill(0).map((_, i) => (
      <Star key={i} className={`h-4 w-4 ${i < rating ? 'fill' : ''}`} />
    ))
  }

  const ratingStats = {
    total: reviews.length,
    average: reviews.length > 0 ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1) : 0,
    distribution: [5, 4, 3, 2, 1].map(star => ({
      star,
      count: reviews.filter(r => r.rating === star).length
    }))
  }

  return (
    <>
          <div className="rating-overview enhanced">
            <div className="rating-summary">
              <div className="average-rating">
                <h2>{ratingStats.average}</h2>
                <div className="stars">{renderStars(Math.round(ratingStats.average))}</div>
                <small>out of 5</small>
              </div>
              <div className="rating-distribution">
                {ratingStats.distribution.map(({ star, count }) => (
                  <div key={star} className="rating-bar">
                    <span>{star}★</span>
                    <div className="bar-container">
                      <div 
                        className="bar-fill" 
                        style={{ width: `${ratingStats.total > 0 ? (count / ratingStats.total) * 100 : 0}%` }}
                      />
                    </div>
                    <span>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="filters-section enhanced">
            <div className="search-bar enhanced">
              <Search className="search-icon" />
              <input
                type="text"
                placeholder="Search reviews..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="filter-controls enhanced">
              <div className="filter-group">
                <label>Rating</label>
                <select
                  value={filterRating}
                  onChange={(e) => setFilterRating(e.target.value)}
                  className="filter-select"
                >
                  <option value="all">All Ratings</option>
                  <option value="5">5 Stars</option>
                  <option value="4">4 Stars</option>
                  <option value="3">3 Stars</option>
                  <option value="2">2 Stars</option>
                  <option value="1">1 Star</option>
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="loading-state">Loading reviews...</div>
          ) : filteredReviews.length === 0 ? (
            <div className="empty-state">
              <Star className="h-12 w-12" />
              <h3>No reviews found</h3>
              <p>Reviews will appear here when customers review your packages</p>
            </div>
          ) : (
            <div className="reviews-list enhanced">
              {filteredReviews.map(review => (
                <div key={review._id} className="review-card enhanced">
                  <div className="review-header">
                    <div className="reviewer-info">
                      <div className="reviewer-avatar">
                        {review.customer.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4>{review.customer}</h4>
                        <small>{new Date(review.date).toLocaleDateString()}</small>
                      </div>
                    </div>
                    <div className="review-rating">
                      {renderStars(review.rating)}
                    </div>
                  </div>
                  <div className="review-package">
                    <Award className="h-4 w-4" />
                    <span>{review.package}</span>
                  </div>
                  <p className="review-comment">{review.comment}</p>
                  {review.response ? (
                    <div className="review-response">
                      <div className="response-header">
                        <MessageSquare className="h-4 w-4" />
                        <span>Your Response</span>
                        <small>{new Date(review.response.date).toLocaleDateString()}</small>
                      </div>
                      <p>{review.response.text}</p>
                    </div>
                  ) : (
                    <div className="review-actions">
                      <button onClick={() => setSelectedReview(review)} className="btn-primary enhanced">
                        <Send className="h-4 w-4" />
                        Respond
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
      {selectedReview && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Respond to Review</h3>
              <button onClick={() => setSelectedReview(null)} className="modal-close">×</button>
            </div>
            <div className="modal-body">
              <div className="review-preview">
                <div className="review-rating">{renderStars(selectedReview.rating)}</div>
                <p>{selectedReview.comment}</p>
                <small>- {selectedReview.customer}</small>
              </div>
              <div className="form-group">
                <label>Your Response</label>
                <textarea
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  rows={4}
                  placeholder="Thank you for your feedback!..."
                />
              </div>
              <div className="form-actions">
                <button onClick={() => setSelectedReview(null)} className="btn-secondary">
                  Cancel
                </button>
                <button onClick={() => handleResponse(selectedReview._id)} className="btn-primary enhanced">
                  <Send className="h-4 w-4" />
                  Send Response
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default OperatorReviews
