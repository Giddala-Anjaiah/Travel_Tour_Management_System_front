import {
  CheckCircle,
  AlertCircle,
  Award,
  Star,
  Shield,
  Clock,
  CalendarClock,
  AlertTriangle,
  Megaphone
} from 'lucide-react'

// Single source of truth for how each alert type is labelled and rendered.
// Used by the header bell, the trip-alert feed and the notification tabs.
export const NOTIFICATION_TYPE_META = {
  booking: { label: 'Booking', color: '#22c55e', Icon: CheckCircle },
  payment: { label: 'Payment', color: '#f59e0b', Icon: AlertCircle },
  offer: { label: 'Offer', color: '#8b5cf6', Icon: Award },
  review: { label: 'Review', color: '#0ea5e9', Icon: Star },
  system: { label: 'System', color: '#64748b', Icon: Shield },
  availability: { label: 'Availability', color: '#06b6d4', Icon: Clock },
  itinerary_change: { label: 'Itinerary change', color: '#f97316', Icon: CalendarClock },
  departure_reminder: { label: 'Departure reminder', color: '#eab308', Icon: Clock },
  disruption: { label: 'Disruption', color: '#ef4444', Icon: AlertTriangle }
}

export const FALLBACK_TYPE_META = { label: 'Alert', color: '#64748b', Icon: Megaphone }

export const TRIP_ALERT_TYPES = [
  'booking',
  'payment',
  'itinerary_change',
  'departure_reminder',
  'disruption'
]

export const NOTIFICATION_TYPES = Object.keys(NOTIFICATION_TYPE_META)

export function getTypeMeta(type) {
  return NOTIFICATION_TYPE_META[type] || FALLBACK_TYPE_META
}

export function getTypeColor(type) {
  return getTypeMeta(type).color
}

export const SEVERITY_META = {
  info: { label: 'Info', color: '#0ea5e9' },
  warning: { label: 'Warning', color: '#f59e0b' },
  critical: { label: 'Critical', color: '#ef4444' }
}

export function getSeverityMeta(severity) {
  return SEVERITY_META[severity] || SEVERITY_META.info
}
