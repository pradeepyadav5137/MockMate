import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Mic, Play } from 'lucide-react';
import { interviewService } from '../../services/services';
import '../../styles/globals.css';
import '../dashboard/Dashboard.css';

const Recordings = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['interviews'],
    queryFn: () => interviewService.getAll().then((r) => r.data.interviews),
  });

  const interviewsWithRecordings = data?.filter(iv => iv.recordingPath || iv.recordingPublicId) || [];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Interview Recordings</h1>
        <p className="page-subtitle">Listen back to your practice sessions</p>
      </div>

      <div className="page-content">
        <div className="glass-card dashboard-section animate-fade-in-up">
          {isLoading ? (
            <div className="table-loading">
              {[...Array(5)].map((_, i) => <div key={i} className="skeleton" style={{ height: 52, marginBottom: 8 }} />)}
            </div>
          ) : interviewsWithRecordings.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🎙️</div>
              <h3>No recordings yet</h3>
              <p>Complete a mock interview to get an audio recording.</p>
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
                    <th>Date</th>
                    <th>Duration</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {interviewsWithRecordings.map((iv, idx) => (
                    <tr key={iv._id}>
                      <td style={{ color: '#475569' }}>{idx + 1}</td>
                      <td style={{ color: '#e2e8f0', fontWeight: 500 }}>{iv.role}</td>
                      <td>
                        <span className={`badge badge-${iv.interviewType === 'Technical' ? 'primary' : iv.interviewType === 'Behavioral' ? 'info' : 'warning'}`}>
                          {iv.interviewType}
                        </span>
                      </td>
                      <td>{new Date(iv.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                      <td>{iv.actualDuration ? `${Math.round(iv.actualDuration / 60)} min` : `${iv.maxDurationMinutes || iv.duration || '—'} min`}</td>
                      <td>
                        <Link to={`/dashboard/feedback/${iv._id}`} className="btn btn-ghost btn-sm">
                          <Play size={13} style={{ marginRight: 4 }} /> Play Recording
                        </Link>
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

export default Recordings;
