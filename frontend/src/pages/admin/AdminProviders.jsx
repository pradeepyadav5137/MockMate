import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminService } from '../../services/services';
import { Activity, RefreshCw, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

const AdminProviders = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-providers'],
    queryFn: () => adminService.getProviders().then(res => res.data.health),
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await adminService.getProviders(true); // force refresh
    await refetch();
    setIsRefreshing(false);
  };

  const getStatusIcon = (status) => {
    if (status === 'healthy' || status === 'configured') return <CheckCircle size={20} color="#10b981" />;
    if (status === 'down') return <XCircle size={20} color="#ef4444" />;
    if (status === 'not_configured') return <AlertTriangle size={20} color="#64748b" />;
    return <AlertTriangle size={20} color="#f59e0b" />;
  };

  const providers = data?.providers || {};
  const lastChecked = data?.lastChecked ? new Date(data.lastChecked).toLocaleString() : '--';

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title">Provider Health</h1>
          <p className="page-subtitle">Monitor status and latency of external AI and infrastructure providers.</p>
          <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)', fontSize: '13px', color: '#93c5fd', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <p style={{ margin: 0 }}><strong>Note on API Limits:</strong> The "Healthy" status indicates successful connection and valid API keys. It <strong>does not</strong> check if your free tier credits (like Cartesia or Deepgram limits) are exhausted, as pinging their generation endpoints would consume your remaining balance.</p>
          </div>
        </div>
        <button 
          onClick={handleRefresh} 
          className="btn btn-secondary"
          disabled={isRefreshing || isLoading}
        >
          <RefreshCw size={16} className={isRefreshing ? 'spin' : ''} /> Refresh
        </button>
      </div>

      <div className="page-content">
        <div style={{ marginBottom: '16px', fontSize: '13px', color: 'var(--color-text-muted)' }}>
          Last checked: {lastChecked}
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
          {Object.entries(providers).map(([key, info]) => (
            <div key={key} className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', textTransform: 'capitalize' }}>
                  {key.replace('_', ' ')}
                </h3>
                {getStatusIcon(info.status)}
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Status:</span>
                  <span style={{ fontWeight: '500', color: info.status === 'down' ? '#ef4444' : 'var(--color-text-primary)' }}>
                    {info.status.replace('_', ' ')}
                  </span>
                </div>
                
                {info.latency !== undefined && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                    <span style={{ color: 'var(--color-text-secondary)' }}>Latency:</span>
                    <span style={{ fontWeight: '500', color: 'var(--color-text-primary)' }}>
                      {info.latency}ms
                    </span>
                  </div>
                )}
                
                {info.error && (
                  <div style={{ marginTop: '8px', padding: '12px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                    <p style={{ fontSize: '12px', color: '#fca5a5', margin: 0, wordBreak: 'break-word' }}>{info.error}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminProviders;
