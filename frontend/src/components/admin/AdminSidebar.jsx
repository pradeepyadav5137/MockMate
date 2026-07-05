import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, MessageSquare, Ticket, CreditCard, Activity, LogOut, X, Home
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import '../dashboard/Sidebar.css';

const adminNavItems = [
  { label: 'Admin Dashboard', icon: LayoutDashboard, path: '/admin' },
  { label: 'Interviews', icon: Activity, path: '/admin/interviews' },
  { label: 'Users', icon: Users, path: '/admin/users' },
  { label: 'Feedback', icon: MessageSquare, path: '/admin/feedback' },
  { label: 'Support Tickets', icon: Ticket, path: '/admin/tickets' },
  { label: 'Payments', icon: CreditCard, path: '/admin/payments' },
  { label: 'Provider Health', icon: Activity, path: '/admin/providers' },
];

const AdminSidebar = ({ isOpen, onClose }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    toast.success('Logged out. See you soon! 👋');
    navigate('/login');
    if (onClose) onClose();
  };

  const handleLinkClick = () => {
    if (onClose) onClose();
  };

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'AD';

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      {/* Logo */}
      <div className="sidebar-logo">
        <img className="sidebar-logo-icon" src="/logo.png" alt="MockMate Admin" />
        <button className="mobile-sidebar-close" onClick={onClose} aria-label="Close sidebar">
          <X size={20} />
        </button>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {adminNavItems.map(({ label, icon: Icon, path }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/admin'}
            onClick={handleLinkClick}
            className={({ isActive }) =>
              `sidebar-nav-item${isActive ? ' active' : ''}`
            }
          >
            <Icon size={17} className="nav-icon" />
            <span>{label}</span>
          </NavLink>
        ))}
        
        <div style={{ margin: '16px 0', borderTop: '1px solid rgba(255,255,255,0.05)' }}></div>
        
        <NavLink
            to="/dashboard"
            onClick={handleLinkClick}
            className="sidebar-nav-item"
          >
            <Home size={17} className="nav-icon" />
            <span>Back to App</span>
        </NavLink>
      </nav>

      {/* User profile at bottom */}
      <div className="sidebar-bottom">
        <div className="sidebar-user">
          <div className="sidebar-avatar" style={{ background: 'var(--color-primary)' }}>{initials}</div>
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{user?.name || 'Admin'}</span>
            <span className="sidebar-user-plan" style={{ color: 'var(--color-primary)' }}>Administrator</span>
          </div>
        </div>
        <button
          id="sidebar-logout"
          className="sidebar-logout-btn"
          onClick={handleLogout}
          title="Log out"
        >
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  );
};

export default AdminSidebar;
