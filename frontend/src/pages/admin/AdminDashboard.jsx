import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Users, Activity, DollarSign, Clock, CheckCircle, XCircle, 
  Video, MessageSquare, Ticket, AlertTriangle, ShieldCheck
} from 'lucide-react';
import { adminService } from '../../services/services';
import { Link } from 'react-router-dom';
import '../../styles/globals.css';

const StatCard = ({ title, value, icon: Icon, color, subtitle }) => (
  <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>{title}</p>
        <h3 style={{ color: 'var(--color-text-primary)', fontSize: '28px', fontWeight: '700', fontFamily: 'var(--font-display)' }}>
          {value}
        </h3>
      </div>
      <div style={{ 
        width: '40px', height: '40px', borderRadius: '50%', 
        background: `${color}15`, color: color,
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <Icon size={20} />
      </div>
    </div>
    {subtitle && <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>{subtitle}</p>}
  </div>
);

const AdminDashboard = () => {
  const [range, setRange] = useState('today');

  const { data: statsData, isLoading: isStatsLoading } = useQuery({
    queryKey: ['admin-stats', range],
    queryFn: () => adminService.getStats(range).then(res => res.data),
    refetchInterval: 60000, // Refresh every minute
  });

  const { data: healthData } = useQuery({
    queryKey: ['admin-providers'],
    queryFn: () => adminService.getProviders().then(res => res.data.health),
  });

  const getStatusColor = (status) => {
    if (status === 'healthy' || status === 'configured') return '#10b981';
    if (status === 'down') return '#ef4444';
    if (status === 'degraded' || status === 'rate_limited') return '#f59e0b';
    return '#64748b';
  };

  if (isStatsLoading) {
    return (
      <div style={{ padding: '20px' }}>
        <div className="skeleton" style={{ height: '120px', borderRadius: '12px', marginBottom: '20px' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
          {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: '140px', borderRadius: '12px' }} />)}
        </div>
      </div>
    );
  }

  const { stats = {}, recentInterviews = [], recentFeedbacks = [], recentTickets = [] } = statsData || {};
  const providers = healthData?.providers || {};

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldCheck size={28} color="var(--color-primary)" />
            Admin Overview
          </h1>
          <p className="page-subtitle">Monitor platform metrics, revenue, and system health.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
          {['today', '7d', '30d', 'all'].map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              style={{
                background: range === r ? 'rgba(20, 184, 166, 0.12)' : 'transparent',
                color: range === r ? '#99f6e4' : 'var(--color-text-secondary)',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              {r === 'all' ? 'Total' : r === 'today' ? 'Today' : r.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
          <StatCard 
            title="Revenue" 
            value={stats.revenue || '₹0'} 
            icon={DollarSign} 
            color="#10b981" 
            subtitle="Actual verified payments"
          />
          <StatCard 
            title="Total Interviews" 
            value={stats.totalInterviews || 0} 
            icon={Video} 
            color="#3b82f6" 
            subtitle={`${stats.completedInterviews || 0} completed, ${stats.failedInterviews || 0} failed`}
          />
          <StatCard 
            title={range === 'all' ? 'Total Users' : 'New Users'} 
            value={range === 'all' ? stats.totalUsers || 0 : stats.newUsers || 0} 
            icon={Users} 
            color="#8b5cf6" 
            subtitle="Registered accounts"
          />
          <StatCard 
            title="Total Talk Time" 
            value={`${Math.floor((stats.totalDuration || 0) / 3600)}h ${Math.floor(((stats.totalDuration || 0) % 3600) / 60)}m`} 
            icon={Clock} 
            color="#f59e0b" 
            subtitle={`Avg: ${Math.floor((stats.avgDuration || 0) / 60)}m ${(stats.avgDuration || 0) % 60}s per session`}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
          
          {/* Recent Interviews */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600' }}>Recent Interviews</h3>
              <Link to="/admin/interviews" style={{ fontSize: '13px', color: 'var(--color-primary)' }}>View All</Link>
            </div>
            {recentInterviews.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', textAlign: 'center', padding: '20px' }}>No interviews found.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {recentInterviews.map((iv, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                    <div>
                      <p style={{ fontSize: '14px', fontWeight: '500', color: 'var(--color-text-primary)' }}>{iv.role}</p>
                      <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{iv.interviewType} • {new Date(iv.createdAt).toLocaleString()}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className={`badge badge-${iv.status === 'completed' ? 'primary' : iv.status === 'failed' ? 'error' : 'warning'}`}>
                        {iv.status}
                      </span>
                      <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                        {iv.actualDuration ? `${Math.floor(iv.actualDuration / 60)}m ${iv.actualDuration % 60}s` : '--'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* System Health Overview */}
            <div className="glass-card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '600' }}>Provider Health</h3>
                <Link to="/admin/providers" style={{ fontSize: '13px', color: 'var(--color-primary)' }}>Details</Link>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {Object.entries(providers).map(([key, data]) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: getStatusColor(data.status) }} />
                    <span style={{ color: 'var(--color-text-secondary)', textTransform: 'capitalize' }}>{key.replace('_', ' ')}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Support Tickets */}
            <div className="glass-card" style={{ padding: '24px', flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Ticket size={16} /> Recent Tickets
                </h3>
                <Link to="/admin/tickets" style={{ fontSize: '13px', color: 'var(--color-primary)' }}>View All</Link>
              </div>
              {recentTickets.length === 0 ? (
                <p style={{ color: 'var(--color-text-muted)', fontSize: '14px', textAlign: 'center', padding: '20px' }}>No recent tickets.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {recentTickets.slice(0, 4).map((t, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                      <div style={{ overflow: 'hidden' }}>
                        <p style={{ fontSize: '14px', fontWeight: '500', color: 'var(--color-text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                          {t.subject}
                        </p>
                        <p style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{t.ticketId}</p>
                      </div>
                      <span className={`badge`} style={{ background: t.status === 'Open' ? 'rgba(220,38,38,0.1)' : 'rgba(255,255,255,0.05)', color: t.status === 'Open' ? '#fca5a5' : '#cbd5e1' }}>
                        {t.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
