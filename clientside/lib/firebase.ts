import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyD2sDArKX1-hESo3afXs8BdECi1yDk_ypE",
  authDomain: "reservationweb-4b61a.firebaseapp.com",
  projectId: "reservationweb-4b61a",
  storageBucket: "reservationweb-4b61a.firebasestorage.app",
  messagingSenderId: "384156096887",
  appId: "1:384156096887:web:d537ee74d242d8136ee972",
  measurementId: "G-RC36JZD21V"
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const firestore = getFirestore(app);
const storage = getStorage(app);
const db = getFirestore(app);

export { auth, firestore, storage, db };

