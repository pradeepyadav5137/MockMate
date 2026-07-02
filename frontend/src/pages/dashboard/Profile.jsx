import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { User, Mail, Shield, CheckCircle, AlertTriangle } from 'lucide-react';
import '../../styles/globals.css';
import '../dashboard/Dashboard.css';

const Profile = () => {
  const { user } = useAuth();

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">My Profile</h1>
        <p className="page-subtitle">Manage your account settings</p>
      </div>

      <div className="page-content">
        <div className="glass-card animate-fade-in-up" style={{ padding: '32px', maxWidth: '600px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '32px' }}>
            <div style={{ 
              width: '80px', height: '80px', borderRadius: '50%', 
              background: 'rgba(20, 184, 166, 0.1)', border: '2px solid rgba(20, 184, 166, 0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '32px', color: '#14b8a6', fontWeight: '600'
            }}>
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div>
              <h2 style={{ fontSize: '24px', margin: '0 0 4px 0', color: '#f8fafc' }}>{user?.name || 'User Name'}</h2>
              <p style={{ margin: 0, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Mail size={14} /> {user?.email || 'user@email.com'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <h3 style={{ fontSize: '16px', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px', color: '#e2e8f0' }}>
                <Shield size={18} style={{ color: '#8b5cf6' }} /> Account Status
              </h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#94a3b8' }}>Email Verification</span>
                {user?.isVerified ? (
                  <span className="badge badge-success"><CheckCircle size={12} style={{ marginRight: 4 }} /> Verified</span>
                ) : (
                  <span className="badge badge-warning"><AlertTriangle size={12} style={{ marginRight: 4 }} /> Unverified</span>
                )}
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <h3 style={{ fontSize: '16px', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px', color: '#e2e8f0' }}>
                <User size={18} style={{ color: '#f59e0b' }} /> Subscription Plan
              </h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#94a3b8' }}>Current Plan</span>
                <span className="badge badge-primary">{user?.activeDayPass ? 'Day Pass Active' : 'Free Plan'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
