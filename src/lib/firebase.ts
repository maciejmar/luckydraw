
'use server';

// This file now simulates a database using in-memory storage.

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
let listenersStore: { [drawId: string]: Array<(data: DrawData | null) => void> } = {};

// Helper to notify listeners
const notifyListeners = (drawId: string) => {
  const listeners = listenersStore[drawId] || [];
  const data = drawsStore[drawId] || null;
  listeners.forEach(listener => {
    try {
      listener(data);
    } catch (e) {
      console.error("Error in listener for drawId", drawId, e);
    }
  });
};

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
  notifyListeners(drawId);
};

export const getDrawData = async (drawId: string, callback: (data: DrawData | null) => void): Promise<() => void> => {
  console.log(`[InMemoryStore] Setting up listener for draw: ${drawId}`);
  if (!listenersStore[drawId]) {
    listenersStore[drawId] = [];
  }
  listenersStore[drawId].push(callback);

  // Call immediately with current data
  try {
    callback(drawsStore[drawId] || null);
  } catch (e) {
    console.error("Error in initial callback for drawId", drawId, e);
  }

  // Return an unsubscribe function
  return () => {
    console.log(`[InMemoryStore] Tearing down listener for draw: ${drawId}`);
    listenersStore[drawId] = (listenersStore[drawId] || []).filter(cb => cb !== callback);
    if (listenersStore[drawId] && listenersStore[drawId].length === 0) {
      delete listenersStore[drawId];
    }
  };
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
  draw.participants.push(participant);
  drawsStore[drawId] = { ...draw }; 
  console.log(`[InMemoryStore] Participant added. Current participants for ${drawId}:`, draw.participants);
  notifyListeners(drawId);
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
  notifyListeners(drawId);
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
  notifyListeners(drawId);
};

// Function to clear the store, useful for testing or resetting state in dev
export const _clearDrawsStore = async (): Promise<void> => {
  drawsStore = {};
  listenersStore = {};
  console.log("[InMemoryStore] Store cleared.");
};
