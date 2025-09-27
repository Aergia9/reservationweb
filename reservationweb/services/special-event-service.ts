import { collection, addDoc, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getAuth } from 'firebase/auth';
import { db, storage } from '@/lib/firebase';

const SPECIAL_EVENTS_COLLECTION = 'events';

export interface SpecialEventData {
  name: string;
  description: string;
  price: number;
  image: string;
  includes: string[];
  duration: string;
  eventType: string;
  minGuests: number;
  eventDate?: string; // Add optional fields that might be in form
  startTime?: string;
  endTime?: string;
}

export const specialEventService = {
  // Upload image to Firebase Storage
  async uploadEventImage(file: File): Promise<string> {
    try {
      const fileName = `event-images/${Date.now()}-${file.name}`;
      const storageRef = ref(storage, fileName);
      
      console.log('Uploading image to:', fileName);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      console.log('Image uploaded successfully:', downloadURL);
      return downloadURL;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw new Error('Failed to upload image');
    }
  },

  // Add special event to Firestore
  async addSpecialEvent(eventData: SpecialEventData, imageFile?: File): Promise<string> {
    try {
      // Check authentication first
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (!user) {
        throw new Error('User must be authenticated to add events');
      }

      console.log('Starting to add special event:', eventData);
      console.log('Current user:', user.uid);
      
      // Validate required fields
      if (!eventData.name || !eventData.description || !eventData.price) {
        throw new Error('Missing required fields: name, description, or price');
      }

      let imageUrl = eventData.image || '';

      // Upload image if provided
      if (imageFile) {
        console.log('Uploading image file...');
        imageUrl = await this.uploadEventImage(imageFile);
      }

      // Transform includes string to array if needed
      let includesArray: string[] = [];
      if (eventData.includes) {
        includesArray = Array.isArray(eventData.includes) 
          ? eventData.includes 
          : String(eventData.includes).split(',').map(item => item.trim()).filter(item => item);
      }

      // Prepare data with proper validation
      const eventDataToSave = {
        name: String(eventData.name).trim(),
        description: String(eventData.description).trim(),
        price: Number(eventData.price) || 0,
        image: imageUrl,
        includes: includesArray,
        duration: String(eventData.duration || '').trim(),
        eventType: String(eventData.eventType || '').trim(),
        minGuests: Number(eventData.minGuests) || 1,
        eventDate: eventData.eventDate || null,
        startTime: eventData.startTime || null,
        endTime: eventData.endTime || null,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      console.log('Data to save:', eventDataToSave);

      // Create document in Firestore using the configured db instance
      const docRef = await addDoc(collection(db, SPECIAL_EVENTS_COLLECTION), eventDataToSave);

      console.log('Special event added with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('Error adding special event:', error);
      
      // More specific error handling
      if (error instanceof Error) {
        if (error.message.includes('permission')) {
          throw new Error('Permission denied. Please ensure you are logged in with the correct account.');
        } else if (error.message.includes('network')) {
          throw new Error('Network error. Please check your internet connection.');
        }
      }
      
      throw new Error(`Failed to add special event: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  // Get all special events
  async getSpecialEvents(): Promise<SpecialEventData[]> {
    try {
      const q = query(collection(db, SPECIAL_EVENTS_COLLECTION), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      
      const events: any[] = [];
      querySnapshot.forEach((doc) => {
        events.push({
          id: doc.id,
          ...doc.data()
        });
      });

      console.log('Retrieved', events.length, 'events from Firestore');
      return events;
    } catch (error) {
      console.error('Error getting special events:', error);
      throw new Error('Failed to get special events');
    }
  }
};