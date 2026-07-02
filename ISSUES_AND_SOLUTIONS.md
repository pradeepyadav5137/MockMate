# MockMate Issues & Troubleshooting Guide

This guide summarizes the issues identified, the fixes applied, and the manual actions you can take to optimize your setup.

---

## 📋 Table of Issues & Status

| Issue | Category | Status | Details |
| :--- | :--- | :--- | :--- |
| **MongoDB buffering timeouts** | Database | **SOLVED** | The backend now automatically falls back to your local MongoDB instance if the MongoDB Atlas connection fails twice. |
| **Feedback not showing** | Frontend/Backend | **SOLVED** | Root cause was the database connection hanging, preventing feedback saving. Automatic local fallback resolves this. |
| **Recordings not showing** | Feature | **SOLVED** | Created the Mongoose `Recording` documents upon interview end (which was missing) and added a dev audio player + Razorpay unlock dialog in the frontend. |
| **AI "Not listening properly"** | Agent | **SOLVED** | Tweaked LiveKit agent parameters (`minDuration: 0.8s`, `minDelay: 1500ms`) to wait for user pauses and avoid cutting you off. |
| **AI asking long questions** | Agent | **SOLVED** | Restructured the system prompt rules to enforce 1-2 sentence questions, and added dynamic scaling based on selected Difficulty (Easy, Medium, Hard). |
| **Cartesia quota limits** | Infrastructure | **SOLVED** | Added a 100% free fallback to Google Gemini TTS using your existing Gemini API Key. |

---

## 🛠️ Manual Steps & Instructions

### 1. Retrieve Historical Data from MongoDB Atlas (IP Whitelisting)
If you see **"No interviews yet"** on your dashboard, it means the server is running on the local MongoDB fallback because your current IP address is not whitelisted on MongoDB Atlas. 

To restore your Atlas connection and historical data:
1. Log in to your [MongoDB Atlas Dashboard](https://cloud.mongodb.com/).
2. In the left sidebar, navigate to **Security** > **Network Access**.
3. Click **Add IP Address**.
4. Select **Add Current IP Address** or choose **Allow Access From Anywhere** (`0.0.0.0/0`) for temporary development convenience.
5. Click **Confirm** and wait 1–2 minutes for the changes to apply.
6. Restart your backend server. It will automatically connect back to Atlas and show your previous history.

---

### 2. Switch to Free Text-to-Speech (Google Gemini TTS)
If your Cartesia credits are exhausted, or you want to avoid operational costs, you can switch the agent to use Google Gemini's Text-to-Speech service (fully covered by the free tier of your `GEMINI_API_KEY`).

To switch to Google Gemini TTS:
1. Open your `backend/.env` file.
2. Add or modify the `TTS_PROVIDER` environment variable:
   ```env
   TTS_PROVIDER=google
   ```
3. (Optional) You can clear or comment out the `CARTESIA_API_KEY` line:
   ```env
   # CARTESIA_API_KEY=...
   ```
4. Restart the backend server. The agent will now use Google Gemini TTS to synthesize speech.

---

### 3. Testing Recordings in Development
Because LiveKit Egress (production recording recorder) is typically not running in local development mode:
- The backend will automatically create a **mock development recording** (using a sample audio file) when you end an interview.
- Go to **Interview History**, click **Feedback** on your completed interview, and you will see the **Interview Audio Recording** card.
- You can test the payment dialog (click **Unlock Recording (₹9)**) and listen to the playback.
