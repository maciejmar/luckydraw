// FairWinnerSelection.ts
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
  winnerId: z.string().describe('The user ID of the selected winner.'),
  reason: z.string().describe('Explanation of why the winner was selected.'),
});

export type FairWinnerSelectionOutput = z.infer<typeof FairWinnerSelectionOutputSchema>;

export async function fairWinnerSelection(input: FairWinnerSelectionInput): Promise<FairWinnerSelectionOutput> {
  return fairWinnerSelectionFlow(input);
}

const fairWinnerSelectionPrompt = ai.definePrompt({
  name: 'fairWinnerSelectionPrompt',
  input: {schema: FairWinnerSelectionInputSchema},
  output: {schema: FairWinnerSelectionOutputSchema},
  prompt: `You are an AI assistant tasked with selecting a fair winner for a draw. Consider the participation time of each user to ensure fairness. Use advanced algorithms to pick a winner.

Here are the participants:
{{#each participants}}
- User ID: {{this.userId}}, Join Time: {{this.joinTime}}
{{/each}}

Optional Description: {{description}}

Based on the participant list, select a winner and provide a reason for your selection.
Ensure the winner is selected fairly, considering their participation time.

Winner ID:`, // The AI should provide the winner ID based on the input.
});

const fairWinnerSelectionFlow = ai.defineFlow(
  {
    name: 'fairWinnerSelectionFlow',
    inputSchema: FairWinnerSelectionInputSchema,
    outputSchema: FairWinnerSelectionOutputSchema,
  },
  async input => {
    const {output} = await fairWinnerSelectionPrompt(input);
    return output!;
  }
);
