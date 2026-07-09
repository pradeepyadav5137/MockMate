import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, TrendingUp, MessageSquare, Zap, BarChart2,
  Download, ChevronDown, ChevronUp, BookOpen, AlertCircle, CheckCircle,
  Volume2, Lock
} from 'lucide-react';
import { feedbackService, paymentService } from '../../services/services';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import '../../styles/globals.css';
import './FeedbackPage.css';

const ScoreCircle = ({ score, label, color, size = 100 }) => {
  const strokeW = size > 100 ? 10 : 7;
  const r = (size - strokeW * 2) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="score-circle-wrapper" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', filter: `drop-shadow(0 0 10px ${color}40)` }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeW} />
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none" stroke={color} strokeWidth={strokeW}
            strokeDasharray={circumference} strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)' }}
          />
        </svg>
        <div className="score-circle-text" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', alignItems: 'baseline', gap: '2px' }}>
          <span className="score-value" style={{ color }}>{score}</span>
          <span className="score-unit">%</span>
        </div>
      </div>
      <div className="score-label">{label}</div>
    </div>
  );
};

const QuestionCard = ({ item, index }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="question-card glass-card">
      <div className="question-card-header" onClick={() => setExpanded(!expanded)}>
        <div className="question-number">Q{index + 1}</div>
        <div className="question-preview">
          <p className="question-text">{item.question}</p>
          <div className={`score-badge-inline ${getScoreClass(item.score)}`}>{item.score}%</div>
        </div>
        <button className="expand-btn">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {expanded && (
        <div className="question-card-body animate-fade-in-up">
          <div className="qb-section">
            <h4>Your Answer</h4>
            <p>{item.candidateAnswer}</p>
          </div>
          <div className="qb-section">
            <h4>Evaluation</h4>
            <p>{item.evaluation}</p>
          </div>
          {item.missedPoints?.length > 0 && (
            <div className="qb-section qb-missed">
              <h4><AlertCircle size={13} /> Missing Points</h4>
              <ul>
                {item.missedPoints.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </div>
          )}
          <div className="qb-section qb-suggested">
            <h4><CheckCircle size={13} /> Suggested Better Answer</h4>
            <p>{item.suggestedAnswer}</p>
          </div>
        </div>
      )}
    </div>
  );
};

