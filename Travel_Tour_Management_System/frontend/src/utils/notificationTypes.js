import { Ticket, CreditCard, Star, Bell, Gift, MapPin, Calendar, AlertTriangle, ShieldCheck } from 'lucide-react'

const TYPE_META = {
  booking: { label: 'Booking', Icon: Ticket, color: '#2563eb' },
  payment: { label: 'Payment', Icon: CreditCard, color: '#059669' },
  review: { label: 'Review', Icon: Star, color: '#7c3aed' },
  system: { label: 'System', Icon: Bell, color: '#6b7280' },
  offer: { label: 'Offer', Icon: Gift, color: '#d97706' },
  availability: { label: 'Availability', Icon: MapPin, color: '#0891b2' },
  itinerary_change: { label: 'Itinerary Change', Icon: Calendar, color: '#b45309' },
  departure_reminder: { label: 'Departure Reminder', Icon: Calendar, color: '#1d4ed8' },
  disruption: { label: 'Disruption', Icon: AlertTriangle, color: '#dc2626' },
  ticket_reply: { label: 'Ticket Reply', Icon: ShieldCheck, color: '#db2777' }
}

const SEVERITY_META = {
  info: { label: 'Info', color: '#6b7280' },
  warning: { label: 'Warning', color: '#d97706' },
  critical: { label: 'Critical', color: '#dc2626' }
}

export function getTypeMeta(type) {
  return TYPE_META[type] || { label: type, Icon: Bell, color: '#6b7280' }
}

export function getSeverityMeta(severity) {
  return SEVERITY_META[severity] || { label: 'Info', color: '#6b7280' }
}

export const TRIP_ALERT_TYPES = ['booking', 'payment', 'review', 'system', 'offer', 'availability', 'itinerary_change', 'departure_reminder', 'disruption', 'ticket_reply']
