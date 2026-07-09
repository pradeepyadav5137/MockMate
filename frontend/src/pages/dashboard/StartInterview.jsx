import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import {
  Upload, FileText, ChevronRight, ChevronLeft, Play,
  Lock, CheckCircle, Zap, Brain, Cpu, Users, Network,
  Layers, Volume2, UserRound, Globe2, BriefcaseBusiness,
  Gauge, Clock3
} from 'lucide-react';
import toast from 'react-hot-toast';
import { interviewService, resumeService } from '../../services/services';
import { useAuth } from '../../context/AuthContext';
import { paymentService } from '../../services/services';
import '../../styles/globals.css';
import './StartInterview.css';

const ROLES = [
  'Frontend Developer', 'Backend Developer', 'Full Stack Developer',
  'SDE-1', 'SDE-2', 'Data Scientist', 'ML Engineer'
];

const INTERVIEW_TYPES = [
  { value: 'core_cs', label: 'Core CS', desc: 'OOPs, DBMS, OS, Networks', Icon: Brain },
  { value: 'dsa', label: 'DSA', desc: 'Data Structures & Algorithms', Icon: Cpu },
  { value: 'hr', label: 'HR / Behavioral', desc: 'STAR method questions', Icon: Users },
  { value: 'system_design', label: 'System Design', desc: 'Architecture & Scalability', Icon: Network },
  { value: 'full_mix', label: 'Full Mix', desc: 'All categories blended', Icon: Layers },
];

const DIFFICULTIES = [
  { value: 'Easy', desc: 'Fresh graduate / Entry-level', color: '#10b981' },
  { value: 'Medium', desc: '1–3 years experience', color: '#f59e0b' },
  { value: 'Hard', desc: '3+ years experience', color: '#ef4444' },
];

const DURATIONS = [
  { value: 15, label: '15 min', note: 'Free', isPremium: false, tier: 'free' },
  { value: 30, label: '30 min', note: 'Basic · ₹9', isPremium: true, tier: 'basic' },
  { value: 50, label: '50 min', note: 'Pro · ₹19', isPremium: true, tier: 'pro' },
];

const VOICE_ACCENTS = [
  { value: 'in-female', label: 'IN Female', detail: 'Clear and natural', lang: 'en-IN', pitch: 1, rate: 0.9, Icon: UserRound, provider: 'edge' },
  { value: 'in-male', label: 'IN Male', detail: 'Professional and calm', lang: 'en-IN', pitch: 1, rate: 0.9, Icon: BriefcaseBusiness, provider: 'edge' },
  { value: 'us-female', label: 'US Female', detail: 'Clear and confident', lang: 'en-US', pitch: 1.08, rate: 0.92, Icon: UserRound },
  { value: 'us-male', label: 'US Male', detail: 'Direct and steady', lang: 'en-US', pitch: 0.86, rate: 0.9, Icon: BriefcaseBusiness },
  { value: 'uk-male', label: 'UK Male', detail: 'Formal and measured', lang: 'en-GB', pitch: 0.88, rate: 0.9, Icon: Globe2 },
  { value: 'us-soft', label: 'US Soft', detail: 'Warm and calm', lang: 'en-US', pitch: 1.14, rate: 0.86, Icon: Volume2 },
  { value: 'us-neutral', label: 'US Neutral', detail: 'Balanced delivery', lang: 'en-US', pitch: 1, rate: 0.9, Icon: Gauge },
];

const VOICE_PREVIEW_TEXT = "Hello, I'm Alex, your AI interviewer. I will keep questions clear, professional, and focused on your interview goals.";

