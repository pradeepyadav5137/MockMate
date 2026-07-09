const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const os = require('os');
const { EdgeTTS } = require('node-edge-tts');
const { shortuuid } = require('@livekit/agents');

const EDGE_VOICES = {
  'in-female': 'en-IN-NeerjaNeural',
  'in-male': 'en-IN-PrabhatNeural',
  'us-female': 'en-US-AriaNeural',
  'us-male': 'en-US-ChristopherNeural',
  'uk-male': 'en-GB-RyanNeural',
  'us-soft': 'en-US-AnaNeural',
  'us-neutral': 'en-US-GuyNeural',
};

const VOICE_PREVIEW_TEXT = "Hello, I'm Alex, your AI interviewer. I will keep questions clear, professional, and focused on your interview goals.";

router.get('/preview', async (req, res) => {
  try {
    const { voice } = req.query;
    if (!voice) return res.status(400).json({ error: 'Voice is required' });

    const edgeVoiceId = EDGE_VOICES[voice] || voice;
    const tempFile = path.join(os.tmpdir(), `${shortuuid()}.mp3`);

    const edge = new EdgeTTS({
      voice: edgeVoiceId,
      lang: 'en-IN',
      outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
    });

    await edge.ttsPromise(VOICE_PREVIEW_TEXT, tempFile);

    res.setHeader('Content-Type', 'audio/mpeg');
    const readStream = fs.createReadStream(tempFile);
    readStream.pipe(res);
    
    readStream.on('close', () => {
      fs.unlink(tempFile, () => {});
    });
  } catch (err) {
    console.error('TTS Preview Error:', err);
    res.status(500).json({ error: 'Preview generation failed' });
  }
});

module.exports = router;
