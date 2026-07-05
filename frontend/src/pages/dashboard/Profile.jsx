import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  User, Mail, Shield, CheckCircle, AlertTriangle, Calendar,
  CreditCard, LifeBuoy, Key, Globe
} from 'lucide-react';
import '../../styles/globals.css';
import '../dashboard/Dashboard.css';
import './Profile.css';

const Profile = () => {
  const { user } = useAuth();

  const joinedDate = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : 'Recently';

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">My Profile</h1>
        <p className="page-subtitle">Manage your account settings</p>
      </div>

      <div className="page-content">
        {/* Two-column layout */}
        <div className="profile-grid animate-fade-in-up">

          {/* Left Column — User Card */}
          <div className="profile-user-card glass-card">
            <div className="profile-avatar-section">
              <div className="profile-avatar">{initials}</div>
              <div className="profile-user-details">
                <h2 className="profile-name">{user?.name || 'User Name'}</h2>
                <p className="profile-email">
                  <Mail size={14} />
                  {user?.email || 'user@email.com'}
                </p>
                <p className="profile-joined">
                  <Calendar size={13} />
                  Joined {joinedDate}
                </p>
              </div>
            </div>

            {/* Account Info Items */}
            <div className="profile-info-list">
              <div className="profile-info-item">
                <div className="profile-info-label">
                  <Shield size={16} style={{ color: '#8b5cf6' }} />
                  <span>Email Verification</span>
                </div>
                {user?.isVerified ? (
                  <span className="badge badge-success">
                    <CheckCircle size={12} style={{ marginRight: 4 }} /> Verified
                  </span>
                ) : (
                  <span className="badge badge-warning">
                    <AlertTriangle size={12} style={{ marginRight: 4 }} /> Unverified
                  </span>
                )}
              </div>

              <div className="profile-info-item">
                <div className="profile-info-label">
                  <Key size={16} style={{ color: '#06b6d4' }} />
                  <span>Auth Method</span>
                </div>
                <span className="badge badge-info">
                  {user?.googleId ? (
                    <><Globe size={12} style={{ marginRight: 4 }} /> Google</>
                  ) : (
                    <>Email & Password</>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Right Column — Plan + Quick Actions */}
          <div className="profile-right-col">
            {/* Subscription Card */}
            <div className="profile-plan-card glass-card">
              <div className="profile-plan-header">
                <div className="profile-plan-icon">
                  <CreditCard size={22} />
                </div>
                <div>
                  <h3 className="profile-plan-title">Subscription Plan</h3>
                  <p className="profile-plan-desc">Your current plan and usage</p>
                </div>
              </div>

              <div className="profile-plan-body">
                <div className="profile-info-item">
                  <div className="profile-info-label">
                    <CreditCard size={16} style={{ color: '#f59e0b' }} />
                    <span>Current Plan</span>
                  </div>
                  <span className="badge badge-primary">Free Plan</span>
                </div>
                <div className="profile-info-item">
                  <div className="profile-info-label">
                    <Calendar size={16} style={{ color: '#10b981' }} />
                    <span>Daily Interviews</span>
                  </div>
                  <span style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>1 / day</span>
                </div>
              </div>

              <Link to="/dashboard/pricing" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '16px' }}>
                <CreditCard size={15} /> Upgrade Plan
              </Link>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
};

export default Profile;
