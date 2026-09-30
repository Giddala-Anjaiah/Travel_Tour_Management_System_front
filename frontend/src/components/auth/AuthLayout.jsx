import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plane, ArrowLeft } from 'lucide-react'
import ThemeToggle from '../ThemeToggle'

export default function AuthLayout({
  badge,
  heading,
  description,
  features,
  children,
  headingBefore,
  backLabel = 'Back to Home',
  backTo = '/',
}) {
  // Hide the app-level floating theme toggle while an auth layout is mounted,
  // so the header toggle is the only one visible on these pages.
  useEffect(() => {
    document.body.classList.add('auth-route')
    return () => document.body.classList.remove('auth-route')
  }, [])

  return (
    <div className="auth-shell">
      <header className="auth-topbar">
        <div className="auth-topbar-inner">
          <Link to="/" className="auth-brand">
            <span className="auth-brand-mark" aria-hidden="true">
              <Plane className="h-5 w-5" />
            </span>
            <span className="auth-brand-text">
              <span className="auth-brand-name">Travel Around Us</span>
              <span className="auth-brand-sub">Travel &amp; Tour Management System</span>
            </span>
          </Link>

          <div className="auth-topbar-actions">
            <ThemeToggle className="auth-theme-toggle" />
            <Link to={backTo} className="auth-home-btn">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {backLabel}
            </Link>
          </div>
        </div>
      </header>

      <main className="auth-main">
        <section className="auth-intro">
          <span className="auth-badge">{badge}</span>
          {headingBefore && <h1 className="auth-intro-title auth-intro-title--sm">{headingBefore}</h1>}
          <h1 className="auth-intro-title">{heading}</h1>
          {description && <p className="auth-intro-text">{description}</p>}

          <ul className="auth-features">
            {features.map((feature) => (
              <li key={feature.title} className="auth-feature">
                <span className="auth-feature-icon" aria-hidden="true">
                  <feature.icon className="h-5 w-5" />
                </span>
                <span className="auth-feature-body">
                  <span className="auth-feature-title">{feature.title}</span>
                  <span className="auth-feature-text">{feature.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="auth-panel">
          <div className="auth-card">{children}</div>
        </section>
      </main>
    </div>
  )
}
