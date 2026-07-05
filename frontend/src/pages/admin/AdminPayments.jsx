import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminService } from '../../services/services';
import { Download, Loader, ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const AdminPayments = () => {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-payments', page],
    queryFn: () => adminService.getPayments({ page, limit: 15 }).then(res => res.data),
    keepPreviousData: true,
  });

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title">Payments</h1>
          <p className="page-subtitle">Track and monitor Razorpay transactions across the platform.</p>
        </div>
      </div>

      <div className="page-content">
        <div className="glass-card" style={{ overflowX: 'auto' }}>
          {isLoading ? (
            <div style={{ padding: '40px', display: 'flex', justifyContent: 'center' }}>
              <Loader size={24} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          ) : data?.items?.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              No payments found.
            </div>
          ) : (
            <>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <th style={{ padding: '16px', color: 'var(--color-text-secondary)', fontSize: '12px', textTransform: 'uppercase' }}>Date</th>
                    <th style={{ padding: '16px', color: 'var(--color-text-secondary)', fontSize: '12px', textTransform: 'uppercase' }}>Transaction ID</th>
                    <th style={{ padding: '16px', color: 'var(--color-text-secondary)', fontSize: '12px', textTransform: 'uppercase' }}>Type / Plan</th>
                    <th style={{ padding: '16px', color: 'var(--color-text-secondary)', fontSize: '12px', textTransform: 'uppercase' }}>Amount</th>
                    <th style={{ padding: '16px', color: 'var(--color-text-secondary)', fontSize: '12px', textTransform: 'uppercase' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.items?.map(payment => (
                    <tr key={payment.paymentId} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      <td style={{ padding: '16px', fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                        {new Date(payment.createdAt).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ padding: '16px' }}>
                        <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--color-text-primary)' }}>{payment.paymentId}</div>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>User: {payment.userId.substring(0, 10)}...</div>
                      </td>
                      <td style={{ padding: '16px' }}>
                        <div style={{ fontSize: '14px', textTransform: 'capitalize', color: 'var(--color-text-secondary)' }}>
                          {payment.type.replace('_', ' ')}
                        </div>
                        <div style={{ fontSize: '12px', textTransform: 'capitalize', color: 'var(--color-text-muted)' }}>
                          {payment.pricingTier}
                        </div>
                      </td>
                      <td style={{ padding: '16px', fontSize: '15px', fontWeight: '600', color: 'var(--color-text-primary)' }}>
                        {payment.amount}
                      </td>
                      <td style={{ padding: '16px' }}>
                        <span style={{ fontSize: '13px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <CheckCircle size={14} /> Success
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

export default AdminPayments;
