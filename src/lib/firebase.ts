
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getDatabase, ref, set, onValue, off, update, get, child } from 'firebase/database';
import type { Participant } from '@/app/draw/[drawId]/draw-client'; // Adjust path as needed
import type { FairWinnerSelectionOutput } from '@/ai/flows/fair-winner-selection';

// --- Firebase Configuration ---
// These are your actual Firebase project credentials.
// For development in Firebase Studio, we are embedding them here.
// WARNING: This is NOT recommended for production. In a production environment,
// these should be configured as environment variables.
const firebaseConfig = {
  apiKey: "AIzaSyAhmcUAe0st2EsG3lh-ZSkj73pNyGAIAjQ",
  authDomain: "luckydraw-a795n.firebaseapp.com",
  databaseURL: "https://luckydraw-a795n.firebaseio.com", // Derived from projectId
  projectId: "luckydraw-a795n",
  storageBucket: "luckydraw-a795n.firebasestorage.app",
  messagingSenderId: "510173850315",
  appId: "1:510173850315:web:713dbfa96c2b8babbf494e",
  measurementId: "G-D4HE7JT9NE" // Optional
};

// Check if all essential config values are present in the hardcoded object
const essentialConfigKeys: (keyof typeof firebaseConfig)[] = [
  'apiKey',
  'authDomain',
  'databaseURL',
  'projectId',
  'storageBucket',
  'messagingSenderId',
  'appId'
];

let missingHardcodedValues: string[] = [];
essentialConfigKeys.forEach(key => {
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
  await set(drawRef, newDrawData);
};

export const getDrawData = (drawId: string, callback: (data: DrawData | null) => void) => {
  const drawRef = ref(database, `draws/${drawId}`);
  const listener = onValue(drawRef, (snapshot) => {
    callback(snapshot.exists() ? snapshot.val() as DrawData : null);
  });
  return () => off(drawRef, 'value', listener); // Return unsubscribe function
};

export const addParticipantToDb = async (drawId: string, participant: Participant): Promise<void> => {
  const participantsRef = ref(database, `draws/${drawId}/participants`);
  const snapshot = await get(participantsRef);
  const currentParticipants = snapshot.exists() ? snapshot.val() as Participant[] : [];
  const updatedParticipants = [...currentParticipants, participant];
  await set(participantsRef, updatedParticipants);
};

export const setDrawWinnerInDb = async (drawId: string, winner: FairWinnerSelectionOutput): Promise<void> => {
  const updates: { [key: string]: any } = {};
  updates[`draws/${drawId}/winner`] = winner;
  updates[`draws/${drawId}/status`] = 'closed';
  await update(ref(database), updates);
};

export const updateDrawStatusInDb = async (drawId: string, status: DrawData['status']): Promise<void> => {
  const statusRef = ref(database, `draws/${drawId}/status`);
  await set(statusRef, status);
};


export { database };
