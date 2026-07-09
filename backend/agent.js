const { cli, defineAgent, WorkerOptions, voice, initializeLogger } = require('@livekit/agents');
initializeLogger({ pretty: true });

const deepgram = require('@livekit/agents-plugin-deepgram');
const openai = require('@livekit/agents-plugin-openai');
const cartesia = require('@livekit/agents-plugin-cartesia');
const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

/**
 * Extract interview metadata from room/job metadata.
 */
const getMetadata = (ctx) => {
  const candidates = [
    ctx.job?.metadata,
    ctx.room?.metadata,
    ctx.room?.localParticipant?.metadata,
  ].filter(Boolean);

  for (const value of candidates) {
    try {
      const parsed = JSON.parse(value);
      if (parsed?.systemPrompt) return parsed;
    } catch (e) {
      // skip invalid JSON
    }
  }
  return {};
};

const { llm: agentsLlm } = require('@livekit/agents');

/**
 * Build LLM instance using FallbackAdapter with Groq, Cerebras, and Mistral.
 */
const buildLlm = () => {
  const groqLLM = new openai.LLM({
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    temperature: 0.45,
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
  });

  const cerebrasLLM = new openai.LLM({
    model: 'gemma-4-31b',
    temperature: 0.45,
    apiKey: process.env.CEREBRAS_API_KEY,
    baseURL: 'https://api.cerebras.ai/v1',
  });

  const mistralLLM = new openai.LLM({
    model: 'mistral-large-latest',
    temperature: 0.45,
    apiKey: process.env.MISTRAL_API_KEY,
    baseURL: 'https://api.mistral.ai/v1',
  });

  return new agentsLlm.FallbackAdapter({
    llms: [groqLLM, cerebrasLLM, mistralLLM],
    attemptTimeout: 7.0,
  });
};

const CARTESIA_VOICES = {
  'us-female': 'bf991597-6c13-47e4-8411-91ec2de5c466',
  'us-male': 'd46abd1d-2d02-43e8-819f-51fb652c1c61',
  'uk-male': 'a0e99841-438c-4a64-b679-ae501e7d6091',
  'us-soft': '79a125e8-cd45-4c13-8a67-188112f4dd22',
  'us-neutral': '794f9389-aac1-45b6-b726-9d9369183238',
};

const apiBaseUrl = process.env.INTERNAL_API_URL || `http://localhost:${process.env.PORT || 5000}/api`;

const extractText = (item) => {
  if (!item) return '';
  if (typeof item.textContent === 'string') return item.textContent.trim();
  if (typeof item.content === 'string') return item.content.trim();
  if (Array.isArray(item.content)) {
    return item.content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (typeof part?.text === 'string') return part.text;
        return '';
      })
      .filter(Boolean)
      .join('\n')
      .trim();
  }
  return '';
};

const saveTranscriptTurn = async (interviewId, speaker, text) => {
  const cleanText = String(text || '').trim();
  if (!interviewId || !cleanText) return;

  try {
    await axios.post(
      `${apiBaseUrl}/interview/${interviewId}/transcript`,
      { speaker, text: cleanText },
      { headers: { 'x-internal-key': process.env.AGENT_INTERNAL_SECRET } }
    );
  } catch (err) {
    console.error(`[agent] Failed to save ${speaker} transcript:`, err.message);
  }
};

/**
 * Agent entry point — called by the LiveKit agents framework when
 * the agent is dispatched to a room.
 */
