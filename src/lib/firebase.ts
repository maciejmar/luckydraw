
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getDatabase, ref, set, onValue, off, update, get } from 'firebase/database';
import type { Participant } from '@/app/draw/[drawId]/draw-client';
import type { FairWinnerSelectionOutput } from '@/ai/flows/fair-winner-selection';

// --- Firebase Configuration ---
// These are your actual Firebase project credentials, directly embedded.
// WARNING: This is NOT recommended for production. In a production environment,
// these should be configured as environment variables.
const firebaseConfig = {
  apiKey: "AIzaSyAhmcUAe0st2EsG3lh-ZSkj73pNyGAIAjQ",
  authDomain: "luckydraw-a795n.firebaseapp.com",
  databaseURL: "https://luckydraw-a795n.firebaseio.com",
  projectId: "luckydraw-a795n",
  storageBucket: "luckydraw-a795n.firebasestorage.app",
  messagingSenderId: "510173850315",
  appId: "1:510173850315:web:713dbfa96c2b8babbf494e",
  measurementId: "G-D4HE7JT9NE"
};

// Simple sanity check for hardcoded values
const essentialHardcodedKeys: (keyof typeof firebaseConfig)[] = [
  'apiKey', 'authDomain', 'databaseURL', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'
];
let missingHardcodedValues: string[] = [];
essentialHardcodedKeys.forEach(key => {
  if (!firebaseConfig[key]) {
    missingHardcodedValues.push(key);
  }
});

if (missingHardcodedValues.length > 0) {
  const errorMessage = `
    ------------------------------------------------------------------------------------
    INTERNAL FIREBASE CONFIGURATION ERROR in src/lib/firebase.ts:
    ------------------------------------------------------------------------------------
    Some essential Firebase configuration values are missing or empty IN THE HARDCODED firebaseConfig object.
    This likely means there was an error transcribing them from your Firebase project settings.

    Missing or empty hardcoded values for:
    ${missingHardcodedValues.map(v => `  - ${v}`).join('\n    ')}

    Please double-check the firebaseConfig object in src/lib/firebase.ts against your
    Firebase project settings in the Firebase Console.
    ------------------------------------------------------------------------------------
  `;
  throw new Error(errorMessage);
}

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const database = getDatabase(app);

export interface DrawData {
  drawId: string;
  description: string;
  participants: Participant[];
  winner: FairWinnerSelectionOutput | null;
  createdAt: string; // ISO string
  status: 'open' | 'selecting' | 'closed';
}

// --- Draw Management Functions ---

export const createDrawInDb = async (drawId: string, description: string): Promise<void> => {
  const drawRef = ref(database, `draws/${drawId}`);
  const newDrawData: DrawData = {
    drawId,
    description,
    participants: [],
    winner: null,
    createdAt: new Date().toISOString(),
    status: 'open',
  };

  const WRITE_TIMEOUT_MS = 15000; // 15 seconds
  
  const writePromise = set(drawRef, newDrawData);
  
  const timeoutPromise = new Promise<void>((_, reject) => 
    setTimeout(() => reject(new Error(`Firebase write operation timed out after ${WRITE_TIMEOUT_MS / 1000} seconds.`)), WRITE_TIMEOUT_MS)
  );

  try {
    console.log(`[Firebase] Attempting to create draw in DB: draws/${drawId} with data:`, JSON.stringify(newDrawData));
    await Promise.race([writePromise, timeoutPromise]);
    console.log(`[Firebase] Successfully created draw in DB: draws/${drawId}`);
  } catch (error) {
    console.error(`[Firebase] Failed to create draw in DB (draws/${drawId}):`, error);
    if (error instanceof Error) {
        // Append more context to the error message
        throw new Error(`Error creating draw '${drawId}' in Firebase: ${error.message}`);
    }
    throw new Error(`An unknown error occurred while creating the draw '${drawId}' in Firebase.`);
  }
};

export const getDrawData = (drawId: string, callback: (data: DrawData | null) => void) => {
  const drawRef = ref(database, `draws/${drawId}`);
  console.log(`[Firebase] Setting up listener for draw data: draws/${drawId}`);
  const listener = onValue(drawRef, (snapshot) => {
    const data = snapshot.exists() ? snapshot.val() as DrawData : null;
    console.log(`[Firebase] Received data for draws/${drawId}:`, data ? JSON.stringify(data).substring(0,100) + "..." : null);
    callback(data);
  }, (error) => {
    console.error(`[Firebase] Error listening to draws/${drawId}:`, error);
    callback(null); // Notify callback of error by passing null
  });
  return () => {
    console.log(`[Firebase] Unsubscribing listener for draw data: draws/${drawId}`);
    off(drawRef, 'value', listener);
  };
};

export const addParticipantToDb = async (drawId: string, participant: Participant): Promise<void> => {
  const participantsRef = ref(database, `draws/${drawId}/participants`);
  console.log(`[Firebase] Attempting to add participant to draws/${drawId}:`, JSON.stringify(participant));
  try {
    const snapshot = await get(participantsRef);
    const currentParticipants = snapshot.exists() ? snapshot.val() as Participant[] : [];
    const updatedParticipants = [...currentParticipants, participant];
    await set(participantsRef, updatedParticipants);
    console.log(`[Firebase] Successfully added participant to draws/${drawId}`);
  } catch (error) {
    console.error(`[Firebase] Failed to add participant to draws/${drawId}:`, error);
    if (error instanceof Error) {
      throw new Error(`Error adding participant to draw '${drawId}': ${error.message}`);
    }
    throw new Error(`An unknown error occurred while adding participant to draw '${drawId}'.`);
  }
};

export const setDrawWinnerInDb = async (drawId: string, winner: FairWinnerSelectionOutput): Promise<void> => {
  const updates: { [key: string]: any } = {};
  updates[`draws/${drawId}/winner`] = winner;
  updates[`draws/${drawId}/status`] = 'closed';
  console.log(`[Firebase] Attempting to set winner for draws/${drawId}:`, JSON.stringify(winner));
  try {
    await update(ref(database), updates);
    console.log(`[Firebase] Successfully set winner for draws/${drawId}`);
  } catch (error) {
    console.error(`[Firebase] Failed to set winner for draws/${drawId}:`, error);
     if (error instanceof Error) {
      throw new Error(`Error setting winner for draw '${drawId}': ${error.message}`);
    }
    throw new Error(`An unknown error occurred while setting winner for draw '${drawId}'.`);
  }
};

export const updateDrawStatusInDb = async (drawId: string, status: DrawData['status']): Promise<void> => {
  const statusRef = ref(database, `draws/${drawId}/status`);
  console.log(`[Firebase] Attempting to update status for draws/${drawId} to: ${status}`);
  try {
    await set(statusRef, status);
    console.log(`[Firebase] Successfully updated status for draws/${drawId} to: ${status}`);
  } catch (error) {
    console.error(`[Firebase] Failed to update status for draws/${drawId}:`, error);
    if (error instanceof Error) {
      throw new Error(`Error updating status for draw '${drawId}': ${error.message}`);
    }
    throw new Error(`An unknown error occurred while updating status for draw '${drawId}'.`);
  }
};

export { database };
