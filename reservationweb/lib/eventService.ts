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
    console.log("Event added to Firebase with ID:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("Error adding event to Firebase:", error);
    // For demo purposes, return a mock ID if Firebase is not configured
    if (error instanceof Error && error.message.includes("projectId")) {
      console.warn("Firebase not configured properly. Using demo mode.");
      return `demo-${Date.now()}`;
    }
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
    
    console.log("Loaded", events.length, "events from Firebase");
    return events;
  } catch (error) {
    console.error("Error getting events from Firebase:", error);
    // Return empty array if Firebase is not configured properly
    if (error instanceof Error && error.message.includes("projectId")) {
      console.warn("Firebase not configured properly. Using demo mode with empty events.");
      return [];
    }
    throw error;
  }
};

// Delete an event from Firestore
export const deleteEvent = async (eventId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, EVENTS_COLLECTION, eventId));
    console.log("Event deleted from Firebase:", eventId);
  } catch (error) {
    console.error("Error deleting event from Firebase:", error);
    // For demo purposes, just log if Firebase is not configured
    if (error instanceof Error && error.message.includes("projectId")) {
      console.warn("Firebase not configured properly. Demo mode - event not actually deleted.");
      return;
    }
    throw error;
  }
};

// Update an event in Firestore
export const updateEvent = async (adminEvent: AdminEvent): Promise<void> => {
  try {
    const firebaseEvent = adminEventToFirebase(adminEvent);
    firebaseEvent.updatedAt = new Date().toISOString();
    await updateDoc(doc(db, EVENTS_COLLECTION, adminEvent.id), firebaseEvent as any);
    console.log("Event updated in Firebase:", adminEvent.id);
  } catch (error) {
    console.error("Error updating event in Firebase:", error);
    // For demo purposes, just log if Firebase is not configured
    if (error instanceof Error && error.message.includes("projectId")) {
      console.warn("Firebase not configured properly. Demo mode - event not actually updated.");
      return;
    }
    throw error;
  }
};

// Subscribe to real-time updates for events
export const subscribeToEvents = (callback: (events: AdminEvent[]) => void) => {
  try {
    const q = query(collection(db, EVENTS_COLLECTION), orderBy("startDate", "asc"));
    
    return onSnapshot(q, (querySnapshot) => {
      const events: AdminEvent[] = [];
      querySnapshot.forEach((doc) => {
        const firebaseEvent = { id: doc.id, ...doc.data() } as FirebaseEvent;
        events.push(firebaseToAdminEvent(firebaseEvent));
      });
      console.log("Real-time update: loaded", events.length, "events from Firebase");
      callback(events);
    }, (error) => {
      console.error("Error in Firebase events subscription:", error);
      // Return empty array if Firebase is not configured properly
      if (error instanceof Error && error.message.includes("projectId")) {
        console.warn("Firebase not configured properly. Using demo mode with empty events.");
        callback([]);
        return;
      }
    });
  } catch (error) {
    console.error("Error setting up Firebase events subscription:", error);
    // Return a mock unsubscribe function if Firebase is not configured
    if (error instanceof Error && error.message.includes("projectId")) {
      console.warn("Firebase not configured properly. Using demo mode.");
      callback([]);
      return () => console.log("Demo mode - no subscription to unsubscribe");
    }
    throw error;
  }
};