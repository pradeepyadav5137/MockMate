import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, CheckCircle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import { authService } from '../../services/services';
import '../../styles/globals.css';
import './Auth.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const ResendButton = ({ email }) => {
  const [sending, setSending] = useState(false);
  const handleResend = async () => {
    setSending(true);
    try {
      await axios.post(`${API_BASE}/auth/resend-verification`, { email });
      toast.success('Verification email resent! Check your inbox.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resend. Try again.');
    } finally {
      setSending(false);
    }
  };
  return (
    <button
      id="resend-verification-btn"
      className="btn btn-primary"
      onClick={handleResend}
      disabled={sending}
    >
      {sending ? <span className="spinner" /> : <><RefreshCw size={15} /> Resend Verification Email</>}
    </button>
  );
};

const Signup = () => {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) return toast.error('All fields are required.');
    if (form.password !== form.confirmPassword) return toast.error('Passwords do not match.');
    if (form.password.length < 6) return toast.error('Password must be at least 6 characters.');

    setLoading(true);
    try {
      await authService.register({ name: form.name, email: form.email, password: form.password });
      setDone(true);
    } catch (err) {
      toast.error(err.response?.data?.message || err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="auth-page">
        <div className="auth-bg">
          <div className="auth-orb auth-orb-1" />
          <div className="auth-orb auth-orb-2" />
        </div>
        <div className="auth-container">
          <div className="auth-card glass-card animate-fade-in-up" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>📬</div>
            <h2 style={{ color: '#f1f5f9', marginBottom: 8 }}>Check your inbox!</h2>
            <p style={{ color: '#94a3b8', marginBottom: 8 }}>
              We sent a verification link to <strong style={{ color: '#99f6e4' }}>{form.email}</strong>.<br />
              Click it to activate your account.
            </p>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 24 }}>
              Didn't receive it? Check your spam folder, or resend below.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <ResendButton email={form.email} />
              <Link to="/login" className="btn btn-ghost">Go to Login</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-bg">
        <div className="auth-orb auth-orb-1" />
        <div className="auth-orb auth-orb-2" />
        <div className="auth-grid" />
      </div>

      <div className="auth-container">
        <Link to="/" className="auth-brand">
          <div><img src="/logo.png" alt="" /></div>
          {/* <div className="auth-brand-icon">🎯</div> */}
          {/* <span></span> */}
        </Link>

        <div className="auth-card glass-card animate-fade-in-up">
          <div className="auth-card-header">
            <h1>Create your account</h1>
            <p>Start practicing with your AI interviewer — it's free</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <div className="input-wrapper">
                <User size={16} className="input-icon" />
                <input
                  id="signup-name"
                  type="text"
                  className="form-input"
                  placeholder="Alex Johnson"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div className="input-wrapper">
                <Mail size={16} className="input-icon" />
                <input
                  id="signup-email"
                  type="email"
                  className="form-input"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div className="input-wrapper">
                <Lock size={16} className="input-icon" />
                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="Min 6 characters"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
                <button type="button" className="input-eye" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <div className="input-wrapper">
                <Lock size={16} className="input-icon" />
                <input
                  id="signup-confirm-password"
                  type="password"
                  className="form-input"
                  placeholder="Repeat password"
                  value={form.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                />
              </div>
            </div>

            <button
              id="signup-submit"
              type="submit"
              className="btn btn-primary btn-lg auth-submit"
              disabled={loading}
            >
              {loading ? <span className="spinner" /> : <>Create Account <ArrowRight size={18} /></>}
            </button>
          </form>

          <div className="auth-perks">
            {['1 free interview per day', 'AI-powered feedback', 'Resume analysis'].map((p) => (
              <div key={p} className="auth-perk-item">
                <CheckCircle size={13} /> <span>{p}</span>
              </div>
            ))}
          </div>

          <div className="auth-divider"><span>or</span></div>

          <button
            type="button"
            className="btn btn-secondary btn-lg google-btn"
            onClick={() => {
              const apiBase = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
              window.location.href = `${apiBase}/auth/google`;
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Sign up with Google
          </button>

          <div className="auth-switch">
            Already have an account?{' '}
            <Link to="/login">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;
