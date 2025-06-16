
'use server';

import type { FairWinnerSelectionOutput } from '@/ai/flows/fair-winner-selection';
import { db } from './firebase-init'; // Assuming you have firebase-init.ts for initialization
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

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
  status: 'open' | 'selecting' | 'closed'; // Added 'selecting' and 'closed' as possible statuses
}

// --- Firestore Collection Reference ---
const drawsCollection = 'draws';

// --- Draw Management Functions (Firestore Version) ---

export const createDrawInDb = async (drawId: string, description: string): Promise<void> => {
  console.log(`[Firestore] Attempting to create draw: ${drawId} with description: \"${description}\"`);
  const drawRef = doc(db, drawsCollection, drawId);
  const newDrawData: DrawData = {
    drawId,
    description,
    participants: [],
    winner: null,
    createdAt: new Date().toISOString(),
    status: 'open',
  };
  try {
    await setDoc(drawRef, newDrawData);
    console.log(`[Firestore] Successfully created draw: ${drawId}`);
  } catch (error) {
    console.error(`[Firestore] Error creating draw ${drawId}:`, error);
    throw error; // Re-throw the error to be caught by the caller
  }
};

export const getDrawSnapshot = async (drawId: string): Promise<DrawData | null> => {
  console.log(`[Firestore] Fetching snapshot for draw: ${drawId}`);
  const drawRef = doc(db, drawsCollection, drawId);
  try {
    const docSnap = await getDoc(drawRef);
    if (docSnap.exists()) {
      const drawData = docSnap.data() as DrawData;
      console.log(`[Firestore] Successfully fetched draw: ${drawId}`);
      return drawData;
    } else {
      console.warn(`[Firestore] Draw ${drawId} NOT FOUND.`);
      return null;
    }
  } catch (error) {
    console.error(`[Firestore] Error fetching draw ${drawId}:`, error);
    throw error; // Re-throw the error
  }
};

export const addParticipantToDb = async (drawId: string, participant: Participant): Promise<void> => {
  console.log(`[Firestore] Adding participant to draw: ${drawId}`, participant);
  const drawRef = doc(db, drawsCollection, drawId);
  try {
    const docSnap = await getDoc(drawRef);
    if (!docSnap.exists()) {
      throw new Error(`Draw with ID \"${drawId}\" not found.`);
    }
    const drawData = docSnap.data() as DrawData;

    if (drawData.status !== 'open') {
      throw new Error('This draw is not open for new participants.');
    }

    const existingParticipant = drawData.participants.find(p => p.name.toLowerCase() === participant.name.toLowerCase());
    if (existingParticipant) {
      console.warn(`[Firestore] Participant with name \"${participant.name}\" already exists in draw ${drawId}. Not adding again.`);
      return;
    }

    const updatedParticipants = [...drawData.participants, participant];
    await updateDoc(drawRef, { participants: updatedParticipants });
    console.log(`[Firestore] Participant added to ${drawId}. Current participants:`, updatedParticipants.length);
  } catch (error) {
    console.error(`[Firestore] Error adding participant to draw ${drawId}:`, error);
    throw error;
  }
};

export const setDrawWinnerInDb = async (drawId: string, winner: FairWinnerSelectionOutput): Promise<void> => {
  console.log(`[Firestore] Setting winner for draw: ${drawId}`, winner);
  const drawRef = doc(db, drawsCollection, drawId);
  try {
    const docSnap = await getDoc(drawRef);
    if (!docSnap.exists()) {
      throw new Error(`Draw with ID \"${drawId}\" not found.`);
    }
    // Optional: Add a check here if status is not 'selecting' to prevent setting winner multiple times

    await updateDoc(drawRef, { winner: winner, status: 'closed' });
    console.log(`[Firestore] Winner set for ${drawId}.`);
  } catch (error) {
    console.error(`[Firestore] Error setting winner for draw ${drawId}:`, error);
    throw error;
  }
};

export const updateDrawStatusInDb = async (drawId: string, status: DrawData['status']): Promise<void> => {
  console.log(`[Firestore] Updating status for draw: ${drawId} to ${status}`);
  const drawRef = doc(db, drawsCollection, drawId);
  try {
    const docSnap = await getDoc(drawRef);
    if (!docSnap.exists()) {
      throw new Error(`Draw with ID \"${drawId}\" not found.`);
    }
    await updateDoc(drawRef, { status: status });
    console.log(`[Firestore] Status updated for ${drawId}.`);
  } catch (error) {
    console.error(`[Firestore] Error updating status for draw ${drawId}:`, error);
    throw error;
  }
};
