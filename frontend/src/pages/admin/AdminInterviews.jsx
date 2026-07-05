import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminService } from '../../services/services';
import { Download, Search, Filter, Loader, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

const AdminInterviews = () => {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [plan, setPlan] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Handle debounce search
  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 500);
    return () => clearTimeout(handler);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-interviews', page, status, type, plan, debouncedSearch],
    queryFn: () => adminService.getInterviews({ page, limit: 15, status, type, plan, search: debouncedSearch }).then(res => res.data),
    keepPreviousData: true,
  });

  const handleExport = async () => {
    try {
      const response = await adminService.exportData('interviews');
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `mockmate_interviews_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      toast.success('Export successful');
    } catch (error) {
      toast.error('Failed to export data');
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '--';
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title">Interviews</h1>
          <p className="page-subtitle">Manage and monitor all interview sessions.</p>
        </div>
        <button onClick={handleExport} className="btn btn-secondary">
          <Download size={16} /> Export CSV
        </button>
      </div>

      <div className="page-content">
        <div className="glass-card" style={{ padding: '20px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ flex: '1 1 250px', margin: 0 }}>
              <div style={{ position: 'relative' }}>
                <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--color-text-muted)' }} />
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Search by role or ID..." 
                  style={{ paddingLeft: '40px' }}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>
            <select className="form-input" style={{ flex: '1 1 150px', margin: 0 }} value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
              <option value="">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="pending">Pending</option>
            </select>
            <select className="form-input" style={{ flex: '1 1 150px', margin: 0 }} value={type} onChange={e => { setType(e.target.value); setPage(1); }}>
              <option value="">All Types</option>
              <option value="full_mix">Full Mix</option>
              <option value="dsa">DSA</option>
              <option value="hr">HR</option>
              <option value="system_design">System Design</option>
              <option value="core_cs">Core CS</option>
            </select>
            <select className="form-input" style={{ flex: '1 1 150px', margin: 0 }} value={plan} onChange={e => { setPlan(e.target.value); setPage(1); }}>
              <option value="">All Plans</option>
              <option value="free">Free</option>
              <option value="basic">Basic</option>
              <option value="pro">Pro</option>
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
              No interviews found matching your filters.
            </div>
          ) : (
            <>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <th style={{ padding: '16px', color: 'var(--color-text-secondary)', fontSize: '12px', textTransform: 'uppercase' }}>Date</th>
                    <th style={{ padding: '16px', color: 'var(--color-text-secondary)', fontSize: '12px', textTransform: 'uppercase' }}>Role / User</th>
                    <th style={{ padding: '16px', color: 'var(--color-text-secondary)', fontSize: '12px', textTransform: 'uppercase' }}>Type</th>
                    <th style={{ padding: '16px', color: 'var(--color-text-secondary)', fontSize: '12px', textTransform: 'uppercase' }}>Plan</th>
                    <th style={{ padding: '16px', color: 'var(--color-text-secondary)', fontSize: '12px', textTransform: 'uppercase' }}>Duration</th>
                    <th style={{ padding: '16px', color: 'var(--color-text-secondary)', fontSize: '12px', textTransform: 'uppercase' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.items?.map(iv => (
                    <tr key={iv._id || iv.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      <td style={{ padding: '16px', fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                        {new Date(iv.createdAt).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ padding: '16px' }}>
                        <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--color-text-primary)' }}>{iv.role}</div>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{iv.userId.substring(0, 12)}...</div>
                      </td>
                      <td style={{ padding: '16px' }}>
                        <span className={`badge badge-${iv.interviewType === 'dsa' ? 'primary' : 'warning'}`} style={{ fontSize: '11px' }}>
                          {iv.interviewType}
                        </span>
                      </td>
                      <td style={{ padding: '16px', fontSize: '14px', textTransform: 'capitalize' }}>
                        <span style={{ color: iv.pricingTier === 'pro' ? '#c084fc' : iv.pricingTier === 'basic' ? '#60a5fa' : 'var(--color-text-secondary)' }}>
                          {iv.pricingTier}
                        </span>
                      </td>
                      <td style={{ padding: '16px', fontSize: '14px' }}>{formatDuration(iv.actualDuration)}</td>
                      <td style={{ padding: '16px' }}>
                        <span className={`badge badge-${iv.status === 'completed' ? 'primary' : iv.status === 'failed' ? 'error' : 'warning'}`}>
                          {iv.status}
                        </span>
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

export default AdminInterviews;
