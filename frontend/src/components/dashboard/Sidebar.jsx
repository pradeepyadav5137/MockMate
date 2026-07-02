import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Home, Play, Clock, BarChart2, Mic, User, CreditCard, LogOut, Zap
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
];

const Sidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    toast.success('Logged out. See you soon! 👋');
    navigate('/login');
  };

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'AI';

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <img className="sidebar-logo-icon" src="/logo.png" alt="AI Interview Companion" />
      </div>

      {/* Plan badge */}
      {user?.activeDayPass && (
        <div className="sidebar-plan-badge">
          <Zap size={12} /> Day Pass Active
        </div>
      )}

      {/* Nav */}
      <nav className="sidebar-nav">
        {navItems.map(({ label, icon: Icon, path }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/dashboard'}
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
            <span className="sidebar-user-plan">{user?.activeDayPass ? 'Day Pass Active' : 'Free Plan'}</span>
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
