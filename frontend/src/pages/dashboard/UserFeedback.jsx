import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Star, MessageSquare, ThumbsUp, Send, CheckCircle, Clock, Mic,
  Brain, HelpCircle, Award, Heart, ChevronDown, Loader
} from 'lucide-react';
import { userFeedbackService, interviewService } from '../../services/services';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import '../../styles/globals.css';
import '../dashboard/Dashboard.css';
import './UserFeedback.css';

// ========== Star Rating Component ==========
const StarRating = ({ value, onChange, label, disabled }) => {
  const [hover, setHover] = useState(0);

  return (
    <div className="uf-star-rating-group">
      <span className="uf-star-label">{label}</span>
      <div className="uf-stars">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            className={`uf-star-btn ${star <= (hover || value) ? 'active' : ''}`}
            onMouseEnter={() => !disabled && setHover(star)}
            onMouseLeave={() => !disabled && setHover(0)}
            onClick={() => !disabled && onChange(star)}
            disabled={disabled}
            aria-label={`${star} star${star > 1 ? 's' : ''}`}
          >
            <Star size={20} fill={star <= (hover || value) ? 'currentColor' : 'none'} />
          </button>
        ))}
        <span className="uf-star-count">{value > 0 ? `${value}/5` : ''}</span>
      </div>
    </div>
  );
};

// ========== Recommend Selector ==========
const RecommendSelector = ({ value, onChange, disabled }) => (
  <div className="uf-recommend-group">
    <span className="uf-star-label">Would you recommend MockMate?</span>
    <div className="uf-recommend-options">
      {[
        { val: 'Yes', icon: '👍', color: '#10b981' },
        { val: 'Maybe', icon: '🤔', color: '#f59e0b' },
        { val: 'No', icon: '👎', color: '#ef4444' },
      ].map(({ val, icon, color }) => (
        <button
          key={val}
          type="button"
          className={`uf-recommend-btn ${value === val ? 'active' : ''}`}
          style={value === val ? { borderColor: color, background: `${color}15` } : {}}
          onClick={() => !disabled && onChange(val)}
          disabled={disabled}
        >
          <span className="uf-recommend-emoji">{icon}</span>
          <span>{val}</span>
        </button>
      ))}
    </div>
  </div>
);

