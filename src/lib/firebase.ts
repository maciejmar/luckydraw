
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getDatabase, ref, set, onValue, off, update, get, child } from 'firebase/database';
import type { Participant } from '@/app/draw/[drawId]/draw-client'; // Adjust path as needed
import type { FairWinnerSelectionOutput } from '@/ai/flows/fair-winner-selection';

const requiredEnvVars: { name: string; value?: string }[] = [
  { name: 'NEXT_PUBLIC_FIREBASE_API_KEY', value: process.env.NEXT_PUBLIC_FIREBASE_API_KEY },
  { name: 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', value: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN },
  { name: 'NEXT_PUBLIC_FIREBASE_DATABASE_URL', value: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL },
  { name: 'NEXT_PUBLIC_FIREBASE_PROJECT_ID', value: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID },
  { name: 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET', value: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET },
  { name: 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', value: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID },
  { name: 'NEXT_PUBLIC_FIREBASE_APP_ID', value: process.env.NEXT_PUBLIC_FIREBASE_APP_ID },
];

const placeholderPattern = /MUST_REPLACE_WITH_YOUR_|YOUR_ACTUAL_|<YOUR_PROJECT_ID>/i;
let problematicVars: string[] = [];

requiredEnvVars.forEach((envVar) => {
  if (!envVar.value || envVar.value.trim() === '' || placeholderPattern.test(envVar.value)) {
    problematicVars.push(`${envVar.name} (current value: "${envVar.value || 'Not set/Empty'}")`);
  }
});

if (problematicVars.length > 0) {
  const fullConfigAttempt = JSON.stringify(
    Object.fromEntries(requiredEnvVars.map(v => [v.name.replace('NEXT_PUBLIC_FIREBASE_', '').toLowerCase(), v.value])),
    null,
    2
  );

  const errorMessage = `
    ------------------------------------------------------------------------------------
    CRITICAL FIREBASE CONFIGURATION ERROR IN YOUR LOCAL ENVIRONMENT:
    ------------------------------------------------------------------------------------
    The Firebase SDK cannot initialize because essential configuration is missing or incorrect.
    
    Problematic environment variable(s):
    ${problematicVars.map(v => `  - ${v}`).join('\n    ')}

    Current Firebase configuration values being read from your environment:
    ${fullConfigAttempt}

    ------------------------------------------------------------------------------------
    TO FIX THIS (these steps are performed on YOUR local machine):
    ------------------------------------------------------------------------------------
    1.  OBTAIN YOUR CREDENTIALS: Go to your Firebase project in the Firebase Console
        (https://console.firebase.google.com/). Navigate to Project Settings (gear icon)
        -> General tab -> Your apps -> select your web app -> SDK setup and configuration (choose Config).
        Copy all the values (apiKey, authDomain, databaseURL, projectId, etc.).

    2.  EDIT YOUR LOCAL ENVIRONMENT FILE:
        *   In the ROOT of your project directory on your computer, find or create a file named '.env.local'.
            (This file is for local overrides and is prioritized by Next.js over '.env').
        *   If '.env.local' does not exist, you can edit the '.env' file directly.

    3.  UPDATE THE VARIABLES: In your chosen '.env.local' (or '.env') file, ensure ALL the
        following variables are correctly set with your actual Firebase project values
        (replace the "YOUR_ACTUAL_..." parts):

        NEXT_PUBLIC_FIREBASE_API_KEY="YOUR_ACTUAL_API_KEY"
        NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="YOUR_ACTUAL_AUTH_DOMAIN"
        NEXT_PUBLIC_FIREBASE_DATABASE_URL="YOUR_ACTUAL_DATABASE_URL" 
        # (e.g., "https://your-project-name.firebaseio.com" or "https://your-project-name.region.firebasedatabase.app")
        NEXT_PUBLIC_FIREBASE_PROJECT_ID="YOUR_ACTUAL_PROJECT_ID"
        NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="YOUR_ACTUAL_STORAGE_BUCKET"
        NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="YOUR_ACTUAL_MESSAGING_SENDER_ID"
        NEXT_PUBLIC_FIREBASE_APP_ID="YOUR_ACTUAL_APP_ID"

    4.  SAVE THE FILE.

    5.  RESTART YOUR NEXT.JS SERVER: This is crucial. Stop your development server (Ctrl+C
        in the terminal) and restart it (e.g., 'npm run dev'). Next.js only loads
        environment variables on startup.

    ------------------------------------------------------------------------------------
    The application cannot function until these Firebase credentials are correctly configured
    in your local development environment.
    ------------------------------------------------------------------------------------
  `;
  // This error will halt execution and be shown prominently in your server console.
  throw new Error(errorMessage);
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

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
