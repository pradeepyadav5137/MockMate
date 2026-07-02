import React from 'react';
import { Link } from 'react-router-dom';
import {
  Zap, Check, Info, Brain, Shield, ArrowRight
} from 'lucide-react';
import '../../styles/globals.css';
import './Pricing.css';

const COST_BREAKDOWN = [
  { label: 'Voice AI (LiveKit)', cost: 8 },
  { label: 'AI Analysis (Groq)', cost: 4 },
  { label: 'Recording Storage', cost: 3 },
  { label: 'Platform & Support', cost: 4 },
];

const Pricing = () => (
  <div>
    <div className="page-header">
      <h1 className="page-title">Pricing</h1>
      <p className="page-subtitle">Transparent pricing designed for students</p>
    </div>

    <div className="page-content">
      <div className="pricing-philosophy animate-fade-in-up">
        <Shield size={20} style={{ color: '#99f6e4' }} />
        <p>
          <strong style={{ color: '#99f6e4' }}>Our Commitment:</strong> We keep pricing as close to operational cost as possible.
          We believe every student deserves access to quality interview preparation, not just those who can afford expensive coaching.
        </p>
      </div>

      <div className="pricing-cards animate-fade-in-up">
        {/* Free Plan */}
        <div className="pricing-card glass-card">
          <div className="pricing-card-header">
            <div className="plan-name">Free</div>
            <div className="plan-price">₹0</div>
            <div className="plan-desc">Get started without any commitment</div>
          </div>

          <ul className="plan-features">
            {[
              { text: '1 interview per day', ok: true },
              { text: 'Max 15 minutes', ok: true },
              { text: 'Resume upload', ok: true },
              { text: 'Role selection', ok: true },
              { text: 'Basic AI feedback', ok: true },
              { text: 'Live transcript', ok: true },
              { text: 'Recording for 24 hours', ok: true },
              { text: 'Download recording', ok: false },
              { text: 'Advanced AI coaching', ok: false },
              { text: 'Permanent transcript', ok: false },
            ].map((f) => (
              <li key={f.text} className={f.ok ? 'feature-ok' : 'feature-no'}>
                {f.ok ? <Check size={13} /> : <span>✗</span>}
                {f.text}
              </li>
            ))}
          </ul>

          <Link to="/signup" className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
            Start Free
          </Link>
        </div>

        {/* Basic Plan */}
        <div className="pricing-card glass-card" style={{ transform: 'scale(1.02)' }}>
          <div className="pricing-card-header">
            <div className="plan-name">Basic Plan</div>
            <div className="plan-price">₹9 <span className="plan-price-note">per day</span></div>
            <div className="plan-desc">Perfect for a single, focused practice session</div>
          </div>

          <ul className="plan-features">
            {[
              { text: 'Up to 30 minutes', ok: true },
              { text: 'GPT-4o powered interviewer', ok: true },
              { text: 'Resume-personalized questions', ok: true },
              { text: 'Basic AI feedback report', ok: true },
              { text: 'Live transcript', ok: true },
              { text: 'Voice recording (24h)', ok: true },
              { text: 'Detailed PDF report', ok: false },
              { text: 'Learning roadmap', ok: false },
              { text: 'Permanent storage (+₹9)', ok: true },
            ].map((f) => (
              <li key={f.text} className={f.ok ? 'feature-ok' : 'feature-no'}>
                {f.ok ? <Check size={13} /> : <span>✗</span>}
                {f.text}
              </li>
            ))}
          </ul>

          <Link to="/dashboard/start" id="pricing-start-basic" className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', borderColor: '#14b8a6', color: '#14b8a6' }}>
            Start Basic
          </Link>
        </div>

        {/* Pro Plan */}
        <div className="pricing-card pricing-card-featured glass-card">
          <div className="pricing-featured-badge">
            <Zap size={12} /> Most Popular
          </div>

          <div className="pricing-card-header">
            <div className="plan-name">Pro Plan</div>
            <div className="plan-price">₹19 <span className="plan-price-note">per day</span></div>
            <div className="plan-desc">Unlimited 50-minute interviews with free recording</div>
          </div>

          <ul className="plan-features">
            {[
              { text: 'Up to 50 minutes', ok: true },
              { text: 'GPT-4o powered interviewer', ok: true },
              { text: 'Resume-personalized questions', ok: true },
              { text: 'Detailed AI feedback report', ok: true },
              { text: 'Full conversation transcript', ok: true },
              { text: 'Voice recording (Free)', ok: true },
              { text: 'PDF feedback report', ok: true },
              { text: 'Learning roadmap', ok: true },
              { text: 'Permanent storage (+₹9)', ok: true },
            ].map((f) => (
              <li key={f.text} className={f.ok ? 'feature-ok' : 'feature-no'}>
                {f.ok ? <Check size={13} /> : <span>✗</span>}
                {f.text}
              </li>
            ))}
          </ul>

          <Link to="/dashboard/start" id="pricing-start-premium" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
            Start Pro Plan <ArrowRight size={16} />
          </Link>
        </div>
      </div>

      {/* Cost Transparency */}
      <div className="cost-transparency glass-card animate-fade-in-up">
        <h2 className="section-title" style={{ marginBottom: 8 }}>
          <Info size={16} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }} />
          Why does it cost ₹19?
        </h2>
        <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 24 }}>
          Every rupee you pay goes directly to running the AI infrastructure for your interview.
          We show you exactly where your money goes.
        </p>

        <div className="cost-bars">
          {COST_BREAKDOWN.map((item) => (
            <div key={item.label} className="cost-bar-item">
              <div className="cost-bar-label">
                <span>{item.label}</span>
                <span className="cost-bar-amount">₹{item.cost}</span>
              </div>
              <div className="cost-bar-track">
                <div
                  className="cost-bar-fill"
                  style={{ width: `${(item.cost / 14) * 100}%` }}
                />
              </div>
            </div>
          ))}
          <div className="cost-bar-total">
            <span>Infrastructure Cost</span>
            <span>₹14</span>
          </div>
          <div className="cost-bar-total cost-bar-user">
            <span>You Pay</span>
            <span style={{ color: '#99f6e4' }}>₹19</span>
          </div>
        </div>

        <div className="cost-note">
          <Brain size={14} />
          The ₹5 difference funds platform maintenance and helps us keep pricing affordable for everyone.
        </div>
      </div>
    </div>
  </div>
);

export default Pricing;
