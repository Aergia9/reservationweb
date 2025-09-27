import { collection, getDocs, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { SpecialEvent } from '../lib/types';

const SPECIAL_EVENTS_COLLECTION = 'event';

// Helper function to convert Firebase document to SpecialEvent
const convertFirebaseToSpecialEvent = (doc: any, index: number): SpecialEvent => {
  const data = doc.data();
  return {
    id: index + 1000, // Convert string ID to number, with offset to avoid conflicts
    name: data.name || '',
    price: data.price || 0,
    image: data.image || '/placeholder.svg',
    description: data.description || '',
    includes: data.includes || [],
    duration: data.duration || '',
    eventType: data.eventType || '',
    minGuests: data.minGuests || 1,
  };
};

export const specialEventService = {
  // Get all special events
  async getSpecialEvents(): Promise<SpecialEvent[]> {
    try {
      const q = query(collection(db, SPECIAL_EVENTS_COLLECTION), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      
      const events: SpecialEvent[] = [];
      let index = 0;
      querySnapshot.forEach((doc) => {
        events.push(convertFirebaseToSpecialEvent(doc, index));
        index++;
      });

      console.log('Loaded', events.length, 'special events from Firebase');
      return events;
    } catch (error) {
      console.error('Error getting special events:', error);
      console.warn('Falling back to empty array due to Firestore error');
      return [];
    }
  },

  // Subscribe to real-time updates for special events
  subscribeToSpecialEvents(callback: (events: SpecialEvent[]) => void) {
    try {
      const q = query(collection(db, SPECIAL_EVENTS_COLLECTION), orderBy('createdAt', 'desc'));
      
      return onSnapshot(q, 
        (querySnapshot) => {
          const events: SpecialEvent[] = [];
          let index = 0;
          querySnapshot.forEach((doc) => {
            events.push(convertFirebaseToSpecialEvent(doc, index));
            index++;
          });

          console.log('Real-time update: loaded', events.length, 'special events');
          callback(events);
        },
        (error) => {
          console.error('Error in real-time subscription:', error);
          // Call callback with empty array on error to prevent hanging
          callback([]);
        }
      );
    } catch (error) {
      console.error('Error subscribing to special events:', error);
      return () => {}; // Return empty unsubscribe function
    }
  }
};