
import { config } from 'dotenv';
config(); // Call dotenv.config() here to load .env variables

import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// Attempt to read the API key from environment variables
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

// Log the API key for debugging
console.log('[Genkit] Attempting to use API Key from process.env:', apiKey ? 'Key found (masked for safety in this log)' : 'Key NOT found in process.env');
if (apiKey) {
  // To actually see the key for debugging, uncomment the next line.
  // Be sure to remove or re-comment it after debugging.
  // console.log('[Genkit] Actual API Key value for debugging:', apiKey);
}


if (!apiKey) {
  // This console log will be visible in the server logs if the key is missing.
  console.warn(
    '[Genkit] GEMINI_API_KEY or GOOGLE_API_KEY environment variable not found at Genkit initialization. ' +
    'The googleAI plugin will attempt to find it. If it fails, AI functionality will likely fail. Please ensure it is set in your environment.'
  );
}

// Conditionally configure the googleAI plugin
console.log('[Genkit] Attempting to create googleAIPlugin instance...');
let googleAIPlugin;
try {
  googleAIPlugin = apiKey ? googleAI({ apiKey }) : googleAI();
  console.log('[Genkit] Successfully created googleAIPlugin instance.');
} catch (pluginError) {
  console.error('[Genkit] CRITICAL ERROR: Failed to initialize googleAI plugin:', pluginError);
  // If the plugin fails to initialize, we should not proceed with configuring genkit with a broken plugin.
  // This will likely cause genkit() to fail or subsequent AI calls to fail.
  // For now, we'll let it proceed so genkit() might throw its own error, or flows will fail.
  // A more robust solution might involve a fallback or preventing app startup.
  googleAIPlugin = googleAI(); // Fallback to default initialization, which will also likely fail if key is bad.
}


export const ai = genkit({
  plugins: [
    googleAIPlugin,
  ],
  model: 'googleai/gemini-2.0-flash', // This is a default model, specific flows might override
});

