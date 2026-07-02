import React, { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowRight, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { authService } from '../../services/services';
import '../../styles/globals.css';
import './Auth.css';

export const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return toast.error('Please enter your email.');
    setLoading(true);
    try {
      await authService.forgotPassword(email);
      setSent(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong.');
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
          <span>AI Interview Companion</span>
        </Link>

        <div className="auth-card glass-card animate-fade-in-up">
          {sent ? (
            <div style={{ textAlign: 'center' }}>
              <CheckCircle size={48} style={{ color: '#6ee7b7', margin: '0 auto 16px' }} />
              <h2 style={{ color: '#f1f5f9', marginBottom: 8 }}>Reset link sent!</h2>
              <p style={{ color: '#94a3b8', marginBottom: 24 }}>
                Check <strong style={{ color: '#99f6e4' }}>{email}</strong> for a password reset link.
              </p>
              <Link to="/login" className="btn btn-secondary">Back to Login</Link>
            </div>
          ) : (
            <>
              <div className="auth-card-header">
                <h1>Forgot Password?</h1>
                <p>No worries, we'll send you reset instructions.</p>
              </div>
              <form onSubmit={handleSubmit} className="auth-form">
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <div className="input-wrapper">
                    <Mail size={16} className="input-icon" />
                    <input
                      id="forgot-email"
                      type="email"
                      className="form-input"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>
                <button id="forgot-submit" type="submit" className="btn btn-primary btn-lg auth-submit" disabled={loading}>
                  {loading ? <span className="spinner" /> : <>Send Reset Link <ArrowRight size={18} /></>}
                </button>
              </form>
              <div className="auth-switch">
                <Link to="/login">← Back to Login</Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export const ResetPassword = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) return toast.error('Passwords do not match.');
    if (form.password.length < 6) return toast.error('Password must be at least 6 characters.');
    setLoading(true);
    try {
      await authService.resetPassword(token, form.password);
      toast.success('Password reset! You can now log in.');
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reset link expired or invalid.');
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
          <span>AI Interview Companion</span>
        </Link>
        <div className="auth-card glass-card animate-fade-in-up">
          <div className="auth-card-header">
            <h1>Set New Password</h1>
            <p>Create a strong new password for your account.</p>
          </div>
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label className="form-label">New Password</label>
              <div className="input-wrapper">
                <Lock size={16} className="input-icon" />
                <input
                  id="reset-password"
                  type="password"
                  className="form-input"
                  placeholder="Min 6 characters"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <div className="input-wrapper">
                <Lock size={16} className="input-icon" />
                <input
                  id="reset-confirm"
                  type="password"
                  className="form-input"
                  placeholder="Repeat password"
                  value={form.confirm}
                  onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                />
              </div>
            </div>
            <button id="reset-submit" type="submit" className="btn btn-primary btn-lg auth-submit" disabled={loading}>
              {loading ? <span className="spinner" /> : <>Reset Password <ArrowRight size={18} /></>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
