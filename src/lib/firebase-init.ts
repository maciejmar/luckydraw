// src/lib/firebase-init.ts
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  

  apiKey: "AIzaSyAhmcUAe0st2EsG3lh-ZSkj73pNyGAIAjQ",
  authDomain: "luckydraw-a795n.firebaseapp.com",
  projectId: "luckydraw-a795n",
  storageBucket: "luckydraw-a795n.firebasestorage.app",
  messagingSenderId: "510173850315",
  appId: "1:510173850315:web:713dbfa96c2b8babbf494e",
  
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };