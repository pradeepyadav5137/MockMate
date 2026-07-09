const { EdgeTTS } = require('node-edge-tts');
const fs = require('fs');

async function test() {
  const edge = new EdgeTTS({
    voice: 'en-IN-NeerjaNeural',
    lang: 'en-IN',
    outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
  });
  console.log("Starting synthesis...");
  try {
    await edge.ttsPromise("Hello, testing mp3 format.", "test.mp3");
    console.log("Success! File size:", fs.statSync("test.mp3").size);
  } catch (e) {
    console.error("Failed:", e);
  }
}
test();
