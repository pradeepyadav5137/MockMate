import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminService } from '../../services/services';
import { Download, Loader, ChevronLeft, ChevronRight, Star } from 'lucide-react';
import toast from 'react-hot-toast';

const AdminFeedback = () => {
  const [page, setPage] = useState(1);
  const [rating, setRating] = useState('');
  const [type, setType] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-feedbacks', page, rating, type],
    queryFn: () => adminService.getFeedbacks({ page, limit: 15, rating, type }).then(res => res.data),
    keepPreviousData: true,
  });

  const handleExport = async () => {
    try {
      const response = await adminService.exportData('feedbacks');
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `mockmate_feedbacks_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      toast.success('Export successful');
    } catch (error) {
      toast.error('Failed to export data');
    }
  };

  const renderStars = (ratingValue) => {
    if (!ratingValue) return '--';
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#f59e0b' }}>
        <span>{ratingValue}</span> <Star size={12} fill="#f59e0b" />
      </div>
    );
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title">User Feedback</h1>
          <p className="page-subtitle">Monitor and review post-interview feedback and NPS ratings.</p>
        </div>
        <button onClick={handleExport} className="btn btn-secondary">
          <Download size={16} /> Export CSV
        </button>
      </div>

      <div className="page-content">
        <div className="glass-card" style={{ padding: '20px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <select className="form-input" style={{ flex: '1 1 200px', margin: 0 }} value={rating} onChange={e => { setRating(e.target.value); setPage(1); }}>
              <option value="">All Ratings</option>
              <option value="5">5 Stars</option>
              <option value="4">4 Stars</option>
              <option value="3">3 Stars</option>
              <option value="2">2 Stars</option>
              <option value="1">1 Star</option>
            </select>
            <select className="form-input" style={{ flex: '1 1 200px', margin: 0 }} value={type} onChange={e => { setType(e.target.value); setPage(1); }}>
              <option value="">All Types</option>
              <option value="testimony">Testimonials (>=4)</option>
              <option value="improvement">Improvements (&lt;4)</option>
            </select>
          </div>
        </div>

        <div className="glass-card" style={{ overflowX: 'auto' }}>
          {isLoading ? (
            <div style={{ padding: '40px', display: 'flex', justifyContent: 'center' }}>
              <Loader size={24} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          ) : data?.items?.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              No feedback found matching your filters.
            </div>
          ) : (
            <>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <th style={{ padding: '16px', color: 'var(--color-text-secondary)', fontSize: '12px', textTransform: 'uppercase' }}>Date</th>
                    <th style={{ padding: '16px', color: 'var(--color-text-secondary)', fontSize: '12px', textTransform: 'uppercase' }}>User / ID</th>
                    <th style={{ padding: '16px', color: 'var(--color-text-secondary)', fontSize: '12px', textTransform: 'uppercase' }}>Overall</th>
                    <th style={{ padding: '16px', color: 'var(--color-text-secondary)', fontSize: '12px', textTransform: 'uppercase' }}>Metrics</th>
                    <th style={{ padding: '16px', color: 'var(--color-text-secondary)', fontSize: '12px', textTransform: 'uppercase' }}>Comment</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.items?.map(fb => (
                    <tr key={fb._id || fb.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      <td style={{ padding: '16px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                        {new Date(fb.createdAt).toLocaleString('en-IN', { month: 'short', day: 'numeric' })}
                      </td>
                      <td style={{ padding: '16px' }}>
                        <div style={{ fontSize: '13px', color: 'var(--color-text-primary)' }}>{fb.userId.substring(0,10)}...</div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Int: {fb.interviewId.substring(0,8)}...</div>
                      </td>
                      <td style={{ padding: '16px' }}>
                        {renderStars(fb.overallRating)}
                      </td>
                      <td style={{ padding: '16px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                          <div>Q: {fb.interviewQualityRating || '-'}</div>
                          <div>V: {fb.aiVoiceQualityRating || '-'}</div>
                          <div>R: {fb.questionRelevanceRating || '-'}</div>
                          <div>Rec: <span style={{ color: fb.wouldRecommend === 'Yes' ? '#10b981' : fb.wouldRecommend === 'No' ? '#ef4444' : '#f59e0b' }}>{fb.wouldRecommend || '-'}</span></div>
                        </div>
                      </td>
                      <td style={{ padding: '16px', fontSize: '13px', color: 'var(--color-text-secondary)', maxWidth: '300px' }}>
                        {fb.feedbackText ? (
                          <div style={{ 
                            whiteSpace: 'nowrap', 
                            overflow: 'hidden', 
                            textOverflow: 'ellipsis',
                            cursor: 'help'
                          }} title={fb.feedbackText}>
                            {fb.feedbackText}
                          </div>
                        ) : '--'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {data?.pagination?.totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderTop: '1px solid var(--color-border)' }}>
                  <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                    Showing {(data.pagination.page - 1) * data.pagination.limit + 1} - {Math.min(data.pagination.page * data.pagination.limit, data.pagination.total)} of {data.pagination.total}
                  </span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      className="btn btn-secondary btn-sm" 
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft size={16} /> Prev
                    </button>
                    <button 
                      className="btn btn-secondary btn-sm" 
                      onClick={() => setPage(p => Math.min(data.pagination.totalPages, p + 1))}
                      disabled={page === data.pagination.totalPages}
                    >
                      Next <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminFeedback;
