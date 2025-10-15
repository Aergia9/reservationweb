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
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of today for comparison
    
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
      
      // Filter out expired events
      if (specialEvent.endDate) {
        let endDate: Date;
        if (typeof specialEvent.endDate === 'object' && 'toDate' in specialEvent.endDate) {
          // It's a Timestamp
          endDate = (specialEvent.endDate as Timestamp).toDate();
        } else {
          // It's a string or other format
          endDate = new Date(specialEvent.endDate as string);
        }
        
        // Set endDate to end of day for proper comparison
        endDate.setHours(23, 59, 59, 999);
        
        // Only include events that haven't expired (endDate is today or later)
        const todayForComparison = new Date();
        todayForComparison.setHours(0, 0, 0, 0);
        
        if (endDate >= todayForComparison) {
          events.push(specialEvent);
          console.log(`Event "${specialEvent.name}" ends on ${endDate.toLocaleDateString()}, still available`);
        } else {
          console.log(`Event "${specialEvent.name}" expired on ${endDate.toLocaleDateString()}, hiding from client`);
        }
      } else {
        // Include events without end date (they never expire)
        events.push(specialEvent);
      }
    });
    
    console.log("Loaded", events.length, "non-expired client events from Firebase");
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
          duration: data.duration || 'Available on request',
          eventType: data.eventType || '',
          minGuests: data.minGuests || 1,
          startDate: data.startDate || null,
          endDate: data.endDate || null,
          createdAt: data.createdAt || Timestamp.now(),
        };
        
        // Filter out expired events
        if (specialEvent.endDate) {
          let endDate: Date;
          if (typeof specialEvent.endDate === 'object' && 'toDate' in specialEvent.endDate) {
            // It's a Timestamp
            endDate = (specialEvent.endDate as Timestamp).toDate();
          } else {
            // It's a string or other format
            endDate = new Date(specialEvent.endDate as string);
          }
          
          // Set endDate to end of day for proper comparison
          endDate.setHours(23, 59, 59, 999);
          
          // Only include events that haven't expired (endDate is today or later)
          const todayForComparison = new Date();
          todayForComparison.setHours(0, 0, 0, 0);
          
          if (endDate >= todayForComparison) {
            events.push(specialEvent);
            console.log(`Event "${specialEvent.name}" ends on ${endDate.toLocaleDateString()}, still available`);
          } else {
            console.log(`Event "${specialEvent.name}" expired on ${endDate.toLocaleDateString()}, hiding from client`);
          }
        } else {
          // Include events without end date (they never expire)
          events.push(specialEvent);
        }
      });
      
      console.log("Real-time update: loaded", events.length, "non-expired client events from Firebase");
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