// Debug script to check event data structure
const admin = require('firebase-admin');

// Initialize Firebase Admin (using your existing config)
const serviceAccount = require('./reservationweb-4b61a-firebase-adminsdk-g0azr-30a0e5c3d8.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function debugEvents() {
  try {
    console.log('🔍 Checking events in Firestore collection "event"...\n');
    
    const eventsRef = db.collection('event');
    const snapshot = await eventsRef.get();
    
    console.log(`📊 Found ${snapshot.docs.length} events in total\n`);
    
    if (snapshot.docs.length === 0) {
      console.log('❌ No events found in the collection!');
      return;
    }
    
    snapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      console.log(`📅 Event ${index + 1}:`);
      console.log(`   ID: ${doc.id}`);
      console.log(`   Name: ${data.name || 'No name'}`);
      console.log(`   Price: ${data.price || 'No price'}`);
      console.log(`   Start Date: ${data.startDate || 'No start date'}`);
      console.log(`   End Date: ${data.endDate || 'No end date'}`);
      console.log(`   Created At: ${data.createdAt || 'No createdAt'}`);
      console.log(`   Duration: ${data.duration || 'No duration'}`);
      console.log(`   Min Guests: ${data.minGuests || 'No min guests'}`);
      
      // Check if endDate is in the future
      if (data.endDate) {
        let endDate;
        if (data.endDate && typeof data.endDate.toDate === 'function') {
          endDate = data.endDate.toDate();
        } else {
          endDate = new Date(data.endDate);
        }
        
        const now = new Date();
        const isOngoing = endDate >= now;
        console.log(`   End Date Parsed: ${endDate.toISOString()}`);
        console.log(`   Is Ongoing: ${isOngoing ? '✅ YES' : '❌ NO (expired)'}`);
      } else {
        console.log(`   Is Ongoing: ✅ YES (no end date)`);
      }
      
      console.log('   ---');
    });
    
  } catch (error) {
    console.error('❌ Error debugging events:', error);
  }
}

debugEvents().then(() => {
  console.log('\n✅ Debug complete!');
  process.exit(0);
}).catch(error => {
  console.error('❌ Debug failed:', error);
  process.exit(1);
});