import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminService } from '../../services/services';
import { Download, Search, Loader, ChevronLeft, ChevronRight, User } from 'lucide-react';
import toast from 'react-hot-toast';

const AdminUsers = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 500);
    return () => clearTimeout(handler);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', page, debouncedSearch],
    queryFn: () => adminService.getUsers({ page, limit: 15, search: debouncedSearch }).then(res => res.data),
    keepPreviousData: true,
  });

  const handleExport = async () => {
    try {
      const response = await adminService.exportData('users');
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `mockmate_users_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      toast.success('Export successful');
    } catch (error) {
      toast.error('Failed to export data');
    }
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title">Users</h1>
          <p className="page-subtitle">Manage registered candidates and accounts.</p>
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
                  placeholder="Search by name, email, or ID..." 
                  style={{ paddingLeft: '40px' }}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="glass-card" style={{ overflowX: 'auto' }}>
          {isLoading ? (
            <div style={{ padding: '40px', display: 'flex', justifyContent: 'center' }}>
              <Loader size={24} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          ) : data?.items?.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              No users found matching your filters.
            </div>
          ) : (
            <>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <th style={{ padding: '16px', color: 'var(--color-text-secondary)', fontSize: '12px', textTransform: 'uppercase' }}>User</th>
                    <th style={{ padding: '16px', color: 'var(--color-text-secondary)', fontSize: '12px', textTransform: 'uppercase' }}>Status</th>
                    <th style={{ padding: '16px', color: 'var(--color-text-secondary)', fontSize: '12px', textTransform: 'uppercase' }}>Role</th>
                    <th style={{ padding: '16px', color: 'var(--color-text-secondary)', fontSize: '12px', textTransform: 'uppercase' }}>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.items?.map(user => (
                    <tr key={user._id || user.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      <td style={{ padding: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {user.avatar ? (
                            <img src={user.avatar} alt={user.name} style={{ width: '36px', height: '36px', borderRadius: '50%' }} />
                          ) : (
                            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <User size={16} />
                            </div>
                          )}
                          <div>
                            <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--color-text-primary)' }}>{user.name}</div>
                            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '16px' }}>
                        {user.isVerified ? (
                          <span style={{ fontSize: '12px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} /> Verified
                          </span>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b' }} /> Unverified
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '16px', fontSize: '14px', textTransform: 'capitalize', color: user.role === 'admin' ? '#f43f5e' : 'var(--color-text-secondary)' }}>
                        {user.role || 'user'}
                      </td>
                      <td style={{ padding: '16px', fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                        {new Date(user.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
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

export default AdminUsers;
