import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Home } from 'lucide-react';
import '../styles/globals.css';
import './dashboard/Dashboard.css';

const NotFound = () => {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      background: 'var(--color-bg-base)'
    }}>
      <div className="glass-card" style={{
        maxWidth: '500px',
        width: '100%',
        padding: '40px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '20px'
      }}>
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: 'rgba(239, 68, 68, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#f87171'
        }}>
          <AlertCircle size={40} />
        </div>
        
        <h1 style={{
          fontSize: '32px',
          fontWeight: '700',
          color: 'var(--color-text-primary)',
          margin: '0'
        }}>
          404 - Page Not Found
        </h1>
        
        <p style={{
          color: 'var(--color-text-secondary)',
          fontSize: '16px',
          lineHeight: '1.6',
          margin: '0 0 10px 0'
        }}>
          The page you are looking for doesn't exist or has been moved.
        </p>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={() => window.history.back()}
            className="btn btn-secondary"
          >
            <ArrowLeft size={16} />
            Go Back
          </button>
          
          <Link to="/" className="btn btn-primary">
            <Home size={16} />
            Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
