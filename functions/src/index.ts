import {setGlobalOptions} from "firebase-functions";
import {onRequest} from "firebase-functions/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK
const app = admin.initializeApp();

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
}>();

// For cost control, set maximum number of containers
setGlobalOptions({ maxInstances: 10 });

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

      logger.info("Webhook verification attempt", {
        mode,
        token,
        challenge,
        expectedToken: process.env.WHATSAPP_VERIFY_TOKEN
      });

      // Verify token
      const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "WhatsApp9Kx7mN2vE8qR5wZ3uC6pL4tY";
      
      if (mode === "subscribe" && token === VERIFY_TOKEN) {
        logger.info("Webhook verified successfully");
        response.status(200).send(challenge);
        return;
      } else {
        logger.error("Webhook verification failed", {
          receivedMode: mode,
          receivedToken: token,
          expectedToken: VERIFY_TOKEN
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
        logger.error("Error testing events", error);
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
    logger.error("Error in WhatsApp webhook", error);
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

// Process incoming WhatsApp messages
async function processWhatsAppMessage(messageData: any) {
  try {
    if (!messageData.messages) return;

    for (const message of messageData.messages) {
      const phoneNumber = message.from;
      const messageText = message.text?.body?.toLowerCase().trim() || "";
      const messageType = message.type;

      logger.info("Message received", { from: phoneNumber, text: messageText, type: messageType });

      // Only process text messages
      if (messageType !== "text") {
        await sendWelcomeMenu(phoneNumber);
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

      const userLanguage = getUserLanguage(phoneNumber) || 'en';

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
        await sendPaymentHelp(phoneNumber, userLanguage);
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
      option3: "3️⃣ Payment assistance",
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
      option3: "3️⃣ Bantuan pembayaran",
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
    const status = booking.paymentStatus === "approved" ? "Confirmed" : "Pending Approval";
    
    const message = `*Booking Information*

*ID:* ${booking.bookingId}
*Event:* ${booking.eventName || 'N/A'}
*Customer:* ${booking.firstName} ${booking.lastName}
*Date:* ${booking.bookingDate || 'N/A'}
*Guests:* ${booking.totalGuests || booking.guests || 'N/A'}
*Total:* Rp${booking.totalPrice?.toLocaleString() || 'N/A'}
*Status:* ${status}

${booking.paymentStatus === "approved" 
  ? "Your booking is confirmed." 
  : "Your payment is being reviewed."}

${language === 'id' 
  ? "*Ingin mengubah booking?* Ketik 'edit' untuk mengubah tanggal/waktu.\n\nBalas 'menu' untuk opsi lainnya." 
  : "*Want to modify your booking?* Type 'edit' to change date/time.\n\nReply 'menu' for more options."}`;

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
}// Send payment help
async function sendPaymentHelp(phoneNumber: string, language: 'en' | 'id' = 'en') {
  const messages = {
    en: {
      title: "*Payment Assistance*",
      process: "Payment Process:",
      steps: "1. Complete booking on website\n2. Upload payment proof\n3. Admin reviews (24 hours)\n4. Email confirmation sent",
      checkStatus: "Send your booking ID to check payment status.",
      footer: "Reply \"menu\" for more options."
    },
    id: {
      title: "*Bantuan Pembayaran*",
      process: "Proses Pembayaran:",
      steps: "1. Selesaikan booking di website\n2. Upload bukti pembayaran\n3. Admin review (24 jam)\n4. Email konfirmasi dikirim",
      checkStatus: "Kirim ID booking untuk cek status pembayaran.",
      footer: "Balas \"menu\" untuk opsi lainnya."
    }
  };

  const msg = messages[language];
  const message = `${msg.title}

${msg.process}
${msg.steps}

${msg.checkStatus}

${msg.footer}`;
  
  await sendWhatsAppMessage(phoneNumber, message);
}

/*
// Send event info (UNUSED - option 4 removed)
async function sendEventInfo(phoneNumber: string) {
  const message = `🎉 *Event Services*

We offer:
🏢 Corporate events
💍 Weddings
🎊 Birthday parties
🍽️ Catering services

Features:
• Professional planning
• Scenic waterfront venue
• Equipment included
• Photography services

Visit our website to book!

Reply "menu" for more options.`;
  
  await sendWhatsAppMessage(phoneNumber, message);
}
*/

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
    const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
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

// Send WhatsApp message
async function sendWhatsAppMessage(phoneNumber: string, message: string) {
  try {
    const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
    const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

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