const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const util = require('util');
const execFileAsync = util.promisify(execFile);
const ffmpeg = require('ffmpeg-static');
const { EdgeTTS } = require('node-edge-tts');
const { tts, AudioByteStream, shortuuid } = require('@livekit/agents');

class EdgeTTSPlugin extends tts.TTS {
  constructor(opts = {}) {
    super(24000, 1, { streaming: false });
    this.label = 'edge.TTS';
    this.voice = opts.voice || 'en-IN-NeerjaNeural';
    this.abortController = new AbortController();
    this.voice = opts.voice || 'en-IN-NeerjaNeural';
    this.abortController = new AbortController();
  }

  get model() {
    return 'edge-tts';
  }

  get provider() {
    return 'microsoft-edge';
  }

  synthesize(text, connOptions, abortSignal) {
    const signal = abortSignal
      ? AbortSignal.any([abortSignal, this.abortController.signal])
      : this.abortController.signal;
    return new EdgeChunkedStream(this, text, signal);
  }

  stream() {
    throw new Error('Streaming is not supported on Edge TTS');
  }

  async close() {
    this.abortController.abort();
  }
}

class EdgeChunkedStream extends tts.ChunkedStream {
  constructor(ttsInstance, text, abortSignal) {
    super(text, ttsInstance, undefined, abortSignal);
    this.label = 'edge.ChunkedStream';
    this.text = text;
    this.ttsInstance = ttsInstance;
  }

  async run() {
    const id = shortuuid();
    const tempMp3 = path.join(os.tmpdir(), `${id}.mp3`);
    const tempPcm = path.join(os.tmpdir(), `${id}.pcm`);
    
    try {
      // Create a fresh EdgeTTS instance for every synthesis to avoid WebSocket timeouts
      const freshEdge = new EdgeTTS({
        voice: this.ttsInstance.voice,
        lang: 'en-IN',
        outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
      });
      
      // synthesize speech as MP3 (supported by edge API)
      await freshEdge.ttsPromise(this.text, tempMp3);
      
      // Convert MP3 to PCM (s16le, 24kHz, 1 channel)
      await execFileAsync(ffmpeg, [
        '-i', tempMp3,
        '-f', 's16le',
        '-acodec', 'pcm_s16le',
        '-ar', '24000',
        '-ac', '1',
        '-y',
        tempPcm
      ]);

      const buffer = await fs.promises.readFile(tempPcm);
      
      const requestId = id;
      const audioByteStream = new AudioByteStream(24000, 1);
      const frames = audioByteStream.write(buffer);

      let lastFrame;
      const sendLastFrame = (segmentId, final) => {
        if (lastFrame) {
          this.queue.put({ requestId, segmentId, frame: lastFrame, final });
          lastFrame = undefined;
        }
      };

      for (const frame of frames) {
        sendLastFrame(requestId, false);
        lastFrame = frame;
      }
      sendLastFrame(requestId, true);
    } catch (error) {
      console.error('[edgeTtsPlugin] Synthesize Error:', error);
      if (error instanceof Error && error.name === 'AbortError') return;
      throw error;
    } finally {
      this.queue.close();
      fs.unlink(tempMp3, () => {});
      fs.unlink(tempPcm, () => {});
    }
  }
}

module.exports = { EdgeTTSPlugin, EdgeChunkedStream };
