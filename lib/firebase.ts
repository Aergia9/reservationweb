import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyD2sDArKX1-hESo3afXs8BdECi1yDk_ypE",
  authDomain: "reservationweb-4b61a.firebaseapp.com",
  projectId: "reservationweb-4b61a",
  storageBucket: "reservationweb-4b61a.firebasestorage.app",
  messagingSenderId: "384156096887",
  appId: "1:384156096887:web:d537ee74d242d8136ee972",
  measurementId: "G-RC36JZD21V"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

export { db, storage, auth };