// ========== Feedback Form ==========
const FeedbackForm = ({ interview, type, onSuccess }) => {
  const [overallRating, setOverallRating] = useState(0);
  const [interviewQualityRating, setInterviewQualityRating] = useState(0);
  const [aiVoiceQualityRating, setAiVoiceQualityRating] = useState(0);
  const [questionRelevanceRating, setQuestionRelevanceRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState('');
  const [wouldRecommend, setWouldRecommend] = useState('');
  const [helpfulFor, setHelpfulFor] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (overallRating === 0) {
      toast.error('Please provide an overall experience rating.');
      return;
    }

    setSubmitting(true);
    try {
      await userFeedbackService.submit({
        interviewId: type === 'improvement' && interview ? (interview._id || interview.id) : null,
        type,
        overallRating,
        interviewQualityRating: interviewQualityRating || overallRating,
        aiVoiceQualityRating: aiVoiceQualityRating || overallRating,
        questionRelevanceRating: questionRelevanceRating || overallRating,
        feedbackText,
        wouldRecommend: wouldRecommend || null,
        helpfulFor: helpfulFor || null,
        companyName: companyName || null,
      });
      toast.success('Thank you for your feedback! 🎉');
      onSuccess();
    } catch (err) {
      if (err.response?.status === 409) {
        toast.error('You already submitted feedback for this interview.');
        onSuccess();
      } else {
        toast.error(err.response?.data?.message || 'Failed to submit feedback.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="uf-form" onSubmit={handleSubmit}>
      {/* Interview info (Only for Improvement) */}
      {type === 'improvement' && interview && (
        <div className="uf-interview-info">
          <div className="uf-interview-meta">
            <span className="uf-meta-role">{interview.role}</span>
            <span className={`badge badge-${interview.interviewType === 'dsa' ? 'primary' : interview.interviewType === 'hr' ? 'info' : 'warning'}`}>
              {interview.interviewType}
            </span>
            <span className="uf-meta-date">
              {new Date(interview.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
        </div>
      )}

      {/* Testimony public note */}
      {type === 'testimony' && (
        <div style={{ padding: '12px', background: 'rgba(20, 184, 166, 0.1)', border: '1px solid rgba(20, 184, 166, 0.2)', borderRadius: '8px', color: '#99f6e4', fontSize: '13px', marginBottom: '16px' }}>
          💡 <strong>Awesome!</strong> This testimony will be showcased on our website to inspire other users.
        </div>
      )}

      {/* Testimony extra fields */}
      {type === 'testimony' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '16px' }}>
          <div className="form-group">
            <label className="form-label">How did MockMate help you?</label>
            <select className="form-input" value={helpfulFor} onChange={e => setHelpfulFor(e.target.value)} disabled={submitting}>
              <option value="">Select an option...</option>
              <option value="Got a Job">Got a Job</option>
              <option value="Got an Internship">Got an Internship</option>
              <option value="Skill Improvement">Skill Improvement</option>
              <option value="Other">Other</option>
            </select>
          </div>
          {(helpfulFor === 'Got a Job' || helpfulFor === 'Got an Internship') && (
            <div className="form-group animate-fade-in-up">
              <label className="form-label">Company Name</label>
              <input type="text" className="form-input" placeholder="e.g. Google, Amazon, Startup Inc." value={companyName} onChange={e => setCompanyName(e.target.value)} disabled={submitting} />
            </div>
          )}
        </div>
      )}

      {/* Ratings */}
      <div className="uf-ratings-grid">
        <StarRating label="Overall Experience" value={overallRating} onChange={setOverallRating} disabled={submitting} />
        <StarRating label="Interview Quality" value={interviewQualityRating} onChange={setInterviewQualityRating} disabled={submitting} />
        <StarRating label="AI Voice Quality" value={aiVoiceQualityRating} onChange={setAiVoiceQualityRating} disabled={submitting} />
        <StarRating label="Question Relevance" value={questionRelevanceRating} onChange={setQuestionRelevanceRating} disabled={submitting} />
      </div>

      {/* Recommend */}
      <RecommendSelector value={wouldRecommend} onChange={setWouldRecommend} disabled={submitting} />

      {/* Text feedback */}
      <div className="form-group">
        <label className="form-label" htmlFor={`uf-text-${interview?._id || 'testimony'}`}>
          {type === 'testimony' ? 'Your Testimony (Optional)' : 'Suggestions for Improvement (Optional)'}
        </label>
        <textarea
          id={`uf-text-${interview?._id || 'testimony'}`}
          className="form-input uf-textarea"
          placeholder={type === 'testimony'
            ? 'Share your experience with MockMate...'
            : 'What could we improve? Any bugs, missing features, or suggestions...'
          }
          value={feedbackText}
          onChange={(e) => setFeedbackText(e.target.value)}
          maxLength={5000}
          disabled={submitting}
        />
      </div>

      {/* Actions */}
      <div className="uf-form-actions">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={submitting || overallRating === 0}
          id="uf-submit-btn"
        >
          {submitting ? (
            <>
              <Loader size={16} style={{ animation: 'spin 0.8s linear infinite' }} />
              Submitting...
            </>
          ) : (
            <>
              <Send size={16} />
              Submit {type === 'testimony' ? 'Testimony' : 'Feedback'}
            </>
          )}
        </button>
      </div>
    </form>
  );
};

// ========== Feedback Card (submitted) ==========
const FeedbackCard = ({ feedback }) => {
  const renderStars = (count) => (
    <div className="uf-stars-display">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} size={14} fill={s <= count ? 'currentColor' : 'none'} className={s <= count ? 'uf-star-filled' : 'uf-star-empty'} />
      ))}
    </div>
  );

  return (
    <div className="uf-card glass-card animate-fade-in-up">
      <div className="uf-card-header">
        <div className="uf-card-type">
          {feedback.type === 'testimony' ? (
            <><Heart size={14} /> Testimony</>
          ) : (
            <><MessageSquare size={14} /> Improvement</>
          )}
        </div>
        <span className="uf-card-date">
          {new Date(feedback.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
      </div>

      <div className="uf-card-ratings">
        <div className="uf-card-rating-item">
          <span>Overall</span>
          {renderStars(feedback.overallRating)}
        </div>
        <div className="uf-card-rating-item">
          <span>Interview Quality</span>
          {renderStars(feedback.interviewQualityRating)}
        </div>
        <div className="uf-card-rating-item">
          <span>AI Voice</span>
          {renderStars(feedback.aiVoiceQualityRating)}
        </div>
        <div className="uf-card-rating-item">
          <span>Questions</span>
          {renderStars(feedback.questionRelevanceRating)}
        </div>
      </div>

      {feedback.wouldRecommend && (
        <div className="uf-card-recommend">
          <span>Recommend MockMate:</span>
          <span className={`uf-recommend-value uf-recommend-value--${feedback.wouldRecommend.toLowerCase()}`}>
            {feedback.wouldRecommend === 'Yes' ? '👍' : feedback.wouldRecommend === 'Maybe' ? '🤔' : '👎'} {feedback.wouldRecommend}
          </span>
        </div>
      )}

      {feedback.feedbackText && (
        <div className="uf-card-text">
          <p>"{feedback.feedbackText}"</p>
        </div>
      )}

      <div className="uf-card-meta">
        {feedback.helpfulFor && <span className="badge badge-success">{feedback.helpfulFor}</span>}
        {feedback.companyName && <span className="badge badge-warning">📍 {feedback.companyName}</span>}
        {feedback.interviewCategory && <span className="badge badge-primary">{feedback.interviewCategory}</span>}
        {feedback.planUsed && <span className="badge badge-info">{feedback.planUsed}</span>}
      </div>
    </div>
  );
};

// ========== Interview Selector ==========
const InterviewSelector = ({ interviews, selectedId, onSelect, feedbackMap }) => {
  const [isOpen, setIsOpen] = useState(false);
  const available = interviews.filter((iv) => !feedbackMap[iv._id || iv.id]);

  if (available.length === 0) {
    return (
      <div className="uf-no-interviews glass-card">
        <CheckCircle size={24} style={{ color: '#10b981' }} />
        <p>You've submitted feedback for all your completed interviews. Great job!</p>
      </div>
    );
  }

  const selected = available.find((iv) => (iv._id || iv.id) === selectedId);

  return (
    <div className="uf-interview-selector">
      <label className="form-label">Select Interview</label>
      <div className={`uf-selector-dropdown ${isOpen ? 'open' : ''}`}>
        <button
          type="button"
          className="uf-selector-trigger"
          onClick={() => setIsOpen(!isOpen)}
        >
          {selected ? (
            <div className="uf-selector-selected">
              <span className="uf-selector-role">{selected.role}</span>
              <span className={`badge badge-${selected.interviewType === 'dsa' ? 'primary' : 'warning'}`} style={{ fontSize: 10 }}>
                {selected.interviewType}
              </span>
              <span className="uf-selector-date">
                {new Date(selected.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </span>
            </div>
          ) : (
            <span className="uf-selector-placeholder">Choose an interview...</span>
          )}
          <ChevronDown size={16} className={`uf-selector-chevron ${isOpen ? 'rotated' : ''}`} />
        </button>

        {isOpen && (
          <div className="uf-selector-options">
            {available.map((iv) => (
              <button
                key={iv._id || iv.id}
                type="button"
                className={`uf-selector-option ${(iv._id || iv.id) === selectedId ? 'active' : ''}`}
                onClick={() => { onSelect(iv._id || iv.id); setIsOpen(false); }}
              >
                <span className="uf-selector-role">{iv.role}</span>
                <span className={`badge badge-${iv.interviewType === 'dsa' ? 'primary' : iv.interviewType === 'hr' ? 'info' : 'warning'}`} style={{ fontSize: 10 }}>
                  {iv.interviewType}
                </span>
                <span className="uf-selector-date">
                  {new Date(iv.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ========== Main Page ==========
const UserFeedbackPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('improvement');
  const [selectedInterviewId, setSelectedInterviewId] = useState('');

  // Fetch completed interviews
  const { data: interviewsData, isLoading: interviewsLoading } = useQuery({
    queryKey: ['interviews'],
    queryFn: () => interviewService.getAll().then((r) => r.data.interviews),
  });

  // Fetch user's existing feedback
  const { data: feedbacksData, isLoading: feedbacksLoading } = useQuery({
    queryKey: ['user-feedbacks'],
    queryFn: () => userFeedbackService.getMy().then((r) => r.data.feedbacks),
  });

  const interviews = (interviewsData || []).filter((iv) => iv.status === 'completed');
  const feedbacks = feedbacksData || [];

  // Build map of interviewId -> feedback (for duplicate check, only for improvements)
  const feedbackMap = {};
  feedbacks.filter(f => f.type === 'improvement').forEach((fb) => { feedbackMap[fb.interviewId] = fb; });

  const selectedInterview = interviews.find((iv) => (iv._id || iv.id) === selectedInterviewId);

  const handleSuccess = () => {
    queryClient.invalidateQueries(['user-feedbacks']);
    setSelectedInterviewId('');
  };

  // Separate feedbacks by type
  const testimonies = feedbacks.filter((f) => f.type === 'testimony');
  const improvements = feedbacks.filter((f) => f.type === 'improvement');

  const isLoading = interviewsLoading || feedbacksLoading;

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="dashboard-header-content">
          <div>
            <h1 className="page-title">Feedback & Testimonials</h1>
            <p className="page-subtitle">Share your experience or help us improve MockMate</p>
          </div>
        </div>
      </div>

      <div className="page-content">
        {/* Tabs */}
        <div className="uf-tabs">
          <button
            className={`uf-tab ${activeTab === 'improvement' ? 'active' : ''}`}
            onClick={() => setActiveTab('improvement')}
            id="uf-tab-improvement"
          >
            <MessageSquare size={16} />
            <span>Feedback & Improvement</span>
            {improvements.length > 0 && <span className="uf-tab-count">{improvements.length}</span>}
          </button>
          <button
            className={`uf-tab ${activeTab === 'testimony' ? 'active' : ''}`}
            onClick={() => setActiveTab('testimony')}
            id="uf-tab-testimony"
          >
            <Heart size={16} />
            <span>Testimony</span>
            {testimonies.length > 0 && <span className="uf-tab-count">{testimonies.length}</span>}
          </button>
        </div>

        {isLoading ? (
          <div style={{ padding: 40 }}>
            {[...Array(3)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 80, marginBottom: 16, borderRadius: 12 }} />
            ))}
          </div>
        ) : (
          <div className="uf-content">
            {/* Submit new feedback section */}
            <div className="uf-submit-section glass-card animate-fade-in-up">
              <div className="uf-submit-header">
                <div className="uf-submit-icon">
                  {activeTab === 'testimony' ? <Heart size={20} /> : <MessageSquare size={20} />}
                </div>
                <div>
                  <h3>
                    {activeTab === 'testimony' ? 'Share Your Testimony' : 'Submit Improvement Feedback'}
                  </h3>
                  <p>
                    {activeTab === 'testimony'
                      ? 'Tell us about your overall experience with MockMate'
                      : 'Help us improve — report bugs, suggest features, or share ideas'
                    }
                  </p>
                </div>
              </div>

              {activeTab === 'improvement' && interviews.length > 0 && (
                <InterviewSelector
                  interviews={interviews}
                  selectedId={selectedInterviewId}
                  onSelect={setSelectedInterviewId}
                  feedbackMap={feedbackMap}
                />
              )}

              {activeTab === 'improvement' && interviews.length === 0 && (
                <div className="uf-no-interviews">
                  <div className="empty-state" style={{ padding: '20px 0' }}>
                    <div className="empty-icon" style={{ fontSize: '32px' }}>🎙️</div>
                    <h3 style={{ fontSize: '16px', marginTop: '12px' }}>No completed interviews yet</h3>
                    <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Complete a mock interview first to leave specific improvement feedback.</p>
                  </div>
                </div>
              )}

              {(activeTab === 'testimony' || (activeTab === 'improvement' && selectedInterview)) && (
                <FeedbackForm
                  interview={selectedInterview}
                  type={activeTab}
                  onSuccess={handleSuccess}
                />
              )}
            </div>

            {/* Past feedback list */}
            {((activeTab === 'testimony' ? testimonies : improvements).length > 0) && (
              <div className="uf-past-section animate-fade-in-up">
                <h2 className="section-title" style={{ marginBottom: 16 }}>
                  {activeTab === 'testimony' ? 'Your Testimonials' : 'Your Improvement Feedback'}
                </h2>
                <div className="uf-feedback-list">
                  {(activeTab === 'testimony' ? testimonies : improvements).map((fb) => (
                    <FeedbackCard key={fb.id || fb._id} feedback={fb} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserFeedbackPage;
