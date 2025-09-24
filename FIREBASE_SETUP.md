# Firebase Setup Guide

This project uses Firebase to synchronize events between the admin panel (`reservationweb/`) and the client website (`clientside/`). Follow these steps to set up Firebase integration.

## Prerequisites

1. A Google account
2. Node.js and npm installed

## Firebase Project Setup

### 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project"
3. Enter a project name (e.g., "reservation-system")
4. Enable Google Analytics (optional)
5. Click "Create project"

### 2. Enable Firestore Database

1. In your Firebase project, go to "Firestore Database"
2. Click "Create database"
3. Choose "Start in test mode" (for development)
4. Select a location for your database
5. Click "Done"

### 3. Get Firebase Configuration

1. Go to Project Settings (gear icon)
2. Scroll down to "Your apps" section
3. Click "Add app" and select Web (</> icon)
4. Register your app with a nickname
5. Copy the Firebase configuration object

### 4. Update Environment Variables

Create `.env.local` files in both `reservationweb/` and `clientside/` directories:

```bash
# reservationweb/.env.local
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

Copy the same values to `clientside/.env.local`.

### 5. Configure Firestore Security Rules (for production)

In the Firebase Console, go to Firestore Database > Rules and update:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read access to events for all users (client side)
    match /events/{document} {
      allow read: if true;
      // Only authenticated users can write (admin side)
      allow write: if request.auth != null;
    }
  }
}
```

## How It Works

### Admin Side (`reservationweb/`)

- Creates and manages events through the admin panel
- Events are stored in Firestore collection called "events"
- Real-time updates when events are added/deleted
- Only events with category "event" are visible to clients

### Client Side (`clientside/`)

- Automatically displays events from Firestore
- Shows only events with category "event"
- Real-time updates when admin adds new events
- Combines hardcoded events with Firebase events

## Development

### Running the Applications

1. **Admin Panel:**
   ```bash
   cd reservationweb
   npm install
   npm run dev
   ```
   Opens at `http://localhost:3000`

2. **Client Website:**
   ```bash
   cd clientside
   npm install
   npm run dev
   ```
   Opens at `http://localhost:3000` (use different port if admin is running)

### Testing the Integration

1. Open both applications in different browser tabs
2. In the admin panel, go to `/event` page
3. Click "Add Event" and create a new event with category "event"
4. The new event should immediately appear on the client website

## Troubleshooting

### Events Not Showing

1. Check browser console for Firebase errors
2. Verify Firebase configuration in `.env.local`
3. Ensure Firestore database is created and accessible
4. Check network connectivity to Firebase

### Authentication Issues (Admin Panel)

1. Verify Firebase Auth is enabled in console
2. Create test user in Firebase Auth
3. Check authentication flow in admin panel

### Build Issues

1. The build may fail due to Google Fonts access restrictions
2. The TypeScript compilation should pass successfully
3. For production deployment, ensure all environment variables are set

## Production Deployment

1. Update Firestore security rules for production
2. Set up Firebase Hosting (optional)
3. Configure environment variables in your hosting platform
4. Test the integration in production environment

## Firebase Collections Structure

### `events` Collection

```typescript
{
  id: string,
  title: string,
  description: string,
  startDate: string, // ISO string
  endDate: string,   // ISO string
  startTime: string, // "HH:MM" format
  endTime: string,   // "HH:MM" format
  category: "meeting" | "deadline" | "event" | "reminder",
  location?: string,
  price?: number,
  image?: string,
  includes?: string[],
  duration?: string,
  eventType?: string,
  minGuests?: number,
  maxGuests?: number,
  createdAt: string, // ISO string
  updatedAt: string  // ISO string
}
```

Only events with `category: "event"` are displayed on the client side.