import React, { useState, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Mic, Play, Pause, Download, Lock, Unlock, Clock, AlertCircle,
  Volume2, Calendar, FileAudio, Loader, CheckCircle, XCircle, CreditCard
} from 'lucide-react';
import { interviewService, recordingService, paymentService } from '../../services/services';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import '../../styles/globals.css';
import '../dashboard/Dashboard.css';
import './Recordings.css';

const INTERVIEW_TYPE_LABELS = {
  core_cs: 'Core CS',
  dsa: 'DSA',
  system_design: 'System Design',
  hr: 'HR / Behavioral',
  full_mix: 'Full Mix',
};

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

const getTimeRemaining = (expiresAt) => {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt) - new Date();
  if (diff <= 0) return 'Expired';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${mins}m remaining`;
  return `${mins}m remaining`;
};

const RecordingStatusBadge = ({ interview }) => {
  const status = interview.recordingStatus;
  const isExpired = interview.recordingDeletedAt || status === 'expired';
  const isReady = !isExpired && !!interview.recordingPath;
  const isPending = !isReady && !isExpired && (
    status === 'recording' ||
    status === 'pending' ||
    (!status && (Date.now() - new Date(interview.completedAt || interview.createdAt).getTime() < 120000))
  );

  if (isExpired) {
    return (
      <span className="rec-badge rec-badge--expired">
        <XCircle size={12} /> Expired
      </span>
    );
  }
  if (isReady) {
    return (
      <span className="rec-badge rec-badge--ready">
        <CheckCircle size={12} /> Ready
      </span>
    );
  }
  if (isPending) {
    return (
      <span className="rec-badge rec-badge--pending">
        <Loader size={12} className="spin" /> Processing
      </span>
    );
  }
  return (
    <span className="rec-badge rec-badge--none">
      <AlertCircle size={12} /> N/A
    </span>
  );
};

const RecordingCard = ({ interview, onUnlockSuccess }) => {
  const { user } = useAuth();
  const [playing, setPlaying] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const audioRef = useRef(null);
  const queryClient = useQueryClient();

  const isExpired = interview.recordingDeletedAt || interview.recordingStatus === 'expired';
  const isReady = !isExpired && !!interview.recordingPath;
  const status = interview.recordingStatus;
  const isPending = !isReady && !isExpired && (
    status === 'recording' ||
    status === 'pending' ||
    (!status && (Date.now() - new Date(interview.completedAt || interview.createdAt).getTime() < 120000))
  );
  const isPro = interview.pricingTier === 'pro';
  const isUnlocked = isPro || interview.recordingUnlocked;
  const hasAccess = isReady && isUnlocked;
  const isLocked = isReady && !isUnlocked;
  const timeRemaining = getTimeRemaining(interview.recordingExpiresAt);
  const expiresExpired = timeRemaining === 'Expired';

  const apiBase = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
  const token = localStorage.getItem('aic_token');
  const streamUrl = hasAccess ? `${apiBase}/storage/recordings/${interview._id}/stream?token=${encodeURIComponent(token || '')}` : null;

  const togglePlay = useCallback(() => {
    if (!audioRef.current || !streamUrl) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      // Set auth headers for streaming
      audioRef.current.src = streamUrl;
      audioRef.current.play().then(() => setPlaying(true)).catch((err) => {
        console.error('Playback failed:', err);
        toast.error('Playback failed. Try again.');
      });
    }
  }, [playing, streamUrl]);

  const handleDownload = useCallback(async () => {
    if (!hasAccess) return;
    try {
      const response = await fetch(`${apiBase}/storage/recordings/${interview._id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mockmate-${interview._id}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Download started!');
    } catch (err) {
      toast.error('Download failed.');
      console.error(err);
    }
  }, [hasAccess, interview._id, apiBase, token]);

  const handleUnlock = useCallback(async () => {
    setUnlocking(true);
    try {
      const idempotencyKey = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
      const orderRes = await paymentService.createOrder({
        type: 'recording_unlock',
        interviewId: interview._id,
        idempotencyKey,
      });
      const { orderId, amount, keyId } = orderRes.data;

      const options = {
        key: keyId,
        amount,
        currency: 'INR',
        name: 'MockMate',
        description: 'Unlock Interview Recording — ₹9',
        order_id: orderId,
        handler: async (response) => {
          try {
            await paymentService.verify({
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
              type: 'recording',
              interviewId: interview._id,
            });
            toast.success('Recording unlocked! 🎉');
            queryClient.invalidateQueries(['interviews']);
            if (onUnlockSuccess) onUnlockSuccess();
          } catch (err) {
            toast.error('Payment verification failed.');
          }
        },
        prefill: { name: user?.name, email: user?.email },
        theme: { color: '#14b8a6' },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not initiate payment. Recording may have expired.');
    } finally {
      setUnlocking(false);
    }
  }, [interview._id, user, queryClient, onUnlockSuccess]);

  return (
    <div className={`rec-card glass-card ${isExpired || expiresExpired ? 'rec-card--expired' : ''}`}>
      {/* Hidden audio element with auth */}
      {hasAccess && (
        <audio
          ref={audioRef}
          preload="none"
          onEnded={() => setPlaying(false)}
          onError={() => { setPlaying(false); toast.error('Audio playback error.'); }}
          crossOrigin="use-credentials"
        >
          <source src={`${streamUrl}`} type="audio/webm" />
        </audio>
      )}

      <div className="rec-card-header">
        <div className="rec-card-icon">
          <FileAudio size={20} />
        </div>
        <div className="rec-card-meta">
          <h3 className="rec-card-role">{interview.role || 'Interview'}</h3>
          <span className="rec-card-type">
            {INTERVIEW_TYPE_LABELS[interview.interviewType] || interview.interviewType}
          </span>
        </div>
        <RecordingStatusBadge interview={interview} />
      </div>

      <div className="rec-card-details">
        <div className="rec-detail">
          <Calendar size={13} />
          <span>{formatDate(interview.createdAt)}</span>
        </div>
        <div className="rec-detail">
          <Clock size={13} />
          <span>
            {interview.actualDuration
              ? `${Math.round(interview.actualDuration / 60)} min`
              : `${interview.maxDurationMinutes || '—'} min`}
          </span>
        </div>
        {interview.recordingExpiresAt && !isExpired && (
          <div className={`rec-detail ${expiresExpired ? 'rec-detail--expired' : timeRemaining?.includes('m remaining') && !timeRemaining?.includes('h') ? 'rec-detail--warning' : ''}`}>
            <AlertCircle size={13} />
            <span>{expiresExpired ? 'Expired' : timeRemaining}</span>
          </div>
        )}
        {isPro && (
          <div className="rec-detail rec-detail--pro">
            <Unlock size={13} />
            <span>Pro — Free Access</span>
          </div>
        )}
      </div>

      <div className="rec-card-actions">
        {(isExpired || expiresExpired) && (
          <div className="rec-expired-msg">
            <XCircle size={14} />
            <span>Recording expired and deleted</span>
          </div>
        )}

        {isReady && !expiresExpired && hasAccess && (
          <>
            <button
              className={`rec-btn rec-btn--play ${playing ? 'rec-btn--playing' : ''}`}
              onClick={togglePlay}
            >
              {playing ? <Pause size={16} /> : <Play size={16} />}
              <span>{playing ? 'Pause' : 'Play'}</span>
            </button>
            <button className="rec-btn rec-btn--download" onClick={handleDownload}>
              <Download size={16} />
              <span>Download</span>
            </button>
          </>
        )}

        {isLocked && !expiresExpired && (
          <button
            className="rec-btn rec-btn--unlock"
            onClick={handleUnlock}
            disabled={unlocking}
          >
            {unlocking ? (
              <Loader size={16} className="spin" />
            ) : (
              <Lock size={16} />
            )}
            <span>{unlocking ? 'Processing...' : 'Unlock Recording — ₹9'}</span>
          </button>
        )}

        {isPending && (
          <div className="rec-pending-msg">
            <Loader size={14} className="spin" />
            <span>Recording is being processed...</span>
          </div>
        )}

        {!isReady && !isExpired && !expiresExpired && !isPending && (
          <div className="rec-expired-msg" style={{ color: '#94a3b8' }}>
            <AlertCircle size={14} />
            <span>Recording not available</span>
          </div>
        )}
      </div>
    </div>
  );
};

