
import { config } from 'dotenv';
config(); // Call dotenv.config() here to load .env variables

import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// Attempt to read the API key from environment variables
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

if (!apiKey) {
  // This console log will be visible in the server logs if the key is missing.
  // The error will still occur during AI calls, but this helps confirm the key isn't found at initialization.
  console.warn(
    'GEMINI_API_KEY or GOOGLE_API_KEY environment variable not found. ' +
    'AI functionality will likely fail. Please ensure it is set in your environment.'
  );
}

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: apiKey, // Pass the API key here. If undefined, the plugin might still throw, but we've tried.
    }),
  ],
  model: 'googleai/gemini-2.0-flash', // This is a default model, specific flows might override
});

