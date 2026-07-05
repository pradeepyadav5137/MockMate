import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Home, Play, Clock, BarChart2, Mic, User, CreditCard, LogOut, LifeBuoy, X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import './Sidebar.css';

const navItems = [
  { label: 'Dashboard', icon: Home, path: '/dashboard' },
  { label: 'Start Interview', icon: Play, path: '/dashboard/start' },
  { label: 'Interview History', icon: Clock, path: '/dashboard/history' },
  { label: 'Feedback Reports', icon: BarChart2, path: '/dashboard/feedback' },
  { label: 'Recordings', icon: Mic, path: '/dashboard/recordings' },
  { label: 'Profile', icon: User, path: '/dashboard/profile' },
  { label: 'Pricing', icon: CreditCard, path: '/dashboard/pricing' },
  { label: 'Support', icon: LifeBuoy, path: '/dashboard/support' },
];

const Sidebar = ({ isOpen, onClose }) => {
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
    : 'AI';

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      {/* Logo */}
      <div className="sidebar-logo">
        <img className="sidebar-logo-icon" src="/logo.png" alt="MockMate" />
        <button className="mobile-sidebar-close" onClick={onClose} aria-label="Close sidebar">
          <X size={20} />
        </button>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {navItems.map(({ label, icon: Icon, path }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/dashboard'}
            onClick={handleLinkClick}
            className={({ isActive }) =>
              `sidebar-nav-item${isActive ? ' active' : ''}`
            }
          >
            <Icon size={17} className="nav-icon" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User profile at bottom */}
      <div className="sidebar-bottom">
        <div className="sidebar-user">
          <div className="sidebar-avatar">{initials}</div>
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{user?.name || 'User'}</span>
            <span className="sidebar-user-plan">Free Plan</span>
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

export default Sidebar;
