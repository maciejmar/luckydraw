
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getDatabase, ref, set, onValue, off, update, get } from 'firebase/database';
import type { Participant } from '@/app/draw/[drawId]/draw-client';
import type { FairWinnerSelectionOutput } from '@/ai/flows/fair-winner-selection';

// --- Firebase Configuration ---
// Hardcoded Firebase configuration values
const firebaseConfig = {
  apiKey: "AIzaSyAhmcUAe0st2EsG3lh-ZSkj73pNyGAIAjQ",
  authDomain: "luckydraw-a795n.firebaseapp.com",
  databaseURL: "https://luckydraw-a795n.firebaseio.com",
  projectId: "luckydraw-a795n",
  storageBucket: "luckydraw-a795n.firebasestorage.app",
  messagingSenderId: "510173850315",
  appId: "1:510173850315:web:713dbfa96c2b8babbf494e",
  measurementId: "G-D4HE7JT9NE", // Optional
};

// Basic check for essential hardcoded Firebase configuration values
const essentialConfigKeys: (keyof typeof firebaseConfig)[] = [
  'apiKey', 'authDomain', 'databaseURL', 'projectId',
];
let hardcodedConfigIsValid = true;
const missingHardcodedKeys: string[] = [];

essentialConfigKeys.forEach(key => {
  if (!firebaseConfig[key]) {
    missingHardcodedKeys.push(key);
    hardcodedConfigIsValid = false;
  }
});

if (!hardcodedConfigIsValid) {
  const errorMessage = `
    ------------------------------------------------------------------------------------
    CRITICAL FIREBASE CONFIGURATION ERROR IN THE SOURCE CODE:
    ------------------------------------------------------------------------------------
    The hardcoded Firebase SDK configuration in src/lib/firebase.ts is missing essential values.

    Missing key(s) in the firebaseConfig object:
${missingHardcodedKeys.map(v => `      - ${v}`).join('\n')}

    Current hardcoded Firebase configuration:
    ${JSON.stringify(firebaseConfig, null, 2)}

    ------------------------------------------------------------------------------------
    TO FIX THIS (these steps are performed by the AI developer):
    ------------------------------------------------------------------------------------
    1.  Ensure the Firebase credentials provided by the user are correct.
    2.  Update the 'firebaseConfig' object in 'src/lib/firebase.ts' with all required values.
    ------------------------------------------------------------------------------------
  `;
  console.error(errorMessage);
  if (typeof window === 'undefined') { 
    throw new Error(errorMessage);
  } else {
    console.error("Firebase cannot be initialized due to missing hardcoded config. App functionality will be affected.");
  }
}

// Initialize Firebase
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}
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
  try {
    await set(drawRef, newDrawData);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Error creating draw '${drawId}' in Firebase: ${error.message}`);
    }
    throw new Error(`An unknown error occurred while creating the draw '${drawId}' in Firebase.`);
  }
};

export const getDrawData = (drawId: string, callback: (data: DrawData | null) => void) => {
  const drawRef = ref(database, `draws/${drawId}`);
  const listener = onValue(drawRef, (snapshot) => {
    const data = snapshot.exists() ? snapshot.val() as DrawData : null;
    callback(data);
  }, (error) => {
    console.error(`[Firebase] Error listening to draws/${drawId}:`, error);
    callback(null);
  });
  return () => {
    off(drawRef, 'value', listener);
  };
};

export const addParticipantToDb = async (drawId: string, participant: Participant): Promise<void> => {
  const participantsRef = ref(database, `draws/${drawId}/participants`);
  try {
    const snapshot = await get(participantsRef);
    const currentParticipants = snapshot.exists() ? snapshot.val() as Participant[] : [];
    const updatedParticipants = [...currentParticipants, participant];
    await set(participantsRef, updatedParticipants);
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
  try {
    await update(ref(database), updates);
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
  try {
    await set(statusRef, status);
  } catch (error) {
    console.error(`[Firebase] Failed to update status for draws/${drawId}:`, error);
    if (error instanceof Error) {
      throw new Error(`Error updating status for draw '${drawId}': ${error.message}`);
    }
    throw new Error(`An unknown error occurred while updating status for draw '${drawId}'.`);
  }
};

export { database };

    