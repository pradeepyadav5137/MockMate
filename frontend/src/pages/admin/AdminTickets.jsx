import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminService } from '../../services/services';
import { Download, Search, Loader, ChevronLeft, ChevronRight, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const AdminTickets = () => {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const queryClient = useQueryClient();

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 500);
    return () => clearTimeout(handler);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-tickets', page, status, debouncedSearch],
    queryFn: () => adminService.getTickets({ page, limit: 15, status, search: debouncedSearch }).then(res => res.data),
    keepPreviousData: true,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, newStatus }) => adminService.updateTicketStatus(id, newStatus),
    onSuccess: () => {
      toast.success('Ticket status updated');
      queryClient.invalidateQueries(['admin-tickets']);
    },
    onError: () => toast.error('Failed to update status'),
  });

  const handleExport = async () => {
    try {
      const response = await adminService.exportData('tickets');
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `mockmate_tickets_${new Date().toISOString().split('T')[0]}.csv`);
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
          <h1 className="page-title">Support Tickets</h1>
          <p className="page-subtitle">Manage and respond to user support requests.</p>
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
                  placeholder="Search by subject or ticket ID..." 
                  style={{ paddingLeft: '40px' }}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>
            <select className="form-input" style={{ flex: '1 1 150px', margin: 0 }} value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
              <option value="">All Statuses</option>
              <option value="Open">Open</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolved">Resolved</option>
              <option value="Closed">Closed</option>
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
              No tickets found matching your filters.
            </div>
          ) : (
            <>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <th style={{ padding: '16px', color: 'var(--color-text-secondary)', fontSize: '12px', textTransform: 'uppercase' }}>Ticket</th>
                    <th style={{ padding: '16px', color: 'var(--color-text-secondary)', fontSize: '12px', textTransform: 'uppercase' }}>Category</th>
                    <th style={{ padding: '16px', color: 'var(--color-text-secondary)', fontSize: '12px', textTransform: 'uppercase' }}>Date</th>
                    <th style={{ padding: '16px', color: 'var(--color-text-secondary)', fontSize: '12px', textTransform: 'uppercase' }}>Status</th>
                    <th style={{ padding: '16px', color: 'var(--color-text-secondary)', fontSize: '12px', textTransform: 'uppercase' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.items?.map(ticket => (
                    <tr key={ticket._id || ticket.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      <td style={{ padding: '16px' }}>
                        <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--color-text-primary)' }}>{ticket.subject}</div>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{ticket.ticketId} • {ticket.userId.substring(0, 10)}...</div>
                      </td>
                      <td style={{ padding: '16px', fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                        {ticket.category}
                      </td>
                      <td style={{ padding: '16px', fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                        {new Date(ticket.createdAt).toLocaleString('en-IN', { month: 'short', day: 'numeric' })}
                      </td>
                      <td style={{ padding: '16px' }}>
                        <span className={`badge`} style={{ 
                          background: ticket.status === 'Open' ? 'rgba(220,38,38,0.1)' : 
                                      ticket.status === 'Resolved' ? 'rgba(16,185,129,0.1)' : 
                                      'rgba(255,255,255,0.05)', 
                          color: ticket.status === 'Open' ? '#fca5a5' : 
                                 ticket.status === 'Resolved' ? '#6ee7b7' : '#cbd5e1' 
                        }}>
                          {ticket.status}
                        </span>
                      </td>
                      <td style={{ padding: '16px' }}>
                        <select 
                          className="form-input" 
                          style={{ padding: '4px 8px', fontSize: '12px', margin: 0, width: 'auto' }}
                          value={ticket.status}
                          onChange={(e) => statusMutation.mutate({ id: ticket._id || ticket.id, newStatus: e.target.value })}
                          disabled={statusMutation.isLoading}
                        >
                          <option value="Open">Open</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Resolved">Resolved</option>
                          <option value="Closed">Closed</option>
                        </select>
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

export default AdminTickets;
