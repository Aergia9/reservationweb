import { collection, getDocs, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { SpecialEvent } from '../lib/types';
import { Timestamp } from 'firebase/firestore';

const SPECIAL_EVENTS_COLLECTION = 'event';

// Helper function to convert Firebase document to SpecialEvent
const convertFirebaseToSpecialEvent = (doc: any, index: number): SpecialEvent => {
  const data = doc.data();
  console.log('Converting Firebase event:', doc.id, data);
  
  return {
    id: doc.id || `event_${index}`, // Use document ID as string
    name: data.name || '',
    price: data.price || 0,
    image: data.image || '/placeholder.svg',
    images: data.images || [], // Map the images array from Firebase
    description: data.description || '',
    includes: data.includes || [],
    duration: typeof data.duration === 'string' ? data.duration : 'Available on request',
    eventType: data.eventType || '',
    minGuests: data.minGuests || 1,
    startDate: data.startDate || null,
    endDate: data.endDate || null,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt : undefined,
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