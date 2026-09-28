let toastCounter = 0

export function showToast(message, type = 'success', duration = 3000) {
  toastCounter += 1
  const id = toastCounter
  const event = new CustomEvent('toast-show', { detail: { id, message, type, duration } })
  window.dispatchEvent(event)
  return id
}

export function hideToast(id) {
  const event = new CustomEvent('toast-hide', { detail: { id } })
  window.dispatchEvent(event)
}
