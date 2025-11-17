import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyD2sDArKX1-hESo3afXs8BdECi1yDk_ypE",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "reservationweb-4b61a.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "reservationweb-4b61a",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "reservationweb-4b61a.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "384156096887",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:384156096887:web:d537ee74d242d8136ee972",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-RC36JZD21V",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Use Firestore database ID "event" to match admin app
const auth = getAuth(app);
const db = getFirestore(app, "event");
const storage = getStorage(app);

export { auth, db, storage };