const StartInterview = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [previewingVoice, setPreviewingVoice] = useState(null);

  React.useEffect(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
    }
  }, []);

  const [config, setConfig] = useState({
    role: '',
    interviewType: 'core_cs',
    difficulty: 'Medium',
    duration: 15,
    voiceAccent: 'in-female',
    jobDescription: '',
  });

  const [resume, setResume] = useState(null);
  const [resumeUploaded, setResumeUploaded] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);

  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setResume(file);
    setUploadingResume(true);
    try {
      await resumeService.upload(file);
      setResumeUploaded(true);
      toast.success('Resume uploaded & analyzed! 🎉');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Resume upload failed.');
      setResumeUploaded(false);
    } finally {
      setUploadingResume(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024,
  });

  const needsUpgrade = config.duration > 15; // 30-min and 50-min sessions require payment

  const handlePayment = async () => {
    if (!window.Razorpay) {
      toast.error('Payment system is still loading. Please refresh and try again.');
      return;
    }
    setPaymentLoading(true);
    try {
      const selectedTier = DURATIONS.find(d => d.value === config.duration)?.tier || 'basic';
      const upgradeTier = selectedTier === 'free' ? 'basic' : selectedTier;
      
      // Create interview first
      const payload = { ...config, pricingTier: upgradeTier, difficulty: config.difficulty.toLowerCase() };
      const res = await interviewService.create(payload);
      const interviewId = res.data.interviewId;
      
      const idempotencyKey = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
      const orderRes = await paymentService.createOrder({ type: 'interview', tier: upgradeTier, interviewId, idempotencyKey });
      const { orderId, amount, keyId } = orderRes.data;

      const options = {
        key: keyId,
        amount,
        currency: 'INR',
        name: 'MockMate',
        description: `${upgradeTier === 'pro' ? 'Pro' : 'Basic Tier'} Interview`,
        order_id: orderId,
        handler: async (response) => {
          try {
            await paymentService.verify({
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
              type: 'interview',
              tier: upgradeTier,
              interviewId,
            });
            toast.success('Payment successful! Starting interview...');
            navigate(`/interview/${interviewId}/room`);
          } catch (err) {
            toast.error(err.response?.data?.error || 'Payment verification failed.');
          }
        },
        prefill: { name: user?.name, email: user?.email },
        theme: { color: '#14b8a6' },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      toast.error('Payment initiation failed. Please try again.');
    } finally {
      setPaymentLoading(false);
    }
  };

  const startInterview = async () => {
    setLoading(true);
    try {
      const selectedTier = DURATIONS.find(d => d.value === config.duration)?.tier || 'free';
      const payload = { ...config, pricingTier: selectedTier, difficulty: config.difficulty.toLowerCase() };
      const res = await interviewService.create(payload);
      toast.success('Interview started! Connecting to AI interviewer...');
      navigate(`/interview/${res.data.interviewId}/room`);
    } catch (err) {
      const message = err.response?.data?.error || err.response?.data?.message || 'Could not start interview.';
      const canPay = err.response?.status === 403 && /upgrade|pass|tier|payment|limit/i.test(message);
      if (canPay) {
        toast.error('Session requires payment. Initiating checkout...');
        await handlePayment();
      } else {
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async () => {
    if (needsUpgrade) {
      handlePayment();
    } else {
      startInterview();
    }
  };

  // We keep a reference to currently playing backend audio so we can cancel it
  const [currentAudio, setCurrentAudio] = useState(null);

  const playVoicePreview = (voice) => {
    // Cancel any existing preview
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }

    if (voice.provider === 'edge') {
      const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
      const audioUrl = `${baseUrl}/tts/preview?voice=${voice.value}`;
      const audio = new Audio(audioUrl);
      setCurrentAudio(audio);
      setPreviewingVoice(voice.value);
      
      audio.onended = () => setPreviewingVoice(null);
      audio.onerror = () => {
        toast.error('Could not load Edge TTS preview.');
        setPreviewingVoice(null);
      };
      audio.play().catch(e => {
        console.error('Audio play blocked:', e);
        setPreviewingVoice(null);
      });
      return;
    }

    if (!('speechSynthesis' in window)) {
      toast.error('Voice preview is not supported in this browser.');
      return;
    }

    const utterance = new SpeechSynthesisUtterance(VOICE_PREVIEW_TEXT);
    utterance.lang = voice.lang;
    utterance.pitch = voice.pitch;
    utterance.rate = voice.rate;

    const browserVoices = window.speechSynthesis.getVoices();
    const matchingVoice = 
      browserVoices.find(v => v.lang === voice.lang && /(Google|Premium|Natural|Online)/i.test(v.name)) ||
      browserVoices.find(v => v.lang === voice.lang) ||
      browserVoices.find(v => v.lang?.startsWith(voice.lang.split('-')[0]));
    if (matchingVoice) utterance.voice = matchingVoice;

    utterance.onend = () => setPreviewingVoice(null);
    utterance.onerror = () => setPreviewingVoice(null);
    setPreviewingVoice(voice.value);
    window.speechSynthesis.speak(utterance);
  };

  const handleVoiceSelect = (voice) => {
    setConfig({ ...config, voiceAccent: voice.value });
    playVoicePreview(voice);
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Start Interview</h1>
        <p className="page-subtitle">Customize your mock interview session</p>
      </div>

      <div className="page-content">
        {/* Progress */}
        <div className="start-progress">
          {['Configure', 'Resume', 'Review'].map((label, i) => (
            <div key={label} className={`progress-step ${step === i + 1 ? 'active' : step > i + 1 ? 'done' : ''}`}>
              <div className="progress-step-dot">
                {step > i + 1 ? <CheckCircle size={14} /> : <span>{i + 1}</span>}
              </div>
              <span>{label}</span>
              {i < 2 && <div className="progress-step-line" />}
            </div>
          ))}
        </div>

        {/* Step 1: Configure */}
        {step === 1 && (
          <div className="start-step animate-fade-in-up">
            <div className="start-section glass-card">
              <h2 className="section-title" style={{ marginBottom: 20 }}>Select Role</h2>
              <div className="role-grid">
                {ROLES.map((role) => (
                  <button
                    key={role}
                    id={`role-${role.replace(/\s+/g, '-').toLowerCase()}`}
                    className={`role-btn ${config.role === role ? 'selected' : ''}`}
                    onClick={() => setConfig({ ...config, role })}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>

            <div className="start-section glass-card">
              <h2 className="section-title" style={{ marginBottom: 20 }}>Interview Type</h2>
              <div className="type-grid">
                {INTERVIEW_TYPES.map((type) => (
                  <button
                    key={type.value}
                    id={`type-${type.value}`}
                    className={`type-card ${config.interviewType === type.value ? 'selected' : ''}`}
                    onClick={() => setConfig({ ...config, interviewType: type.value })}
                  >
                    <span className="type-icon"><type.Icon size={24} /></span>
                    <span className="type-value">{type.label}</span>
                    <span className="type-desc">{type.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="config-row">
              <div className="start-section glass-card">
                <h2 className="section-title" style={{ marginBottom: 20 }}>Difficulty</h2>
                <div className="difficulty-grid">
                  {DIFFICULTIES.map((d) => (
                    <button
                      key={d.value}
                      id={`difficulty-${d.value.toLowerCase()}`}
                      className={`difficulty-btn ${config.difficulty === d.value ? 'selected' : ''}`}
                      style={{ '--diff-color': d.color }}
                      onClick={() => setConfig({ ...config, difficulty: d.value })}
                    >
                      <strong>{d.value}</strong>
                      <span>{d.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="start-section glass-card">
                <h2 className="section-title" style={{ marginBottom: 20 }}>Duration</h2>
                <div className="duration-grid">
                  {DURATIONS.map((d) => (
                    <button
                      key={d.value}
                      id={`duration-${d.value}`}
                      className={`duration-btn ${config.duration === d.value ? 'selected' : ''} ${d.isPremium ? 'premium-required' : ''}`}
                      onClick={() => setConfig({ ...config, duration: d.value })}
                    >
                      <span className="duration-label">{d.label}</span>
                      <span className="duration-note">
                        {d.isPremium && <Lock size={10} />}
                        {d.note}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="start-section glass-card animate-fade-in-up">
              <h2 className="section-title" style={{ marginBottom: 20 }}>Interviewer Voice & Accent</h2>
              <div className="voice-grid">
                {VOICE_ACCENTS.map((v) => (
                  <button
                    key={v.value}
                    id={`voice-${v.value}`}
                    type="button"
                    className={`voice-btn ${config.voiceAccent === v.value ? 'selected' : ''}`}
                    onClick={() => handleVoiceSelect(v)}
                  >
                    <span className="voice-icon"><v.Icon size={18} /></span>
                    <span className="voice-copy">
                      <span className="voice-label">{v.label}</span>
                      <span className="voice-detail">{previewingVoice === v.value ? 'Playing preview...' : v.detail}</span>
                    </span>
                    <span className="voice-play"><Volume2 size={15} /></span>
                  </button>
                ))}
              </div>
            </div>

            <div className="start-section glass-card">
              <h2 className="section-title" style={{ marginBottom: 12 }}>Job Description <span style={{ color: '#475569', fontSize: 13, fontWeight: 400 }}>(Optional)</span></h2>
              <textarea
                id="job-description"
                className="form-input jd-textarea"
                placeholder="Paste the job description here. The AI will tailor questions to match the role requirements..."
                value={config.jobDescription}
                onChange={(e) => setConfig({ ...config, jobDescription: e.target.value })}
                rows={4}
              />
            </div>

            <div className="step-actions">
              <button
                id="step1-next"
                className="btn btn-primary btn-lg"
                disabled={!config.role}
                onClick={() => setStep(2)}
              >
                Next: Upload Resume <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Resume */}
        {step === 2 && (
          <div className="start-step animate-fade-in-up">
            <div className="start-section glass-card">
              <h2 className="section-title">Upload Your Resume</h2>
              <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 24 }}>
                Our AI will analyze your resume and ask personalized questions about your projects and experience.
              </p>

              <div
                {...getRootProps()}
                id="resume-dropzone"
                className={`dropzone ${isDragActive ? 'drag-active' : ''} ${resumeUploaded ? 'uploaded' : ''}`}
              >
                <input {...getInputProps()} />
                {uploadingResume ? (
                  <div className="dropzone-uploading">
                    <div className="spinner" style={{ width: 36, height: 36 }} />
                    <p>Analyzing your resume with AI...</p>
                  </div>
                ) : resumeUploaded ? (
                  <div className="dropzone-done">
                    <CheckCircle size={36} style={{ color: '#6ee7b7' }} />
                    <p><strong>{resume?.name}</strong></p>
                    <span>Resume analyzed successfully!</span>
                  </div>
                ) : (
                  <div className="dropzone-idle">
                    <Upload size={36} style={{ color: '#14b8a6' }} />
                    <p>{isDragActive ? 'Drop it here!' : 'Drag & drop your resume (PDF)'}</p>
                    <span>or click to browse · Max 5MB</span>
                    <div className="btn btn-secondary btn-sm" style={{ marginTop: 12 }}>
                      <FileText size={14} /> Browse File
                    </div>
                  </div>
                )}
              </div>

              <div className="resume-benefits">
                {['Personalized project-based questions', 'Context-aware follow-ups', 'Accurate skill assessment'].map((b) => (
                  <div key={b} className="benefit-item">
                    <CheckCircle size={13} style={{ color: '#6ee7b7', flexShrink: 0 }} />
                    <span>{b}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="step-actions">
              <button className="btn btn-secondary" onClick={() => setStep(1)}>
                <ChevronLeft size={16} /> Back
              </button>
              <button
                id="step2-next"
                className="btn btn-primary btn-lg"
                onClick={() => setStep(3)}
              >
                {resumeUploaded ? 'Review & Start' : 'Skip & Continue'} <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <div className="start-step animate-fade-in-up">
            <div className="start-section glass-card review-card">
              <h2 className="section-title" style={{ marginBottom: 24 }}>Review Your Setup</h2>

              <div className="review-grid">
                {[
                  { label: 'Role', value: config.role, Icon: UserRound },
                  { label: 'Interview Type', value: INTERVIEW_TYPES.find(t => t.value === config.interviewType)?.label || config.interviewType, Icon: Layers },
                  { label: 'Difficulty', value: config.difficulty, Icon: Gauge },
                  { label: 'Duration', value: `${config.duration} minutes`, Icon: Clock3 },
                  { label: 'Voice Accent', value: VOICE_ACCENTS.find(v => v.value === config.voiceAccent)?.label || config.voiceAccent, Icon: Volume2 },
                  { label: 'Resume', value: resumeUploaded ? resume?.name : 'Not uploaded', Icon: FileText },
                ].map((item) => (
                  <div key={item.label} className="review-item">
                    <span className="review-icon"><item.Icon size={17} /></span>
                    <div>
                      <div className="review-label">{item.label}</div>
                      <div className="review-value">{item.value}</div>
                    </div>
                  </div>
                ))}
              </div>

              {needsUpgrade && (
                <div className="upgrade-notice">
                  <Zap size={16} style={{ color: '#fcd34d', flexShrink: 0 }} />
                  <div>
                    <strong style={{ color: '#fcd34d' }}>Payment Required</strong>
                    <p>{config.duration}-minute sessions require a ₹{config.duration === 30 ? 9 : 19} payment for AI infrastructure cost.</p>
                    <div className="cost-breakdown">
                      <div className="cost-item"><span>Voice AI (LiveKit)</span><span>₹{config.duration === 30 ? 4 : 8}</span></div>
                      <div className="cost-item"><span>AI Analysis (Groq)</span><span>₹{config.duration === 30 ? 2 : 4}</span></div>
                      <div className="cost-item"><span>Recording Storage</span><span>₹{config.duration === 30 ? 1 : 3}</span></div>
                      <div className="cost-item"><span>Platform & Support</span><span>₹{config.duration === 30 ? 2 : 4}</span></div>
                      <div className="cost-item cost-total"><span>You pay</span><span>₹{config.duration === 30 ? 9 : 19}</span></div>
                    </div>
                    <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>
                      "We keep pricing close to operational cost to help students prepare."
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="start-section glass-card">
              <h3 style={{ color: '#e2e8f0', marginBottom: 12 }}>What to expect</h3>
              <div className="expect-list">
                {[
                  'Your AI interviewer will greet you warmly',
                  'Questions adapt based on your answers',
                  'You can ask for clarification anytime',
                  'Detailed feedback after the interview',
                  'Full transcript available',
                ].map((item) => (
                  <div key={item} className="expect-item">
                    <CheckCircle size={14} style={{ color: '#99f6e4', flexShrink: 0 }} /> {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="step-actions">
              <button className="btn btn-secondary" onClick={() => setStep(2)}>
                <ChevronLeft size={16} /> Back
              </button>
              <button
                id="start-interview-final"
                className="btn btn-primary btn-lg"
                disabled={loading || paymentLoading}
                onClick={handleStart}
              >
                {loading || paymentLoading ? (
                  <span className="spinner" />
                ) : needsUpgrade ? (
                  <><Zap size={16} /> Pay ₹{config.duration === 30 ? 9 : 19} & Start</>
                ) : (
                  <><Play size={16} /> Start Interview</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
  </div>
  );
};


export default StartInterview;
