const { OpenAI } = require('openai');
const fs = require('fs');
require('dotenv').config();

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1'
});

async function main() {
  console.log("Key length:", process.env.GROQ_API_KEY?.length);
  try {
    // we don't have an audio file, just check if the client can be instantiated
    console.log("Client created successfully");
  } catch(e) {
    console.log("Error:", e);
  }
}
main();
