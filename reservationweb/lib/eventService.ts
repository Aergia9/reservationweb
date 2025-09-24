import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  deleteDoc, 
  updateDoc, 
  onSnapshot,
  query,
  orderBy,
  Timestamp 
} from "firebase/firestore";
import { db } from "./firebase";
import { FirebaseEvent, AdminEvent, adminEventToFirebase, firebaseToAdminEvent } from "./types";

const EVENTS_COLLECTION = "events";

// Add a new event to Firestore
export const addEvent = async (adminEvent: AdminEvent): Promise<string> => {
  try {
    const firebaseEvent = adminEventToFirebase(adminEvent);
    const docRef = await addDoc(collection(db, EVENTS_COLLECTION), firebaseEvent);
    return docRef.id;
  } catch (error) {
    console.error("Error adding event:", error);
    throw error;
  }
};

// Get all events from Firestore
export const getEvents = async (): Promise<AdminEvent[]> => {
  try {
    const q = query(collection(db, EVENTS_COLLECTION), orderBy("startDate", "asc"));
    const querySnapshot = await getDocs(q);
    const events: AdminEvent[] = [];
    
    querySnapshot.forEach((doc) => {
      const firebaseEvent = { id: doc.id, ...doc.data() } as FirebaseEvent;
      events.push(firebaseToAdminEvent(firebaseEvent));
    });
    
    return events;
  } catch (error) {
    console.error("Error getting events:", error);
    throw error;
  }
};

// Delete an event from Firestore
export const deleteEvent = async (eventId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, EVENTS_COLLECTION, eventId));
  } catch (error) {
    console.error("Error deleting event:", error);
    throw error;
  }
};

// Update an event in Firestore
export const updateEvent = async (adminEvent: AdminEvent): Promise<void> => {
  try {
    const firebaseEvent = adminEventToFirebase(adminEvent);
    firebaseEvent.updatedAt = new Date().toISOString();
    await updateDoc(doc(db, EVENTS_COLLECTION, adminEvent.id), firebaseEvent as any);
  } catch (error) {
    console.error("Error updating event:", error);
    throw error;
  }
};

// Subscribe to real-time updates for events
export const subscribeToEvents = (callback: (events: AdminEvent[]) => void) => {
  const q = query(collection(db, EVENTS_COLLECTION), orderBy("startDate", "asc"));
  
  return onSnapshot(q, (querySnapshot) => {
    const events: AdminEvent[] = [];
    querySnapshot.forEach((doc) => {
      const firebaseEvent = { id: doc.id, ...doc.data() } as FirebaseEvent;
      events.push(firebaseToAdminEvent(firebaseEvent));
    });
    callback(events);
  }, (error) => {
    console.error("Error in events subscription:", error);
  });
};