import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Zap, Check, Info, Brain, ArrowRight, Play,
  CheckCircle, Star, ChevronDown,
  Mic, FileText, Sliders, MessageSquare, Map, Lock,
  Upload, Target, PhoneCall, Award, Menu, X
} from 'lucide-react';
import '../../styles/globals.css';
import './Landing.css';

const FEATURES = [
  { icon: <Mic size={24} />, title: 'Natural Voice Interview', desc: 'Talk naturally. The AI listens, adapts, and responds like a real senior engineer — not a chatbot reading from a script.' },
  { icon: <FileText size={24} />, title: 'Resume-Based Questions', desc: 'Upload your resume and get questions tailored to your actual projects, experience, and technology stack.' },
  { icon: <Sliders size={24} />, title: 'Adaptive Difficulty', desc: "Struggling? The AI simplifies. Doing well? It goes deeper. Always matched to your level." },
  { icon: <MessageSquare size={24} />, title: 'Detailed Feedback', desc: 'Know exactly what was weak, what was strong, and what a better answer would look like — question by question.' },
  { icon: <Map size={24} />, title: 'Learning Roadmap', desc: 'Get a personalized study plan with curated resources to improve exactly where you need it most.' },
  { icon: <Lock size={24} />, title: 'Private & Secure', desc: 'Your data is encrypted. Recordings deleted after 24h by default. Full transparency on data handling.' },
];

const HOW_IT_WORKS = [
  { step: '01', icon: <Upload size={28} />, title: 'Upload Your Resume', desc: 'Our AI reads your resume and builds a personalized candidate profile to power the interview.' },
  { step: '02', icon: <Target size={28} />, title: 'Choose Your Interview', desc: 'Select role, interview type (Technical/Behavioral/Mixed), difficulty, and duration.' },
  { step: '03', icon: <PhoneCall size={28} />, title: 'Talk Naturally', desc: 'Your AI interviewer starts with a warm intro and gradually goes deeper based on your answers.' },
  { step: '04', icon: <Award size={28} />, title: 'Get Real Feedback', desc: 'Receive a comprehensive performance report with actionable advice and a study roadmap.' },
];

const TESTIMONIALS = [
  { name: 'Priya Sharma', role: 'SDE-1 @ Flipkart', text: "I was terrified of technical interviews. After 3 sessions with this AI, I went into my Flipkart interview feeling genuinely prepared.", avatar: 'PS' },
  { name: 'Rohan Mehta', role: 'Full Stack @ Razorpay', text: "The AI caught that I wasn't explaining trade-offs in my system design answers. That insight alone changed how I interview.", avatar: 'RM' },
  { name: 'Ananya Patel', role: 'ML Engineer @ Swiggy', text: "₹29 for a full AI interview with detailed feedback? Cheaper than one coaching call. Absolutely worth it.", avatar: 'AP' },
];

const FAQS = [
  { q: 'How is this different from practicing with a friend?', a: "The AI is available 24/7, has deep technical knowledge, tracks performance objectively, and gives detailed structured feedback a friend typically can't." },
  { q: 'Is the free plan actually useful?', a: '1 interview per day is enough for consistent practice. Most improvements happen with regular short sessions, not occasional long ones.' },
  { q: 'What happens to my resume data?', a: 'We mask all PII (phone, email, address) before processing. Only professional info is kept. Delete anytime from your profile.' },
  { q: 'How long does feedback take to generate?', a: 'Typically 30–60 seconds after the interview ends. Groq AI analyzes the full conversation and generates a comprehensive report.' },
];

const FaqItem = ({ q, a }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className={`faq-item ${open ? 'open' : ''}`} onClick={() => setOpen(!open)}>
      <div className="faq-question"><span>{q}</span><ChevronDown size={18} className="faq-icon" /></div>
      {open && <div className="faq-answer">{a}</div>}
    </div>
  );
};