const agent = defineAgent({
  entry: async (ctx) => {
    console.log('[agent] Room:', ctx.room?.name);
    let session;
    let endTimer;

    try {
      await ctx.connect();
      console.log('[agent] Connected to room');

      const metadata = getMetadata(ctx);
      const { systemPrompt, maxDuration = 900, interviewId, voiceAccent = 'us-male', isPaid } = metadata;

      if (!systemPrompt) {
        console.error('[agent] No system prompt in metadata — exiting');
        return;
      }
      if (!process.env.CARTESIA_API_KEY) {
        console.warn('[agent] CARTESIA_API_KEY is missing — Cartesia TTS cannot start, checking fallbacks');
      }

      console.log('[agent] System prompt loaded, interview:', interviewId);

      // ── STT: Deepgram ──────────────────────────────────────────────
      const stt = new deepgram.STT({
        model: process.env.DEEPGRAM_MODEL || 'nova-2',
        language: 'en-IN',
        smartFormat: true,
        apiKey: process.env.DEEPGRAM_API_KEY,
        keepAlive: true,
      });

      // ── LLM: Groq (via OpenAI compat) ─────────────────────────────
      const llm = buildLlm();

      // ── TTS: Selection (Edge TTS / Cartesia) ──────────────────────
      let tts;
      const EDGE_VOICES = {
        'in-female': 'en-IN-NeerjaNeural',
        'in-male': 'en-IN-PrabhatNeural',
        'us-female': 'en-US-AriaNeural',
        'us-male': 'en-US-ChristopherNeural',
        'uk-male': 'en-GB-RyanNeural',
        'us-soft': 'en-US-AnaNeural',
        'us-neutral': 'en-US-GuyNeural',
      };

      const { EdgeTTSPlugin } = require('./edgeTtsPlugin');
      const edgeVoiceId = EDGE_VOICES[voiceAccent] || 'en-IN-NeerjaNeural';

      if (!isPaid || voiceAccent.startsWith('in-') || !process.env.CARTESIA_API_KEY) {
        console.log(`[agent] Using Edge TTS (Free tier / Indian voice / Fallback). Voice: ${edgeVoiceId}`);
        tts = new EdgeTTSPlugin({ voice: edgeVoiceId });
      } else {
        console.log(`[agent] Using Cartesia TTS (Premium). Voice: ${voiceAccent}`);
        tts = new cartesia.TTS({
          model: process.env.CARTESIA_MODEL || 'sonic-2',
          voice: process.env.CARTESIA_VOICE_ID || CARTESIA_VOICES[voiceAccent] || CARTESIA_VOICES['us-male'],
          apiKey: process.env.CARTESIA_API_KEY,
          language: process.env.CARTESIA_LANGUAGE || 'en',
        });
      }

      // ── Voice Agent Session ────────────────────────────────────────
      session = new voice.AgentSession({
        stt,
        llm,
        tts,
        turnDetection: 'server',
      });

      // ── Timing and Lifecycle State ────────────────────────────────
      const now = Date.now();
      const nominalDurationMs = maxDuration * 1000;
      const closingDurationMs = 120000; // 2 minutes
      
      const closingAtMs = now + nominalDurationMs - closingDurationMs;
      const endsAtMs = now + nominalDurationMs;
      const hardEndsAtMs = endsAtMs + 60000; // 1 min grace

      let currentPhase = 'INTRO';
      let introExchanges = 0;

      // Sync timing to backend
      if (interviewId) {
        axios.post(
          `${apiBaseUrl}/interview/${interviewId}/start-timing`,
          {
            startedAt: new Date(now).toISOString(),
            closingAt: new Date(closingAtMs).toISOString(),
            endsAt: new Date(endsAtMs).toISOString(),
            hardEndsAt: new Date(hardEndsAtMs).toISOString(),
          },
          { headers: { 'x-internal-key': process.env.AGENT_INTERNAL_SECRET } }
        ).catch(e => console.error('[agent] Sync timing failed:', e.message));
      }

      session.on('error', (err) => {
        console.error('[agent] Session error:', err?.message || String(err));
      });

      let replyTimer;
      let pendingUserText = '';
      let isGenerating = false;
      let generationTurnId = 0;

      const triggerNextTurn = () => {
        if (isGenerating) return;
        if (session.agentState === 'speaking' || session.agentState === 'thinking') return;
        
        const rawUserInput = pendingUserText;
        if (!rawUserInput) return;
        
        pendingUserText = '';
        isGenerating = true;
        generationTurnId++;
        const currentGenId = generationTurnId;

        const timeNow = Date.now();
        let phaseInstruction = '';

        if (timeNow >= hardEndsAtMs) {
            console.log('[agent] Hard timeout reached during turn, ending immediately.');
            isGenerating = false;
            return;
        } else if (timeNow >= closingAtMs) {
            currentPhase = 'CLOSING';
            phaseInstruction = '\n\n[SYSTEM RULE: We are now in the CLOSING phase. You MUST immediately provide a concise spoken summary of my performance, ask if I have any final questions, answer briefly, and naturally wrap up the interview. DO NOT ask any new technical questions. End your final goodbye with the exact word "Goodbye." so the system knows to close.]';
        } else {
            if (currentPhase === 'INTRO') {
                if (introExchanges >= 1) {
                    currentPhase = 'TECHNICAL_INTERVIEW';
                } else {
                    introExchanges++;
                    phaseInstruction = '\n\n[SYSTEM RULE: We are in the INTRO phase. Follow up on my introduction briefly.]';
                }
            }
            
            if (currentPhase === 'TECHNICAL_INTERVIEW') {
                phaseInstruction = `\n\n[SYSTEM RULE: We are in the TECHNICAL_INTERVIEW phase. Substantial time remains (${Math.ceil((closingAtMs - timeNow)/60000)} min until closing). You MUST NOT end or conclude the interview yet. Reject any premature closing. Continue with another dynamic, in-category technical question, or a harder follow-up based on my previous answer.]`;
            }
        }

        const userInput = rawUserInput + phaseInstruction;

        try {
          console.log(`[agent] Generating reply (Gen ID: ${currentGenId}) for:`, rawUserInput, `[Phase: ${currentPhase}]`);
          session.generateReply({
            userInput,
            inputModality: 'text',
            allowInterruptions: true,
          });
        } catch (err) {
          console.error('[agent] Reply generation failed:', err.message || err);
          isGenerating = false;
        }
      };

      session.on('user_input_transcribed', (ev) => {
        if (ev.isFinal && ev.transcript) {
          console.log('[agent] Candidate:', ev.transcript);
          saveTranscriptTurn(interviewId, 'user', ev.transcript);
          pendingUserText = [pendingUserText, ev.transcript].filter(Boolean).join(' ').trim();
          
          if (!isGenerating && session.agentState !== 'speaking' && session.agentState !== 'thinking') {
            clearTimeout(replyTimer);
            replyTimer = setTimeout(triggerNextTurn, 900);
          } else {
            console.log('[agent] Preserving transcript, generation in progress or agent busy.');
          }
        }
      });

      session.on('conversation_item_added', (ev) => {
        const item = ev.item;
        if (item?.role !== 'assistant' || item?.interrupted) return;
        const text = extractText(item);
        if (text) {
          console.log('[agent] Alex:', text);
          saveTranscriptTurn(interviewId, 'assistant', text);
          
          if (currentPhase === 'CLOSING' && /goodbye/i.test(text)) {
            console.log('[agent] Detected natural closing ("goodbye"). Scheduling normal_closing.');
            setTimeout(async () => {
              if (interviewId) {
                await axios.post(
                  `${apiBaseUrl}/interview/${interviewId}/end`,
                  { reason: 'normal_closing' },
                  { headers: { 'x-internal-key': process.env.AGENT_INTERNAL_SECRET } }
                ).catch((e) => console.error('[agent] End notify failed:', e.message));
              }
              await session.close().catch(() => {});
              await ctx.room.disconnect();
            }, 5000); // give 5 seconds for TTS to finish speaking the goodbye
          }
        }
      });

      session.on('agent_state_changed', (ev) => {
        const state = ev.newState || ev.state;
        console.log('[agent] State:', state);
        if (state === 'listening' || state === 'idle') {
           isGenerating = false;
           if (pendingUserText) {
             clearTimeout(replyTimer);
             replyTimer = setTimeout(triggerNextTurn, 900);
           }
        } else if (state === 'thinking' || state === 'speaking') {
           isGenerating = true;
        }
      });

      // ── Start the session ──────────────────────────────────────────
      const myAgent = new voice.Agent({ instructions: systemPrompt });
      await session.start({
        agent: myAgent,
        room: ctx.room,
        inputOptions: { closeOnDisconnect: false },
      });
      console.log('[agent] Session started');

      // ── Send greeting after a short delay ──────────────────────────
      setTimeout(async () => {
        try {
          console.log('[agent] Sending greeting...');
          await session.say(
            "Hi, I'm Alex. We'll do a focused mock interview today. To start, tell me about yourself and the kind of engineering work you've done.",
            { allowInterruptions: true }
          );
          console.log('[agent] Greeting delivered');
        } catch (e) {
          console.error('[agent] Greeting failed:', e.message || e);
        }
      }, 2000);

      // ── Auto-end after max duration (Hard timeout) ────────────────
      endTimer = setTimeout(async () => {
        console.log(`[agent] Hard timeout reached; ending interview forcibly`);
        try {
          await session.say(
            "I'm so sorry, but we've run completely out of time for today. Your feedback is being prepared.",
            { allowInterruptions: false }
          );
          if (interviewId) {
            await axios.post(
              `${apiBaseUrl}/interview/${interviewId}/end`,
              { reason: 'time_expired' },
              { headers: { 'x-internal-key': process.env.AGENT_INTERNAL_SECRET } }
            ).catch((e) => console.error('[agent] End notify failed:', e.message));
          }
          await session.close().catch(() => {});
          await ctx.room.disconnect();
        } catch (e) {
          console.error('[agent] Auto-end error:', e.message || e);
        }
      }, hardEndsAtMs - now);

    } catch (err) {
      console.error('[agent] Entry error:', err.message || err);
      console.error(err.stack);
      try { await session?.close?.(); } catch (_) {}
      try { if (ctx.room) await ctx.room.disconnect(); } catch (_) {}
    } finally {
      ctx.room?.once?.('disconnected', () => {
        if (endTimer) clearTimeout(endTimer);
        console.log('[agent] Room disconnected');
      });
    }
  },
});

module.exports = agent;

if (require.main === module) {
  cli.runApp(new WorkerOptions({
    agent: __filename,
    agentName: process.env.LIVEKIT_AGENT_NAME || 'alex-interviewer',
    initializeProcessTimeout: 30000, // Allow up to 30s for imports & handshake (prevents timeout on slower VMs)
  }));
}

process.on('unhandledRejection', (err) => console.error('[agent] Unhandled:', err));
process.on('uncaughtException', (err) => console.error('[agent] Uncaught:', err));