const FeedbackPage = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [unlockLoading, setUnlockLoading] = useState(false);
  const [unlockedRecordingUrl, setUnlockedRecordingUrl] = useState(null);

  const { data: feedbackData, isLoading, isError } = useQuery({
    queryKey: ['feedback', id],
    queryFn: async () => {
      try {
        const response = await feedbackService.getFeedback(id);
        return response.data.feedback;
      } catch (err) {
        if (err.response?.status === 202) return null;
        throw err;
      }
    },
    refetchInterval: (query) => (query.state.data ? false : 3000),
    retry: (failureCount, err) => err.response?.status === 202 || failureCount < 3,
    retryDelay: 3000,
  });

  useQuery({
    queryKey: ['transcript', id],
    queryFn: () => feedbackService.getTranscript(id).then((r) => r.data.transcript),
  });

  // refetch feedback data after recording unlock to get updated interview state
  const { refetch: refetchFeedback } = useQuery({
    queryKey: ['feedback', id],
    enabled: false,
  });

  const handleUnlockRecording = async () => {
    setUnlockLoading(true);
    try {
      const idempotencyKey = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
      const orderRes = await paymentService.createOrder({ type: 'recording_unlock', interviewId: id, idempotencyKey });
      const { orderId, amount, keyId } = orderRes.data;

      const options = {
        key: keyId,
        amount,
        currency: 'INR',
        name: 'MockMate',
        description: 'Unlock Interview Recording',
        order_id: orderId,
        handler: async (response) => {
          try {
            await paymentService.verify({
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
              type: 'recording',
              interviewId: id,
            });
            toast.success('Recording unlocked! 🎉');
            const apiBase = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
            setUnlockedRecordingUrl(`${apiBase}/storage/recordings/${id}/stream?token=${encodeURIComponent(localStorage.getItem('aic_token') || '')}`);
            refetchFeedback();
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
      toast.error(err.response?.data?.message || 'Payment initiation failed or recording expired.');
    } finally {
      setUnlockLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="feedback-loading">
        <div style={{ fontSize: 48, marginBottom: 16 }}>🤖</div>
        <h2>Generating Your Feedback...</h2>
        <p>Our AI is carefully reviewing your interview performance. This takes about 30–60 seconds.</p>
        <div className="spinner" style={{ width: 36, height: 36, marginTop: 16 }} />
      </div>
    );
  }

  if (!isError && !feedbackData) {
    return (
      <div className="feedback-loading">
        <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
        <h2>Generating Your Feedback...</h2>
        <p>Our AI is reviewing your interview. This page updates automatically when the report is ready.</p>
        <div className="spinner" style={{ width: 36, height: 36, marginTop: 16 }} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="feedback-loading">
        <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
        <h2>Feedback is being generated</h2>
        <p>Please check back in a minute. You can also refresh the page.</p>
        <button className="btn btn-secondary" onClick={() => window.location.reload()}>Refresh</button>
      </div>
    );
  }

  const f = feedbackData;
  const score = (primary, fallback = 0) => Number(primary ?? fallback ?? 0);

  return (
    <div>
      <div className="page-header">
        <div className="dashboard-header-content">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link to="/dashboard/history" className="btn btn-ghost btn-sm">
              <ArrowLeft size={16} /> Back
            </Link>
            <div>
              <h1 className="page-title">Interview Feedback</h1>
              <p className="page-subtitle">Detailed performance analysis from your AI interviewer</p>
            </div>
          </div>
          {f.pdfUrl && (
            <a href={f.pdfUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
              <Download size={16} /> Download PDF Report
            </a>
          )}
        </div>
      </div>

      <div className="page-content">
        {f.status === 'failed' ? (
          <div className="feedback-hero glass-card animate-fade-in-up" style={{ padding: 48, textAlign: 'center' }}>
            <AlertCircle size={48} style={{ color: '#f59e0b', margin: '0 auto 16px' }} />
            <h2 style={{ fontSize: 24, marginBottom: 12, color: '#f1f5f9' }}>Feedback Temporarily Unavailable</h2>
            <p style={{ color: '#94a3b8', fontSize: 16, maxWidth: 600, margin: '0 auto 24px', lineHeight: 1.6 }}>
              {f.summary}
            </p>
            {f.fallbackError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: 12, borderRadius: 8, display: 'inline-block' }}>
                <p style={{ color: '#ef4444', fontSize: 13, margin: 0, fontFamily: 'monospace' }}>
                  Technical detail: {f.fallbackError}
                </p>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Overall Score */}
            <div className="feedback-hero glass-card animate-fade-in-up">
          <div className="feedback-hero-left">
            <div className="overall-score-ring">
              <ScoreCircle score={f.overallScore || 0} label="Overall" color="#14b8a6" size={160} />
            </div>
          </div>
          <div className="feedback-hero-right">
            <h2 className="feedback-overall-label">Overall Performance</h2>
            <p className="feedback-summary">{f.summary}</p>

            <div className="score-grid">
              <ScoreCircle score={score(f.technicalScore, f.scores?.technical)} label="Technical" color="#f59e0b" size={100} />
              <ScoreCircle score={score(f.communicationScore, f.scores?.communication)} label="Communication" color="#06b6d4" size={100} />
              <ScoreCircle score={score(f.confidenceScore, f.scores?.confidence)} label="Confidence" color="#10b981" size={100} />
              <ScoreCircle score={score(f.problemSolvingScore, f.scores?.problemSolving)} label="Problem Solving" color="#8b5cf6" size={100} />
            </div>
          </div>
        </div>
        </>
        )}

        {/* Recording Section */}
        {f.interview && (f.interview.recordingPath || f.interview.recordingStatus) && (
          <div className="recording-section glass-card animate-fade-in-up" style={{ padding: 24, marginTop: 24 }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 16px 0', fontSize: 18, color: '#e2e8f0' }}>
              <Volume2 size={20} style={{ color: '#14b8a6' }} />
              Interview Audio Recording
            </h3>

            {(() => {
              const isPro = f.interview.pricingTier === 'pro';
              const isUnlocked = isPro || f.interview.recordingUnlocked || !!unlockedRecordingUrl;
              const isExpired = f.interview.recordingDeletedAt || f.interview.recordingStatus === 'expired';
              const hasFile = f.interview.recordingPath && !isExpired;
              const apiBase = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

              if (isExpired) {
                return (
                  <p style={{ color: '#f87171', fontSize: 14 }}>
                    This recording has expired and been deleted after 24 hours.
                  </p>
                );
              }

              if (!hasFile) {
                return (
                  <p style={{ color: '#fbbf24', fontSize: 14 }}>
                    Recording is still being processed. Please check back shortly.
                  </p>
                );
              }

              if (isUnlocked) {
                return (
                  <div className="recording-player-wrapper">
                    <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 12 }}>
                      {isPro ? (
                        <span style={{ color: '#a78bfa', fontWeight: 600 }}>✨ Pro — Free recording access included</span>
                      ) : (
                        <span style={{ color: '#6ee7b7', fontWeight: 600 }}>✅ Recording unlocked</span>
                      )}
                      {' · '}Listen back to analyze your pacing, voice clarity, and filler words.
                    </p>
                    <audio
                      controls
                      src={unlockedRecordingUrl || `${apiBase}/storage/recordings/${id}/stream?token=${encodeURIComponent(localStorage.getItem('aic_token') || '')}`}
                      style={{ width: '100%', marginTop: 8 }}
                    />
                    <div style={{ marginTop: 12 }}>
                      <a
                        href={`${apiBase}/storage/recordings/${id}/download`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary"
                        style={{ fontSize: 13, padding: '8px 16px' }}
                        onClick={(e) => {
                          e.preventDefault();
                          const token = localStorage.getItem('aic_token');
                          fetch(`${apiBase}/storage/recordings/${id}/download`, {
                            headers: { Authorization: `Bearer ${token}` },
                          }).then(r => r.blob()).then(blob => {
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `mockmate-${id}.webm`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                          }).catch(() => toast.error('Download failed'));
                        }}
                      >
                        <Download size={14} style={{ marginRight: 4 }} /> Download Recording
                      </a>
                    </div>
                  </div>
                );
              }

              // Locked
              return (
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  <Lock size={32} style={{ color: '#f59e0b', marginBottom: 12 }} />
                  <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 16 }}>
                    Your recording is ready but locked. Unlock it to listen and download.
                  </p>
                  <button
                    className="btn btn-primary"
                    onClick={handleUnlockRecording}
                    disabled={unlockLoading}
                    style={{
                      background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                      border: 'none',
                      padding: '12px 24px',
                      fontSize: 14,
                      fontWeight: 600,
                    }}
                  >
                    {unlockLoading ? 'Processing...' : '🔓 Unlock Recording — ₹9'}
                  </button>
                </div>
              );
            })()}
          </div>
        )}

      {f.status !== 'failed' && (
        <>
        {/* Evaluations */}
        <div className="eval-grid animate-fade-in-up">
          {[
            { title: 'Technical', icon: BarChart2, color: '#f59e0b', text: f.technicalEvaluation },
            { title: 'Communication', icon: MessageSquare, color: '#06b6d4', text: f.communicationEvaluation },
            { title: 'Confidence', icon: Zap, color: '#10b981', text: f.confidenceEvaluation },
            { title: 'Problem Solving', icon: TrendingUp, color: '#8b5cf6', text: f.problemSolvingEvaluation },
          ].map(({ title, icon: Icon, color, text }) => (
            <div key={title} className="eval-card glass-card">
              <div className="eval-header">
                <Icon size={16} style={{ color }} />
                <span>{title}</span>
              </div>
              <p>{text || 'No evaluation available.'}</p>
            </div>
          ))}
        </div>

        {/* Strengths & Weaknesses */}
        <div className="sw-grid animate-fade-in-up">
          <div className="glass-card sw-card">
            <h3><CheckCircle size={16} style={{ color: '#6ee7b7' }} /> Strengths</h3>
            <ul className="sw-list">
              {(f.strengths || []).map((s, i) => (
                <li key={i} className="sw-item strength">{s}</li>
              ))}
            </ul>
          </div>
          <div className="glass-card sw-card">
            <h3><AlertCircle size={16} style={{ color: '#fca5a5' }} /> Areas for Improvement</h3>
            <ul className="sw-list">
              {(f.weaknesses || []).map((w, i) => (
                <li key={i} className="sw-item weakness">{w}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Question Breakdown */}
        {f.questionBreakdown?.length > 0 && (
          <div className="animate-fade-in-up">
            <h2 className="section-title" style={{ marginBottom: 16 }}>Question-by-Question Breakdown</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {f.questionBreakdown.map((item, i) => (
                <QuestionCard key={i} item={item} index={i} />
              ))}
            </div>
          </div>
        )}

        {/* Learning Roadmap */}
        {f.learningRoadmap?.length > 0 && (
          <div className="glass-card animate-fade-in-up" style={{ padding: 24 }}>
            <h2 className="section-title" style={{ marginBottom: 20 }}>
              <BookOpen size={18} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }} />
              Personalized Learning Roadmap
            </h2>
            <div className="roadmap-grid">
              {f.learningRoadmap.map((item, i) => (
                <div key={i} className="roadmap-item">
                  <div className="roadmap-header">
                    <span className={`badge badge-${item.priority === 'High' ? 'danger' : item.priority === 'Medium' ? 'warning' : 'success'}`}>
                      {item.priority}
                    </span>
                    <h4>{item.topic}</h4>
                  </div>
                  <div className="roadmap-resources">
                    {(item.resources || []).map((r, j) => (
                      <a key={j} href={r.url} target="_blank" rel="noopener noreferrer" className="resource-link">
                        {r.type === 'video' ? '🎬' : r.type === 'course' ? '🎓' : '📖'} {r.title}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Interviewer Remarks */}
        {f.interviewerRemarks && (
          <div className="interviewer-remarks animate-fade-in-up">
            <div className="remarks-avatar">🎯</div>
            <div className="remarks-content">
              <div className="remarks-label">Alex — Your AI Interviewer</div>
              <p className="remarks-text">"{f.interviewerRemarks}"</p>
            </div>
          </div>
        )}
        </>
        )}
      </div>
    </div>
  );
};

const getScoreClass = (score) => {
  if (score >= 80) return 'score-high';
  if (score >= 60) return 'score-medium';
  return 'score-low';
};

export default FeedbackPage;