const Landing = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLinkClick = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="landing">
      <nav className="landing-nav">
        <div className="container landing-nav-inner">
          <div className="nav-brand">
            <a href="#" onClick={handleLinkClick}>
              <img className="nav-brand-logo" src="/logo.png" alt="MockMate" />
            </a>
          </div>

          <button
            className="mobile-hamburger-btn"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

          <div className={`nav-links ${isMobileMenuOpen ? 'open' : ''}`}>
            <a href="#features" onClick={handleLinkClick}>Features</a>
            <a href="#how-it-works" onClick={handleLinkClick}>How It Works</a>
            <a href="#pricing" onClick={handleLinkClick}>Pricing</a>
            <Link to="/support" onClick={handleLinkClick}>Support</Link>
            <Link to="/login" onClick={handleLinkClick}>Sign In</Link>
            <Link to="/signup" id="nav-get-started" className="btn btn-primary btn-sm" onClick={handleLinkClick}>
              Get Started Free
            </Link>
          </div>
        </div>
      </nav>

    <section className="hero-section">
      <div className="hero-bg">
        <div className="hero-orb hero-orb-1" /><div className="hero-orb hero-orb-2" /><div className="hero-grid" />
      </div>
      <div className="container hero-content">
        <div className="hero-badge animate-fade-in"><Zap size={13} /> AI-Powered · Voice Interview · ₹29</div>
        <h1 className="hero-headline animate-fade-in-up">Practice Interviews with a<br /><span className="gradient-text">Friendly Senior Engineer</span><br />— Powered by AI</h1>
        <p className="hero-subtitle animate-fade-in-up animate-delay-1">Stop practicing alone. Talk to an AI that asks smart questions based on <em>your</em> resume, adapts to your answers, encourages you when you're stuck, and gives you detailed feedback.</p>
        <div className="hero-ctas animate-fade-in-up animate-delay-2">
          <Link to="/signup" id="hero-start-free" className="btn btn-primary btn-lg">Start Free Today <ArrowRight size={18} /></Link>
          <a href="#how-it-works" className="btn btn-secondary btn-lg"><Play size={16} /> See How It Works</a>
        </div>
        <div className="hero-stats animate-fade-in-up animate-delay-3">
          {[['1 Free', 'Interview Daily'], ['₹29', 'Premium Interview'], ['Llama 3', 'Powered AI'], ['7 Roles', 'Supported']].map(([v, l]) => (
            <div key={l} className="hero-stat"><span className="hero-stat-value">{v}</span><span className="hero-stat-label">{l}</span></div>
          ))}
        </div>
      </div>
    </section>

    <section id="how-it-works" className="section">
      <div className="container">
        <div className="section-header-centered">
          <div className="section-label">Simple Process</div>
          <h2 className="section-headline">From Resume to <span className="gradient-text">Real Feedback</span></h2>
        </div>
        <div className="how-grid">
          {HOW_IT_WORKS.map((s, i) => (
            <div key={s.step} className="how-card glass-card animate-fade-in-up" style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="how-step-num">{s.step}</div>
              <div className="how-icon">{s.icon}</div>
              <h3>{s.title}</h3><p>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    <section id="features" className="section section-alt">
      <div className="container">
        <div className="section-header-centered">
          <div className="section-label">Features</div>
          <h2 className="section-headline">Everything to <span className="gradient-text">Ace Your Interview</span></h2>
        </div>
        <div className="features-grid">
          {FEATURES.map((f, i) => (
            <div key={f.title} className="feature-card glass-card animate-fade-in-up" style={{ animationDelay: `${i * 0.08}s` }}>
              <div className="feature-icon">{f.icon}</div><h3>{f.title}</h3><p>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    <section className="section">
      <div className="container">
        <div className="interview-flow-visual glass-card">
          <div className="flow-visual-left">
            <h2>A natural conversation,<br /><span className="gradient-text">not a quiz</span></h2>
            <p>The AI starts by getting to know you. Then explores your projects. Then digs into concepts. Then asks follow-ups based on <em>exactly what you said</em>.</p>
            <div className="flow-phases">
              {['Warm-Up & Intro', 'Resume Discussion', 'Core Concepts', 'DSA / System Design', 'Behavioral', 'Feedback'].map((p, i) => (
                <div key={p} className="flow-phase-item">
                  <div className="flow-phase-dot" style={{ background: `hsl(${140 + i * 12}, 75%, 65%)` }} /><span>{p}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flow-visual-right">
            <div className="chat-preview">
              {[
                { role: 'ai', text: "Hi! I noticed you built a BookNest project. That sounds interesting. Can you tell me what problem it was solving?" },
                { role: 'user', text: "Sure! BookNest is an e-book platform. I built the full stack — React frontend, Node.js backend, MongoDB for storage." },
                { role: 'ai', text: "Impressive! How did you handle authentication? I'd love to understand the flow you chose." },
                { role: 'user', text: "I used JWT tokens. The user logs in and gets a token that expires in 7 days..." },
                { role: 'ai', text: "Interesting choice! What happens when that token expires while the user is actively reading a book?" },
              ].map((msg, i) => (
                <div key={i} className={`chat-bubble ${msg.role}`}>
                  {msg.role === 'ai' && <span className="chat-avatar">🎯</span>}
                  <div className="chat-text">{msg.text}</div>
                  {msg.role === 'user' && <span className="chat-avatar">👤</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>

    <section id="pricing" className="section section-alt">
      <div className="container">
        <div className="section-header-centered">
          <div className="section-label">Pricing</div>
          <h2 className="section-headline">Honest Pricing. <span className="gradient-text">No Surprises.</span></h2>
          <p className="section-desc">Every rupee goes directly to running the AI infrastructure for your interview.</p>
        </div>
        <div className="landing-pricing-grid">
          {/* Free Card */}
          <div className="landing-pricing-card glass-card">
            <h3>Free</h3>
            <div className="landing-price">₹0</div>
            <ul className="landing-features">
              {['1 interview per day', '15 min duration', 'Resume upload & analysis', 'Basic AI feedback', 'Live transcript', 'Voice recording (24h)'].map(f => (
                <li key={f}><CheckCircle size={13} /> {f}</li>
              ))}
            </ul>
            <Link to="/signup" className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>Start Free</Link>
          </div>

          {/* Basic Card */}
          <div className="landing-pricing-card glass-card">
            <h3>Basic Plan</h3>
            <div className="landing-price">₹9 <span style={{ fontSize: 13, color: '#94a3b8' }}>/interview</span></div>
            <ul className="landing-features">
              {['30 minutes duration', 'Groq AI interviewer', 'Resume-personalized questions', 'Basic AI feedback report', 'Live transcript', 'Voice recording (24h)'].map(f => (
                <li key={f}><CheckCircle size={13} /> {f}</li>
              ))}
            </ul>
            <Link to="/signup" className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', borderColor: '#14b8a6', color: '#14b8a6' }}>Get Started</Link>
          </div>

          {/* Pro Card */}
          <div className="landing-pricing-card landing-pricing-featured glass-card">
            <div className="featured-tag"><Zap size={12} /> Best Value</div>
            <h3>Pro Plan</h3>
            <div className="landing-price">₹29 <span style={{ fontSize: 13, color: '#94a3b8' }}>/interview</span></div>
            <ul className="landing-features">
              {['50 minutes duration', 'Groq AI interviewer', 'Resume-personalized questions', 'Detailed AI feedback report', 'Full conversation transcript', 'Voice recording (24h)', 'PDF feedback report', 'Learning roadmap'].map(f => (
                <li key={f}><CheckCircle size={13} /> {f}</li>
              ))}
            </ul>
            <Link to="/signup" id="landing-premium-cta" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
              Get Started <ArrowRight size={16} />
            </Link>
            <div className="cost-mini">
              <p>Infrastructure cost breakdown:</p>
              {[['Voice AI (LiveKit)', 12], ['AI Analysis (Groq)', 6], ['Recording Storage', 5], ['Platform & Support', 6]].map(([l, c]) => (
                <div key={l} className="cost-mini-row"><span>{l}</span><span>₹{c}</span></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>

    <section className="section">
      <div className="container">
        <div className="section-header-centered">
          <div className="section-label">Testimonials</div>
          <h2 className="section-headline">What Students Say</h2>
        </div>
        <div className="testimonials-grid">
          {TESTIMONIALS.map((t, i) => (
            <div key={t.name} className="testimonial-card glass-card animate-fade-in-up" style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="testimonial-stars">{[...Array(5)].map((_, j) => <Star key={j} size={13} style={{ color: '#fcd34d' }} fill="#fcd34d" />)}</div>
              <p className="testimonial-text">"{t.text}"</p>
              <div className="testimonial-author">
                <div className="testimonial-avatar">{t.avatar}</div>
                <div><div className="testimonial-name">{t.name}</div><div className="testimonial-role">{t.role}</div></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>

    <section className="section section-alt">
      <div className="container">
        <div className="section-header-centered">
          <h2 className="section-headline">Frequently Asked <span className="gradient-text">Questions</span></h2>
        </div>
        <div className="faq-list">{FAQS.map(faq => <FaqItem key={faq.q} {...faq} />)}</div>
      </div>
    </section>

    <section className="cta-section">
      <div className="container cta-inner">
        <h2>Ready to land your dream job?</h2>
        <p>Start with 1 free interview today. No credit card needed.</p>
        <Link to="/signup" id="cta-final" className="btn btn-primary btn-lg">Get Started Free <ArrowRight size={18} /></Link>
      </div>
    </section>

    <footer className="landing-footer">
      <div className="container footer-inner">
        <div className="footer-brand"><span>🎯</span> MockMate</div>
        <div className="footer-links">
          <Link to="/login">Login</Link><Link to="/signup">Sign Up</Link><a href="#pricing">Pricing</a><Link to="/support">Support</Link>
        </div>
        <p className="footer-copy">© 2026 MockMate. Built for students, by developers.</p>
      </div>
    </footer>
  </div>
  );
};

export default Landing;
