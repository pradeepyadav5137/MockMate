const { EdgeTTSPlugin, EdgeChunkedStream } = require('./edgeTtsPlugin');
const { AudioByteStream, initializeLogger } = require('@livekit/agents');
initializeLogger({ pretty: true });
const tts = new EdgeTTSPlugin();

async function run() {
  console.log("Testing EdgeTTSPlugin with ffmpeg decode...");
  const stream = tts.synthesize("Hello! This is a test of the Edge TTS decoder.", {}, new AbortController().signal);
  let frames = 0;
  for await (const chunk of stream) {
    frames++;
    if (frames === 1) console.log("Received first frame!", chunk.frame);
  }
  console.log(`Success! Received ${frames} total audio frames.`);
}

run().catch(console.error);
