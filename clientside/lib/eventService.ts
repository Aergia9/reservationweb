import { 
  collection, 
  getDocs, 
  onSnapshot,
  query,
  orderBy,
  Timestamp
} from "firebase/firestore";
import { db } from "./firebase";
import { SpecialEvent } from "./types";

const EVENTS_COLLECTION = "event";

// Get all events from Firestore for client display
export const getClientEvents = async (): Promise<SpecialEvent[]> => {
  try {
    // Get all events from the collection
    const q = query(
      collection(db, EVENTS_COLLECTION), 
      orderBy("createdAt", "desc")
    );
    const querySnapshot = await getDocs(q);
    const events: SpecialEvent[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      // Convert the new admin event structure to SpecialEvent
      console.log('Raw Firebase data for event:', doc.id, data);
      
      const specialEvent: SpecialEvent = {
        id: doc.id,
        name: data.name || '',
        price: data.price || 0,
        image: data.image || '/placeholder.svg',
        images: data.images || [], // Map the images array from Firebase
        description: data.description || '',
        includes: data.includes || [],
        duration: data.duration || 'Available on request',
        eventType: data.eventType || '',
        minGuests: data.minGuests || 1,
        startDate: data.startDate || null,
        endDate: data.endDate || null,
        createdAt: data.createdAt || Timestamp.now(),
      };
      
      console.log('Mapped SpecialEvent:', specialEvent);
      events.push(specialEvent);
    });
    
    console.log("Loaded", events.length, "client events from Firebase");
    return events;
  } catch (error) {
    console.error("Error getting client events from Firebase:", error);
    // Return empty array if there's an error to prevent UI crashes
    if (error instanceof Error && error.message.includes("projectId")) {
      console.warn("Firebase not configured properly. Using demo mode with no Firebase events.");
      return [];
    }
    return [];
  }
};

// Subscribe to real-time updates for client events
export const subscribeToClientEvents = (callback: (events: SpecialEvent[]) => void) => {
  try {
    const q = query(
      collection(db, EVENTS_COLLECTION), 
      orderBy("createdAt", "desc")
    );
    
    return onSnapshot(q, (querySnapshot) => {
      const events: SpecialEvent[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // Convert the new admin event structure to SpecialEvent
        const specialEvent: SpecialEvent = {
          id: doc.id,
          name: data.name || '',
          price: data.price || 0,
          image: data.image || '/placeholder.svg',
          images: data.images || [], // Map the images array from Firebase
          description: data.description || '',
          includes: data.includes || [],
          duration: data.duration ? (typeof data.duration === 'string' ? Timestamp.now() : data.duration) : Timestamp.now(),
          eventType: data.eventType || '',
          minGuests: data.minGuests || 1,
          createdAt: data.createdAt || Timestamp.now(),
        };
        events.push(specialEvent);
      });
      console.log("Real-time update: loaded", events.length, "client events from Firebase");
      callback(events);
    }, (error) => {
      console.error("Error in client events Firebase subscription:", error);
      // Call callback with empty array to prevent UI crashes
      if (error instanceof Error && error.message.includes("projectId")) {
        console.warn("Firebase not configured properly. Using demo mode with no Firebase events.");
        callback([]);
        return;
      }
      callback([]);
    });
  } catch (error) {
    console.error("Error setting up client events Firebase subscription:", error);
    // Return a mock unsubscribe function if Firebase is not configured
    if (error instanceof Error && error.message.includes("projectId")) {
      console.warn("Firebase not configured properly. Using demo mode.");
      callback([]);
      return () => console.log("Demo mode - no subscription to unsubscribe");
    }
    throw error;
  }
};