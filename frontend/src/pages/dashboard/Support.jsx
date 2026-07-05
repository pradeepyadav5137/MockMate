import React, { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  LifeBuoy, Send, Upload, X, CheckCircle, Clock, AlertCircle,
  Tag, Calendar, Loader, Paperclip, ArrowLeft, Ticket
} from 'lucide-react';
import { supportService } from '../../services/services';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import '../../styles/globals.css';
import '../dashboard/Dashboard.css';
import './Support.css';

const CATEGORIES = [
  'Interview Issue',
  'Payment Issue',
  'Recording Issue',
  'Feedback Issue',
  'Account Issue',
  'Other',
];

const STATUS_CLASS_MAP = {
  'Open': 'ticket-status--open',
  'In Progress': 'ticket-status--in-progress',
  'Resolved': 'ticket-status--resolved',
  'Closed': 'ticket-status--closed',
};

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

// ========== Raise Ticket Form ==========
const RaiseTicketForm = ({ onSuccess }) => {
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('Other');
  const [description, setDescription] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [attachmentPreview, setAttachmentPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const fileInputRef = useRef(null);

  const validate = () => {
    const errs = {};
    if (!subject.trim() || subject.trim().length < 5) errs.subject = 'Subject must be at least 5 characters.';
    if (!description.trim() || description.trim().length < 10) errs.description = 'Description must be at least 10 characters.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
    if (!allowed.includes(file.type)) {
      toast.error('Only image files are allowed (PNG, JPG, GIF, WebP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File must be under 5MB.');
      return;
    }
    setAttachment(file);
    setAttachmentPreview(URL.createObjectURL(file));
  };

  const removeAttachment = () => {
    setAttachment(null);
    if (attachmentPreview) URL.revokeObjectURL(attachmentPreview);
    setAttachmentPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('subject', subject.trim());
      formData.append('category', category);
      formData.append('description', description.trim());
      if (attachment) formData.append('attachment', attachment);

      const res = await supportService.createTicket(formData);
      onSuccess(res.data.ticket);
      toast.success('Ticket submitted successfully! 🎉');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit ticket.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="support-form" onSubmit={handleSubmit}>
      {/* Row 1: Subject + Category */}
      <div className="support-form-row">
        <div className="form-group">
          <label className="form-label" htmlFor="ticket-subject">Subject <span style={{ color: '#f87171' }}>*</span></label>
          <input
            id="ticket-subject"
            type="text"
            className={`form-input ${errors.subject ? 'form-input--error' : ''}`}
            placeholder="Brief summary of your issue..."
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={200}
            disabled={submitting}
          />
          {errors.subject && <span className="form-error">{errors.subject}</span>}
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="ticket-category">Category <span style={{ color: '#f87171' }}>*</span></label>
          <select
            id="ticket-category"
            className="form-input form-select"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={submitting}
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Row 2: Description + Screenshot */}
      <div className="support-form-row">
        <div className="form-group">
          <label className="form-label" htmlFor="ticket-description">Description <span style={{ color: '#f87171' }}>*</span></label>
          <textarea
            id="ticket-description"
            className={`form-input ${errors.description ? 'form-input--error' : ''}`}
            placeholder="Describe your issue in detail..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={5000}
            disabled={submitting}
          />
          {errors.description && <span className="form-error">{errors.description}</span>}
        </div>

        <div className="form-group">
          <label className="form-label">Screenshot (Optional)</label>
          <div className="attachment-area">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              onChange={handleFileChange}
              style={{ display: 'none' }}
              id="ticket-attachment"
            />
            {!attachment ? (
              <label htmlFor="ticket-attachment" className="attachment-dropzone">
                <Upload size={24} />
                <div className="attachment-dropzone-text">
                  <span>Click to upload screenshot</span>
                  <small>PNG, JPG, GIF, WebP · Max 5MB</small>
                </div>
              </label>
            ) : (
              <div className="attachment-preview">
                {attachmentPreview && <img src={attachmentPreview} alt="preview" />}
                <div className="attachment-preview-info">
                  <span>{attachment.name}</span>
                  <small>{(attachment.size / 1024).toFixed(1)} KB</small>
                </div>
                <button type="button" className="attachment-remove" onClick={removeAttachment}>
                  <X size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <button
        type="submit"
        className="btn btn-primary support-submit-btn"
        disabled={submitting}
      >
        {submitting ? (
          <>
            <Loader size={16} className="spin" style={{ animation: 'spin 0.8s linear infinite' }} />
            Submitting...
          </>
        ) : (
          <>
            <Send size={16} />
            Submit Ticket
          </>
        )}
      </button>
    </form>
  );
};

// ========== Success View ==========
const TicketSuccess = ({ ticket, onReset }) => {
  return (
    <div className="support-success">
      <div className="support-success-icon">
        <CheckCircle size={36} />
      </div>
      <h3>Ticket Submitted!</h3>
      <p>
        Your support ticket has been created successfully. Our team will review it shortly.
        Please save your ticket ID for reference.
      </p>
      <div className="support-ticket-id-display">
        <Ticket size={18} />
        {ticket.ticketId}
      </div>
      <div className="support-success-actions">
        <button className="btn btn-primary" onClick={onReset}>
          <Send size={15} /> Raise Another Ticket
        </button>
        <Link to="/dashboard/support/tickets" className="btn btn-secondary">
          <Clock size={15} /> View My Tickets
        </Link>
      </div>
    </div>
  );
};

// ========== Ticket Card ==========
const TicketCard = ({ ticket }) => {
  const statusKey = ticket.status?.replace(/\s+/g, '-').toLowerCase();

  return (
    <div className="ticket-card">
      <div className="ticket-card-header">
        <h3 className="ticket-card-title">{ticket.subject}</h3>
        <span className="ticket-card-id">{ticket.ticketId}</span>
      </div>
      <div className="ticket-card-body">{ticket.description}</div>
      <div className="ticket-card-footer">
        <span className={`ticket-status ticket-status--${statusKey}`}>
          {ticket.status}
        </span>
        <span className="ticket-meta">
          <Tag size={12} />
          {ticket.category}
        </span>
        <span className="ticket-meta">
          <Calendar size={12} />
          {formatDate(ticket.createdAt)}
        </span>
        {ticket.attachmentPath && (
          <span className="ticket-meta">
            <Paperclip size={12} />
            Attachment
          </span>
        )}
      </div>
    </div>
  );
};

// ========== My Tickets View ==========
const MyTickets = () => {
  const [statusFilter, setStatusFilter] = useState('All');

  const { data, isLoading } = useQuery({
    queryKey: ['my-tickets'],
    queryFn: () => supportService.getMyTickets().then((r) => r.data.tickets),
  });

  const tickets = data || [];
  const filteredTickets = statusFilter === 'All'
    ? tickets
    : tickets.filter((t) => t.status === statusFilter);

  return (
    <div>
      <div className="tickets-filter-tabs">
        {['All', 'Open', 'In Progress', 'Resolved', 'Closed'].map((status) => (
          <button
            key={status}
            className={`tickets-filter-tab ${statusFilter === status ? 'active' : ''}`}
            onClick={() => setStatusFilter(status)}
          >
            {status}
            {status !== 'All' && tickets.filter((t) => t.status === status).length > 0 && (
              <span style={{ marginLeft: 4 }}>
                ({tickets.filter((t) => t.status === status).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div style={{ padding: 40 }}>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 100, marginBottom: 16, borderRadius: 12 }} />
          ))}
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="glass-card dashboard-section">
          <div className="empty-state">
            <div className="empty-icon">🎫</div>
            <h3>{statusFilter === 'All' ? 'No tickets yet' : `No ${statusFilter.toLowerCase()} tickets`}</h3>
            <p>
              {statusFilter === 'All'
                ? 'When you raise a support ticket, it will appear here.'
                : `You don't have any tickets with "${statusFilter}" status.`}
            </p>
            <Link to="/dashboard/support" className="btn btn-primary">
              <Send size={15} /> Raise a Ticket
            </Link>
          </div>
        </div>
      ) : (
        <div className="tickets-list">
          {filteredTickets.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} />
          ))}
        </div>
      )}
    </div>
  );
};

