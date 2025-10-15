import { Timestamp } from 'firebase/firestore'

export interface SpecialEvent {
  id: string;
  name: string;
  price: number;
  image: string;
  description: string;
  includes: string[];
  duration: Timestamp;
  eventType: string;
  minGuests: number;
  createdAt?: Timestamp;
}
