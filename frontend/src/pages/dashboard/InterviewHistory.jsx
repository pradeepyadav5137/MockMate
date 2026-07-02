import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowRight, Eye, BarChart2 } from 'lucide-react';
import { interviewService } from '../../services/services';
import '../../styles/globals.css';
import '../dashboard/Dashboard.css';

const InterviewHistory = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['interviews'],
    queryFn: () => interviewService.getAll().then((r) => r.data.interviews),
  });

  const interviews = data || [];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Interview History</h1>
        <p className="page-subtitle">All your practice sessions</p>
      </div>

      <div className="page-content">
        <div className="glass-card dashboard-section animate-fade-in-up">
          {isLoading ? (
            <div className="table-loading">
              {[...Array(5)].map((_, i) => <div key={i} className="skeleton" style={{ height: 52, marginBottom: 8 }} />)}
            </div>
          ) : interviews.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <h3>No interviews yet</h3>
              <p>Start a mock interview to build your history.</p>
              <Link to="/dashboard/start" className="btn btn-primary">Start Interview</Link>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Role</th>
                    <th>Type</th>
                    <th>Difficulty</th>
                    <th>Date</th>
                    <th>Duration</th>
                    <th>Score</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {interviews.map((iv, idx) => (
                    <tr key={iv._id}>
                      <td style={{ color: '#475569' }}>{idx + 1}</td>
                      <td style={{ color: '#e2e8f0', fontWeight: 500 }}>{iv.role}</td>
                      <td>
                        <span className={`badge badge-${iv.interviewType === 'Technical' ? 'primary' : iv.interviewType === 'Behavioral' ? 'info' : 'warning'}`}>
                          {iv.interviewType}
                        </span>
                      </td>
                      <td>
                        <span style={{ color: iv.difficulty === 'Hard' ? '#f87171' : iv.difficulty === 'Medium' ? '#fcd34d' : '#6ee7b7', fontWeight: 500 }}>
                          {iv.difficulty}
                        </span>
                      </td>
                      <td>{new Date(iv.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                      <td>{iv.actualDuration ? `${Math.round(iv.actualDuration / 60)} min` : `${iv.maxDurationMinutes || iv.duration || '—'} min`}</td>
                      <td>
                        {iv.scores?.overall
                          ? <span style={{ color: iv.scores.overall >= 80 ? '#6ee7b7' : iv.scores.overall >= 60 ? '#fcd34d' : '#f87171', fontWeight: 600 }}>{iv.scores.overall}%</span>
                          : <span className="text-muted">—</span>
                        }
                      </td>
                      <td>
                        <span className={`badge badge-${iv.status === 'completed' ? 'success' : iv.status === 'active' ? 'primary' : 'info'}`}>
                          {iv.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Link to={`/dashboard/feedback/${iv._id}`} className="btn btn-ghost btn-sm" id={`view-feedback-${iv._id}`}>
                            <BarChart2 size={13} /> Feedback
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InterviewHistory;
