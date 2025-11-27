import { Timestamp } from 'firebase/firestore';

// Shared types for Firebase events
export interface FirebaseEvent {
  id: string;
  title: string;
  description: string;
  startDate: string; // ISO string for Firebase compatibility
  endDate: string; // ISO string for Firebase compatibility
  startTime: string;
  endTime: string;
  category: "meeting" | "deadline" | "event" | "reminder";
  location?: string;
  price?: number; // For client-side display
  hasChildrenPrice?: boolean; // Whether event has separate children pricing
  childrenPrice?: number; // Price for children if different
  image?: string; // For client-side display
  includes?: string[]; // For client-side display
  duration?: string; // For client-side display
  eventType?: string; // For client-side display
  minGuests?: number; // For client-side display
  maxGuests?: number; // For client-side display
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  // Package support
  hasPackages?: boolean;
  packages?: EventPackage[];
}

// Client-side specific event interface (extends Firebase event)
export interface ClientEvent extends FirebaseEvent {
  // All fields from FirebaseEvent are available
  // Additional computed properties can be added here if needed
}

// Package interface for events with multiple pricing options
export interface EventPackage {
  id: string;
  name: string;
  description: string;
  price: number;
  peopleCount: number;
  includes: string[];
  hasChildrenPrice?: boolean;
  childrenPrice?: number;
}

export interface SpecialEvent {
  id: string;
  name: string;
  price: number;
  hasChildrenPrice?: boolean;
  childrenPrice?: number;
  image: string;
  images?: string[]; // Support for multiple images
  description: string;
  includes: string[];
  duration: Timestamp | string;
  eventType: string;
  minGuests: number;
  startDate?: string;
  endDate?: string;
  createdAt?: Timestamp;
  // Package support
  hasPackages?: boolean;
  packages?: EventPackage[];
}

// Utility function to convert Firebase event to legacy SpecialEvent format
export const firebaseToSpecialEvent = (firebaseEvent: FirebaseEvent, index: number): SpecialEvent => ({
  id: `event_${index + 1000}`, // Use string ID to match interface
  name: firebaseEvent.title,
  price: firebaseEvent.price || 100, // Default price if not set
  image: firebaseEvent.image || "/placeholder.svg",
  description: firebaseEvent.description,
  includes: firebaseEvent.includes || ["Event Access", "Basic Service"],
  duration: Timestamp.fromDate(new Date(`2000-01-01T${firebaseEvent.startTime || '00:00'}`)), // Convert to Timestamp
  eventType: firebaseEvent.eventType || firebaseEvent.category,
  minGuests: firebaseEvent.minGuests || 1,
  createdAt: Timestamp.fromDate(new Date(firebaseEvent.createdAt)),
});

// Helper function to calculate duration from start and end times
const calculateDuration = (startTime: string, endTime: string): string => {
  const start = new Date(`2000-01-01T${startTime}`);
  const end = new Date(`2000-01-01T${endTime}`);
  const diffMs = end.getTime() - start.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  
  if (diffHours < 1) {
    const diffMinutes = Math.round(diffMs / (1000 * 60));
    return `${diffMinutes} minutes`;
  } else if (diffHours === 1) {
    return "1 hour";
  } else if (diffHours % 1 === 0) {
    return `${diffHours} hours`;
  } else {
    return `${diffHours.toFixed(1)} hours`;
  }
};