import {setGlobalOptions, config as functionsConfig} from "firebase-functions";
import {onRequest} from "firebase-functions/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";

// --- Runtime hygiene constants ---
const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const MAX_SESSIONS = 1000; // cap memory in warm instances

// PII masking helpers for safer logging
function maskPhone(p?: string) {
  if (!p) return p;
  const s = String(p);
  if (s.length <= 4) return "***";
  return `${"*".repeat(Math.max(0, s.length - 4))}${s.slice(-4)}`;
}
// Exported utility for potential use in logging/reporting
export function maskEmail(e?: string) {
  if (!e) return e;
  const [u, d] = String(e).split("@");
  if (!d) return "***";
  const uMasked = u.length <= 2 ? "**" : `${u[0]}***${u[u.length - 1]}`;
  return `${uMasked}@${d}`;
}

// Initialize Firebase Admin SDK with a default bucket (we will lazily verify later in runtime).
const PROJECT_ID = process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'reservationweb-4b61a';
const explicitBucketEnv = process.env.STORAGE_BUCKET || (functionsConfig()?.firebase?.storage_bucket as string | undefined);
const consoleBucket = `${PROJECT_ID}.firebasestorage.app`;
const legacyBucket = `${PROJECT_ID}.appspot.com`;

const preferredBucket = explicitBucketEnv || consoleBucket;

const app = admin.initializeApp({ storageBucket: preferredBucket });
logger.info('Storage bucket configured (lazy verify at upload time)', { preferredBucket, explicitBucketEnv, consoleBucket, legacyBucket });

// Helper to resolve a working bucket at runtime
// Type fallback because admin.storage().bucket() returns an internal Bucket type
async function resolveActiveBucket() { //: ReturnType<typeof admin.storage().bucket>
  // 1) If env explicitly set, try it first
  const configured = explicitBucketEnv;
  const tryNames = [configured, consoleBucket, legacyBucket].filter(Boolean) as string[];

  for (const name of tryNames) {
    try {
      const b = admin.storage().bucket(name);
      // Lightweight list call to verify bucket exists
      await b.getFiles({ maxResults: 1 });
      if (name !== preferredBucket) {
        logger.warn('Using non-preferred bucket at runtime', { name });
      }
      return b;
    } catch (e:any) {
      logger.error('Bucket candidate failed verification', { name, message: e?.message });
      continue;
    }
  }

  // Fallback to default app bucket (may still fail but we log it)
  return admin.storage().bucket();
}

// Connect to the "event" database to match client-side configuration
// For Firebase Functions, we need to specify the database ID in the options
let db: admin.firestore.Firestore;
try {
  // Try to connect to the named "event" database
  db = admin.firestore(app);
  
  // Set database options to use "event" database
  const firestoreSettings = {
    databaseId: "event"
  };
  
  // Apply settings if possible
  db.settings(firestoreSettings);
  logger.info("Successfully configured Firestore to use 'event' database");
  
} catch (error) {
  logger.warn("Error configuring 'event' database, using default", error);
  db = admin.firestore(app);
}

logger.info("Firebase Admin initialized targeting 'event' database");

// User session tracking for first-time users, language preference, and booking modification
const userSessions = new Map<string, { 
  isFirstMessage: boolean; 
  lastInteraction: number; 
  language?: 'en' | 'id' | null;
  lastBookingId?: string;
  waitingForBookingId?: boolean;
  bookingModification?: {
    bookingId: string;
    step: 'awaiting_choice' | 'awaiting_date' | 'awaiting_time' | 'confirming';
    changeType?: 'date_only' | 'time_only' | 'both';
    newDate?: string;
    newTime?: string;
  };
  newBooking?: {
    step: 'selecting_event' | 'awaiting_name' | 'awaiting_email' | 'awaiting_phone' | 'awaiting_children' | 'awaiting_adults' | 'awaiting_date' | 'confirming';
    eventId?: string;
    eventName?: string;
    eventPrice?: number;
    eventStartDate?: Date;
    eventEndDate?: Date;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    children?: number;
    adults?: number;
    guests?: number;
    bookingDate?: string;
  };
  paymentUpload?: {
    bookingId: string;
  };
  paymentSelection?: {
    bookingId: string;
    step: 'awaiting_method';
  };
}>();

// For cost control, set maximum number of containers
setGlobalOptions({ maxInstances: 10 });
// Updated: Enhanced error logging for media upload debugging

// WhatsApp webhook for customer service automation
export const whatsappWebhook = onRequest(async (request, response) => {
  try {
    logger.info("WhatsApp webhook received", {
      method: request.method,
      body: request.body,
      query: request.query,
    });

    // Handle webhook verification (required by WhatsApp)
    if (request.method === "GET") {
      const mode = request.query["hub.mode"];
      const token = request.query["hub.verify_token"];
      const challenge = request.query["hub.challenge"];

      // Avoid logging tokens/challenges; only log the mode
      logger.info("Webhook verification attempt", { mode });

    // Verify token (must be supplied via env/config; no insecure fallback)
  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || (functionsConfig()?.whatsapp?.verify_token as string);
  if (!VERIFY_TOKEN) {
    logger.error("Missing WHATSAPP_VERIFY_TOKEN configuration. Refusing verification.");
    response.status(500).send("Server not configured");
    return;
  }
      
      if (mode === "subscribe" && token === VERIFY_TOKEN) {
        logger.info("Webhook verified successfully");
        response.status(200).send(challenge);
        return;
      } else {
            // Minimal failure logging without exposing secret token
            logger.error("Webhook verification failed", {
              receivedMode: mode,
              tokenMismatch: token !== VERIFY_TOKEN
            });
        response.status(403).send("Forbidden");
        return;
      }
    }

    // Test endpoint for debugging events
    if (request.method === "GET" && request.query.test === "events") {
      logger.info("Testing events endpoint");
      try {
        const eventsRef = db.collection("event");
        const querySnapshot = await eventsRef.get();
        
        const events = querySnapshot.docs.map(doc => ({
          id: doc.id,
          data: doc.data()
        }));
        
        response.status(200).json({
          success: true,
          count: events.length,
          events: events
        });
        return;
      } catch (error) {
    logger.error("Error testing events", { message: (error as any)?.message });
        response.status(500).json({
          success: false,
          error: (error as Error).message
        });
        return;
      }
    }

    // Handle incoming messages
    if (request.method === "POST") {
      const body = request.body;

      if (body.object === "whatsapp_business_account") {
        for (const entry of body.entry) {
          for (const change of entry.changes) {
            if (change.field === "messages") {
              await processWhatsAppMessage(change.value);
            }
          }
        }
        response.status(200).send("EVENT_RECEIVED");
        return;
      }
    }

    response.status(404).send("Not Found");
  } catch (error) {
  logger.error("Error in WhatsApp webhook", { message: (error as any)?.message });
    response.status(500).send("Internal Server Error");
  }
});

// Check if user is new (first time messaging)
function isFirstTimeUser(phoneNumber: string): boolean {
  const session = userSessions.get(phoneNumber);
  const now = Date.now();
  
  if (!session || (now - session.lastInteraction) > 24 * 60 * 60 * 1000) {
    userSessions.set(phoneNumber, { isFirstMessage: true, lastInteraction: now, language: null });
    return true;
  }
  
  userSessions.set(phoneNumber, { ...session, isFirstMessage: false, lastInteraction: now });
  return false;
}

// Get user's language preference
function getUserLanguage(phoneNumber: string): 'en' | 'id' | null {
  const session = userSessions.get(phoneNumber);
  return session?.language || null;
}

// Set user's language preference
function setUserLanguage(phoneNumber: string, language: 'en' | 'id') {
  const session = userSessions.get(phoneNumber) || { isFirstMessage: false, lastInteraction: Date.now(), language: null };
  userSessions.set(phoneNumber, { ...session, language });
}

// Session cleanup utility
function cleanupSessions() {
  const now = Date.now();
  const entries = Array.from(userSessions.entries());
  // Remove expired based on TTL
  for (const [key, sess] of entries) {
    if (now - sess.lastInteraction > SESSION_TTL_MS) {
      userSessions.delete(key);
    }
  }
  // If still above cap, remove oldest
  if (userSessions.size > MAX_SESSIONS) {
    const sorted = entries.sort((a,b) => a[1].lastInteraction - b[1].lastInteraction);
    const excess = userSessions.size - MAX_SESSIONS;
    for (let i=0;i<excess;i++) {
      userSessions.delete(sorted[i][0]);
    }
  }
}

