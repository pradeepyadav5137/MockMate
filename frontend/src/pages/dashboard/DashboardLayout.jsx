import React, { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Sidebar from '../../components/dashboard/Sidebar';
import '../../styles/globals.css';

const DashboardLayout = () => {
  const { isAuthenticated, loading } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#080810' }}>
        <div className="spinner" style={{ width: 40, height: 40 }} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const toggleSidebar = () => {
    setIsSidebarOpen(prev => !prev);
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  return (
    <div className="app-layout">
      {/* Mobile Top Bar */}
      <header className="mobile-header">
        <button className="mobile-menu-toggle" onClick={toggleSidebar} aria-label="Toggle menu">
          <Menu size={22} />
        </button>
        <div className="mobile-logo">
          <img src="/logo.png" alt="MockMate" style={{ height: '30px', objectFit: 'contain' }} />
        </div>
        <div style={{ width: 30 }} /> {/* Spacer to balance flex layout */}
      </header>

      {/* Sidebar Overlay for Mobile */}
      {isSidebarOpen && (
        <div className="sidebar-overlay" onClick={closeSidebar} />
      )}

      <Sidebar isOpen={isSidebarOpen} onClose={closeSidebar} />
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default DashboardLayout;
