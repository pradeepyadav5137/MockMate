# MockMate AI Platform

MockMate is a production-ready AI interview platform designed to help candidates prepare for technical and behavioral interviews. It leverages a conversational AI pipeline (powered by Groq Llama 3, Deepgram, and Cartesia) through WebRTC (LiveKit) to simulate a real, interactive senior engineer interview.

## 🌟 Key Features
- **Real-Time Voice AI:** Low latency conversational pipeline using WebRTC (LiveKit). The AI listens to your responses, dynamically adapts the interview flow, and interrupts gracefully.
- **Resume-Driven Context:** Users upload their resumes. The AI scans them to craft targeted questions based on the candidate's actual projects and tech stack.
- **Dynamic Difficulty:** The AI evaluator scales the complexity of follow-up questions up or down depending on how well the candidate is performing.
- **Granular Feedback & Analytics:** Post-interview, the AI generates a comprehensive, rubric-based performance report detailing strengths, weaknesses, and a personalized study roadmap.
- **Session Recordings:** Interviews are securely recorded and streamed using AWS S3 presigned URLs, giving candidates the ability to listen back and self-evaluate.
- **Tiered Entitlements:** Built-in integration with Razorpay supports Free, Basic (₹9), and Pro (₹29) tiers with atomic concurrency-safe benefit provisioning.

## 🛠 Tech Stack
- **Frontend:** React (Create React App), Context API, CSS Variables / Utility Classes, React Router.
- **Backend:** Node.js, Express.js.
- **Database:** Amazon DynamoDB (NoSQL).
- **Storage:** AWS S3 (Presigned URLs for media), Local Storage fallback.
- **Real-Time Media:** LiveKit Server & `@livekit/agents`.
- **AI Providers:** Groq (Llama 3), Deepgram (STT), Cartesia (TTS), node-edge-tts (TTS Fallback).
- **Payment & Emails:** Razorpay, Brevo (Transactional Email).

## 🚀 Getting Started

### Prerequisites
- Node.js (v20+ recommended)
- An active AWS Account with DynamoDB and S3 configured
- API Keys for LiveKit, Groq, Deepgram, Cartesia, and Razorpay
- Google Developer Console credentials (if using OAuth)

### 1. Backend Setup
Navigate into the `backend/` directory:
```bash
cd backend
npm install
```

Copy the `.env.example` to `.env` and fill in your credentials:
```bash
cp .env.example .env
```
Ensure you have set up all mandatory fields (e.g. `JWT_SECRET`, AWS credentials, AI Provider Keys).

Start the backend:
```bash
npm run dev
```

### 2. Frontend Setup
Navigate into the `frontend/` directory:
```bash
cd frontend
npm install
```

Start the React development server:
```bash
npm start
```

### 3. Agent Pipeline
To handle the real-time AI WebRTC processing, the LiveKit Agent must be running.
In a new terminal window inside the `backend/` folder:
```bash
node agent.js dev
```

## 🔒 Production Security & Testing
- **Auth:** Protected by robust JWT authentication and Google OAuth 2.0. Internal microservice communication between the main backend and the LiveKit agent relies on a timing-safe `AGENT_INTERNAL_SECRET` check to prevent spoofing.
- **Payments:** Razorpay webhooks are fully verified via HMAC-SHA256. Webhook and frontend fulfillment calls execute concurrently safely via DynamoDB Conditional Expressions.
- **Testing:** The project includes a robust Jest suite in `backend/tests/` to verify entitlement state transitions and JWT security protocols. Run tests via `cd backend && npm test`.

## 📜 License
MockMate is proprietary software. All rights reserved.