// Process incoming WhatsApp messages
async function processWhatsAppMessage(messageData: any) {
  try {
    if (!messageData.messages) return;
    // Cleanup expired sessions and cap size each invocation
    cleanupSessions();

    for (const message of messageData.messages) {
  const phoneNumber = message.from;
  const messageText = message.text?.body?.toLowerCase().trim() || "";
  const messageType = message.type;
  const userLanguage = getUserLanguage(phoneNumber) || 'en';

  logger.info("Message received", { from: maskPhone(phoneNumber), text: messageText, type: messageType });

      // If user sends an image (photo) OR a document that is an image, and we're expecting payment proof, handle it
      const isImageDocument = messageType === "document" && (message.document?.mime_type?.startsWith("image/") ?? false);
      if (messageType === "image" || isImageDocument) {
        // Quick mime validation before doing heavier work downstream
        const incomingMime = message.image?.mime_type || message.document?.mime_type || '';
        if (incomingMime && !incomingMime.startsWith('image/')) {
          await sendWhatsAppMessage(phoneNumber, userLanguage === 'id' ? 'File bukan gambar. Kirim bukti pembayaran sebagai foto atau gambar.' : 'The file isn\'t an image. Please send payment proof as a photo/image.');
          continue;
        }
        logger.info("Incoming media message", {
          type: messageType,
          mediaId: message.image?.id || message.document?.id,
          mime: message.image?.mime_type || message.document?.mime_type,
          from: maskPhone(phoneNumber),
        });
        const session = userSessions.get(phoneNumber);
        if (session?.paymentUpload?.bookingId) {
          const mediaId = message.image?.id || message.document?.id;
          await handlePaymentProofUpload(phoneNumber, session.paymentUpload.bookingId, mediaId, userLanguage);
          // After handling, continue to next message
          continue;
        } else {
          const msg = userLanguage === 'id'
            ? "Untuk unggah bukti pembayaran, silakan ketik ID booking Anda dulu atau balas '3' untuk bantuan pembayaran."
            : "To upload payment proof, please send your booking ID first or reply '3' for payment help.";
          await sendWhatsAppMessage(phoneNumber, msg);
          continue;
        }
      }

      // Only process other message types as text flow
      if (messageType !== "text") {
        await sendWelcomeMenu(phoneNumber, userLanguage);
        continue;
      }

      // First time user or specific greetings
      if (isFirstTimeUser(phoneNumber) || messageText === "hi" || messageText === "hello" || messageText === "halo") {
        const userLang = getUserLanguage(phoneNumber);
        if (!userLang) {
          await sendLanguageSelection(phoneNumber);
        } else {
          await sendWelcomeMenu(phoneNumber, userLang);
        }
        continue;
      }

      // Test command for webhook verification (placed early to bypass other checks)
      if (messageText === "project test") {
        await sendWhatsAppMessage(phoneNumber, "✅ Project test successful! The webhook is connected and working properly.");
        continue;
      }

  // userLanguage already resolved above

      // Handle language selection
      if (messageText === "english" || messageText === "en") {
        setUserLanguage(phoneNumber, 'en');
        await sendWelcomeMenu(phoneNumber, 'en');
        continue;
      } else if (messageText === "bahasa" || messageText === "indonesia" || messageText === "id") {
        setUserLanguage(phoneNumber, 'id');
        await sendWelcomeMenu(phoneNumber, 'id');
        continue;
      }

      // Handle booking modification flow
      const session = userSessions.get(phoneNumber);
      if (session?.bookingModification) {
        await handleBookingModification(phoneNumber, messageText, userLanguage);
        continue;
      }

      // Handle payment method selection flow
      if (session?.paymentSelection) {
        await handlePaymentMethodSelection(phoneNumber, messageText, userLanguage);
        continue;
      }

      // Global cancel for payment flows
      if (messageText === 'cancel' || messageText === 'batal') {
        const sessionCancel = userSessions.get(phoneNumber);
        if (sessionCancel?.paymentSelection || sessionCancel?.paymentUpload) {
          if (sessionCancel.paymentSelection) delete sessionCancel.paymentSelection;
          if (sessionCancel.paymentUpload) delete sessionCancel.paymentUpload;
          userSessions.set(phoneNumber, sessionCancel);
          const cancelMsg = userLanguage === 'id'
            ? '❌ Proses pembayaran dibatalkan. Ketik "menu" untuk kembali atau mulai booking baru.'
            : '❌ Payment process cancelled. Type "menu" to return or start a new booking.';
          await sendWhatsAppMessage(phoneNumber, cancelMsg);
          continue;
        }
      }

      // Resend proof command: 'resend <bookingId>' or 'kirim ulang <bookingId>'
      if (messageText.startsWith('resend') || messageText.startsWith('kirim ulang')) {
        const parts = messageText.split(/\s+/);
        const maybeId = parts.slice(1).join(' ').trim();
        if (!maybeId) {
          const errMsg = userLanguage === 'id'
            ? 'Format perintah salah. Gunakan: kirim ulang <IDBooking>'
            : 'Invalid command format. Use: resend <BookingID>';
          await sendWhatsAppMessage(phoneNumber, errMsg);
          continue;
        }
        await reactivatePaymentProof(phoneNumber, maybeId.toUpperCase(), userLanguage);
        continue;
      }

      // Handle new booking flow
      if (session?.newBooking) {
        await handleNewBookingFlow(phoneNumber, messageText, userLanguage);
        continue;
      }

      // Check if user is waiting for a booking ID
      if (session?.waitingForBookingId) {
        const bookingIdMatch = messageText.match(/\b(?:TES\d{2,4}T|[A-Z]{2,3}-[A-Z0-9]{3,6}|[A-Z]{2,3}\d{3,6}[A-Z]?)\b/i);
        if (bookingIdMatch) {
          // Clear the waiting state
          const currentSession = userSessions.get(phoneNumber) || { 
            isFirstMessage: false, 
            lastInteraction: Date.now(), 
            language: userLanguage 
          };
          currentSession.waitingForBookingId = false;
          userSessions.set(phoneNumber, currentSession);
          
          await handleBookingInquiry(phoneNumber, bookingIdMatch[0].toUpperCase(), userLanguage);
        } else {
          const errorMsg = userLanguage === 'id' ?
            "Format ID booking tidak valid. Silakan masukkan ID booking yang benar (contoh: TES353T, BK-ABC123)." :
            "Invalid booking ID format. Please enter a valid booking ID (e.g., TES353T, BK-ABC123).";
          await sendWhatsAppMessage(phoneNumber, errorMsg);
        }
        continue;
      }

      // Menu selections
      if (messageText === "1") {
        await sendBookingHelp(phoneNumber, userLanguage);
      } else if (messageText === "2") {
        await sendCurrentEvents(phoneNumber, userLanguage);
      } else if (messageText === "3") {
        // Start new booking flow
        await startNewBookingFlow(phoneNumber, userLanguage);
      } else if (messageText.includes("menu")) {
        await sendWelcomeMenu(phoneNumber, userLanguage);
      } else if (messageText === "edit" || messageText === "modify") {
        // Start booking modification flow
        await startBookingModification(phoneNumber, userLanguage);
      } else {
        // Check if message is an event name for detailed view
        const eventDetailRequest = await checkForEventDetailRequest(messageText, userLanguage);
        if (eventDetailRequest) {
          await sendEventDetails(phoneNumber, messageText.toLowerCase(), userLanguage);
        } else {
          // If no specific action matches, show help
          await sendHelpMessage(phoneNumber, userLanguage);
        }
      }
    }
  } catch (error) {
    logger.error("Error processing message", error);
  }
}

// Send language selection for first-time users
async function sendLanguageSelection(phoneNumber: string) {
  const message = `Please choose your language / Silakan pilih bahasa Anda:

1️⃣ English
2️⃣ Bahasa Indonesia

Reply with:
• "English" for English
• "Bahasa" for Bahasa Indonesia`;

  await sendWhatsAppMessage(phoneNumber, message);
}

// Send welcome menu
async function sendWelcomeMenu(phoneNumber: string, language: 'en' | 'id' = 'en') {
  const messages = {
    en: {
      title: "*Welcome to Makassar Phinisi Sea Side Hotel*",
      subtitle: "I am your digital assistant, ready to assist you 24/7.",
      question: "*How may I assist you today?*",
      option1: "1️⃣ Check booking status",
      option2: "2️⃣ View current events",
      option3: "3️⃣ Book an event",
      tips: "*Quick Guide:*",
      tip1: "• Reply with a number (1, 2, or 3)",
      tip2: "• Send your booking ID for assistance (e.g., BK-ABC123)",
      tip3: "• Type \"menu\" to view this menu again",
      closing: "How may I help you today?"
    },
    id: {
      title: "*Selamat datang di Makassar Phinisi Sea Side Hotel*",
      subtitle: "Saya adalah asisten digital Anda, siap melayani 24/7.",
      question: "*Bagaimana saya dapat membantu Anda hari ini?*",
      option1: "1️⃣ Cek status booking",
      option2: "2️⃣ Lihat event terkini",
      option3: "3️⃣ Booking event",
      tips: "*Panduan Cepat:*",
      tip1: "• Balas dengan angka (1, 2, atau 3)",
      tip2: "• Kirim ID booking untuk bantuan (contoh: BK-ABC123)",
      tip3: "• Ketik \"menu\" untuk melihat menu ini lagi",
      closing: "Bagaimana saya dapat membantu Anda hari ini?"
    }
  };

  const msg = messages[language];
  const message = `${msg.title}

${msg.subtitle}

${msg.question}

${msg.option1}
${msg.option2}
${msg.option3}

${msg.tips}
${msg.tip1}
${msg.tip2}
${msg.tip3}

${msg.closing}`;

  await sendWhatsAppMessage(phoneNumber, message);
}

// Handle booking inquiry
async function handleBookingInquiry(phoneNumber: string, bookingId: string, language: 'en' | 'id' = 'en') {
  try {
    logger.info(`Searching for booking ID: ${bookingId} in 'booking' collection`);
    
    // Search only the 'booking' collection
    const bookingsRef = db.collection('booking');
    const querySnapshot = await bookingsRef.where("bookingId", "==", bookingId).get();
    
    logger.info(`Found ${querySnapshot.docs.length} documents with booking ID ${bookingId}`);

    if (querySnapshot.empty) {
      logger.info(`No booking found with ID: ${bookingId}`);
      const errorMsg = language === 'id' ?
        `Maaf, booking dengan ID ${bookingId} tidak ditemukan.\n\nSilakan periksa kembali ID booking Anda dan coba lagi.\nBalas "menu" untuk opsi lainnya.` :
        `Sorry, booking ${bookingId} was not found.\n\nPlease check your booking ID and try again.\nReply "menu" for more options.`;
      await sendWhatsAppMessage(phoneNumber, errorMsg);
      return;
    }

    const booking = querySnapshot.docs[0].data();
    logger.info(`Found booking:`, booking);
    const status = booking.paymentStatus === "approved" ? (language==='id' ? 'Terkonfirmasi' : 'Confirmed') : booking.paymentStatus === 'reviewing' ? (language==='id' ? 'Sedang Ditinjau' : 'Under Review') : (language==='id' ? 'Menunggu' : 'Pending');

    // If no payment proof yet but payment method chosen, prompt user to upload proof and set session state
    if (!booking.paymentImageUrl && booking.paymentMethod) {
      const session = userSessions.get(phoneNumber) || { isFirstMessage:false, lastInteraction:Date.now(), language: language };
      session.paymentUpload = { bookingId };
      userSessions.set(phoneNumber, session);
    }
    
    const message = `*Booking Information*

*ID:* ${booking.bookingId}
*Event:* ${booking.eventName || 'N/A'}
*Customer:* ${booking.firstName} ${booking.lastName}
*Date:* ${booking.bookingDate || 'N/A'}
*Guests:* ${booking.totalGuests || booking.guests || 'N/A'}
*Total:* Rp${booking.totalPrice?.toLocaleString() || 'N/A'}
*Status:* ${status}

${booking.paymentStatus === "approved" 
  ? (language==='id'? 'Booking Anda sudah dikonfirmasi.' : 'Your booking is confirmed.') 
  : booking.paymentStatus === 'reviewing' ? (language==='id'? 'Bukti pembayaran Anda sedang ditinjau.' : 'Your payment proof is under review.') : (language==='id'? 'Silakan kirim bukti pembayaran jika belum.' : 'Please send your payment proof if not yet sent.')}

${language === 'id' 
  ? (booking.paymentImageUrl ? '*Ingin mengubah booking?* Ketik "edit". Balas "menu" untuk opsi lainnya.' : '*Kirim bukti pembayaran dengan mengirim foto sekarang.*\n\nKetik "edit" untuk ubah tanggal/waktu. Balas "menu" untuk opsi lain.') 
  : (booking.paymentImageUrl ? '*Want to modify your booking?* Type "edit". Reply "menu" for more options.' : '*Send your payment proof by attaching a photo now.*\n\nType "edit" to modify date/time. Reply "menu" for more options.')}`;

    await sendWhatsAppMessage(phoneNumber, message);
    
    // Store booking ID for potential modification
    const session = userSessions.get(phoneNumber) || { 
      isFirstMessage: false, 
      lastInteraction: Date.now(), 
      language: language as 'en' | 'id' 
    };
    session.lastBookingId = bookingId;
    userSessions.set(phoneNumber, session);
  } catch (error) {
    logger.error("Error getting booking", error);
    await sendWhatsAppMessage(phoneNumber, "Error retrieving booking. Please try again.");
  }
}

