
'use server';

/**
 * @fileOverview An AI agent that selects a winner for a draw based on fairness and participation time.
 *
 * - fairWinnerSelection - A function that initiates the winner selection process.
 * - FairWinnerSelectionInput - The input type for the fairWinnerSelection function.
 * - FairWinnerSelectionOutput - The return type for the fairWinnerSelection function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const FairWinnerSelectionInputSchema = z.object({
  participants: z
    .array(
      z.object({
        userId: z.string().describe('Unique identifier for the user.'),
        joinTime: z.string().datetime({ message: "Join time must be a valid ISO 8601 date string" }).describe('The time the user joined the draw, as an ISO 8601 string.'),
      })
    )
    .describe('List of participants in the draw, with their user IDs and join times.'),
  description: z
    .string()
    .optional()
    .describe('Optional description of the draw for context.'),
});

export type FairWinnerSelectionInput = z.infer<typeof FairWinnerSelectionInputSchema>;

const FairWinnerSelectionOutputSchema = z.object({
  winnerId: z.string().describe('The user ID of the selected winner. This ID must be one of the user IDs from the input participants list.'),
  reason: z.string().describe('Explanation of why the winner was selected. This can be creative and use participation time or draw description for inspiration.'),
});

export type FairWinnerSelectionOutput = z.infer<typeof FairWinnerSelectionOutputSchema>;

export async function fairWinnerSelection(input: FairWinnerSelectionInput): Promise<FairWinnerSelectionOutput> {
  console.log('[FairWinnerSelection Flow Entry] Called with input:', JSON.stringify(input));
  
  const resolvedApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  console.log('[FairWinnerSelection Flow Entry] Checking resolved API Key:', resolvedApiKey ? 'Found' : 'NOT Found');

  if (!resolvedApiKey) {
    console.error('[FairWinnerSelection Flow Entry] CRITICAL: API Key is missing. Throwing specific error.');
    throw new Error('AI Service Configuration Error: API Key is missing. Please check server environment variables or .env file.');
  }
  
  return fairWinnerSelectionFlow(input);
}

const fairWinnerSelectionPrompt = ai.definePrompt({
  name: 'fairWinnerSelectionPrompt',
  input: {schema: FairWinnerSelectionInputSchema},
  output: {schema: FairWinnerSelectionOutputSchema},
  prompt: `You are an AI assistant for "LuckyDraw", a system designed to pick a random winner from a list of participants. Your primary goal is to ensure the selection is truly random and unbiased from the provided list.

While you should be aware of when each participant joined (their joinTime), this information is primarily for you to craft a fun and engaging "reason" for why this particular participant was chosen. The winner themselves MUST be chosen randomly from the list of participants. Do not simply pick the first participant in the list unless it is a genuinely random choice.

Here are the participants:
{{#each participants}}
- User ID: {{this.userId}}, Join Time: {{this.joinTime}}
{{/each}}

Optional Description of the Draw: {{description}}

Instructions:
1. From the list of participants provided above, RANDOMLY select ONE (and only one) winner. Ensure your selection process is unbiased.
2. Output the 'winnerId' of the randomly selected participant. This 'winnerId' MUST exactly match one of the 'userId's from the input list.
3. Craft a creative and engaging 'reason' for why this participant was chosen. You can use their join time or the draw description as inspiration for the reason, but remember the selection itself must be random.

Please provide your response in the structured format defined by the output schema.
`,
});

const fairWinnerSelectionFlow = ai.defineFlow(
  {
    name: 'fairWinnerSelectionFlow',
    inputSchema: FairWinnerSelectionInputSchema,
    outputSchema: FairWinnerSelectionOutputSchema,
  },
  async input => {
    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 2000; // 2 seconds

    if (!input.participants || input.participants.length === 0) {
      console.error('[FairWinnerSelection Flow] No participants provided.');
      throw new Error('No participants provided for the draw.');
    }
    console.log(`[FairWinnerSelection Flow] Starting selection for ${input.participants.length} participants.`);

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`[FairWinnerSelection Flow] Attempt ${attempt} to call prompt.`);
        const {output} = await fairWinnerSelectionPrompt(input);
        
        if (!output) {
          console.error('[FairWinnerSelection Flow] AI did not return an output.');
          throw new Error('AI did not return an output.');
        }
        console.log('[FairWinnerSelection Flow] AI returned output:', JSON.stringify(output));

        // Validate that the winnerId is one of the participants
        const participantIds = input.participants.map(p => p.userId);
        if (!participantIds.includes(output.winnerId)) {
          console.error(`[FairWinnerSelection Flow] AI returned an invalid winnerId: ${output.winnerId}. Valid IDs: ${participantIds.join(', ')}`);
          throw new Error(`AI returned a winnerId ('${output.winnerId}') that is not in the participant list.`);
        }
        console.log(`[FairWinnerSelection Flow] Successfully selected winner: ${output.winnerId} on attempt ${attempt}.`);
        return output;
      } catch (error: any) {
        const errorMessage = error.message || String(error) || 'Unknown error during AI call';
        console.error(`[FairWinnerSelection Flow] Attempt ${attempt} FAILED. Error:`, errorMessage, error.stack);

        const isOverloadError = errorMessage.includes('503 Service Unavailable') || errorMessage.includes('model is overloaded') || errorMessage.includes('The model is overloaded') || errorMessage.includes('RESOURCE_EXHAUSTED');
        // More specific API key error checks based on common error messages
        const isApiKeyError = errorMessage.includes('API key not valid') || 
                              errorMessage.includes('API_KEY_INVALID') || 
                              errorMessage.includes('PERMISSION_DENIED') || // Often key-related
                              errorMessage.includes('AUTH_ERROR') || // Generic auth
                              errorMessage.includes('Failed to authenticate') ||
                              errorMessage.includes('Invalid API key') ||
                              errorMessage.includes('API key is missing') || // Our specific error from the check above
                              errorMessage.includes('FAILED_PRECONDITION'); // Original error seen

        if (isApiKeyError) {
            console.error('[FairWinnerSelection Flow] API Key related error detected. Aborting retries.');
            // Provide a more user-friendly message for API key issues
            throw new Error('There seems to be an issue with the AI service API key configuration. Please verify the key and ensure it has the necessary permissions.');
        }

        if (!isOverloadError || attempt === MAX_RETRIES) {
          console.error(`[FairWinnerSelection Flow] Failed after ${attempt} attempts. Re-throwing. Error:`, errorMessage);
          throw new Error(isOverloadError ? 'The AI service is currently busy. Please try again in a few moments.' : `An unexpected error occurred while selecting the winner: ${errorMessage}`);
        }
        
        console.warn(`[FairWinnerSelection Flow] Attempt ${attempt} failed (possibly overload). Retrying in ${RETRY_DELAY_MS / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
    // This line should ideally not be reached if MAX_RETRIES > 0,
    // as the loop will either return a result or throw an error.
    // But as a fallback:
    console.error('[FairWinnerSelection Flow] Failed to select winner after multiple retries due to AI service issues.');
    throw new Error('Failed to select winner after multiple retries due to AI service issues.');
  }
);

