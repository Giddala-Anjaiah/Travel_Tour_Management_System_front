import { useState, useRef, useEffect } from 'react'
import { MessageSquare, X, Send, Plane, IndianRupee, Hotel, Map, Calendar, Loader2 } from 'lucide-react'
import { api } from '../api'
import './Chatbot.css'

const QUICK_PROMPTS = [
  { icon: Plane, label: 'Plan my trip', message: 'Help me plan a trip based on my preferences' },
  { icon: IndianRupee, label: 'Budget packages', message: 'Show me budget-friendly packages' },
  { icon: Hotel, label: 'Recommend hotels', message: 'Recommend hotels for my next trip' },
  { icon: Map, label: 'Suggest destinations', message: 'Suggest destinations for my next vacation' },
  { icon: Calendar, label: 'Create itinerary', message: 'Create an itinerary for me' }
]

export default function Chatbot() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Hi! I am your personalized travel assistant. How can I help you plan your next trip?'
    }
  ])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const listRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages, open])

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus()
  }, [open])

  const send = async (text) => {
    const trimmed = text.trim()
    if (!trimmed || sending) return
    setError('')
    const userMsg = { id: crypto.randomUUID(), role: 'user', text: trimmed }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setSending(true)

    try {
      const data = await api('/customer/chat', {
        method: 'POST',
        body: JSON.stringify({ message: trimmed })
      })
      const reply = data?.reply || 'I could not process that right now. Please try again.'
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'assistant', text: reply }])
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', text: 'Sorry, I am having trouble connecting right now. Please try again.' }
      ])
    } finally {
      setSending(false)
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  return (
    <div className="chatbot">
      {open && (
        <div className="chatbot-panel">
          <div className="chatbot-header">
            <div className="chatbot-header-left">
              <span className="chatbot-avatar">
                <Plane className="h-5 w-5" />
              </span>
              <div>
                <h3>Travel Assistant</h3>
                <p>Your Personalized AI Travel Guide</p>
              </div>
            </div>
            <button className="chatbot-close" onClick={() => setOpen(false)} aria-label="Close chat">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="chatbot-messages" ref={listRef}>
            {messages.map((m) => (
              <div key={m.id} className={`chatbot-msg chatbot-msg--${m.role}`}>
                {m.role === 'assistant' && (
                  <span className="chatbot-avatar-sm">
                    <Plane className="h-4 w-4" />
                  </span>
                )}
                <div className="chatbot-bubble">{m.text}</div>
              </div>
            ))}
            {sending && (
              <div className="chatbot-msg chatbot-msg--assistant">
                <span className="chatbot-avatar-sm">
                  <Plane className="h-4 w-4" />
                </span>
                <div className="chatbot-bubble chatbot-bubble--typing">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Thinking...</span>
                </div>
              </div>
            )}
            {error && <div className="chatbot-error">{error}</div>}
          </div>

          {messages.length === 1 && (
            <div className="chatbot-quick-prompts">
              {QUICK_PROMPTS.map((q) => {
                const Icon = q.icon
                return (
                  <button key={q.label} className="chatbot-chip" onClick={() => send(q.message)}>
                    <Icon className="h-4 w-4" />
                    <span>{q.label}</span>
                  </button>
                )
              })}
            </div>
          )}

          <div className="chatbot-footer">
            <input
              ref={inputRef}
              type="text"
              className="chatbot-input"
              placeholder="Ask me anything about travel..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              disabled={sending}
            />
            <button
              className="chatbot-send"
              onClick={() => send(input)}
              disabled={sending || !input.trim()}
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <button className="chatbot-fab" onClick={() => setOpen((v) => !v)} aria-label="Open travel assistant">
        {open ? <X className="h-6 w-6" /> : <MessageSquare className="h-6 w-6" />}
      </button>
    </div>
  )
}
