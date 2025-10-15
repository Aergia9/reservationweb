import { collection, addDoc, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import type { SpecialEvent } from '../types/event';

const EVENTS_COLLECTION = 'special-events';


export const eventService = {
  // Used by admin to add new special events
  async addEvent(event: Omit<SpecialEvent, 'id'>) {
    try {
      console.log('Adding event:', event); // Debug log

      // First, create the document in Firestore
      const docRef = await addDoc(collection(db, EVENTS_COLLECTION), {
        ...event,
        price: event.price, // Price is already a number, no need to parse
        minGuests: event.minGuests, // minGuests is already a number, no need to parse
        createdAt: Timestamp.now()
      });

      console.log('Document written with ID:', docRef.id); // Debug log
      return { ...event, id: docRef.id };
    } catch (error) {
      console.error('Error adding event:', error);
      throw error;
    }
  },

  async uploadImage(file: File) {
    try {
      const storageRef = ref(storage, `event-images/${Date.now()}-${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      return downloadURL;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  },

  // Used by client to fetch all special events
  async getEvents(): Promise<SpecialEvent[]> {
    try {
      const q = query(collection(db, EVENTS_COLLECTION), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate()
      })) as SpecialEvent[];
    } catch (error) {
      console.error('Error getting events:', error);
      throw error;
    }
  }
};