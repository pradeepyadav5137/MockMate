import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  TrendingUp, Clock, Mic, CheckCircle, Play, ArrowRight,
  BarChart2, MessageSquare, Zap, AlertTriangle, RefreshCw
} from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { feedbackService, interviewService } from '../../services/services';
import { useAuth } from '../../context/AuthContext';
import '../../styles/globals.css';
import './Dashboard.css';

const ScoreRing = ({ score, color, size = 64 }) => {
  const r = (size - 8) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 100) * circumference;

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={4} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={4}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 1s ease' }}
      />
    </svg>
  );
};

const StatCard = ({ icon: Icon, label, value, color, subtitle }) => (
  <div className="stat-card animate-fade-in-up">
    <div className="stat-icon" style={{ background: `${color}1a`, color }}>
      <Icon size={20} />
    </div>
    <div className="stat-value">{value ?? '—'}</div>
    <div className="stat-label">{label}</div>
    {subtitle && <div className="stat-subtitle">{subtitle}</div>}
  </div>
);

const Dashboard = () => {
  const { user } = useAuth();
  const [resending, setResending] = useState(false);

  const handleResendVerification = async () => {
    setResending(true);
    try {
      const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
      await axios.post(`${API_BASE}/auth/resend-verification`, { email: user.email });
      toast.success('Verification email sent! Check your inbox.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send. Try again.');
    } finally {
      setResending(false);
    }
  };

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => feedbackService.getStats().then((r) => r.data.stats),
  });

  const { data: interviewsData, isLoading: interviewsLoading } = useQuery({
    queryKey: ['interviews'],
    queryFn: () => interviewService.getAll().then((r) => r.data.interviews),
  });

  const stats = statsData || {};
  const interviews = interviewsData || [];
  const recentInterviews = interviews.slice(0, 5);

  const scoreCards = [
    { label: 'Overall Score', value: stats.averageScore ? `${stats.averageScore}%` : null, icon: TrendingUp, color: '#14b8a6' },
    { label: 'Communication', value: stats.communicationScore ? `${stats.communicationScore}%` : null, icon: MessageSquare, color: '#06b6d4' },
    { label: 'Technical', value: stats.technicalScore ? `${stats.technicalScore}%` : null, icon: BarChart2, color: '#f59e0b' },
    { label: 'Confidence', value: stats.confidenceScore ? `${stats.confidenceScore}%` : null, icon: Zap, color: '#10b981' },
  ];

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="dashboard-header-content">
          <div>
            <h1 className="page-title">
              Good {getTimeGreeting()}, {user?.name?.split(' ')[0] || 'there'}! 👋
            </h1>
            <p className="page-subtitle">
              {stats.totalInterviews > 0
                ? `You've completed ${stats.totalInterviews} interview${stats.totalInterviews > 1 ? 's' : ''}. Keep going!`
                : "Ready to start your first mock interview?"}
            </p>
          </div>
          <Link to="/dashboard/start" id="dashboard-start-btn" className="btn btn-primary">
            <Play size={16} /> Start Interview
          </Link>
        </div>
      </div>

      <div className="page-content">
        {/* Email verification warning banner */}
        {user && !user.isVerified && (
          <div className="plan-banner animate-fade-in-up" style={{ borderColor: 'rgba(251,191,36,0.4)', background: 'rgba(251,191,36,0.08)' }}>
            <div className="plan-banner-content">
              <AlertTriangle size={18} style={{ color: '#fbbf24', flexShrink: 0 }} />
              <div>
                <strong style={{ color: '#fbbf24' }}>Email not verified</strong>
                <span style={{ color: '#94a3b8' }}> — Please verify your email to start interviews. Check your inbox or resend below.</span>
              </div>
            </div>
            <button
              id="dashboard-resend-verify-btn"
              className="btn btn-sm"
              style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)', whiteSpace: 'nowrap' }}
              onClick={handleResendVerification}
              disabled={resending}
            >
              {resending ? <span className="spinner" /> : <><RefreshCw size={13} /> Resend Email</>}
            </button>
          </div>
        )}

        {/* Plan banner for free users */}
        {!user?.activeDayPass && (
          <div className="plan-banner animate-fade-in-up">
            <div className="plan-banner-content">
              <span>₹19</span>
              <div>
                <strong>Free Plan</strong>
                <span> - 1 interview per category/day, 30 min max. </span>
              </div>
            </div>
            <Link to="/dashboard/pricing" className="btn btn-primary btn-sm">
              Buy Day Pass - ₹19
            </Link>
          </div>
        )}

        {/* Stat cards */}
        <div className="stats-grid">
          <div className="stat-card stat-card-total animate-fade-in-up">
            <div className="stat-icon" style={{ background: 'rgba(20,184,166,0.15)', color: '#14b8a6' }}>
              <CheckCircle size={20} />
            </div>
            <div className="stat-value">{statsLoading ? '—' : (stats.totalInterviews ?? 0)}</div>
            <div className="stat-label">Interviews Completed</div>
          </div>

          {scoreCards.map((card, i) => (
            <div key={card.label} className="stat-card animate-fade-in-up" style={{ animationDelay: `${i * 0.08}s` }}>
              <div className="stat-icon" style={{ background: `${card.color}1a`, color: card.color }}>
                <card.icon size={20} />
              </div>
              <div className="stat-value">{statsLoading ? '—' : (card.value ?? '—')}</div>
              <div className="stat-label">{card.label}</div>
            </div>
          ))}
        </div>

        {/* Recent Interviews */}
        <div className="glass-card dashboard-section animate-fade-in-up">
          <div className="section-header">
            <h2 className="section-title">Recent Interviews</h2>
            <Link to="/dashboard/history" className="btn btn-ghost btn-sm">
              View All <ArrowRight size={14} />
            </Link>
          </div>

          {interviewsLoading ? (
            <div className="table-loading">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 48, marginBottom: 8 }} />
              ))}
            </div>
          ) : recentInterviews.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🎙️</div>
              <h3>No interviews yet</h3>
              <p>Start your first mock interview to see your performance here.</p>
              <Link to="/dashboard/start" className="btn btn-primary">
                <Play size={15} /> Start First Interview
              </Link>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Role</th>
                    <th>Type</th>
                    <th>Date</th>
                    <th>Duration</th>
                    <th>Score</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {recentInterviews.map((interview) => (
                    <tr key={interview._id}>
                      <td>
                        <span style={{ color: '#e2e8f0', fontWeight: 500 }}>{interview.role}</span>
                      </td>
                      <td>
                        <span className={`badge badge-${interview.interviewType === 'Technical' ? 'primary' : interview.interviewType === 'Behavioral' ? 'info' : 'warning'}`}>
                          {interview.interviewType}
                        </span>
                      </td>
                      <td>{new Date(interview.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                      <td>{interview.actualDuration ? `${Math.round(interview.actualDuration / 60)} min` : `${interview.maxDurationMinutes || interview.duration || '—'} min`}</td>
                      <td>
                        {interview.scores?.overall
                          ? <span style={{ color: getScoreColor(interview.scores.overall), fontWeight: 600 }}>{interview.scores.overall}%</span>
                          : <span className="text-muted">—</span>
                        }
                      </td>
                      <td>
                        <span className={`badge badge-${getStatusBadge(interview.status)}`}>
                          {interview.status}
                        </span>
                      </td>
                      <td>
                        <Link
                          to={`/dashboard/feedback/${interview._id}`}
                          className="btn btn-ghost btn-sm"
                          id={`view-interview-${interview._id}`}
                        >
                          View <ArrowRight size={13} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Quick Start Tips */}
        {stats.totalInterviews === 0 && (
          <div className="tips-grid animate-fade-in-up">
            {[
              { icon: '📄', title: 'Upload Resume', desc: 'Get personalized questions based on your projects and experience.', link: '/dashboard/start', cta: 'Upload Now' },
              { icon: '🎯', title: 'Choose Your Role', desc: 'Select from Frontend, Backend, Full Stack, SDE-1, SDE-2, and more.', link: '/dashboard/start', cta: 'Start Interview' },
              { icon: '🤖', title: 'Talk Naturally', desc: 'Your AI interviewer is friendly. Just speak like you would in a real interview.', link: null, cta: null },
            ].map((tip) => (
              <div key={tip.title} className="tip-card glass-card">
                <div className="tip-icon">{tip.icon}</div>
                <h3>{tip.title}</h3>
                <p>{tip.desc}</p>
                {tip.link && (
                  <Link to={tip.link} className="btn btn-ghost btn-sm" style={{ marginTop: 8 }}>
                    {tip.cta} <ArrowRight size={13} />
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const getTimeGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
};

const getScoreColor = (score) => {
  if (score >= 80) return '#6ee7b7';
  if (score >= 60) return '#fcd34d';
  return '#f87171';
};

const getStatusBadge = (status) => {
  const map = { completed: 'success', active: 'primary', feedback: 'info', cancelled: 'danger', scheduled: 'warning' };
  return map[status] || 'info';
};

export default Dashboard;
