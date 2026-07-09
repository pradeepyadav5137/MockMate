import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Mic, MicOff, PhoneOff, SkipForward, Clock, Loader, Star
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Room, RoomEvent, Track } from 'livekit-client';
import { interviewService, userFeedbackService } from '../../services/services';
import '../../styles/globals.css';
import './InterviewRoom.css';

const PHASES = [
  'Introduction', 'Resume Discussion', 'Core CS',
  'DSA', 'System Design', 'HR', 'Feedback Discussion',
];

const normalizeTranscriptItem = (m, i) => ({
  role: m.role || m.speaker,
  content: m.content || m.text || '',
  timestamp: new Date(m.timestamp || Date.now()),
  phase: m.phase || 'Introduction',
  id: m.id || `restored-${i}`,
});

const InterviewRoom = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const roomRef       = useRef(null);
  const isSpeakingRef = useRef(false);
  const isMutedRef    = useRef(false);
  const phaseRef      = useRef('Introduction');
  const timerRef      = useRef(null);
  const skipTimerRef  = useRef(null);
  const intentionalEndRef = useRef(false);
  const sessionDataRef    = useRef(null);

  const micStreamRef      = useRef(null);
  const audioContextRef   = useRef(null);
  const analyserRef       = useRef(null);
  const animationFrameRef = useRef(null);
  const mediaRecorderRef  = useRef(null);
  const recordingContextRef = useRef(null);
  const recordedChunksRef = useRef([]);

  const [sessionData,     setSessionData]     = useState(null);
  const [loading,         setLoading]         = useState(true);
  const [callActive,      setCallActive]      = useState(false);
  const [isSpeaking,      setIsSpeaking]      = useState(false);
  const [isUserSpeaking,  setIsUserSpeaking]  = useState(false);
  const [isMuted,         setIsMuted]         = useState(false);
  const [transcript,      setTranscript]      = useState([]);
  const [remainingSeconds, setRemainingSeconds] = useState(15 * 60);
  const [phase,           setPhase]           = useState('Introduction');
  const [showSkip,        setShowSkip]        = useState(false);
  const [ending,          setEnding]          = useState(false);
  const [reconnecting,    setReconnecting]    = useState(false);
  const [micError,        setMicError]        = useState(false);
  const [micLevel,        setMicLevel]        = useState(0);

  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackHover, setFeedbackHover] = useState(0);

  const setupAudioAnalyser = useCallback((stream) => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch {}
    }

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    try {
      const audioContext = new AudioCtx();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const level = Math.min(100, Math.round((average / 128) * 100));

        const actualLevel = isMutedRef.current ? 0 : level;
        setMicLevel(actualLevel);

        setIsUserSpeaking(!isSpeakingRef.current && actualLevel > 12);
        animationFrameRef.current = requestAnimationFrame(updateVolume);
      };

      updateVolume();
    } catch (err) {
      console.error('Failed to configure audio analyzer on stream:', err);
    }
  }, []);

  const startMicMonitoring = useCallback((mediaStreamTrack) => {
    if (!mediaStreamTrack) return;
    try {
      const stream = new MediaStream([mediaStreamTrack]);
      micStreamRef.current = stream;
      setupAudioAnalyser(stream);
    } catch (err) {
      console.error('Mic monitoring failed:', err);
    }
  }, [setupAudioAnalyser]);

  const stopMicMonitoring = useCallback(() => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (audioContextRef.current) {
      try { audioContextRef.current.close().catch(() => {}); } catch {}
    }
    micStreamRef.current = null;
    audioContextRef.current = null;
    analyserRef.current = null;
    animationFrameRef.current = null;
    setMicLevel(0);
    setIsUserSpeaking(false);
  }, []);

  const getPhaseSequence = (type) => {
    if (type === 'dsa') return ['Introduction', 'Resume Discussion', 'DSA', 'Feedback Discussion'];
    if (type === 'system_design') return ['Introduction', 'Resume Discussion', 'System Design', 'Feedback Discussion'];
    if (type === 'core_cs') return ['Introduction', 'Core CS', 'Feedback Discussion'];
    if (type === 'hr') return ['Introduction', 'HR', 'Feedback Discussion'];
    if (type === 'full_mix') return ['Introduction', 'Resume Discussion', 'Core CS', 'DSA', 'System Design', 'HR', 'Feedback Discussion'];
    return ['Introduction', 'Resume Discussion', 'Core CS', 'HR', 'Feedback Discussion'];
  };

  const checkAndAdvancePhase = useCallback((updatedTranscript, currentInterviewType) => {
    const currentPhase = phaseRef.current;
    const assistantMsgCount = updatedTranscript.filter(
      (m) => (m.role || m.speaker) === 'assistant' && (m.phase || 'Introduction') === currentPhase
    ).length;

    const sequence = getPhaseSequence(currentInterviewType);
    const currentIndex = sequence.indexOf(currentPhase);

    if (currentIndex !== -1 && currentIndex < sequence.length - 1) {
      let threshold = 3;
      if (currentPhase === 'Introduction' || currentPhase === 'Feedback Discussion') {
        threshold = 1;
      }

      if (assistantMsgCount >= threshold) {
        const nextPhase = sequence[currentIndex + 1];
        phaseRef.current = nextPhase;
        setPhase(nextPhase);
        interviewService.updateState(id, { phase: nextPhase }).catch(() => {});
        toast(`Moving to next stage: ${nextPhase}`, { icon: '➔' });
      }
    }
  }, [id]);

  const initLiveKit = useCallback((data) => {
    if (!data.token || !data.serverUrl) {
      toast.error('Interview session could not be initialized. Please go back and try again.');
      navigate('/dashboard');
      return;
    }

    if (roomRef.current) {
      const oldRoom = roomRef.current;
      roomRef.current = null;
      try { oldRoom.removeAllListeners(); oldRoom.disconnect(); } catch {}
    }

    const room = new Room({
      autoSubscribe: true,
    });
    roomRef.current = room;

    room.on(RoomEvent.Connected, () => {
      setCallActive(true);
      setReconnecting(false);
      timerRef.current = setInterval(() => setRemainingSeconds((s) => Math.max(0, s - 1)), 1000);
      toast.success('Connected - your interview has started.');
      skipTimerRef.current = setTimeout(() => setShowSkip(true), 45_000);

      // Start recording the user's mic and AI audio
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioContext();
        const dest = ctx.createMediaStreamDestination();
        recordingContextRef.current = ctx;

        const connectTrack = (mediaStreamTrack, name) => {
          if (!mediaStreamTrack) return;
          try {
            const source = ctx.createMediaStreamSource(new MediaStream([mediaStreamTrack]));
            source.connect(dest);
            console.log(`🎙️ ${name} connected to recording destination`);
          } catch (e) {
            console.warn(`Failed to connect ${name} to recording:`, e.message);
          }
        };

        // Connect local mic if already published (usually not yet published here)
        const micPub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
        if (micPub?.track?.mediaStreamTrack) {
          connectTrack(micPub.track.mediaStreamTrack, 'Local mic (pre-existing)');
        }

        // Dynamically connect local mic when it gets published
        room.on(RoomEvent.LocalTrackPublished, (publication) => {
          if (publication.source === Track.Source.Microphone && publication.track?.mediaStreamTrack) {
            connectTrack(publication.track.mediaStreamTrack, 'Local mic (dynamic)');
          }
        });

        // Connect remote tracks (AI voice) as they come in
        room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
          if (track.kind === Track.Kind.Audio && track.mediaStreamTrack) {
            connectTrack(track.mediaStreamTrack, 'Remote AI audio');
          }
        });

        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
        const recorder = new MediaRecorder(dest.stream, { mimeType });
        recordedChunksRef.current = [];
        recorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
        recorder.start(1000); // capture in 1s chunks
        mediaRecorderRef.current = recorder;
        console.log('🎙️ Mixed audio recording started');
      } catch (recErr) {
        console.warn('Could not start audio recording:', recErr.message);
      }
    });

    room.on(RoomEvent.Disconnected, () => {
      if (roomRef.current !== room) return;

      setCallActive(false);
      setIsSpeaking(false);
      setIsUserSpeaking(false);
      isSpeakingRef.current = false;
      clearInterval(timerRef.current);
      clearTimeout(skipTimerRef.current);

      if (!intentionalEndRef.current) {
        if (sessionDataRef.current?.reconnectAttempts >= 1) {
          setReconnecting(false);
          toast.error('Connection lost — your feedback is still being saved');
          navigate(`/dashboard/feedback/${id}`);
          return;
        }
        if (!sessionDataRef.current) sessionDataRef.current = {};
        sessionDataRef.current.reconnectAttempts = 1;
        setReconnecting(true);
        toast('Connection interrupted. Reconnecting...');
        setTimeout(() => {
          interviewService.getToken(id)
            .then((res) => {
              const freshData = res.data;
              if (!freshData.success || !freshData.token) {
                setReconnecting(false);
                toast.error('Interview session has ended.');
                navigate('/dashboard');
                return;
              }
              sessionDataRef.current = freshData;
              setSessionData(freshData);
              initLiveKit(freshData);
            })
            .catch(() => {
              setReconnecting(false);
              toast.error('Could not reconnect. Please go back and start a new session.');
            });
        }, 3000);
      }
    });

    // Remote audio track management (AI Agent)
    room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      console.log('TrackSubscribed:', track.kind, 'from', participant.identity);
      
      if (track.kind === Track.Kind.Audio) {
        // Use the standard livekit-client attach() — creates the <audio> element automatically
        const el = track.attach();
        el.autoplay = true;
        el.playsInline = true;
        el.volume = 1.0;
        el.hidden = true;
        document.body.appendChild(el);

        // Handle autoplay restrictions
        el.play().then(() => {
          console.log('Agent audio playing via attach()');
        }).catch((err) => {
          console.warn('Audio autoplay blocked, will retry on click:', err.message);
          const resume = () => {
            el.play().catch(() => {});
            document.removeEventListener('click', resume);
            document.removeEventListener('keydown', resume);
          };
          document.addEventListener('click', resume, { once: true });
          document.addEventListener('keydown', resume, { once: true });
        });

        track.on('unsubscribed', () => {
          console.log('Remote audio track unsubscribed');
          track.detach().forEach((e) => e.remove());
        });
      }
    });

    // AI speaking state
    room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
      const isAgentSpeaking = speakers.some(
        (s) => s.identity !== room.localParticipant.identity
      );
      setIsSpeaking(isAgentSpeaking);
      isSpeakingRef.current = isAgentSpeaking;
      if (isAgentSpeaking) {
        setIsUserSpeaking(false);
      }
    });

    room.on(RoomEvent.TranscriptionReceived, (segments, participant) => {
      segments.forEach((seg) => {
        if (seg.final) {
          const isLocal = participant?.identity === room.localParticipant.identity;
          const entry = {
            role: isLocal ? 'user' : 'assistant',
            content: (seg.text || '').trim(),
            timestamp: new Date(),
            phase: phaseRef.current,
            id: `${participant?.identity || 'unknown'}-${Date.now()}-${Math.random()}`,
          };

          if (!entry.content) return;
          setTranscript((prev) => {
            const isDuplicate = prev.some(
              (m) =>
                m.role === entry.role &&
                m.content === entry.content &&
                Date.now() - new Date(m.timestamp).getTime() < 3000
            );
            if (isDuplicate) return prev;

            const newTranscript = [...prev, entry];
            if (entry.role === 'assistant') {
              checkAndAdvancePhase(newTranscript, data.interviewType);
            }
            return newTranscript;
          });
        }
      });
    });

    try {
      room.registerTextStreamHandler("lk.transcription", async (reader, participantInfo) => {
        const isLocal = participantInfo?.identity === room.localParticipant.identity;
        for await (const chunk of reader) {
          const text = (typeof chunk === 'string' ? chunk : chunk?.text || chunk?.content || '').trim();
          if (text) {
            const entry = {
              role: isLocal ? 'user' : 'assistant',
              content: text,
              timestamp: new Date(),
              phase: phaseRef.current,
              id: `${participantInfo?.identity || 'unknown'}-${Date.now()}-${Math.random()}`,
            };

            setTranscript((prev) => {
              const isDuplicate = prev.some(
                (m) =>
                  m.role === entry.role &&
                  m.content === entry.content &&
                  Date.now() - new Date(m.timestamp).getTime() < 3000
              );
              if (isDuplicate) return prev;

              const newTranscript = [...prev, entry];
              if (entry.role === 'assistant') {
                checkAndAdvancePhase(newTranscript, data.interviewType);
              }
              return newTranscript;
            });
          }
        }
      });
    } catch (err) {
      console.warn("registerTextStreamHandler not supported or failed:", err);
    }

    const connectAndPublishMic = async () => {
      try {
        await room.connect(data.serverUrl, data.token);
        await room.localParticipant.setMicrophoneEnabled(true, {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        });

        const micPublication = room.localParticipant.getTrackPublication(Track.Source.Microphone);
        const micTrack = micPublication?.track?.mediaStreamTrack;
        startMicMonitoring(micTrack);
      } catch (err) {
        console.error('Room connection failed:', err);
        if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
          setMicError(true);
          toast.error('Microphone is blocked. Please allow mic access in your browser settings.');
          return;
        }
        toast.error('Failed to connect to the interview room.');
      }
    };

    navigator.permissions?.query({ name: 'microphone' }).then((perm) => {
      if (perm.state === 'denied') {
        setMicError(true);
        toast.error('Microphone is blocked. Please allow mic access in your browser settings.');
        return;
      }
      connectAndPublishMic();
    }).catch(connectAndPublishMic);
  }, [id, checkAndAdvancePhase]);

  useEffect(() => {
    intentionalEndRef.current = false;
    interviewService.getToken(id)
      .then((res) => {
        const data = res.data;
        sessionDataRef.current = data;
        setSessionData(data);

        if (data.existingTranscript?.length > 0) {
          const restored = data.existingTranscript.map(normalizeTranscriptItem);
          setTranscript(restored);
          if (data.startedAt && data.maxDurationMinutes) {
            const passed = Math.floor((Date.now() - new Date(data.startedAt)) / 1000);
            setRemainingSeconds(Math.max(0, (data.maxDurationMinutes * 60) - passed));
          } else if (data.maxDurationMinutes) {
            setRemainingSeconds(data.maxDurationMinutes * 60);
          }
        } else if (data.maxDurationMinutes) {
          setRemainingSeconds(data.maxDurationMinutes * 60);
        }

        setLoading(false);
        initLiveKit(data);
      })
      .catch(() => {
        toast.error('Could not load interview session.');
        navigate('/dashboard');
      });

    return () => {
      intentionalEndRef.current = true;
      roomRef.current?.disconnect();
      clearInterval(timerRef.current);
      clearTimeout(skipTimerRef.current);
      stopMicMonitoring();
    };
  }, [id]);

  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const toggleMute = async () => {
    if (!roomRef.current) return;
    const next = !isMutedRef.current;
    isMutedRef.current = next;

    try {
      await roomRef.current.localParticipant.setMicrophoneEnabled(!next, {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      });

      if (!next) {
        const micPublication = roomRef.current.localParticipant.getTrackPublication(Track.Source.Microphone);
        startMicMonitoring(micPublication?.track?.mediaStreamTrack);
      }
    } catch (err) {
      console.error('Failed to toggle microphone:', err);
      isMutedRef.current = !next;
      toast.error('Could not update microphone state.');
      return;
    }

    setIsMuted(next);
    if (next) {
      stopMicMonitoring();
      setMicLevel(0);
      setIsUserSpeaking(false);
    }
    toast(next ? 'Microphone muted' : 'Microphone unmuted');
  };

  const handleSkip = () => {
    toast('Feature not supported in LiveKit yet - please tell the interviewer "Let\'s move on".');
  };

  const handleEndInterview = async () => {
    intentionalEndRef.current = true;
    setEnding(true);

    const uploadRecording = async (chunks) => {
      if (chunks.length > 0) {
        try {
          const blob = new Blob(chunks, { type: 'audio/webm' });
          const formData = new FormData();
          formData.append('recording', blob, 'recording.webm');
          const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
          const token = localStorage.getItem('aic_token');
          await fetch(`${API_BASE}/interview/${id}/recording`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          });
          console.log('✅ Recording uploaded');
        } catch (uploadErr) {
          console.warn('Recording upload failed:', uploadErr.message);
        }
      }
    };

    // Stop the audio recorder and wait for upload on stop
    const uploadPromise = new Promise((resolve) => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.onstop = async () => {
          await uploadRecording(recordedChunksRef.current);
          resolve();
        };
        mediaRecorderRef.current.stop();
      } else {
        uploadRecording(recordedChunksRef.current).then(resolve);
      }
    });

    await uploadPromise;

    if (recordingContextRef.current) {
      try { recordingContextRef.current.close().catch(() => {}); } catch {}
      recordingContextRef.current = null;
    }

    try {
      roomRef.current?.disconnect();
    } catch (e) {}
    setCallActive(false);
    clearInterval(timerRef.current);
    stopMicMonitoring();

    try {
      await interviewService.end(id);
    } catch (err) {
      console.warn('Error ending interview on server:', err);
    }

    setShowFeedbackModal(true);
  };

  const submitAppFeedback = async () => {
    setEnding(true); // Re-use ending state for loading spinner
    if (feedbackRating > 0) {
      try {
        await userFeedbackService.submit({
          interviewId: id,
          type: 'improvement',
          overallRating: feedbackRating,
          interviewQualityRating: feedbackRating,
          aiVoiceQualityRating: feedbackRating,
          questionRelevanceRating: feedbackRating,
          feedbackText: feedbackText,
        });
        toast.success('Thanks for your feedback!');
      } catch (err) {
        if (err.response?.status !== 409) {
          console.warn('Failed to submit user feedback', err.message);
        }
      }
    }
    toast.success('Generating your interview report...');
    navigate(`/dashboard/feedback/${id}`);
  };

  const skipAppFeedback = () => {
    toast.success('Generating your interview report...');
    navigate(`/dashboard/feedback/${id}`);
  };

  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const getMicLevelLabel = () => {
    if (isMuted) return 'Muted';
    if (micLevel > 60) return 'Strong';
    if (micLevel > 30) return 'Good';
    if (micLevel > 10) return 'Low';
    return 'Silent';
  };

  if (loading) {
    return (
      <div className="ir-loading">
        <div className="ir-loading-inner">
          <Loader size={40} className="ir-spinner" />
          <p>Setting up your interview session...</p>
        </div>
      </div>
    );
  }

  if (micError) {
    return (
      <div className="ir-loading">
        <div className="ir-loading-inner">
          <MicOff size={48} style={{ color: '#f87171', marginBottom: 12 }} />
          <h3 style={{ color: '#f1f5f9', margin: '0 0 8px' }}>Microphone Access Required</h3>
          <p style={{ color: '#94a3b8', maxWidth: 360, textAlign: 'center', lineHeight: 1.6 }}>
            Your browser has blocked microphone access. Please click the lock icon in your browser's address bar, allow microphone, then refresh this page.
          </p>
          <button
            className="ir-ctrl-btn ir-ctrl-btn--end"
            style={{ marginTop: 20 }}
            onClick={() => window.location.reload()}
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  const lastAiMsg = [...transcript].reverse().find((m) => m.role === 'assistant');
  const captionText = lastAiMsg?.content || (callActive ? 'Alex is ready' : 'Connecting...');

  return (
    <div className="ir-root">
      <div className="ir-topbar">
        <div className="ir-topbar-left">
          <div className="ir-phase-pill">
            <span className="ir-phase-dot" />
            {phase}
          </div>
        </div>
        <div className="ir-topbar-center">
          <span className="ir-role-title">
            {sessionData?.role || 'Mock Interview'} · {sessionData?.interviewType || ''}
          </span>
        </div>
        <div className="ir-topbar-right">
          <Clock size={13} />
          <span className="ir-timer" style={{ color: remainingSeconds <= 120 ? 'red' : remainingSeconds <= 300 ? 'yellow' : 'inherit' }}>
            {formatTime(remainingSeconds)}
          </span>
          <div className={`ir-live-dot ${callActive ? 'active' : ''}`} />
          <span className="ir-live-label">{callActive ? 'LIVE' : 'Connecting'}</span>
        </div>
      </div>

      {reconnecting && (
        <div className="ir-reconnect-banner">
          <Loader size={16} className="ir-spinner" />
          <span>Connection interrupted - reconnecting automatically...</span>
        </div>
      )}

      <div className="ir-stage">
        <div className="ir-phases">
          {PHASES.map((p, i) => (
            <div
              key={p}
              className={`ir-phase-step ${p === phase ? 'active' : PHASES.indexOf(phase) > i ? 'done' : ''}`}
              title={p}
            >
              <div className="ir-phase-step-dot" />
              <span>{p}</span>
            </div>
          ))}
        </div>

        <div className="ir-callers">
          <div className={`ir-caller ${isSpeaking ? 'ir-caller--speaking' : ''}`}>
            <div className="ir-caller-avatar ir-caller-avatar--ai">
              {isSpeaking && (
                <>
                  <div className="ir-ring ir-ring-1" />
                  <div className="ir-ring ir-ring-2" />
                  <div className="ir-ring ir-ring-3" />
                </>
              )}
              <div className="ir-avatar-inner">AI</div>
            </div>
            <div className="ir-caller-info">
              <span className="ir-caller-name">Alex</span>
              <span className="ir-caller-role">AI Interviewer · Senior Engineer</span>
            </div>
            <div className={`ir-status-badge ${isSpeaking ? 'ir-status-badge--speaking' : ''}`}>
              {isSpeaking
                ? <><span className="ir-bar"/><span className="ir-bar"/><span className="ir-bar"/><span className="ir-bar"/><span className="ir-bar"/> Speaking...</>
                : (isUserSpeaking ? 'Listening' : 'Thinking...')}
            </div>
          </div>

          <div className="ir-vs">
            <div className="ir-vs-line" />
            <span>VS</span>
            <div className="ir-vs-line" />
          </div>

          <div className={`ir-caller ${isUserSpeaking ? 'ir-caller--speaking ir-caller--user-speaking' : ''}`}>
            <div className={`ir-caller-avatar ir-caller-avatar--user ${isMuted ? 'ir-caller-avatar--muted' : ''}`}>
              {isUserSpeaking && !isMuted && (
                <>
                  <div className="ir-ring ir-ring-1 ir-ring--user" />
                  <div className="ir-ring ir-ring-2 ir-ring--user" />
                  <div className="ir-ring ir-ring-3 ir-ring--user" />
                </>
              )}
              <div className="ir-avatar-inner">You</div>
              {isMuted && (
                <div className="ir-muted-overlay">
                  <MicOff size={20} />
                </div>
              )}
            </div>
            <div className="ir-caller-info">
              <span className="ir-caller-name">You</span>
              <span className="ir-caller-role">Candidate</span>
            </div>

            <div className="ir-mic-strength-container">
              <Mic size={14} className="ir-mic-strength-icon" />
              <div className="ir-mic-strength-meter">
                <div 
                  className="ir-mic-strength-fill"
                  style={{ 
                    width: `${micLevel}%`,
                    backgroundColor: micLevel > 70 ? '#f87171' : micLevel > 35 ? '#fbbf24' : '#34d399'
                  }}
                />
              </div>
              <span className="ir-mic-strength-label">{getMicLevelLabel()}</span>
            </div>

            <div className={`ir-status-badge ${isUserSpeaking && !isMuted ? 'ir-status-badge--user' : ''}`}>
              {isMuted
                ? 'Muted'
                : isUserSpeaking
                  ? <><span className="ir-bar ir-bar--user"/><span className="ir-bar ir-bar--user"/><span className="ir-bar ir-bar--user"/><span className="ir-bar ir-bar--user"/><span className="ir-bar ir-bar--user"/> Speaking...</>
                  : 'Listening'}
            </div>
          </div>
        </div>

        <div className="ir-caption">
          <span className="ir-caption-role">
            Alex (Interviewer)
          </span>
          <p className="ir-caption-text">{captionText}</p>
        </div>
      </div>

      <div className="ir-controls">
        <div className="ir-controls-inner">
          <button
            id="btn-mute"
            className={`ir-ctrl-btn ${isMuted ? 'ir-ctrl-btn--danger' : 'ir-ctrl-btn--default'}`}
            onClick={toggleMute}
            title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
            <span>{isMuted ? 'Unmute' : 'Mute'}</span>
          </button>

          {showSkip && (
            <button
              id="btn-skip"
              className="ir-ctrl-btn ir-ctrl-btn--skip"
              onClick={handleSkip}
            >
              <SkipForward size={20} />
              <span>Skip Question</span>
            </button>
          )}

          <button
            id="btn-end-interview"
            className="ir-ctrl-btn ir-ctrl-btn--end"
            onClick={handleEndInterview}
            disabled={ending}
          >
            {ending && !showFeedbackModal ? <Loader size={18} className="ir-spinner" /> : <PhoneOff size={20} />}
            <span>{ending && !showFeedbackModal ? 'Ending...' : 'End Interview'}</span>
          </button>
        </div>
      </div>

      {showFeedbackModal && (
        <div className="ir-modal-overlay">
          <div className="ir-modal glass-card animate-fade-in-up" style={{ padding: '32px', width: '90%', maxWidth: '400px', textAlign: 'center' }}>
            <h2 style={{ fontSize: 20, marginBottom: 8, color: '#f1f5f9' }}>How was your experience?</h2>
            <p style={{ fontSize: 14, color: '#94a3b8', marginBottom: 24, lineHeight: 1.5 }}>
              Help us improve MockMate by rating the app's UI and AI voice quality.
            </p>
            
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  style={{ 
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: star <= (feedbackHover || feedbackRating) ? '#f59e0b' : '#334155',
                    transition: 'color 0.2s'
                  }}
                  onMouseEnter={() => setFeedbackHover(star)}
                  onMouseLeave={() => setFeedbackHover(0)}
                  onClick={() => setFeedbackRating(star)}
                >
                  <Star size={32} fill={star <= (feedbackHover || feedbackRating) ? 'currentColor' : 'none'} />
                </button>
              ))}
            </div>

            <textarea
              className="form-input"
              style={{ width: '100%', minHeight: 80, marginBottom: 24, resize: 'none', background: 'rgba(15, 23, 42, 0.6)' }}
              placeholder="Any suggestions for improvement? (Optional)"
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
            />

            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={skipAppFeedback}>
                Skip
              </button>
              <button 
                className="btn btn-primary" 
                style={{ flex: 1 }} 
                onClick={submitAppFeedback}
                disabled={feedbackRating === 0}
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InterviewRoom;