// ========== Main Support Page ==========
const Support = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [view, setView] = useState('form'); // 'form', 'success', 'tickets'
  const [submittedTicket, setSubmittedTicket] = useState(null);

  const handleSuccess = (ticket) => {
    setSubmittedTicket(ticket);
    setView('success');
    queryClient.invalidateQueries(['my-tickets']);
  };

  const handleReset = () => {
    setSubmittedTicket(null);
    setView('form');
  };

  return (
    <div>
      <div className="page-header">
        <div className="dashboard-header-content">
          <div>
            <h1 className="page-title">
              {view === 'tickets' ? 'My Tickets' : 'Raise Support Ticket'}
            </h1>
            <p className="page-subtitle">
              {view === 'tickets'
                ? 'Track the status of your support requests'
                : 'Having an issue? Let us know and we\'ll help you out'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {view === 'tickets' ? (
              <button className="btn btn-primary btn-sm" onClick={() => setView('form')}>
                <Send size={14} /> Raise Ticket
              </button>
            ) : (
              <Link to="/dashboard/support/tickets" className="btn btn-secondary btn-sm" onClick={() => setView('tickets')}>
                <Clock size={14} /> My Tickets
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="page-content">
        {view === 'form' && (
          <div className="support-form-container">
            <div className="support-form-card">
              <RaiseTicketForm onSuccess={handleSuccess} />
            </div>
          </div>
        )}

        {view === 'success' && submittedTicket && (
          <div className="support-form-container">
            <div className="support-form-card">
              <TicketSuccess ticket={submittedTicket} onReset={handleReset} />
            </div>
          </div>
        )}

        {view === 'tickets' && <MyTickets />}
      </div>
    </div>
  );
};

// ========== My Tickets Page (standalone route) ==========
export const MyTicketsPage = () => {
  return (
    <div>
      <div className="page-header">
        <div className="dashboard-header-content">
          <div>
            <h1 className="page-title">My Tickets</h1>
            <p className="page-subtitle">Track the status of your support requests</p>
          </div>
          <Link to="/dashboard/support" className="btn btn-primary btn-sm">
            <Send size={14} /> Raise Ticket
          </Link>
        </div>
      </div>
      <div className="page-content">
        <MyTickets />
      </div>
    </div>
  );
};

export default Support;
