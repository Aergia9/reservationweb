import { 
  collection, 
  getDocs, 
  onSnapshot,
  query,
  orderBy,
  where
} from "firebase/firestore";
import { db } from "./firebase";
import { FirebaseEvent, SpecialEvent, firebaseToSpecialEvent } from "./types";

const EVENTS_COLLECTION = "events";

// Get all events from Firestore for client display
export const getClientEvents = async (): Promise<SpecialEvent[]> => {
  try {
    // Only get events of type "event" that are suitable for client booking
    const q = query(
      collection(db, EVENTS_COLLECTION), 
      where("category", "==", "event"),
      orderBy("startDate", "asc")
    );
    const querySnapshot = await getDocs(q);
    const events: SpecialEvent[] = [];
    
    querySnapshot.forEach((doc) => {
      const firebaseEvent = { id: doc.id, ...doc.data() } as FirebaseEvent;
      events.push(firebaseToSpecialEvent(firebaseEvent, events.length));
    });
    
    return events;
  } catch (error) {
    console.error("Error getting client events:", error);
    // Return empty array if there's an error to prevent UI crashes
    return [];
  }
};

// Subscribe to real-time updates for client events
export const subscribeToClientEvents = (callback: (events: SpecialEvent[]) => void) => {
  const q = query(
    collection(db, EVENTS_COLLECTION), 
    where("category", "==", "event"),
    orderBy("startDate", "asc")
  );
  
  return onSnapshot(q, (querySnapshot) => {
    const events: SpecialEvent[] = [];
    querySnapshot.forEach((doc) => {
      const firebaseEvent = { id: doc.id, ...doc.data() } as FirebaseEvent;
      events.push(firebaseToSpecialEvent(firebaseEvent, events.length));
    });
    callback(events);
  }, (error) => {
    console.error("Error in client events subscription:", error);
    // Call callback with empty array to prevent UI crashes
    callback([]);
  });
};