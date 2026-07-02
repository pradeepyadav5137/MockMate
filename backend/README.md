# MockMate Backend

## Setup

### 1. Install dependencies
npm install

### 2. Speech setup
The LiveKit agent uses Deepgram for speech-to-text and Cartesia for text-to-speech.

### 3. Environment variables
Copy .env.example to .env and fill in all keys.
Free APIs needed:
  - Groq: https://console.groq.com (free)
  - Deepgram: https://deepgram.com (free 12k mins)
  - LiveKit Cloud: https://cloud.livekit.io (free 10k mins/month)
  - Cartesia: https://cartesia.ai

### 4. Run in development
npm run dev            ← starts Express server
node agent.js dev      ← starts LiveKit agent worker

### 5. Run in production (EC2)
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
