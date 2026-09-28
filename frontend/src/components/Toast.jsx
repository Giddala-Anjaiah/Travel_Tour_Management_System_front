import { useEffect, useState } from 'react'
import './Toast.css'

const ToastContainer = () => {
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    const handleShow = (e) => {
      const { id, message, type, duration } = e.detail
      setToasts((prev) => [...prev, { id, message, type }])
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, duration)
    }
    const handleHide = (e) => {
      setToasts((prev) => prev.filter((t) => t.id !== e.detail.id))
    }
    window.addEventListener('toast-show', handleShow)
    window.addEventListener('toast-hide', handleHide)
    return () => {
      window.removeEventListener('toast-show', handleShow)
      window.removeEventListener('toast-hide', handleHide)
    }
  }, [])

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          {toast.message}
        </div>
      ))}
    </div>
  )
}

export default ToastContainer
