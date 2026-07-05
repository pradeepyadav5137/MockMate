import React, { useEffect, useState, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Loader, Mail, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import '../../styles/globals.css';
import './Auth.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// ─── Token verification page (/verify-email/:token) ───────────────────────────
export const VerifyEmailToken = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading'); // loading | success | error
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    called.current = true;

    const verify = async () => {
      try {
        await axios.get(`${API_BASE}/auth/verify-email/${token}`);
        setStatus('success');
        setTimeout(() => navigate('/login'), 3000);
      } catch (err) {
        setStatus('error');
      }
    };
    verify();
  }, [token, navigate]);

  return (
    <div className="auth-page">
      <div className="auth-bg">
        <div className="auth-orb auth-orb-1" />
        <div className="auth-orb auth-orb-2" />
      </div>
      <div className="auth-container">
        <div className="auth-card glass-card animate-fade-in-up" style={{ textAlign: 'center' }}>
          {status === 'loading' && (
            <>
              <Loader size={56} style={{ color: '#14b8a6', marginBottom: 16, animation: 'spin 1s linear infinite' }} />
              <h2 style={{ color: '#f1f5f9' }}>Verifying your email…</h2>
              <p style={{ color: '#94a3b8' }}>Please wait a moment.</p>
            </>
          )}
          {status === 'success' && (
            <>
              <CheckCircle size={56} style={{ color: '#6ee7b7', marginBottom: 16 }} />
              <h2 style={{ color: '#f1f5f9' }}>Email Verified! 🎉</h2>
              <p style={{ color: '#94a3b8', marginBottom: 24 }}>
                Your account is active. Redirecting you to login…
              </p>
              <Link to="/login" className="btn btn-primary">Go to Login</Link>
            </>
          )}
          {status === 'error' && (
            <>
              <XCircle size={56} style={{ color: '#f87171', marginBottom: 16 }} />
              <h2 style={{ color: '#f1f5f9' }}>Link Expired or Invalid</h2>
              <p style={{ color: '#94a3b8', marginBottom: 24 }}>
                This verification link may have expired (24h limit). Request a new one below.
              </p>
              <Link to="/resend-verification" className="btn btn-primary">Resend Verification Email</Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Resend verification page (/resend-verification) ──────────────────────────
export const ResendVerification = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleResend = async (e) => {
    e.preventDefault();
    if (!email) return toast.error('Please enter your email.');
    setLoading(true);
    try {
      await axios.post(`${API_BASE}/auth/resend-verification`, { email });
      setSent(true);
      toast.success('Verification email sent! Check your inbox.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send email. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-bg">
        <div className="auth-orb auth-orb-1" />
        <div className="auth-orb auth-orb-2" />
      </div>
      <div className="auth-container">
        <Link to="/" className="auth-brand">
          <div className="auth-brand-icon">🎯</div>
          <span>MockMate</span>
        </Link>

        <div className="auth-card glass-card animate-fade-in-up" style={{ textAlign: sent ? 'center' : 'left' }}>
          {sent ? (
            <>
              <div style={{ fontSize: 56, marginBottom: 16 }}>📬</div>
              <h2 style={{ color: '#f1f5f9', marginBottom: 8 }}>Check your inbox!</h2>
              <p style={{ color: '#94a3b8', marginBottom: 24 }}>
                A new verification link has been sent to <strong style={{ color: '#99f6e4' }}>{email}</strong>.
                <br />Click it to activate your account.
              </p>
              <Link to="/login" className="btn btn-primary">Go to Login</Link>
            </>
          ) : (
            <>
              <div className="auth-card-header">
                <h1>Resend Verification Email</h1>
                <p>Enter your email and we'll send you a new verification link.</p>
              </div>

              <form onSubmit={handleResend} className="auth-form">
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <div className="input-wrapper">
                    <Mail size={16} className="input-icon" />
                    <input
                      id="resend-email"
                      type="email"
                      className="form-input"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <button
                  id="resend-submit"
                  type="submit"
                  className="btn btn-primary btn-lg auth-submit"
                  disabled={loading}
                >
                  {loading ? <span className="spinner" /> : <><RefreshCw size={16} /> Send Verification Link</>}
                </button>
              </form>

              <div className="auth-switch">
                Already verified? <Link to="/login">Sign in</Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
