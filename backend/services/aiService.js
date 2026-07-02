const Groq = require('groq-sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const geminiClient = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

// TODO: add Cerebras SDK when available
// TODO: add Mistral SDK when available

const requestOpenAICompatible = async ({ apiKey, baseUrl, model, messages, temperature, maxTokens }) => {
  if (!apiKey) throw new Error('API key not configured');
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${response.status} ${text.slice(0, 200)}`);
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.content;
};

const callWithFallback = async (messages, { temperature = 0.3, maxTokens = 2000 } = {}) => {
  try {
    const result = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages,
      max_tokens: maxTokens,
      temperature,
    });
    return result.choices[0].message.content;
  } catch (err) {
    console.error('Groq failed, trying Gemini:', err.message);
  }

  try {
    if (!geminiClient) throw new Error('Gemini API key not configured');

    for (const modelName of ['gemini-2.0-flash', 'gemini-1.5-flash']) {
      try {
        const model = geminiClient.getGenerativeModel({ model: modelName });
        const prompt = messages.map((m) => `${m.role}: ${m.content}`).join('\n');
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
      } catch (geminiErr) {
        console.error(`Gemini ${modelName} failed:`, geminiErr.message);
      }
    }
  } catch (err) {
    console.error('Gemini failed, trying Cerebras:', err.message);
  }

  try {
    return await requestOpenAICompatible({
      apiKey: process.env.CEREBRAS_API_KEY,
      baseUrl: 'https://api.cerebras.ai/v1',
      model: 'gemma-4-31b',
      messages,
      temperature,
      maxTokens,
    });
  } catch (err) {
    console.error('Cerebras failed, trying Mistral:', err.message);
  }

  try {
    return await requestOpenAICompatible({
      apiKey: process.env.MISTRAL_API_KEY,
      baseUrl: 'https://api.mistral.ai/v1',
      model: 'mistral-large-latest',
      messages,
      temperature,
      maxTokens,
    });
  } catch (err) {
    console.error('Mistral failed:', err.message);
  }

  throw new Error('All AI providers temporarily unavailable.');
};

const groqGenerate = async (prompt, { jsonMode = false, temperature = 0.3, maxTokens = 2000 } = {}) => {
  const messages = [{ role: 'user', content: prompt }];
  const text = await callWithFallback(messages, { temperature, maxTokens });

  if (!jsonMode) return text;
  const clean = text.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(clean);
  } catch (e) {
    console.error('Failed to parse AI JSON:', clean.slice(0, 300));
    throw new Error('AI response was not valid JSON');
  }
};

const getCategoryName = (interviewType) => ({
  core_cs: 'Core CS',
  dsa: 'Data Structures & Algorithms',
  system_design: 'System Design',
  hr: 'HR & Behavioral',
  full_mix: 'Full Mix',
})[interviewType] || 'your selected category';

const getPhaseSequence = (interviewType) => {
  const sequences = {
    core_cs:       ['Introduction', 'Core CS', 'Feedback Discussion'],
    dsa:           ['Introduction', 'DSA', 'Feedback Discussion'],
    system_design: ['Introduction', 'System Design', 'Feedback Discussion'],
    hr:            ['Introduction', 'HR', 'Feedback Discussion'],
    full_mix:      ['Introduction', 'Resume Discussion', 'Core CS', 'DSA',
                    'System Design', 'HR', 'Feedback Discussion'],
  };
  return sequences[interviewType] || sequences.full_mix;
};

const getPhaseInstructions = (phase, interviewType) => {
  const instructions = {

    Introduction: `
      Ask only: "Tell me about yourself."
      Listen carefully. Ask ONE follow-up about something specific they mention.
      Maximum 2 exchanges total in this phase. Then move on immediately.
      Do NOT linger here. Do NOT ask about their projects yet.`,

    'Resume Discussion': `
      Pick ONE project from their resume profile.
      Ask: "Tell me about [project name]."
      Dig into ONE specific detail they mention — tech choice, challenge, or outcome.
      Keep follow-ups to one sentence. Max 3 exchanges then move to next phase.`,

    'Core CS': `
      Topics to cover: OOP, DBMS, OS, Computer Networks, SQL, basic CS fundamentals.
      Ask ONE short concept question. Example: "What is a deadlock?"
      After they answer, ask ONE follow-up based on their response.
      If they answer well: harder follow-up.
      If they struggle: simpler rephrasing or one small hint.
      Max 4 exchanges per topic. Then move to a new CS topic.
      Questions must sound spoken, not textbook. Max 15 words.`,

    DSA: `
      State ONE problem in 2-3 short spoken sentences. No walls of text.
      Good example: "Given an array of numbers, find two that sum to a target.
      How would you start?"
      After they answer:
        → Ask: "What's the time complexity?"
        → If brute force: "Can you do better?"
        → If stuck: one small hint only. Example: "What if you stored visited values?"
        → Ask ONE edge case: "What if the array is empty?"
      Discuss back and forth like a human. Never lecture.
      One question at a time. Always.`,

    'System Design': `
      Ask ONE design question in one sentence.
      Example: "How would you design a URL shortener?"
      Let them drive. Ask short follow-ups:
        → "How would you handle scale?"
        → "What if a server goes down?"
        → "How would you store the data?"
      One question at a time. Never list multiple concerns at once.`,

    HR: `
      Ask ONE behavioral question.
      Example: "Tell me about a tough deadline you hit."
      Follow up with: "What was your specific role?"
      Then: "What was the result?"
      Keep it conversational. Max 3 exchanges per question.
      Use STAR method internally to evaluate, but speak naturally.`,

    'Feedback Discussion': `
      Say: "That wraps up our session. Let me share some quick thoughts."
      Give 2 specific strengths based on actual answers from this interview.
      Give 1 area to work on with a concrete suggestion.
      Keep it personal and encouraging. Reference actual moments from the conversation.
      End with: "Any questions for me before we finish?"`,

  };

  return instructions[phase] ||
    'Continue naturally. Keep questions short and conversational. One at a time.';
};

const buildPhasePlan = (interviewType) => getPhaseSequence(interviewType)
  .map((phaseName) => `${phaseName}: ${getPhaseInstructions(phaseName, interviewType).replace(/\s+/g, ' ').trim()}`)
  .join('\n');

const buildInterviewSystemPrompt = ({ role, interviewType, difficulty, phase, resumeProfile, interviewMemory, exchangesInPhase = 0 }) => {
  const randomSeeds = [
    "Focus on deep technical internals, database query optimizations, and production bottlenecks.",
    "Focus heavily on engineering trade-offs, system failures, and alternative architectures you would consider.",
    "Ask situational questions about fast deadlines, code quality conflicts, and cross-functional team collaboration.",
    "Focus heavily on API design patterns, security practices, and robust error handling strategies.",
    "Focus on testing methodology, performance profiling, and operational monitoring in production."
  ];
  const chosenSeed = randomSeeds[Math.floor(Math.random() * randomSeeds.length)];

  // Build rich resume context from full profile
  let resumeContext = 'No resume provided. Ask general questions based on the role.';
  if (resumeProfile && typeof resumeProfile === 'object') {
    const parts = [];
    if (resumeProfile.summary) parts.push(`SUMMARY: ${resumeProfile.summary}`);
    if (resumeProfile.skills?.length) parts.push(`SKILLS: ${resumeProfile.skills.join(', ')}`);
    if (resumeProfile.technologies?.length) parts.push(`TECHNOLOGIES: ${resumeProfile.technologies.join(', ')}`);
    if (resumeProfile.projects?.length) {
      const projectDetails = resumeProfile.projects.map((p, i) =>
        `  ${i + 1}. ${p.name}${p.role ? ` (Role: ${p.role})` : ''}: ${p.description || 'No description'}${p.technologies?.length ? ` [Tech: ${p.technologies.join(', ')}]` : ''}`
      ).join('\n');
      parts.push(`PROJECTS:\n${projectDetails}`);
    }
    if (resumeProfile.experience?.length) {
      const expDetails = resumeProfile.experience.map((e, i) =>
        `  ${i + 1}. ${e.role} at ${e.company}${e.duration ? ` (${e.duration})` : ''}: ${e.description || 'No description'}`
      ).join('\n');
      parts.push(`EXPERIENCE:\n${expDetails}`);
    }
    if (resumeProfile.education?.length) {
      const eduDetails = resumeProfile.education.map((e, i) =>
        `  ${i + 1}. ${e.degree} from ${e.institution}${e.year ? ` (${e.year})` : ''}${e.score ? ` - ${e.score}` : ''}`
      ).join('\n');
      parts.push(`EDUCATION:\n${eduDetails}`);
    }
    resumeContext = parts.join('\n\n');
  }

  return `You are Alex, a senior software engineer at a top tech company.
You are conducting a VOICE mock interview. Speak naturally like a real person.

IMPORTANT CONTEXT:
Role: ${role}
Interview Type: ${interviewType}
Difficulty: ${difficulty}
Starting Phase: ${phase}
Phase Sequence: ${getPhaseSequence(interviewType).join(' -> ')}

CANDIDATE PROFILE:
${resumeContext}

CONVERSATION SO FAR:
${interviewMemory || 'Interview just started.'}

════════════════════════════════════════
ABSOLUTE RULES — NEVER BREAK THESE:
════════════════════════════════════════
1. YOU ARE THE INTERVIEWER, NOT THE CANDIDATE. Your job is to ask a question and WAIT for the candidate to answer.
2. ONE question per response. Never two questions at once. Ever.
3. Maximum 2 sentences per response. You are speaking out loud.
4. Questions should be 18-35 words when needed. Short is fine, but never be vague.
5. Never use bullet points, markdown, headers, or numbered lists.
6. Never say "As a Senior Software Engineer" or narrate your role.
7. After the candidate answers: only use a brief reaction when it adds value, then ask the next question.
8. NEVER reveal the answer to a question. If they don't know, move on or give a tiny hint.
9. DO NOT WRITE A SCRIPT. You are only generating your CURRENT spoken response.
10. If the candidate says "I don't know": say "Take a guess, no pressure."
11. Do not overuse fillers like "got it", "okay", or "sounds good". Never repeat the same filler twice.
12. Never repeat a question already asked in this interview.
13. STAY IN CATEGORY: This is a ${interviewType} interview. Never switch.

════════════════════════════════════════
REPHRASING RULE — VERY IMPORTANT:
════════════════════════════════════════
If the candidate says any of these:
  "I didn't understand", "Can you repeat?", "Can you explain?",
  "What do you mean?", "I'm confused", "Pardon?", "Say again"
Then:
  — Do NOT ask a new question.
  — Rephrase the SAME question in simpler words.
  — You may add one short example to clarify.
  — Do NOT reveal the answer.
  — Wait for their response.
Example:
  Alex asked: "What is dependency injection?"
  Candidate: "I didn't understand."
  Alex says: "Sure. How would you pass a database connection into a class
  without creating it inside the class?"
  (same concept, simpler words, one example, no answer given)

════════════════════════════════════════
PHASE PROGRESSION — MANDATORY:
════════════════════════════════════════
You MUST move through phases. Never stay in one phase forever.
Current saved assistant exchanges in this phase: ${exchangesInPhase || 0}
Move to the next phase after 3-4 candidate answers in the current phase.
Use a natural transition only when changing topics, then immediately ask the first question for the next phase.
Never announce the phase name to the candidate.
Phase sequence: ${getPhaseSequence(interviewType).join(' -> ')}
Starting phase: ${phase}

════════════════════════════════════════
DIFFICULTY ADAPTATION:
════════════════════════════════════════
Watch the candidate's answers carefully:
— Strong answer → ask a harder follow-up next
— Weak/incomplete answer → ask a simpler follow-up or give a small hint
— Multiple weak answers in a row → gently encourage:
  "No worries, let's try a slightly different angle."
Start at ${difficulty} difficulty. Adapt from there.

════════════════════════════════════════
PHASE INSTRUCTIONS:
════════════════════════════════════════
${buildPhasePlan(interviewType)}

SESSION FOCUS: ${chosenSeed}`;
};

const extractResumeProfile = async (rawText) => {
  const prompt = `You are a resume parser. Extract structured information from resume text.
IMPORTANT: Remove all PII - mask phone numbers, emails, physical addresses. Keep only professional information.
Return ONLY a valid JSON object (no markdown, no backticks) with this structure:
{
  "skills": ["skill1", "skill2"],
  "projects": [{"name": "", "description": "", "technologies": [], "role": ""}],
  "experience": [{"company": "", "role": "", "duration": "", "description": ""}],
  "education": [{"institution": "", "degree": "", "year": "", "score": ""}],
  "technologies": ["tech1", "tech2"],
  "summary": "2-3 sentence professional summary focusing on strengths and tech stack"
}

Extract from this resume:

${rawText.substring(0, 4000)}`;

  return groqGenerate(prompt, { jsonMode: true, temperature: 0.3 });
};

const generateCheckpointSummary = async (recentMessages, currentState) => {
  const transcript = recentMessages
    .map((m) => `${(m.role || m.speaker || 'unknown').toUpperCase()}: ${m.content || m.text || ''}`)
    .join('\n');

  const prompt = `Summarize this interview segment. Return ONLY a valid JSON object (no markdown, no backticks):
{
  "summary": "Brief summary of what was discussed",
  "topicsCovered": ["topic1", "topic2"],
  "strengths": ["strength1"],
  "weaknesses": ["weakness1"],
  "confidenceLevel": "Low|Medium|High",
  "suggestedNextPhase": "phase name"
}

Transcript:
${transcript}`;

  try {
    return await groqGenerate(prompt, { jsonMode: true, temperature: 0.3 });
  } catch (err) {
    console.error('⚠️  Checkpoint summary generation failed (non-critical):', err.message);
    return null;
  }
};

const generateFeedback = async (interview, transcript, resumeProfile) => {
  const fullTranscript = transcript.messages
    .map((m) => `${(m.role || m.speaker || 'unknown').toUpperCase()}: ${m.content || m.text || ''}`)
    .join('\n');

  const prompt = `You are an expert interviewer generating a comprehensive performance evaluation.
Analyze the interview transcript and return a detailed JSON feedback report.

Return ONLY a valid JSON object (no markdown, no backticks) with this exact structure:
{
  "overallScore": 0-100,
  "summary": "2-3 sentence overall assessment",
  "scores": {
    "technical": 0-100,
    "communication": 0-100,
    "confidence": 0-100,
    "problemSolving": 0-100
  },
  "technicalEvaluation": "detailed paragraph",
  "communicationEvaluation": "detailed paragraph",
  "confidenceEvaluation": "detailed paragraph",
  "problemSolvingEvaluation": "detailed paragraph",
  "strengths": ["strength1", "strength2", "strength3"],
  "weaknesses": ["weakness1", "weakness2"],
  "missedOpportunities": ["missed1", "missed2"],
  "improvementAreas": ["area1", "area2"],
  "questionBreakdown": [
    {
      "question": "...",
      "candidateAnswer": "brief summary",
      "evaluation": "what was good/missing",
      "missedPoints": ["point1"],
      "suggestedAnswer": "what a strong answer would include",
      "score": 0-100
    }
  ],
  "learningRoadmap": [
    {
      "topic": "Topic Name",
      "resources": [{"title": "...", "url": "...", "type": "article|video|course"}],
      "priority": "High|Medium|Low"
    }
  ],
  "interviewerRemarks": "Personal, encouraging closing remarks from the interviewer"
}

Role: ${interview.role}
Interview Type: ${interview.interviewType}
Difficulty: ${interview.difficulty}
Candidate Profile: ${JSON.stringify(resumeProfile?.profile || {})}

TRANSCRIPT:
${fullTranscript.substring(0, 12000)}`;

  return groqGenerate(prompt, { jsonMode: true, temperature: 0.4, maxTokens: 4000 });
};

const determineNextPhase = (currentPhase, interviewType, exchangesInPhase = 0, suggestedNextPhase = null) => {
  const sequence = getPhaseSequence(interviewType);
  const currentIndex = sequence.indexOf(currentPhase);

  if (currentIndex === -1 || currentIndex === sequence.length - 1) {
    return currentPhase; 
  }

  if (suggestedNextPhase && sequence.includes(suggestedNextPhase) && sequence.indexOf(suggestedNextPhase) > currentIndex) {
    return suggestedNextPhase;
  }

  if (exchangesInPhase >= 4) {
    return sequence[currentIndex + 1];
  }

  return currentPhase;
};

module.exports = {
  extractResumeProfile,
  buildInterviewSystemPrompt,
  generateCheckpointSummary,
  generateFeedback,
  getPhaseSequence,
  determineNextPhase,
  getCategoryName
};