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
  image?: string; // For client-side display
  includes?: string[]; // For client-side display
  duration?: string; // For client-side display
  eventType?: string; // For client-side display
  minGuests?: number; // For client-side display
  maxGuests?: number; // For client-side display
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

// Client-side specific event interface (extends Firebase event)
export interface ClientEvent extends FirebaseEvent {
  // All fields from FirebaseEvent are available
  // Additional computed properties can be added here if needed
}

// Admin-side specific event interface (maps to existing Event type)
export interface AdminEvent {
  id: string;
  title: string;
  description: string;
  startDate: Date;
  endDate: Date;
  startTime: string;
  endTime: string;
  category: "meeting" | "deadline" | "event" | "reminder";
  location?: string;
}

// Utility functions to convert between formats
export const adminEventToFirebase = (adminEvent: AdminEvent): FirebaseEvent => ({
  id: adminEvent.id,
  title: adminEvent.title,
  description: adminEvent.description,
  startDate: adminEvent.startDate.toISOString(),
  endDate: adminEvent.endDate.toISOString(),
  startTime: adminEvent.startTime,
  endTime: adminEvent.endTime,
  category: adminEvent.category,
  location: adminEvent.location,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

export const firebaseToAdminEvent = (firebaseEvent: FirebaseEvent): AdminEvent => ({
  id: firebaseEvent.id,
  title: firebaseEvent.title,
  description: firebaseEvent.description,
  startDate: new Date(firebaseEvent.startDate),
  endDate: new Date(firebaseEvent.endDate),
  startTime: firebaseEvent.startTime,
  endTime: firebaseEvent.endTime,
  category: firebaseEvent.category,
  location: firebaseEvent.location,
});

export const firebaseToClientEvent = (firebaseEvent: FirebaseEvent): ClientEvent => ({
  ...firebaseEvent,
  // Client events can use all firebase event fields directly
});