import { collection, addDoc, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { SpecialEvent } from '../types/event';

const EVENTS_COLLECTION = 'special-events';

export const eventService = {
  async addEvent(event: any) {
    try {
      console.log('Adding event:', event); // Debug log
      const docRef = await addDoc(collection(db, 'special-events'), {
        ...event,
        createdAt: new Date(),
      });
      console.log('Event added with ID:', docRef.id); // Debug log
      return { ...event, id: docRef.id };
    } catch (error) {
      console.error('Error adding event:', error);
      throw error;
    }
  },

  async getEvents(): Promise<SpecialEvent[]> {
    try {
      const q = query(collection(db, EVENTS_COLLECTION), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as SpecialEvent[];
    } catch (error) {
      console.error('Error getting events:', error);
      throw error;
    }
  },
};