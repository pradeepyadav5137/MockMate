import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LifeBuoy, Send, CheckCircle, Loader, ArrowLeft, Ticket, Mail
} from 'lucide-react';
import { supportService } from '../services/services';
import toast from 'react-hot-toast';
import '../styles/globals.css';
import './landing/Landing.css';
import './dashboard/Support.css';

const PublicSupport = () => {
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [ticketData, setTicketData] = useState(null);

  const validateEmail = (em) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em);

  const validate = () => {
    const errs = {};
    if (!email.trim() || !validateEmail(email.trim())) errs.email = 'Please enter a valid email address.';
    if (!subject.trim() || subject.trim().length < 5) errs.subject = 'Subject must be at least 5 characters.';
    if (!description.trim() || description.trim().length < 10) errs.description = 'Description must be at least 10 characters.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const res = await supportService.createGuestTicket({
        email: email.trim(),
        subject: subject.trim(),
        description: description.trim(),
      });
      setTicketData(res.data.ticket);
      setSubmitted(true);
      toast.success('Ticket submitted! 🎉');
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to submit ticket. Please try again.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setEmail('');
    setSubject('');
    setDescription('');
    setErrors({});
    setSubmitted(false);
    setTicketData(null);
  };

  return (
    <div className="landing">
      {/* Same nav as landing but simplified */}
      <nav className="landing-nav">
        <div className="container landing-nav-inner">
          <div className="nav-brand">
            <a href="/"><img className="nav-brand-logo" src="/logo.png" alt="MockMate" /></a>
          </div>
          <div className="nav-links">
            <Link to="/">Home</Link>
            <Link to="/login">Sign In</Link>
            <Link to="/signup" className="btn btn-primary btn-sm">Get Started Free</Link>
          </div>
        </div>
      </nav>

      <div className="public-support-page">
        <div className="public-support-bg">
          <div className="hero-orb-1" />
          <div className="hero-orb-2" />
        </div>

        <div className="public-support-container">
          <div className="public-support-header">
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'rgba(20, 184, 166, 0.12)', border: '2px solid rgba(20, 184, 166, 0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px', color: '#14b8a6'
            }}>
              <LifeBuoy size={28} />
            </div>
            <h1>Need Help?</h1>
            <p>
              Can't log in? Having trouble? Submit a support ticket and we'll get back to you via email.
            </p>
          </div>

          <div className="support-form-card">
            {!submitted ? (
              <form className="support-form" onSubmit={handleSubmit}>
                <div className="form-group">
                  <label className="form-label" htmlFor="guest-email">Email Address <span style={{ color: '#f87171' }}>*</span></label>
                  <input
                    id="guest-email"
                    type="email"
                    className="form-input"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    maxLength={100}
                    disabled={submitting}
                  />
                  {errors.email && <span className="form-error">{errors.email}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="guest-subject">Subject <span style={{ color: '#f87171' }}>*</span></label>
                  <input
                    id="guest-subject"
                    type="text"
                    className="form-input"
                    placeholder="Brief summary of your issue..."
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    maxLength={200}
                    disabled={submitting}
                  />
                  {errors.subject && <span className="form-error">{errors.subject}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="guest-description">Description <span style={{ color: '#f87171' }}>*</span></label>
                  <textarea
                    id="guest-description"
                    className="form-input"
                    placeholder="Describe your issue in detail..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={5000}
                    disabled={submitting}
                  />
                  {errors.description && <span className="form-error">{errors.description}</span>}
                </div>

                <button
                  type="submit"
                  className="btn btn-primary support-submit-btn"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader size={16} style={{ animation: 'spin 0.8s linear infinite' }} />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      Submit Ticket
                    </>
                  )}
                </button>

                <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
                  Already have an account? <Link to="/login" style={{ color: 'var(--color-primary-light)' }}>Sign in</Link> for faster support.
                </p>
              </form>
            ) : (
              <div className="support-success">
                <div className="support-success-icon">
                  <CheckCircle size={36} />
                </div>
                <h3>Ticket Submitted!</h3>
                <p>
                  We've received your support request. Our team will respond to <strong style={{ color: '#99f6e4' }}>{email}</strong> as soon as possible.
                </p>
                <div className="support-ticket-id-display">
                  <Ticket size={18} />
                  {ticketData?.ticketId}
                </div>
                <div className="support-success-actions">
                  <button className="btn btn-secondary" onClick={handleReset}>
                    <Send size={15} /> Submit Another
                  </button>
                  <Link to="/" className="btn btn-ghost">
                    <ArrowLeft size={15} /> Back to Home
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicSupport;