// Send current events
async function sendCurrentEvents(phoneNumber: string, language: 'en' | 'id' = 'en') {
  try {
    logger.info("Searching for events in multiple collections...");
    logger.info("Database configuration:", {
      projectId: app.options.projectId,
      databaseId: (db as any)._settings?.databaseId || "default",
      appName: app.name
    });
    
    // Search only the 'event' collection for events (not bookings)
    const collectionsToCheck = ['event'];
    let querySnapshot: any = null;
    let foundCollection = '';
    
    // Try each collection
    for (const collectionName of collectionsToCheck) {
      try {
        logger.info(`Checking collection: ${collectionName}`);
        const eventsRef = db.collection(collectionName);
        
        let tempSnapshot;
        try {
          tempSnapshot = await eventsRef.orderBy("createdAt", "desc").get();
        } catch (orderError) {
          logger.info(`createdAt field not found in ${collectionName}, trying without ordering`);
          tempSnapshot = await eventsRef.get();
        }
        
        logger.info(`Collection ${collectionName}: Found ${tempSnapshot.docs.length} documents`);
        
        // Only consider this collection if it contains actual event documents (not bookings)
        if (tempSnapshot.docs.length > 0) {
          let eventLikeDocuments = 0;
          tempSnapshot.docs.forEach(doc => {
            const data = doc.data();
            // Skip booking documents (they have bookingId field)
            if (data.bookingId || data.bookingType === 'event') {
              return; // This is booking data, not event data
            }
            // Check if document looks like an event (has name/title, price, etc.)
            if (data.name || data.title || data.eventName || data.price || data.description) {
              eventLikeDocuments++;
            }
          });
          
          logger.info(`Collection ${collectionName}: Found ${eventLikeDocuments} actual event documents (excluding bookings)`);
          
          if (eventLikeDocuments > 0) {
            querySnapshot = tempSnapshot;
            foundCollection = collectionName;
            break;
          }
        }
      } catch (error) {
        logger.info(`Collection ${collectionName} not accessible or doesn't exist`);
      }
    }

    if (!querySnapshot || querySnapshot.docs.length === 0) {
      logger.info("No events found in any collection. Checking if events are stored as different document types...");
      
      // Maybe the events are stored in the main documents, let's check all collections
      try {
        const allCollections = await db.listCollections();
        logger.info("All available collections:", allCollections.map(col => col.id));
        
        // Check each collection for documents that look like events
        for (const collection of allCollections) {
          try {
            const snapshot = await collection.limit(5).get();
            if (snapshot.docs.length > 0) {
              logger.info(`Collection ${collection.id} sample documents:`, 
                snapshot.docs.map(doc => ({
                  id: doc.id,
                  fields: Object.keys(doc.data())
                }))
              );
            }
          } catch (error) {
            logger.info(`Cannot access collection ${collection.id}`);
          }
        }
      } catch (error) {
        logger.error("Cannot list collections", error);
      }
    }

    logger.info(`Using collection: ${foundCollection} with ${querySnapshot?.docs.length || 0} documents`);

    // Filter for ongoing events
    const now = new Date();
    const ongoingEvents: any[] = [];
    
    if (querySnapshot && querySnapshot.docs.length > 0) {
      querySnapshot.docs.forEach((doc: any) => {
        const event = doc.data();
        
        // Skip booking documents completely
        if (event.bookingId || event.bookingType === 'event') {
          logger.info(`Skipping booking document: ${doc.id}`);
          return;
        }
        
        logger.info(`Processing event document: ${doc.id}`, {
          id: doc.id,
          hasName: !!(event.name || event.title || event.eventName),
          hasPrice: !!(event.price),
          hasEndDate: !!event.endDate,
          allFields: Object.keys(event)
        });
        
        // Check if this looks like an event (has name/title and possibly price)
        const eventName = event.name || event.title || event.eventName;
        if (!eventName) {
          logger.info(`Skipping document ${doc.id} - no event name found`);
          return;
        }
        
        // Check if event is ongoing (more strict date filtering)
        let isOngoing = true;
        
        if (event.endDate) {
          let endDate: Date;
          if (event.endDate && typeof event.endDate.toDate === 'function') {
            // Firestore Timestamp
            endDate = event.endDate.toDate();
            logger.info(`Converted Timestamp endDate: ${endDate.toISOString()}`);
          } else {
            // String date
            endDate = new Date(event.endDate);
            logger.info(`Converted string endDate: ${endDate.toISOString()}`);
          }
          
          // Event is ongoing if end date is today or later
          endDate.setHours(23, 59, 59, 999); // Set to end of day
          isOngoing = endDate >= now;
          logger.info(`Event ${eventName} - ongoing check:`, {
            endDate: endDate.toISOString(),
            now: now.toISOString(),
            isOngoing
          });
        } else if (event.createdAt) {
          // If no endDate, check if event is too old (more than 30 days)
          let createdDate: Date;
          if (event.createdAt && typeof event.createdAt.toDate === 'function') {
            createdDate = event.createdAt.toDate();
          } else {
            createdDate = new Date(event.createdAt);
          }
          
          const daysSinceCreated = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
          isOngoing = daysSinceCreated <= 30; // Only show events created within last 30 days
          
          logger.info(`Event ${eventName} - age check:`, {
            createdDate: createdDate.toISOString(),
            daysSinceCreated,
            isOngoing
          });
        } else {
          logger.info(`Event ${eventName} has no endDate or createdAt - assuming ongoing`);
        }
        
        if (isOngoing) {
          ongoingEvents.push({
            ...event,
            id: doc.id,
            displayName: eventName
          });
          logger.info(`Added ongoing event: ${eventName}`);
        } else {
          logger.info(`Filtered out expired event: ${eventName}`);
        }
      });
    }

    logger.info(`Found ${ongoingEvents.length} ongoing events`);

    const messages = {
      en: {
        title: "*Current Events Available*",
        noEvents: "*Current Events*\n\nNo events currently scheduled.\n\nWe offer:\n• Corporate meetings\n• Wedding celebrations\n• Birthday parties\n• Custom events\n\nReply \"menu\" for more options.",
        footer: "Visit our website to book!\nReply \"menu\" for more options."
      },
      id: {
        title: "*Event Tersedia Saat Ini*",
        noEvents: "*Event Terkini*\n\nTidak ada event yang dijadwalkan saat ini.\n\nKami menyediakan:\n• Rapat korporat\n• Perayaan pernikahan\n• Pesta ulang tahun\n• Event khusus\n\nBalas \"menu\" untuk opsi lainnya.",
        footer: "Kunjungi website kami untuk booking!\nBalas \"menu\" untuk opsi lainnya."
      }
    };

    if (ongoingEvents.length === 0) {
      logger.info("No ongoing events found, sending no events message");
      await sendWhatsAppMessage(phoneNumber, messages[language].noEvents);
      return;
    }

    let message = `${messages[language].title}\n\n`;
    
    ongoingEvents.slice(0, 3).forEach((event, index) => {
      message += `${index + 1}. ${event.displayName}\n`;
      message += `Price: Rp${Number(event.price || 0).toLocaleString()}\n`;
      if (event.duration) {
        message += `Duration: ${event.duration}\n`;
      }
      message += `Min: ${event.minGuests || 1} guests\n`;
      
      // Show end date if available
      if (event.endDate) {
        let endDate: Date;
        if (event.endDate && typeof event.endDate.toDate === 'function') {
          endDate = event.endDate.toDate();
        } else {
          endDate = new Date(event.endDate);
        }
        const dateStr = language === 'id' ? 
          `Berlaku hingga: ${endDate.toLocaleDateString('id-ID')}` :
          `Available until: ${endDate.toLocaleDateString('en-US')}`;
        message += `${dateStr}\n`;
      }
      message += `\n`;
    });

    message += messages[language].footer;
    logger.info("Sending events message to user");
    await sendWhatsAppMessage(phoneNumber, message);
  } catch (error) {
    logger.error("Error getting events", error);
    logger.error("Detailed error:", {
      name: (error as Error)?.name,
      message: (error as Error)?.message,
      stack: (error as Error)?.stack
    });
    const errorMsg = language === 'id' ? 
      "Error mengambil data event. Silakan coba lagi." :
      "Error retrieving events. Please try again.";
    await sendWhatsAppMessage(phoneNumber, errorMsg);
  }
}

// Send booking help
async function sendBookingHelp(phoneNumber: string, language: 'en' | 'id' = 'en') {
  const messages = {
    en: {
      title: "*Booking Assistance*",
      checkStatus: "To check your booking status:",
      checkInstruction: "Please provide your booking ID (e.g., TES353T, BK-ABC123)",
      newBooking: "For new bookings:",
      steps: "• Visit our website\n• Choose your event type\n• Complete payment",
      note: "Your booking ID can be found in your email confirmation.",
      footer: "Reply \"menu\" for more options."
    },
    id: {
      title: "*Bantuan Booking*",
      checkStatus: "Untuk mengecek status booking Anda:",
      checkInstruction: "Silakan berikan ID booking Anda (contoh: TES353T, BK-ABC123)",
      newBooking: "Untuk booking baru:",
      steps: "• Kunjungi website kami\n• Pilih jenis event\n• Selesaikan pembayaran",
      note: "ID booking dapat ditemukan di email konfirmasi Anda.",
      footer: "Balas \"menu\" untuk opsi lainnya."
    }
  };

  // Set session to wait for booking ID
  const currentSession = userSessions.get(phoneNumber) || { 
    isFirstMessage: false, 
    lastInteraction: Date.now(), 
    language: language 
  };
  currentSession.waitingForBookingId = true;
  userSessions.set(phoneNumber, currentSession);

  const msg = messages[language];
  const message = `${msg.title}

${msg.checkStatus}
${msg.checkInstruction}

${msg.newBooking}
${msg.steps}

${msg.note}

${msg.footer}`;

  await sendWhatsAppMessage(phoneNumber, message);
}

