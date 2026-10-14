import "./Footer.css";

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-container">

        {/* Brand Section */}
        <div className="footer-brand">
          <div className="footer-logo">
            <span className="logo-icon">✈️</span>
            <span>TourManager</span>
          </div>

          <p>
            Your trusted travel management platform for discovering
            destinations, booking tours and hotels, and managing your
            complete travel experience with ease.
          </p>

          <div className="social-links">
            <a href="#" aria-label="Facebook">f</a>
            <a href="#" aria-label="Instagram">◎</a>
            <a href="#" aria-label="Twitter">𝕏</a>
            <a href="#" aria-label="LinkedIn">in</a>
          </div>
        </div>

        {/* Quick Links */}
        <div className="footer-column">
          <h3>Quick Links</h3>
          <ul>
            <li><a href="#">Home</a></li>
            <li><a href="#features">Features</a></li>
            <li><a href="#about">About Us</a></li>
            <li><a href="#prices">Tour Packages</a></li>
            <li><a href="#contact">Contact Us</a></li>
            <li><a href="#login">Login</a></li>
            <li><a href="#signup">Sign Up</a></li>
          </ul>
        </div>

        {/* Services */}
        <div className="footer-column">
          <h3>Our Services</h3>
          <ul>
            <li><a href="#">Tour Management</a></li>
            <li><a href="#">Booking Management</a></li>
            <li><a href="#">Customer Management</a></li>
            <li><a href="#">Itinerary Management</a></li>
            <li><a href="#">Payment Management</a></li>
            <li><a href="#">Travel Analytics</a></li>
            <li><a href="#">Reviews & Ratings</a></li>
          </ul>
        </div>

        {/* Contact Section */}
        <div className="footer-column footer-contact">
          <h3>Get In Touch</h3>

          <div className="contact-item">
            <span>📍</span>
            <p>Narasaraopeta, India</p>
          </div>

          <div className="contact-item">
            <span>📧</span>
            <p>tourmanager@gmail.com</p>
          </div>

          <div className="contact-item">
            <span>📞</span>
            <p>+91 9876543210</p>
          </div>

          <div className="contact-item">
            <span>🕒</span>
            <p>Mon - Sat: 9:00 AM - 6:00 PM</p>
          </div>
        </div>

      </div>

      {/* Newsletter */}
      <div className="newsletter-section">
        <div className="newsletter-content">
          <div>
            <h3>Ready to Explore the World?</h3>
            <p>
              Subscribe to get the latest travel updates, offers and
              destination ideas.
            </p>
          </div>

          <form className="newsletter-form">
            <input
              type="email"
              placeholder="Enter your email address"
              aria-label="Email address"
            />
            <button type="submit">Subscribe</button>
          </form>
        </div>
      </div>

      {/* Bottom Footer */}
      <div className="footer-bottom">
        <div className="footer-bottom-container">

          <p>
            © 2026 <strong>Travel Around Us</strong>. All Rights Reserved.
          </p>

          <div className="footer-legal">
            <a href="#">Privacy Policy</a>
            <a href="#">Terms & Conditions</a>
            <a href="#">Cookie Policy</a>
          </div>

        </div>
      </div>
    </footer>
  );
};

export default Footer;