const Recordings = () => {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['interviews'],
    queryFn: () => interviewService.getAll().then((r) => r.data.interviews),
  });

  // Filter to only completed interviews (every interview should have a recording attempt)
  const completedInterviews = data?.filter(
    (iv) => iv.status === 'completed'
  )?.sort((a, b) => new Date(b.completedAt || b.createdAt) - new Date(a.completedAt || a.createdAt)) || [];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Interview Recordings</h1>
        <p className="page-subtitle">Listen back to your practice sessions · Recordings available for 24 hours</p>
      </div>

      <div className="page-content">
        <div className="rec-info-bar glass-card animate-fade-in-up">
          <div className="rec-info-item">
            <Volume2 size={16} style={{ color: '#14b8a6' }} />
            <span>Every interview is automatically recorded</span>
          </div>
          <div className="rec-info-item">
            <CreditCard size={16} style={{ color: '#a78bfa' }} />
            <span>Pro (₹19) = free access · Others = unlock for ₹9</span>
          </div>
          <div className="rec-info-item">
            <Clock size={16} style={{ color: '#fbbf24' }} />
            <span>Recordings expire after 24 hours</span>
          </div>
        </div>

        {isLoading ? (
          <div className="glass-card dashboard-section animate-fade-in-up" style={{ padding: 40 }}>
            <div className="table-loading">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 140, marginBottom: 16, borderRadius: 12 }} />
              ))}
            </div>
          </div>
        ) : completedInterviews.length === 0 ? (
          <div className="glass-card dashboard-section animate-fade-in-up">
            <div className="empty-state">
              <div className="empty-icon">🎙️</div>
              <h3>No recordings yet</h3>
              <p>Complete a mock interview to get an audio recording.</p>
              <Link to="/dashboard/start" className="btn btn-primary">Start Interview</Link>
            </div>
          </div>
        ) : (
          <div className="rec-grid animate-fade-in-up">
            {completedInterviews.map((iv) => (
              <RecordingCard
                key={iv._id}
                interview={iv}
                onUnlockSuccess={() => queryClient.invalidateQueries(['interviews'])}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Recordings;
