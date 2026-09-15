import React from 'react'
import { MapPin, Calendar, Users, CreditCard, BarChart3, Star, ArrowRight, Plane, CheckCircle, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import './index.css'
import Footer from './Footer'

function App() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const features = [
    { icon: MapPin, title: 'Tour Package Management', description: 'Create and manage comprehensive tour packages with ease' },
    { icon: Calendar, title: 'Booking Management', description: 'Handle bookings efficiently with real-time availability' },
    { icon: Users, title: 'Customer Management', description: 'Manage customer profiles and preferences seamlessly' },
    { icon: Plane, title: 'Itinerary Management', description: 'Plan detailed itineraries for every trip' },
    { icon: CreditCard, title: 'Payment Management', description: 'Secure payment processing and financial tracking' },
    { icon: BarChart3, title: 'Travel Analytics', description: 'Gain insights with comprehensive travel analytics' },
    { icon: Star, title: 'Reviews and Ratings', description: 'Collect and manage customer feedback' }
  ]

  const steps = [
    { step: 'Create Package', icon: MapPin },
    { step: 'Customer Books', icon: Calendar },
    { step: 'Payment', icon: CreditCard },
    { step: 'Plan Itinerary', icon: Plane },
    { step: 'Travel', icon: Users },
    { step: 'Complete Trip', icon: CheckCircle },
    { step: 'Review', icon: Star }
  ]

  return (
    <div>
      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-content">
          <div className="logo">
            <Plane className="h-8 w-8" style={{ color: '#4f46e5' }} />
            <span className="logo-text">Travel Around Us</span>
          </div>
          
          {/* Desktop Menu */}
          <div className="nav-links">
            <a href="#">Home</a>
            <a href="#features">Features</a>
            <a href="#about">About Us</a>
            
            <a href="#prices">Prices</a>
            <a href="#contact">Contact</a>
            <a href="#how-it-works">How It Works</a>
            <div className="nav-buttons">
              <Link to="/login" className="btn-login">Login</Link>
              <Link to="/signup" className="btn-signup">Sign Up</Link>
            </div>
          </div>

          {/* Mobile Menu Button */}
          <button 
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className={`mobile-menu ${mobileMenuOpen ? 'active' : ''}`}>
            <a href="#">Home</a>
            <a href="#features">Features</a>
            <a href="#about">About Us</a>
            
            <a href="#prices">Prices</a>
            <a href="#contact">Contact</a>
            <a href="#how-it-works">How It Works</a>
            <Link to="/login" className="btn-login">Login</Link>
            <Link to="/signup" className="btn-signup">Sign Up</Link>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <h1>Plan Journeys, <span>Create Memories</span></h1>
          <p>Create Tour Packages. Manage bookings, customers, itineraries, payments and travel operations, with ease.</p>
          <div className="hero-buttons">
            <Link to="/login" className="btn-primary">
              Get Started <ArrowRight className="h-5 w-5" />
            </Link>
           
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="features">
        <div className="features-content">
          <div className="features-header">
            <h2>Key Features</h2>
            <p>Everything you need to manage your travel business efficiently</p>
          </div>
          
          <div className="features-grid">
            {features.map((feature, index) => (
              <div key={index} className="feature-card">
                <div className="feature-icon">
                  <feature.icon className="h-7 w-7" />
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About Us Section */}
      <section id="about" className="about">
        <div className="about-content">
          <div className="about-header">
            <h2>About Us</h2>
            <p>Making Every Journey Simple, From Planning to Booking</p>
          </div>
          
          <div className="about-grid">
            <div className="about-text">
              <h3>Our Mission</h3>
              <p>To simplify travel management for businesses of all sizes by providing intuitive tools that streamline operations, enhance customer experiences, and drive growth.</p>
              
              <h3>Our Vision</h3>
              <p>To become the world's leading travel management platform, empowering travel companies to deliver exceptional experiences to millions of travelers worldwide.</p>
              
              <h3>Why Choose Us</h3>
              <ul>
                <li> Explore with Ease — Discover destinations and tour packages in one place.</li>
                <li> Easy Hotel Booking — Find hotels, rooms, and availability without the hassle.</li>
                <li> Simple Travel Management — Manage itineraries, bookings, and customer details efficiently.</li>
                <li> Secure Payments — Complete bookings through a smooth and reliable payment process.</li>
                <li> Digital Invoices — Access booking details and invoices whenever you need them.</li>
                <li> Real Experiences — Share reviews and help other travelers make better choices.</li>
              </ul>
            </div>
            <div className="about-stats">
              <div className="stat-item">
                <img src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400&h=300&fit=crop" alt="Happy Clients" className="stat-image" />
                <div className="stat-content">
                  <span className="stat-number">5000+</span>
                  <span className="stat-label">Happy Clients</span>
                </div>
              </div>
              <div className="stat-item">
                <img src="https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=400&h=300&fit=crop" alt="Bookings Managed" className="stat-image" />
                <div className="stat-content">
                  <span className="stat-number">1M+</span>
                  <span className="stat-label">Bookings Managed</span>
                </div>
              </div>
              <div className="stat-item">
                <img src="https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=400&h=300&fit=crop" alt="Cities" className="stat-image" />
                <div className="stat-content">
                  <span className="stat-number">500+</span>
                  <span className="stat-label">Cities</span>
                </div>
              </div>
              <div className="stat-item">
                <img src="https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=400&h=300&fit=crop" alt="Satisfaction Rate" className="stat-image" />
                <div className="stat-content">
                  <span className="stat-number">99%</span>
                  <span className="stat-label">Satisfaction Rate</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Prices Section */}
      <section id="prices" className="prices">
        <div className="prices-content">
          <div className="prices-header">
            <h2>Tour Packages</h2>
            <p>Explore our amazing destinations with seasonal pricing</p>
          </div>
          
          <div className="pricing-grid">
            <div className="pricing-card">
              <div className="pricing-header">
                <h3>Goa Beach Paradise</h3>
                <div className="price">
                  <span className="price-amount">₹15,999</span>
                  <span className="price-period">/person</span>
                </div>
                <p>3 Days 2 Nights • Summer Special</p>
              </div>
              <ul className="pricing-features">
                <li>Beachside resort accommodation</li>
                <li>Daily breakfast & dinner</li>
                <li>Water sports activities</li>
                <li>Sightseeing tours</li>
                <li>Airport transfers</li>
                <li>Travel insurance included</li>
              </ul>
              <button className="pricing-btn">Book Now</button>
            </div>
            
            <div className="pricing-card popular">
              <div className="popular-badge">Best Seller</div>
              <div className="pricing-header">
                <h3>Kerala Backwaters</h3>
                <div className="price">
                  <span className="price-amount">₹24,999</span>
                  <span className="price-period">/person</span>
                </div>
                <p>5 Days 4 Nights • Monsoon Magic</p>
              </div>
              <ul className="pricing-features">
                <li>Houseboat stay experience</li>
                <li>All meals included</li>
                <li>Ayurvedic spa treatment</li>
                <li>Tea garden visits</li>
                <li>Private boat tours</li>
                <li>Professional guide</li>
              </ul>
              <button className="pricing-btn">Book Now</button>
            </div>
            
            <div className="pricing-card">
              <div className="pricing-header">
                <h3>Himalayan Adventure</h3>
                <div className="price">
                  <span className="price-amount">₹35,999</span>
                  <span className="price-period">/person</span>
                </div>
                <p>7 Days 6 Nights • Winter Wonder</p>
              </div>
              <ul className="pricing-features">
                <li>Mountain resort stay</li>
                <li>All meals & hot beverages</li>
                <li>Trekking expeditions</li>
                <li>Skiing adventures</li>
                <li>Bonfire nights</li>
                <li>Emergency rescue support</li>
              </ul>
              <button className="pricing-btn">Book Now</button>
            </div>

            <div className="pricing-card">
              <div className="pricing-header">
                <h3>Rajasthan Royal Tour</h3>
                <div className="price">
                  <span className="price-amount">₹28,999</span>
                  <span className="price-period">/person</span>
                </div>
                <p>6 Days 5 Nights • Winter Special</p>
              </div>
              <ul className="pricing-features">
                <li>Heritage hotel stays</li>
                <li>Traditional Rajasthani meals</li>
                <li>Fort & palace tours</li>
                <li>Camel safari experience</li>
                <li>Cultural dance shows</li>
                <li>Photography guide</li>
              </ul>
              <button className="pricing-btn">Book Now</button>
            </div>

            <div className="pricing-card popular">
              <div className="popular-badge">Trending</div>
              <div className="pricing-header">
                <h3>Andaman Islands</h3>
                <div className="price">
                  <span className="price-amount">₹32,999</span>
                  <span className="price-period">/person</span>
                </div>
                <p>5 Days 4 Nights • Summer Escape</p>
              </div>
              <ul className="pricing-features">
                <li>Beachfront cottages</li>
                <li>Seafood cuisine</li>
                <li>Scuba diving sessions</li>
                <li>Island hopping tours</li>
                <li>Sunset cruises</li>
                <li>Snorkeling gear provided</li>
              </ul>
              <button className="pricing-btn">Book Now</button>
            </div>

            <div className="pricing-card">
              <div className="pricing-header">
                <h3>Golden Temple Trip</h3>
                <div className="price">
                  <span className="price-amount">₹12,999</span>
                  <span className="price-period">/person</span>
                </div>
                <p>3 Days 2 Nights • All Season</p>
              </div>
              <ul className="pricing-features">
                <li>Hotel near Golden Temple</li>
                <li>Langar meals included</li>
                <li>Heritage walk tours</li>
                <li>Wagah Border visit</li>
                <li>Jallianwala Bagh tour</li>
                <li>Local transportation</li>
              </ul>
              <button className="pricing-btn">Book Now</button>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="contact">
        <div className="contact-content">
          <div className="contact-header">
            <h2>Contact Us</h2>
            <p>Get in touch with our team for any questions</p>
          </div>
          
          <div className="contact-grid">
            <div className="contact-info">
              <div className="contact-item">
                <h3>Email</h3>
                <p>tourmanager@gmail.com</p>
              </div>
              <div className="contact-item">
                <h3>Phone</h3>
                
                <p>+91 9876543210</p>
              </div>
              <div className="contact-item">
                <h3>Address</h3>
                <p>Travel Street, Suite 100<br />Narasaraopeta, India </p>
              </div>
              <div className="contact-item">
                <h3>Business Hours</h3>
                <p>Monday - Friday: 9AM - 6PM<br />Saturday: 10AM - 4PM</p>
              </div>
            </div>
            
            <form className="contact-form">
              <div className="form-group">
                <label>Name</label>
                <input type="text" placeholder="Your name" />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" placeholder="your@email.com" />
              </div>
              <div className="form-group">
                <label>Subject</label>
                <input type="text" placeholder="How can we help?" />
              </div>
              <div className="form-group">
                <label>Message</label>
                <textarea rows="5" placeholder="Tell us more about your needs..."></textarea>
              </div>
              <button type="submit" className="submit-btn">Send Message</button>
            </form>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="how-it-works">
        <div className="how-it-works-content">
          <div className="how-it-works-header">
            <h2>How It Works</h2>
            <p>Simple steps to manage your travel operations</p>
          </div>
          
          <div className="steps-container">
            {steps.map((step, index) => (
              <React.Fragment key={index}>
                <div className="step-item">
                  <div className="step-icon">
                    <step.icon className="h-6 w-6" />
                  </div>
                  <span className="step-label">{step.step}</span>
                </div>
                {index < steps.length - 1 && (
                  <span className="step-arrow">→</span>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta">
        <div className="cta-content">
          <h2>Ready to explore Your Dream Destination ?</h2>
          <p>Join thousands of travellers using  our TourManager platform to achieve their dream Destinations</p>
          <Link to="/signup"><button>Start Free Trial</button></Link>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  )
}

export default App
