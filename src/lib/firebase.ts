
'use server';

// This file now simulates a database using in-memory storage with polling.

import type { FairWinnerSelectionOutput } from '@/ai/flows/fair-winner-selection';

// --- Type Definitions ---
export interface Participant {
  userId: string;
  name: string;
  joinTime: string; // ISO string
  color: string;
}

export interface DrawData {
  drawId: string;
  description: string;
  participants: Participant[];
  winner: FairWinnerSelectionOutput | null;
  createdAt: string; // ISO string
  status: 'open' | 'selecting' | 'closed';
}

// --- In-Memory Store ---
let drawsStore: { [drawId: string]: DrawData } = {};

// --- Draw Management Functions (In-Memory Version) ---

export const createDrawInDb = async (drawId: string, description: string): Promise<void> => {
  console.log(`[InMemoryStore] Attempting to create draw: ${drawId}`);
  if (drawsStore[drawId]) {
    console.warn(`[InMemoryStore] Draw with ID "${drawId}" already exists. Overwriting.`);
  }
  const newDrawData: DrawData = {
    drawId,
    description,
    participants: [],
    winner: null,
    createdAt: new Date().toISOString(),
    status: 'open',
  };
  drawsStore[drawId] = newDrawData;
  console.log(`[InMemoryStore] Successfully created draw: ${drawId}`, newDrawData);
};

export const getDrawSnapshot = async (drawId: string): Promise<DrawData | null> => {
  console.log(`[InMemoryStore] Fetching snapshot for draw: ${drawId}`);
  return drawsStore[drawId] || null;
};

export const addParticipantToDb = async (drawId: string, participant: Participant): Promise<void> => {
  console.log(`[InMemoryStore] Adding participant to draw: ${drawId}`, participant);
  const draw = drawsStore[drawId];
  if (!draw) {
    throw new Error(`Draw with ID "${drawId}" not found.`);
  }
  if (draw.status !== 'open') {
    throw new Error('This draw is not open for new participants.');
  }
  draw.participants = draw.participants || [];
  // Ensure participant with the same name doesn't already exist (case-insensitive)
  const existingParticipant = draw.participants.find(p => p.name.toLowerCase() === participant.name.toLowerCase());
  if (existingParticipant) {
    // This case should ideally be caught client-side, but as a safeguard:
    console.warn(`[InMemoryStore] Participant with name "${participant.name}" already exists in draw ${drawId}. Not adding again.`);
    // Optionally throw an error or return a status
    // throw new Error(`Participant with name "${participant.name}" already exists.`);
    return; 
  }
  draw.participants.push(participant);
  drawsStore[drawId] = { ...draw }; // Ensure change is reflected if draw was a copy
  console.log(`[InMemoryStore] Participant added. Current participants for ${drawId}:`, draw.participants);
};

export const setDrawWinnerInDb = async (drawId: string, winner: FairWinnerSelectionOutput): Promise<void> => {
  console.log(`[InMemoryStore] Setting winner for draw: ${drawId}`, winner);
  const draw = drawsStore[drawId];
  if (!draw) {
    throw new Error(`Draw with ID "${drawId}" not found.`);
  }
  draw.winner = winner;
  draw.status = 'closed';
  drawsStore[drawId] = { ...draw };
  console.log(`[InMemoryStore] Winner set for ${drawId}:`, draw.winner);
};

export const updateDrawStatusInDb = async (drawId: string, status: DrawData['status']): Promise<void> => {
  console.log(`[InMemoryStore] Updating status for draw: ${drawId} to ${status}`);
  const draw = drawsStore[drawId];
  if (!draw) {
    throw new Error(`Draw with ID "${drawId}" not found.`);
  }
  draw.status = status;
  drawsStore[drawId] = { ...draw };
  console.log(`[InMemoryStore] Status updated for ${drawId}.`);
};

// Function to clear the store, useful for testing or resetting state in dev
export async function _clearDrawsStore(): Promise<void> {
  drawsStore = {};
  console.log("[InMemoryStore] Store cleared.");
};