// Send help message for unrecognized input
async function sendHelpMessage(phoneNumber: string, language: 'en' | 'id' = 'en') {
  const messages = {
    en: {
      main: "I did not understand your request.",
      options: "Please reply with:",
      option1: "1️⃣ Check booking",
      option2: "2️⃣ Current events", 
      option3: "3️⃣ Payment assistance",
      footer: "Or type \"menu\" to see all options"
    },
    id: {
      main: "Saya tidak memahami permintaan Anda.",
      options: "Silakan balas dengan:",
      option1: "1️⃣ Cek booking",
      option2: "2️⃣ Event terkini",
      option3: "3️⃣ Bantuan pembayaran", 
      footer: "Atau ketik \"menu\" untuk melihat semua opsi"
    }
  };

  const msg = messages[language];
  const message = `${msg.main}

${msg.options}
${msg.option1}
${msg.option2}
${msg.option3}

${msg.footer}`;

  await sendWhatsAppMessage(phoneNumber, message);
}// Check if message is a request for event details
async function checkForEventDetailRequest(messageText: string, language: 'en' | 'id' = 'en'): Promise<boolean> {
  try {
    const normalizedText = messageText.toLowerCase().trim();
    
    // Common event name patterns to check for
    const commonEventNames = ['teswabot', 'tesemail', 'tesqr', 'workshop', 'seminar', 'conference'];
    
    // Check if message matches common event names
    if (commonEventNames.includes(normalizedText)) {
      return true;
    }
    
    // Get available events to check against
    const eventsRef = db.collection('event');
    const querySnapshot = await eventsRef.get();
    
    if (querySnapshot.empty) {
      return false;
    }

    // Check if message matches any event name
    for (const doc of querySnapshot.docs) {
      const event = doc.data();
      
      // Skip booking documents
      if (event.bookingId || event.bookingType === 'event') {
        continue;
      }
      
      const eventName = (event.name || event.title || event.eventName || '').toLowerCase();
      if (eventName && (normalizedText === eventName || eventName.includes(normalizedText))) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    logger.error("Error checking for event detail request", error);
    return false;
  }
}

// Send detailed event information
async function sendEventDetails(phoneNumber: string, eventName: string, language: 'en' | 'id' = 'en') {
  try {
    logger.info(`Searching for event details: ${eventName}`);
    
    const eventsRef = db.collection('event');
    const querySnapshot = await eventsRef.get();
    
    let eventData: any = null;
    
    // Find the specific event
    for (const doc of querySnapshot.docs) {
      const event = doc.data();
      
      // Skip booking documents
      if (event.bookingId || event.bookingType === 'event') {
        continue;
      }
      
      const docEventName = (event.name || event.title || event.eventName || '').toLowerCase();
      if (docEventName === eventName.toLowerCase()) {
        eventData = { ...event, id: doc.id };
        break;
      }
    }
    
    if (!eventData) {
      const errorMsg = language === 'id' ? 
        "Event tidak ditemukan. Ketik '2' untuk melihat semua event yang tersedia." :
        "Event not found. Type '2' to see all available events.";
      await sendWhatsAppMessage(phoneNumber, errorMsg);
      return;
    }

    const messages = {
      en: {
        title: `*${eventData.name || eventData.title || eventData.eventName}*`,
        type: "*Type:*",
        dates: "*Event Dates:*",
        price: "*Price:*",
        minGuests: "*Min Guests:*",
        includes: "*Includes:*",
        description: "*Description:*",
        bookNow: "*Ready to book?* Visit our website or reply 'menu' for more options.",
        perPerson: "/person",
        until: "Available until:",
        from: "from"
      },
      id: {
        title: `*${eventData.name || eventData.title || eventData.eventName}*`,
        type: "*Jenis:*",
        dates: "*Tanggal Event:*",
        price: "*Harga:*",
        minGuests: "*Min Tamu:*",
        includes: "*Termasuk:*",
        description: "*Deskripsi:*",
        bookNow: "*Siap untuk booking?* Kunjungi website kami atau balas 'menu' untuk opsi lainnya.",
        perPerson: "/orang",
        until: "Tersedia hingga:",
        from: "dari"
      }
    };

    const msg = messages[language];
    let message = `${msg.title}\n\n`;
    
    // Add type if available
    if (eventData.type) {
      message += `${msg.type} ${eventData.type}\n\n`;
    }
    
    // Add dates
    if (eventData.startDate && eventData.endDate) {
      let startDate = eventData.startDate;
      let endDate = eventData.endDate;
      
      if (typeof startDate.toDate === 'function') {
        startDate = startDate.toDate();
      } else {
        startDate = new Date(startDate);
      }
      
      if (typeof endDate.toDate === 'function') {
        endDate = endDate.toDate();
      } else {
        endDate = new Date(endDate);
      }
      
      const dateFormat = language === 'id' ? 'id-ID' : 'en-US';
      message += `${msg.dates} ${startDate.toLocaleDateString(dateFormat)} - ${endDate.toLocaleDateString(dateFormat)}\n\n`;
    }
    
    // Add price
    if (eventData.price) {
      message += `${msg.price} Rp${Number(eventData.price).toLocaleString()}${msg.perPerson}\n\n`;
    }
    
    // Add minimum guests
    if (eventData.minGuests) {
      message += `${msg.minGuests} ${eventData.minGuests}\n\n`;
    }
    
    // Add description
    if (eventData.description) {
      message += `${msg.description} ${eventData.description}\n\n`;
    }
    
    // Add includes if available
    if (eventData.includes && Array.isArray(eventData.includes)) {
      message += `${msg.includes}\n`;
      eventData.includes.forEach((item: string) => {
        message += `• ${item}\n`;
      });
      message += `\n`;
    }
    
    message += msg.bookNow;
    
    await sendWhatsAppMessage(phoneNumber, message);
    
    // If there's an image, send it separately
    if (eventData.imageUrl || eventData.image) {
      await sendEventImage(phoneNumber, eventData.imageUrl || eventData.image);
    }
    
  } catch (error) {
    logger.error("Error sending event details", error);
    const errorMsg = language === 'id' ? 
      "Error mengambil detail event. Silakan coba lagi." :
      "Error retrieving event details. Please try again.";
    await sendWhatsAppMessage(phoneNumber, errorMsg);
  }
}

// Send event image
async function sendEventImage(phoneNumber: string, imageUrl: string) {
  try {
  const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || (functionsConfig()?.whatsapp?.access_token as string);
    const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

    const response = await fetch(`https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phoneNumber,
        type: "image",
        image: {
          link: imageUrl
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error("Failed to send image", { status: response.status, error: errorText });
    } else {
      logger.info("Image sent successfully", { to: phoneNumber });
    }
  } catch (error) {
    logger.error("Error sending image", error);
  }
}

// Start booking modification flow
async function startBookingModification(phoneNumber: string, language: 'en' | 'id' = 'en') {
  try {
    const session = userSessions.get(phoneNumber);
    const lastBookingId = session?.lastBookingId;
    
    if (!lastBookingId) {
      const message = language === 'id' ?
        "Tidak ditemukan booking terbaru. Silakan kirim ID booking Anda terlebih dahulu." :
        "No recent booking found. Please send your booking ID first.";
      await sendWhatsAppMessage(phoneNumber, message);
      return;
    }
    
    // Verify booking still exists
    const bookingsRef = db.collection('booking');
    const querySnapshot = await bookingsRef.where("bookingId", "==", lastBookingId).get();
    
    if (querySnapshot.empty) {
      const message = language === 'id' ?
        "Booking tidak ditemukan. Silakan kirim ID booking yang valid." :
        "Booking not found. Please send a valid booking ID.";
      await sendWhatsAppMessage(phoneNumber, message);
      return;
    }

    const booking = querySnapshot.docs[0].data();
    
    // Check if booking can be modified (not cancelled, etc.)
    if (booking.status === 'cancelled') {
      const message = language === 'id' ?
        "Booking yang dibatalkan tidak dapat diubah." :
        "Cancelled bookings cannot be modified.";
      await sendWhatsAppMessage(phoneNumber, message);
      return;
    }

    // Start modification flow
    const currentSession = userSessions.get(phoneNumber) || { 
      isFirstMessage: false, 
      lastInteraction: Date.now(), 
      language: language 
    };
    
    currentSession.bookingModification = {
      bookingId: lastBookingId,
      step: 'awaiting_choice'
    };
    
    userSessions.set(phoneNumber, currentSession);

    const messages = {
      en: {
        title: "*Modify Booking*",
        current: `*Current Booking:* ${lastBookingId}`,
        date: `*Current Date:* ${booking.bookingDate || 'N/A'}`,
        time: `*Current Time:* ${booking.bookingTime || 'N/A'}`,
        options: "*What would you like to change?*",
        option1: "1️⃣ Change Date",
        option2: "2️⃣ Change Time",
        option3: "3️⃣ Change Both",
        option4: "4️⃣ Cancel",
        instruction: "Please reply with 1, 2, 3, or 4:"
      },
      id: {
        title: "*Ubah Booking*",
        current: `*Booking Saat Ini:* ${lastBookingId}`,
        date: `*Tanggal Saat Ini:* ${booking.bookingDate || 'N/A'}`,
        time: `*Waktu Saat Ini:* ${booking.bookingTime || 'N/A'}`,
        options: "*Apa yang ingin Anda ubah?*",
        option1: "1️⃣ Ubah Tanggal",
        option2: "2️⃣ Ubah Waktu",
        option3: "3️⃣ Ubah Keduanya",
        option4: "4️⃣ Batal",
        instruction: "Silakan balas dengan 1, 2, 3, atau 4:"
      }
    };

    const msg = messages[language];
    const message = `${msg.title}

${msg.current}
${msg.date}
${msg.time}

${msg.options}

${msg.option1}
${msg.option2}
${msg.option3}
${msg.option4}

${msg.instruction}`;

    await sendWhatsAppMessage(phoneNumber, message);

  } catch (error) {
    logger.error("Error starting booking modification", error);
    const errorMsg = language === 'id' ? 
      "Error memulai perubahan booking. Silakan coba lagi." :
      "Error starting booking modification. Please try again.";
    await sendWhatsAppMessage(phoneNumber, errorMsg);
  }
}

// Handle booking modification flow
async function handleBookingModification(phoneNumber: string, messageText: string, language: 'en' | 'id' = 'en') {
  try {
    const session = userSessions.get(phoneNumber);
    if (!session?.bookingModification) {
      return;
    }

    const { step } = session.bookingModification;

    switch (step) {
      case 'awaiting_choice':
        await handleModificationChoice(phoneNumber, messageText, language);
        break;
      case 'awaiting_date':
        await handleDateInput(phoneNumber, messageText, language);
        break;
      case 'awaiting_time':
        await handleTimeInput(phoneNumber, messageText, language);
        break;
      case 'confirming':
        await handleConfirmation(phoneNumber, messageText, language);
        break;
    }
  } catch (error) {
    logger.error("Error handling booking modification", error);
    const errorMsg = language === 'id' ? 
      "Error dalam proses perubahan booking. Silakan coba lagi." :
      "Error in booking modification process. Please try again.";
    await sendWhatsAppMessage(phoneNumber, errorMsg);
  }
}

// Handle modification choice (1, 2, 3, or 4)
async function handleModificationChoice(phoneNumber: string, choice: string, language: 'en' | 'id' = 'en') {
  const session = userSessions.get(phoneNumber);
  if (!session?.bookingModification) return;

  const messages = {
    en: {
      datePrompt: "Please enter new date (DD-MM-YYYY format, e.g., 25-12-2025):",
      timePrompt: "Please enter new time (HH:MM format, e.g., 14:30):",
      cancelled: "Booking modification cancelled.",
      invalid: "Invalid choice. Please reply with 1, 2, 3, or 4."
    },
    id: {
      datePrompt: "Silakan masukkan tanggal baru (format DD-MM-YYYY, contoh: 25-12-2025):",
      timePrompt: "Silakan masukkan waktu baru (format HH:MM, contoh: 14:30):",
      cancelled: "Perubahan booking dibatalkan.",
      invalid: "Pilihan tidak valid. Silakan balas dengan 1, 2, 3, atau 4."
    }
  };

  const msg = messages[language];

  switch (choice) {
    case '1': // Change date only
      session.bookingModification.step = 'awaiting_date';
      session.bookingModification.changeType = 'date_only';
      userSessions.set(phoneNumber, session);
      await sendWhatsAppMessage(phoneNumber, msg.datePrompt);
      break;
    case '2': // Change time only
      session.bookingModification.step = 'awaiting_time';
      session.bookingModification.changeType = 'time_only';
      userSessions.set(phoneNumber, session);
      await sendWhatsAppMessage(phoneNumber, msg.timePrompt);
      break;
    case '3': // Change both
      session.bookingModification.step = 'awaiting_date';
      session.bookingModification.changeType = 'both';
      userSessions.set(phoneNumber, session);
      await sendWhatsAppMessage(phoneNumber, msg.datePrompt);
      break;
    case '4': // Cancel
      delete session.bookingModification;
      userSessions.set(phoneNumber, session);
      await sendWhatsAppMessage(phoneNumber, msg.cancelled);
      break;
    default:
      await sendWhatsAppMessage(phoneNumber, msg.invalid);
  }
}

// Handle date input
async function handleDateInput(phoneNumber: string, dateText: string, language: 'en' | 'id' = 'en') {
  const session = userSessions.get(phoneNumber);
  if (!session?.bookingModification) return;

  // Validate date format (DD-MM-YYYY)
  const datePattern = /^\d{2}-\d{2}-\d{4}$/;
  if (!datePattern.test(dateText)) {
    const errorMsg = language === 'id' ?
      "Format tanggal salah. Gunakan format DD-MM-YYYY (contoh: 25-12-2025):" :
      "Invalid date format. Use DD-MM-YYYY format (e.g., 25-12-2025):";
    await sendWhatsAppMessage(phoneNumber, errorMsg);
    return;
  }

  const [day, month, year] = dateText.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);

  // Check if date is in the past
  if (date < today) {
    const errorMsg = language === 'id' ?
      "Tanggal tidak boleh di masa lalu. Silakan masukkan tanggal yang akan datang:" :
      "Date cannot be in the past. Please enter a future date:";
    await sendWhatsAppMessage(phoneNumber, errorMsg);
    return;
  }

  // Get booking information to validate against event dates
  const { bookingId } = session.bookingModification;
  try {
    const bookingsRef = db.collection('booking');
    const querySnapshot = await bookingsRef.where("bookingId", "==", bookingId).get();
    
    if (!querySnapshot.empty) {
      const booking = querySnapshot.docs[0].data();
      const eventName = booking.eventName;
      
      if (eventName) {
        // Get event information for date validation
        const eventsRef = db.collection('event');
        const eventQuery = await eventsRef.where("name", "==", eventName).get();
        
        if (!eventQuery.empty) {
          const eventData = eventQuery.docs[0].data();
          
          if (eventData.startDate && eventData.endDate) {
            const eventStart = new Date(eventData.startDate);
            const eventEnd = new Date(eventData.endDate);
            eventStart.setHours(0, 0, 0, 0);
            eventEnd.setHours(0, 0, 0, 0);
            
            // Check if date is within event range
            if (date < eventStart || date > eventEnd) {
              const startDateStr = eventStart.toLocaleDateString('en-GB');
              const endDateStr = eventEnd.toLocaleDateString('en-GB');
              
              const errorMsg = language === 'id' ?
                `Tanggal ${dateText} tidak dalam periode event. Event "${eventName}" berlangsung dari ${startDateStr} sampai ${endDateStr}. Silakan pilih tanggal dalam rentang ini:` :
                `Date ${dateText} is not within the event period. Event "${eventName}" runs from ${startDateStr} to ${endDateStr}. Please choose a date within this range:`;
              
              await sendWhatsAppMessage(phoneNumber, errorMsg);
              return;
            }
          }
        }
      }
    }
  } catch (error) {
    logger.error("Error validating date against event", error);
    // Continue with basic validation if event validation fails
  }

  session.bookingModification.newDate = dateText;

  // Check if we need to ask for time based on user's original choice
  const changeType = session.bookingModification.changeType;
  
  if (changeType === 'both') {
    // User chose to change both date and time, so ask for time next
    session.bookingModification.step = 'awaiting_time';
    userSessions.set(phoneNumber, session);
    
    const timePrompt = language === 'id' ?
      "Silakan masukkan waktu baru (format HH:MM, contoh: 14:30):" :
      "Please enter new time (HH:MM format, e.g., 14:30):";
    await sendWhatsAppMessage(phoneNumber, timePrompt);
  } else {
    // User chose to change date only, go directly to confirmation
    session.bookingModification.step = 'confirming';
    userSessions.set(phoneNumber, session);
    await showConfirmation(phoneNumber, language);
  }
}

// Handle time input
async function handleTimeInput(phoneNumber: string, timeText: string, language: 'en' | 'id' = 'en') {
  const session = userSessions.get(phoneNumber);
  if (!session?.bookingModification) return;

  // Validate time format (HH:MM)
  const timePattern = /^\d{2}:\d{2}$/;
  if (!timePattern.test(timeText)) {
    const errorMsg = language === 'id' ?
      "Format waktu salah. Gunakan format HH:MM (contoh: 14:30):" :
      "Invalid time format. Use HH:MM format (e.g., 14:30):";
    await sendWhatsAppMessage(phoneNumber, errorMsg);
    return;
  }

  const [hours, minutes] = timeText.split(':');
  if (parseInt(hours) > 23 || parseInt(minutes) > 59) {
    const errorMsg = language === 'id' ?
      "Waktu tidak valid. Silakan masukkan waktu yang benar (HH:MM):" :
      "Invalid time. Please enter a valid time (HH:MM):";
    await sendWhatsAppMessage(phoneNumber, errorMsg);
    return;
  }

  session.bookingModification.newTime = timeText;
  session.bookingModification.step = 'confirming';
  userSessions.set(phoneNumber, session);
  
  await showConfirmation(phoneNumber, language);
}

// Show confirmation
async function showConfirmation(phoneNumber: string, language: 'en' | 'id' = 'en') {
  const session = userSessions.get(phoneNumber);
  if (!session?.bookingModification) return;

  const { bookingId, newDate, newTime } = session.bookingModification;

  const messages = {
    en: {
      title: "✅ *Confirm Changes*",
      booking: `*Booking ID:* ${bookingId}`,
      newDate: newDate ? `*New Date:* ${newDate}` : '',
      newTime: newTime ? `*New Time:* ${newTime}` : '',
      confirm: "*Please confirm your changes:*",
      option1: "1️⃣ Confirm Changes",
      option2: "2️⃣ Make Changes Again",
      option3: "3️⃣ Cancel",
      instruction: "Reply with 1, 2, or 3:"
    },
    id: {
      title: "✅ *Konfirmasi Perubahan*",
      booking: `*Booking ID:* ${bookingId}`,
      newDate: newDate ? `*Tanggal Baru:* ${newDate}` : '',
      newTime: newTime ? `*Waktu Baru:* ${newTime}` : '',
      confirm: "*Silakan konfirmasi perubahan Anda:*",
      option1: "1️⃣ Konfirmasi Perubahan",
      option2: "2️⃣ Buat Perubahan Lagi",
      option3: "3️⃣ Batal",
      instruction: "Balas dengan 1, 2, atau 3:"
    }
  };

  const msg = messages[language];
  let message = `${msg.title}

${msg.booking}`;

  if (newDate) message += `\n${msg.newDate}`;
  if (newTime) message += `\n${msg.newTime}`;

  message += `\n\n${msg.confirm}

${msg.option1}
${msg.option2}
${msg.option3}

${msg.instruction}`;

  await sendWhatsAppMessage(phoneNumber, message);
}

// Handle confirmation
async function handleConfirmation(phoneNumber: string, choice: string, language: 'en' | 'id' = 'en') {
  const session = userSessions.get(phoneNumber);
  if (!session?.bookingModification) return;

  switch (choice) {
    case '1': // Confirm changes
      await applyBookingChanges(phoneNumber, language);
      break;
    case '2': // Make changes again
      await startBookingModification(phoneNumber, language);
      break;
    case '3': // Cancel
      delete session.bookingModification;
      userSessions.set(phoneNumber, session);
      const cancelMsg = language === 'id' ?
        "Perubahan booking dibatalkan." :
        "Booking modification cancelled.";
      await sendWhatsAppMessage(phoneNumber, cancelMsg);
      break;
    default:
      const invalidMsg = language === 'id' ?
        "Pilihan tidak valid. Silakan balas dengan 1, 2, atau 3." :
        "Invalid choice. Please reply with 1, 2, or 3.";
      await sendWhatsAppMessage(phoneNumber, invalidMsg);
  }
}

// Apply booking changes
async function applyBookingChanges(phoneNumber: string, language: 'en' | 'id' = 'en') {
  try {
    const session = userSessions.get(phoneNumber);
    if (!session?.bookingModification) return;

    const { bookingId, newDate, newTime } = session.bookingModification;

    // Update booking in database
    const bookingsRef = db.collection('booking');
    const querySnapshot = await bookingsRef.where("bookingId", "==", bookingId).get();

    if (querySnapshot.empty) {
      const errorMsg = language === 'id' ?
        "Booking tidak ditemukan." :
        "Booking not found.";
      await sendWhatsAppMessage(phoneNumber, errorMsg);
      return;
    }

    const docRef = querySnapshot.docs[0].ref;
    const updateData: any = {
      updatedAt: admin.firestore.Timestamp.now()
    };

    if (newDate) updateData.bookingDate = newDate;
    if (newTime) updateData.bookingTime = newTime;

    await docRef.update(updateData);

    // Clear modification session
    delete session.bookingModification;
    userSessions.set(phoneNumber, session);

    const messages = {
      en: {
        success: "*Booking Updated Successfully!*",
        updated: "Your booking has been updated with the new information.",
        note: "You will receive a confirmation email shortly.",
        menu: "Reply 'menu' for more options."
      },
      id: {
        success: "*Booking Berhasil Diperbarui!*",
        updated: "Booking Anda telah diperbarui dengan informasi baru.",
        note: "Anda akan menerima email konfirmasi sebentar lagi.",
        menu: "Balas 'menu' untuk opsi lainnya."
      }
    };

    const msg = messages[language];
    const successMessage = `${msg.success}

${msg.updated}

${msg.note}

${msg.menu}`;

    await sendWhatsAppMessage(phoneNumber, successMessage);

    logger.info(`Booking ${bookingId} updated successfully`, { newDate, newTime });

  } catch (error) {
    logger.error("Error applying booking changes", error);
    const errorMsg = language === 'id' ?
      "Error menyimpan perubahan. Silakan coba lagi." :
      "Error saving changes. Please try again.";
    await sendWhatsAppMessage(phoneNumber, errorMsg);
  }
}

  // Start new booking flow
  async function startNewBookingFlow(phoneNumber: string, language: 'en' | 'id' = 'en') {
    try {
      // Get available events
      const eventsRef = db.collection('event');
      const querySnapshot = await eventsRef.get();
    
      const availableEvents: any[] = [];
    
      querySnapshot.docs.forEach((doc: any) => {
        const event = doc.data();
      
        // Skip booking documents
        if (event.bookingId || event.bookingType === 'event') {
          return;
        }
      
        // Check if event is active (within date range)
        let isActive = false;
        if (event.startDate && event.endDate) {
          let startDate: Date;
          let endDate: Date;
          
          if (typeof event.startDate.toDate === 'function') {
            startDate = event.startDate.toDate();
          } else {
            startDate = new Date(event.startDate);
          }
          
          if (typeof event.endDate.toDate === 'function') {
            endDate = event.endDate.toDate();
          } else {
            endDate = new Date(event.endDate);
          }
          
          // Set to start/end of day for comparison
          startDate.setHours(0, 0, 0, 0);
          endDate.setHours(23, 59, 59, 999);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          // Event is active if today is between start and end date
          isActive = today >= startDate && today <= endDate;
          
          if (isActive) {
            availableEvents.push({
              id: doc.id,
              name: event.name || event.title || event.eventName,
              price: event.price,
              startDate: startDate,
              endDate: endDate
            });
          }
        }
      });
    
      if (availableEvents.length === 0) {
        const message = language === 'id' ?
          "Maaf, saat ini tidak ada event yang tersedia untuk booking. Silakan coba lagi nanti." :
          "Sorry, there are no events available for booking at the moment. Please try again later.";
        await sendWhatsAppMessage(phoneNumber, message);
        return;
      }
    
      // Initialize booking session
      const currentSession = userSessions.get(phoneNumber) || { 
        isFirstMessage: false, 
        lastInteraction: Date.now(), 
        language: language 
      };
    
      currentSession.newBooking = {
        step: 'selecting_event'
      };
    
      userSessions.set(phoneNumber, currentSession);
    
      // Send event list
      const messages = {
        en: {
          title: "*Book an Event* 🎉",
          subtitle: "Select an event by replying with the number:",
          footer: "Reply 'cancel' to cancel booking"
        },
        id: {
          title: "*Booking Event* 🎉",
          subtitle: "Pilih event dengan membalas nomornya:",
          footer: "Balas 'cancel' untuk membatalkan booking"
        }
      };
    
      const msg = messages[language];
      let message = `${msg.title}\n\n${msg.subtitle}\n\n`;
    
      availableEvents.slice(0, 5).forEach((event, index) => {
        message += `${index + 1}. ${event.name} - Rp${Number(event.price || 0).toLocaleString()}\n`;
      });
    
      message += `\n${msg.footer}`;
    
      await sendWhatsAppMessage(phoneNumber, message);
    
    } catch (error) {
      logger.error("Error starting new booking flow", error);
      const errorMsg = language === 'id' ?
        "Error memulai booking. Silakan coba lagi." :
        "Error starting booking. Please try again.";
      await sendWhatsAppMessage(phoneNumber, errorMsg);
    }
  }

  // Handle new booking flow
  async function handleNewBookingFlow(phoneNumber: string, messageText: string, language: 'en' | 'id' = 'en') {
    try {
      const session = userSessions.get(phoneNumber);
      if (!session?.newBooking) return;
    
      // Allow cancellation at any step
      if (messageText === 'cancel' || messageText === 'batal') {
        delete session.newBooking;
        userSessions.set(phoneNumber, session);
        const cancelMsg = language === 'id' ?
          "Booking dibatalkan. Ketik 'menu' untuk kembali ke menu utama." :
          "Booking cancelled. Type 'menu' to return to main menu.";
        await sendWhatsAppMessage(phoneNumber, cancelMsg);
        return;
      }
    
      const step = session.newBooking.step;
    
      if (step === 'selecting_event') {
        // User selected an event number
        const eventNumber = parseInt(messageText);
        if (isNaN(eventNumber) || eventNumber < 1) {
          const errorMsg = language === 'id' ?
            "Nomor tidak valid. Silakan pilih nomor event yang tersedia." :
            "Invalid number. Please select an available event number.";
          await sendWhatsAppMessage(phoneNumber, errorMsg);
          return;
        }
      
        // Get the event
        const eventsRef = db.collection('event');
        const querySnapshot = await eventsRef.get();
        const availableEvents: any[] = [];
        const now = new Date();
        now.setHours(0, 0, 0, 0);
      
        querySnapshot.docs.forEach((doc: any) => {
          const event = doc.data();
          if (!event.bookingId && event.bookingType !== 'event') {
            // Check if event is active
            let isActive = false;
            if (event.startDate && event.endDate) {
              let startDate: Date;
              let endDate: Date;
              
              if (typeof event.startDate.toDate === 'function') {
                startDate = event.startDate.toDate();
              } else {
                startDate = new Date(event.startDate);
              }
              
              if (typeof event.endDate.toDate === 'function') {
                endDate = event.endDate.toDate();
              } else {
                endDate = new Date(event.endDate);
              }
              
              startDate.setHours(0, 0, 0, 0);
              endDate.setHours(23, 59, 59, 999);
              
              isActive = now >= startDate && now <= endDate;
              
              if (isActive) {
                availableEvents.push({
                  id: doc.id,
                  name: event.name || event.title || event.eventName,
                  price: event.price,
                  startDate: startDate,
                  endDate: endDate
                });
              }
            }
          }
        });
      
        if (eventNumber > availableEvents.length) {
          const errorMsg = language === 'id' ?
            "Nomor event tidak valid. Silakan pilih nomor yang tersedia." :
            "Invalid event number. Please select an available number.";
          await sendWhatsAppMessage(phoneNumber, errorMsg);
          return;
        }
      
        const selectedEvent = availableEvents[eventNumber - 1];
        session.newBooking.eventId = selectedEvent.id;
        session.newBooking.eventName = selectedEvent.name;
        session.newBooking.eventPrice = selectedEvent.price;
        session.newBooking.eventStartDate = selectedEvent.startDate;
        session.newBooking.eventEndDate = selectedEvent.endDate;
        session.newBooking.step = 'awaiting_name';
        userSessions.set(phoneNumber, session);
      
        const namePrompt = language === 'id' ?
          `Event dipilih: *${selectedEvent.name}*\n\nSilakan masukkan nama lengkap Anda (Nama Depan dan Belakang):` :
          `Selected event: *${selectedEvent.name}*\n\nPlease enter your full name (First and Last Name):`;
        await sendWhatsAppMessage(phoneNumber, namePrompt);
      
      } else if (step === 'awaiting_name') {
        // Parse name (first and last)
        const nameParts = messageText.trim().split(' ');
        if (nameParts.length < 2) {
          const errorMsg = language === 'id' ?
            "Silakan masukkan nama lengkap Anda (Nama Depan dan Belakang)." :
            "Please enter your full name (First and Last Name).";
          await sendWhatsAppMessage(phoneNumber, errorMsg);
          return;
        }
      
        session.newBooking.firstName = nameParts[0];
        session.newBooking.lastName = nameParts.slice(1).join(' ');
        session.newBooking.step = 'awaiting_email';
        userSessions.set(phoneNumber, session);
      
        const emailPrompt = language === 'id' ?
          "Silakan masukkan alamat email Anda:" :
          "Please enter your email address:";
        await sendWhatsAppMessage(phoneNumber, emailPrompt);
      
      } else if (step === 'awaiting_email') {
        // Validate email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(messageText)) {
          const errorMsg = language === 'id' ?
            "Format email tidak valid. Silakan masukkan email yang benar." :
            "Invalid email format. Please enter a valid email.";
          await sendWhatsAppMessage(phoneNumber, errorMsg);
          return;
        }
      
        session.newBooking.email = messageText.trim();
        session.newBooking.step = 'awaiting_phone';
        userSessions.set(phoneNumber, session);
      
        const phonePrompt = language === 'id' ?
          "Silakan masukkan nomor telepon Anda:" :
          "Please enter your phone number:";
        await sendWhatsAppMessage(phoneNumber, phonePrompt);
      
      } else if (step === 'awaiting_phone') {
        session.newBooking.phone = messageText.trim();
        session.newBooking.step = 'awaiting_children';
        userSessions.set(phoneNumber, session);
      
        const childrenPrompt = language === 'id' ?
          "Berapa jumlah anak-anak? (Jika tidak ada, ketik 0)" :
          "How many children? (If none, type 0)";
        await sendWhatsAppMessage(phoneNumber, childrenPrompt);
      
      } else if (step === 'awaiting_children') {
        const children = parseInt(messageText);
        if (isNaN(children) || children < 0) {
          const errorMsg = language === 'id' ?
            "Jumlah anak-anak tidak valid. Silakan masukkan angka 0 atau lebih." :
            "Invalid children number. Please enter 0 or more.";
          await sendWhatsAppMessage(phoneNumber, errorMsg);
          return;
        }
      
        session.newBooking.children = children;
        session.newBooking.step = 'awaiting_adults';
        userSessions.set(phoneNumber, session);
      
        const adultsPrompt = language === 'id' ?
          "Berapa jumlah orang dewasa?" :
          "How many adults?";
        await sendWhatsAppMessage(phoneNumber, adultsPrompt);
      
      } else if (step === 'awaiting_adults') {
        const adults = parseInt(messageText);
        if (isNaN(adults) || adults < 1) {
          const errorMsg = language === 'id' ?
            "Jumlah orang dewasa tidak valid. Minimal 1 orang dewasa." :
            "Invalid adult number. Minimum 1 adult required.";
          await sendWhatsAppMessage(phoneNumber, errorMsg);
          return;
        }
      
        session.newBooking.adults = adults;
        session.newBooking.guests = adults + (session.newBooking.children || 0);
        session.newBooking.step = 'awaiting_date';
        userSessions.set(phoneNumber, session);
      
        const datePrompt = language === 'id' ?
          "Silakan masukkan tanggal booking (format: DD/MM/YYYY):" :
          "Please enter booking date (format: DD/MM/YYYY):";
        await sendWhatsAppMessage(phoneNumber, datePrompt);
      
      } else if (step === 'awaiting_date') {
        // Validate date format
        const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
        const match = messageText.match(dateRegex);
      
        if (!match) {
          const errorMsg = language === 'id' ?
            "Format tanggal tidak valid. Gunakan format DD/MM/YYYY (contoh: 15/12/2024)." :
            "Invalid date format. Use DD/MM/YYYY format (example: 15/12/2024).";
          await sendWhatsAppMessage(phoneNumber, errorMsg);
          return;
        }
      
        // Parse date
        const [, day, month, year] = match;
        const bookingDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        bookingDate.setHours(0, 0, 0, 0);
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
      
        // Check if date is in the past
        if (bookingDate < today) {
          const errorMsg = language === 'id' ?
            "Tanggal tidak boleh di masa lalu. Silakan masukkan tanggal yang akan datang:" :
            "Date cannot be in the past. Please enter a future date:";
          await sendWhatsAppMessage(phoneNumber, errorMsg);
          return;
        }
      
        // Check if date is within event period
        const eventStartDate = session.newBooking.eventStartDate;
        const eventEndDate = session.newBooking.eventEndDate;
      
        if (eventStartDate && eventEndDate) {
          if (bookingDate < eventStartDate || bookingDate > eventEndDate) {
            const startStr = eventStartDate.toLocaleDateString('id-ID');
            const endStr = eventEndDate.toLocaleDateString('id-ID');
            
            const errorMsg = language === 'id' ?
              `Tanggal ${messageText} tidak dalam periode event. Event "${session.newBooking.eventName}" berlangsung dari ${startStr} sampai ${endStr}. Silakan pilih tanggal dalam rentang ini:` :
              `Date ${messageText} is not within the event period. Event "${session.newBooking.eventName}" runs from ${startStr} to ${endStr}. Please choose a date within this range:`;
            
            await sendWhatsAppMessage(phoneNumber, errorMsg);
            return;
          }
        }
      
        session.newBooking.bookingDate = messageText.trim();
        session.newBooking.step = 'confirming';
        userSessions.set(phoneNumber, session);
      
        await showBookingConfirmation(phoneNumber, language);
      
      } else if (step === 'confirming') {
        if (messageText === '1' || messageText.toLowerCase() === 'yes' || messageText.toLowerCase() === 'ya') {
          await createBooking(phoneNumber, language);
        } else if (messageText === '2' || messageText.toLowerCase() === 'no' || messageText.toLowerCase() === 'tidak') {
          delete session.newBooking;
          userSessions.set(phoneNumber, session);
          const cancelMsg = language === 'id' ?
            "Booking dibatalkan. Ketik '4' atau 'menu' untuk memulai lagi." :
            "Booking cancelled. Type '4' or 'menu' to start again.";
          await sendWhatsAppMessage(phoneNumber, cancelMsg);
        } else {
          const errorMsg = language === 'id' ?
            "Silakan balas dengan 1 (Ya) atau 2 (Tidak)." :
            "Please reply with 1 (Yes) or 2 (No).";
          await sendWhatsAppMessage(phoneNumber, errorMsg);
        }
      }
    
    } catch (error) {
      logger.error("Error handling new booking flow", error);
      const errorMsg = language === 'id' ?
        "Error memproses booking. Silakan coba lagi." :
        "Error processing booking. Please try again.";
      await sendWhatsAppMessage(phoneNumber, errorMsg);
    }
  }

  // Show booking confirmation
  async function showBookingConfirmation(phoneNumber: string, language: 'en' | 'id' = 'en') {
    const session = userSessions.get(phoneNumber);
    if (!session?.newBooking) return;
  
    const booking = session.newBooking;
    const totalPrice = (booking.eventPrice || 0) * (booking.guests || 1);
  
    const messages = {
      en: {
        title: "*Booking Confirmation*",
        event: `Event: ${booking.eventName}`,
        name: `Name: ${booking.firstName} ${booking.lastName}`,
        email: `Email: ${booking.email}`,
        phone: `Phone: ${booking.phone}`,
        adults: `Adults: ${booking.adults}`,
        children: `Children: ${booking.children}`,
        totalGuests: `Total Guests: ${booking.guests}`,
        date: `Date: ${booking.bookingDate}`,
        price: `Price per person: Rp${Number(booking.eventPrice || 0).toLocaleString()}`,
        total: `Total: Rp${totalPrice.toLocaleString()}`,
        question: "Is this information correct?",
        option1: "1️⃣ Yes, confirm booking",
        option2: "2️⃣ No, cancel"
      },
      id: {
        title: "*Konfirmasi Booking*",
        event: `Event: ${booking.eventName}`,
        name: `Nama: ${booking.firstName} ${booking.lastName}`,
        email: `Email: ${booking.email}`,
        phone: `Telepon: ${booking.phone}`,
        adults: `Dewasa: ${booking.adults}`,
        children: `Anak-anak: ${booking.children}`,
        totalGuests: `Total Tamu: ${booking.guests}`,
        date: `Tanggal: ${booking.bookingDate}`,
        price: `Harga per orang: Rp${Number(booking.eventPrice || 0).toLocaleString()}`,
        total: `Total: Rp${totalPrice.toLocaleString()}`,
        question: "Apakah informasi ini sudah benar?",
        option1: "1️⃣ Ya, konfirmasi booking",
        option2: "2️⃣ Tidak, batal"
      }
    };
  
    const msg = messages[language];
    const message = `${msg.title}

  ${msg.event}
  ${msg.name}
  ${msg.email}
  ${msg.phone}
  ${msg.adults}
  ${msg.children}
  ${msg.totalGuests}
  ${msg.date}

  ${msg.price}
  ${msg.total}

  ${msg.question}

  ${msg.option1}
  ${msg.option2}`;
  
    await sendWhatsAppMessage(phoneNumber, message);
  }

  // Create booking in database
  async function createBooking(phoneNumber: string, language: 'en' | 'id' = 'en') {
    try {
      const session = userSessions.get(phoneNumber);
      if (!session?.newBooking) return;
    
      const booking = session.newBooking;
      const totalPrice = (booking.eventPrice || 0) * (booking.guests || 1);
    
      // Generate booking ID using same logic as website
      const eventName = booking.eventName || 'booking';
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substr(2, 3).toUpperCase();
      
      let bookingId: string;
      if (!eventName || eventName === 'booking') {
        bookingId = `BK${String(timestamp).slice(-6)}`;
      } else {
        const words = eventName.trim().split(/\s+/);
        let abbreviation = '';
        
        if (words.length === 1) {
          // One word: take first 3 letters
          abbreviation = words[0].substring(0, 3).toUpperCase();
        } else if (words.length === 2) {
          // Two words: first 2 letters from first word, first letter from second word
          abbreviation = (words[0].substring(0, 2) + words[1].substring(0, 1)).toUpperCase();
        } else {
          // Three or more words: first letter from each of the first three words
          abbreviation = (words[0].substring(0, 1) + words[1].substring(0, 1) + words[2].substring(0, 1)).toUpperCase();
        }
        
        // Use timestamp last 3 digits + random suffix for uniqueness (same as website)
        const uniqueNumber = String(timestamp).slice(-3) + randomSuffix.slice(0, 1);
        bookingId = `${abbreviation}${uniqueNumber}`;
      }
    
      // Normalize date formats
      let bookingDateRaw = booking.bookingDate || '';
      let bookingDateIso = '';
      let bookingDateTimestamp: admin.firestore.Timestamp | null = null;
      if (bookingDateRaw) {
        // Expect DD/MM/YYYY from WhatsApp flow
        const m = bookingDateRaw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (m) {
          const [_, dd, mm, yyyy] = m;
          bookingDateIso = `${yyyy}-${mm}-${dd}`; // YYYY-MM-DD
          const jsDate = new Date(parseInt(yyyy), parseInt(mm)-1, parseInt(dd));
          bookingDateTimestamp = admin.firestore.Timestamp.fromDate(jsDate);
        } else {
          // Fallback attempt parsing
          const d = new Date(bookingDateRaw);
          if (!isNaN(d.getTime())) {
            bookingDateIso = d.toISOString().substring(0,10);
            bookingDateTimestamp = admin.firestore.Timestamp.fromDate(d);
          }
        }
      }

      // Save to Firestore
      const bookingsRef = db.collection('booking');
      await bookingsRef.add({
        // Identifiers
        bookingId: bookingId,
        bookingType: 'event',
        // Event info
        eventId: booking.eventId,
        eventName: booking.eventName,
        // Customer info
        firstName: booking.firstName,
        lastName: booking.lastName,
        email: booking.email,
        phone: booking.phone,
        // Guests
        adults: booking.adults || 1,
        children: booking.children || 0,
        totalGuests: booking.guests || 1,
        // Schedule
  bookingDate: bookingDateRaw,
  bookingDateIso,
  bookingDateTimestamp,
        bookingTime: "",
        // Package defaults (aligned with client)
        hasPackage: false,
        packageId: null,
        packageName: null,
        packagePeopleCount: null,
        packagePrice: null,
        // Payment
  paymentImageUrl: "",
  paymentStatus: 'pending', // will become 'reviewing' once proof uploaded
        paymentMethod: null,
        // Commerce
        totalPrice: totalPrice,
        status: 'pending',
        // Audit
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
        source: 'whatsapp'
      });
    
      // Clear booking session
      delete session.newBooking;
      // Start payment method selection flow
      session.paymentSelection = { bookingId, step: 'awaiting_method' };
      userSessions.set(phoneNumber, session);
    
      const messages = {
        en: {
          success: "*Booking Successful!* ✅",
          id: `Booking ID: *${bookingId}*`,
          details: "Your booking has been confirmed.",
          paymentIntro: "Please choose a payment method to proceed:",
          menu: "Type 'menu' to return to main menu.",
          selectPrompt: "Reply with 1, 2, 3, or 4 to select bank."
        },
        id: {
          success: "*Booking Berhasil!* ✅",
          id: `ID Booking: *${bookingId}*`,
          details: "Booking Anda telah dikonfirmasi.",
          paymentIntro: "Silakan pilih metode pembayaran:",
          menu: "Ketik 'menu' untuk kembali ke menu utama.",
          selectPrompt: "Balas dengan 1, 2, 3, atau 4 untuk memilih bank."
        }
      };
    
      const msg = messages[language];
      const message = `${msg.success}

${msg.id}

${msg.details}

${msg.paymentIntro}
1️⃣ Mandiri
2️⃣ BNI
3️⃣ BCA
4️⃣ BRI

${msg.selectPrompt}`;
    
      await sendWhatsAppMessage(phoneNumber, message);
    
      logger.info("Booking created successfully", { bookingId, phoneNumber });
    
    } catch (error) {
      logger.error("Error creating booking", error);
      const errorMsg = language === 'id' ?
        "Error menyimpan booking. Silakan coba lagi atau hubungi customer service." :
        "Error saving booking. Please try again or contact customer service.";
      await sendWhatsAppMessage(phoneNumber, errorMsg);
    }
  }// Handle payment proof upload from WhatsApp image
async function handlePaymentProofUpload(phoneNumber: string, bookingId: string, mediaId: string | undefined, language: 'en' | 'id' = 'en') {
  try {
    if (!mediaId) {
      const msg = language === 'id' ? 'Tidak ada gambar yang diterima. Silakan kirim ulang bukti pembayaran sebagai foto.' : 'No image received. Please resend the payment proof as a photo.';
      await sendWhatsAppMessage(phoneNumber, msg);
      return;
    }

    const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
    if (!WHATSAPP_TOKEN) {
      logger.error('Missing WHATSAPP_ACCESS_TOKEN when handling payment proof');
      await sendWhatsAppMessage(phoneNumber, 'Server configuration error. Please try again later.');
      return;
    }

    // 1) Get media URL metadata
    const metaUrl = `https://graph.facebook.com/v18.0/${mediaId}`;
    logger.info('Fetching media metadata', { metaUrl, bookingId });
    const metaRes = await fetch(metaUrl, {
      headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` }
    });
    if (!metaRes.ok) {
      const text = await metaRes.text();
      logger.error('Failed to fetch media metadata', { status: metaRes.status, text, mediaId, bookingId });
      await sendWhatsAppMessage(phoneNumber, language === 'id' ? 'Gagal mengambil media dari WhatsApp.' : 'Failed to fetch media from WhatsApp.');
      return;
    }
    const meta = await metaRes.json();
    logger.info('Media metadata fetched', { mediaId, mime_type: meta?.mime_type, hasUrl: !!meta?.url, file_size: meta?.file_size });
    const mediaUrl: string = meta.url;
    const mimeType: string | undefined = meta.mime_type;
    const fileSize: number | undefined = meta.file_size || meta.fileSize;
    // Enforce basic constraints: image only & size limit (5MB)
    if (!mimeType || !mimeType.startsWith('image/')) {
      await sendWhatsAppMessage(phoneNumber, language === 'id' ? 'File yang dikirim bukan gambar. Kirim ulang sebagai gambar.' : 'The file sent is not an image. Please resend as an image.');
      return;
    }
    if (fileSize && fileSize > 5_000_000) { // 5MB cap
      await sendWhatsAppMessage(phoneNumber, language === 'id' ? 'Gambar terlalu besar (maks 5MB). Kirim gambar dengan ukuran lebih kecil.' : 'Image too large (max 5MB). Please send a smaller image.');
      return;
    }

    // 2) Download binary
    logger.info('Downloading media binary', { mediaUrlMasked: mediaUrl ? mediaUrl.split('?')[0] : null, mimeType });
    const binRes = await fetch(mediaUrl, { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } });
    if (!binRes.ok) {
      const text = await binRes.text();
      logger.error('Failed to download media', { status: binRes.status, text, mediaId, bookingId });
      await sendWhatsAppMessage(phoneNumber, language === 'id' ? 'Gagal mengunduh media dari WhatsApp.' : 'Failed to download media from WhatsApp.');
      return;
    }
    const buffer = Buffer.from(await binRes.arrayBuffer());

    // 3) Upload to Firebase Storage
    const bucket = await resolveActiveBucket();
    logger.info('Uploading media to Storage', { bucket: (bucket as any)?.name, bookingId, overrideUsed: !!explicitBucketEnv });
    const ext = mimeType?.includes('png') ? 'png' : mimeType?.includes('jpeg') || mimeType?.includes('jpg') ? 'jpg' : 'bin';
    const fileName = `payment-proofs/payment_${Date.now()}_${bookingId}.${ext}`;
    const file = bucket.file(fileName);
    try {
      await file.save(buffer, { contentType: mimeType || 'application/octet-stream', resumable: false, public: false });
    } catch (storageErr: any) {
      // Log rich error context for S1 debugging
      logger.error('Storage upload failed', {
        message: storageErr?.message,
        code: storageErr?.code,
        status: storageErr?.status || storageErr?.response?.status,
        errors: storageErr?.errors || storageErr?.response?.data || storageErr?.response?.text,
        bucket: (bucket as any)?.name,
        bookingId,
      });
      await sendWhatsAppMessage(phoneNumber, language === 'id' ? 'Gagal menyimpan file ke Storage (S1).' : 'Failed to store file (S1).');
      return;
    }

    // Generate a short-lived signed URL for viewing
    let signedUrl: string;
    try {
      // Try to get signed URL, fall back to public URL if permissions issue
      try {
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        [signedUrl] = await file.getSignedUrl({ action: 'read', expires: expiresAt });
        logger.info('Generated signed URL for payment proof', { fileName, bookingId, expiresAt: expiresAt.toISOString() });
      } catch (signErr: any) {
        if (signErr?.name === 'SigningError' || signErr?.message?.includes('signBlob')) {
          // Fallback: make file public and use public URL
          logger.warn('Signed URL failed, using public URL', { error: signErr?.message, fileName, bookingId });
          await file.makePublic();
          signedUrl = file.publicUrl();
          logger.info('Using public URL for payment proof', { fileName, bookingId });
        } else {
          throw signErr;
        }
      }
    } catch (signErr) {
      logger.error('URL generation completely failed', { error: (signErr as any)?.message, fileName, bookingId });
      await sendWhatsAppMessage(phoneNumber, language === 'id' ? 'File diupload tapi gagal membuat URL (S2).' : 'File uploaded but failed to create URL (S2).');
      return;
    }

    // 4) Prevent duplicate upload
    const existingSnap = await db.collection('booking').where('bookingId','==',bookingId).limit(1).get();
    if (!existingSnap.empty) {
      const existingData = existingSnap.docs[0].data();
      if (existingData.paymentImageUrl) {
        const alreadyMsg = language==='id' ? 'Bukti pembayaran sudah dikirim. Tidak dapat mengirim ulang.' : 'Payment proof already sent. Cannot resend.';
        await sendWhatsAppMessage(phoneNumber, alreadyMsg);
        return;
      }
    }
    // 5) Update booking document
    try {
      const bookingsRef = db.collection('booking');
      const q = await bookingsRef.where('bookingId', '==', bookingId).limit(1).get();
      if (!q.empty) {
        await q.docs[0].ref.update({
          paymentImageUrl: signedUrl,
          paymentStatus: 'reviewing',
          updatedAt: admin.firestore.Timestamp.now()
        });
        logger.info('Booking updated with payment proof', { bookingId });
      } else {
        logger.warn('Booking for payment upload not found', { bookingId });
        await sendWhatsAppMessage(phoneNumber, language === 'id' ? 'Booking tidak ditemukan saat menyimpan bukti (B1).' : 'Booking not found while saving proof (B1).');
        return;
      }
    } catch (firestoreErr) {
      logger.error('Firestore update failed', { error: (firestoreErr as any)?.message, bookingId });
      await sendWhatsAppMessage(phoneNumber, language === 'id' ? 'Gagal memperbarui booking di database (B2).' : 'Failed to update booking in database (B2).');
      return;
    }

    // Clear payment upload session
    const session = userSessions.get(phoneNumber);
    if (session?.paymentUpload) delete session.paymentUpload;
    if (session) userSessions.set(phoneNumber, session);

    const okMsg = language === 'id'
      ? '✅ Bukti pembayaran berhasil diterima. Status sekarang *Sedang Ditinjau*. Anda akan diberi tahu setelah disetujui.'
      : '✅ Payment proof received. Status is now *Under Review*. You will be notified once approved.';
    await sendWhatsAppMessage(phoneNumber, okMsg);

  } catch (error) {
    logger.error('Error handling payment proof upload', error);
    await sendWhatsAppMessage(phoneNumber, language === 'id' ? 'Terjadi kesalahan saat menyimpan bukti pembayaran.' : 'An error occurred while saving the payment proof.');
  }
}

// Send WhatsApp message
async function sendWhatsAppMessage(phoneNumber: string, message: string) {
  try {
  const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || (functionsConfig()?.whatsapp?.access_token as string);
  const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || (functionsConfig()?.whatsapp?.phone_number_id as string);

    if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
      logger.error("WhatsApp credentials not configured");
      return;
    }

    const url = `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`;
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phoneNumber,
        type: "text",
        text: { body: message }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error("Failed to send message", { status: response.status, error: errorText });
    } else {
      logger.info("Message sent successfully", { to: phoneNumber });
    }
  } catch (error) {
    logger.error("Error sending message", error);
  }
}

// Payment method selection constants (mirroring client side)
const BANK_METHODS: { id: number; code: string; name: string; accountNumber: string; accountName: string; }[] = [
  { id: 1, code: 'MANDIRI', name: 'Mandiri', accountNumber: '1740098288889', accountName: 'Makassar Phinisi Sea Side Hotel' },
  { id: 2, code: 'BNI', name: 'BNI', accountNumber: '8881301303', accountName: 'Makassar Phinisi Sea Side Hotel' },
  { id: 3, code: 'BCA', name: 'BCA', accountNumber: '0253838288', accountName: 'Mks Phinisi Sea Side Hotel' },
  { id: 4, code: 'BRI', name: 'BRI', accountNumber: '064201001310305', accountName: 'PT.Makassar Phinisi Seaside Hotel' }
];

async function handlePaymentMethodSelection(phoneNumber: string, messageText: string, language: 'en' | 'id' = 'en') {
  const session = userSessions.get(phoneNumber);
  if (!session?.paymentSelection) return;
  const bookingId = session.paymentSelection.bookingId;

  // Validate numeric choice
  const choiceNum = parseInt(messageText, 10);
  const selected = BANK_METHODS.find(b => b.id === choiceNum);

  if (!selected) {
    const retryMsg = language === 'id'
      ? `Pilihan tidak valid. Silakan pilih:
1️⃣ Mandiri
2️⃣ BNI
3️⃣ BCA
4️⃣ BRI`
      : `Invalid selection. Please choose:
1️⃣ Mandiri
2️⃣ BNI
3️⃣ BCA
4️⃣ BRI`;
    await sendWhatsAppMessage(phoneNumber, retryMsg);
    return;
  }

  try {
    // Update booking document with paymentMethod
    const bookingsRef = db.collection('booking');
    const q = await bookingsRef.where('bookingId', '==', bookingId).limit(1).get();
    if (!q.empty) {
      await q.docs[0].ref.update({
        paymentMethod: selected.code,
        updatedAt: admin.firestore.Timestamp.now()
      });
    }

    // Clear payment selection, start payment upload state
    delete session.paymentSelection;
    session.paymentUpload = { bookingId };
    userSessions.set(phoneNumber, session);

    const bankInfo = language === 'id'
      ? `Metode pembayaran dipilih: *${selected.name}*\nNo Rekening: *${selected.accountNumber}*\nNama: *${selected.accountName}*\n\nSilakan lakukan transfer sesuai total dan kirim foto bukti pembayaran di chat ini sekarang.`
      : `Payment method selected: *${selected.name}*\nAccount Number: *${selected.accountNumber}*\nAccount Name: *${selected.accountName}*\n\nPlease make the transfer for the total amount and send a photo of the payment proof here now.`;

    await sendWhatsAppMessage(phoneNumber, bankInfo);
  } catch (error) {
    logger.error('Error updating payment method', error);
    await sendWhatsAppMessage(phoneNumber, language === 'id' ? 'Terjadi kesalahan saat menyimpan metode pembayaran.' : 'An error occurred while saving payment method.');
  }
}

// Reactivate payment proof upload flow for a booking
async function reactivatePaymentProof(phoneNumber: string, bookingId: string, language: 'en' | 'id' = 'en') {
  try {
    // Validate booking exists
    const bookingsRef = db.collection('booking');
    const q = await bookingsRef.where('bookingId', '==', bookingId).limit(1).get();
    if (q.empty) {
      const notFound = language === 'id'
        ? `Booking dengan ID ${bookingId} tidak ditemukan.`
        : `Booking with ID ${bookingId} not found.`;
      await sendWhatsAppMessage(phoneNumber, notFound);
      return;
    }
    // Reactivate payment upload state
    const session = userSessions.get(phoneNumber) || { isFirstMessage: false, lastInteraction: Date.now(), language: language };
    session.paymentUpload = { bookingId };
    userSessions.set(phoneNumber, session);
    const msg = language === 'id'
      ? `Silakan kirim foto bukti pembayaran terbaru untuk *${bookingId}* sekarang.`
      : `Please send the latest payment proof photo for *${bookingId}* now.`;
    await sendWhatsAppMessage(phoneNumber, msg);
  } catch (error) {
    logger.error('Error reactivating payment proof', error);
    await sendWhatsAppMessage(phoneNumber, language === 'id' ? 'Terjadi kesalahan saat mengaktifkan ulang unggah bukti.' : 'An error occurred while reactivating proof upload.');
  }
}