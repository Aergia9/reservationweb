const admin = require('firebase-admin');

// Initialize with the same configuration used by functions
admin.initializeApp();
const db = admin.firestore();

async function testEventRetrieval() {
  try {
    console.log('🔍 Testing event retrieval from Firestore...\n');
    
    const eventsRef = db.collection('event');
    let querySnapshot;
    
    // Try with different orderings
    try {
      console.log('Trying with createdAt ordering...');
      querySnapshot = await eventsRef.orderBy('createdAt', 'desc').get();
    } catch (orderError) {
      console.log('createdAt field not found, trying without ordering...');
      querySnapshot = await eventsRef.get();
    }
    
    console.log(`📊 Found ${querySnapshot.docs.length} total events\n`);
    
    if (querySnapshot.docs.length === 0) {
      console.log('❌ No events found in collection "event"');
      
      // Check if events exist in other collections
      console.log('\n🔍 Checking alternative collection names...');
      const alternativeCollections = ['special-events', 'events', 'Event'];
      
      for (const collectionName of alternativeCollections) {
        try {
          const altSnapshot = await db.collection(collectionName).get();
          console.log(`📊 Collection "${collectionName}": ${altSnapshot.docs.length} documents`);
        } catch (error) {
          console.log(`❌ Collection "${collectionName}": Error accessing`);
        }
      }
      return;
    }
    
    // Process ongoing events
    const now = new Date();
    console.log(`🕒 Current time: ${now.toISOString()}\n`);
    
    let ongoingCount = 0;
    
    querySnapshot.docs.forEach((doc, index) => {
      const event = doc.data();
      console.log(`📅 Event ${index + 1}:`);
      console.log(`   ID: ${doc.id}`);
      console.log(`   Name: ${event.name || 'No name'}`);
      console.log(`   Price: ${event.price || 'No price'}`);
      console.log(`   EndDate Type: ${typeof event.endDate}`);
      console.log(`   EndDate Value: ${event.endDate}`);
      
      // Check if ongoing
      let isOngoing = true;
      if (event.endDate) {
        let endDate;
        if (event.endDate && typeof event.endDate.toDate === 'function') {
          endDate = event.endDate.toDate();
          console.log(`   Converted Timestamp: ${endDate.toISOString()}`);
        } else {
          endDate = new Date(event.endDate);
          console.log(`   Converted String: ${endDate.toISOString()}`);
        }
        
        endDate.setHours(23, 59, 59, 999);
        isOngoing = endDate >= now;
        console.log(`   Is Ongoing: ${isOngoing ? '✅ YES' : '❌ NO'}`);
      } else {
        console.log(`   Is Ongoing: ✅ YES (no end date)`);
      }
      
      if (isOngoing) ongoingCount++;
      console.log('   ---');
    });
    
    console.log(`\n📊 Summary:`);
    console.log(`   Total events: ${querySnapshot.docs.length}`);
    console.log(`   Ongoing events: ${ongoingCount}`);
    console.log(`   Expired events: ${querySnapshot.docs.length - ongoingCount}`);
    
  } catch (error) {
    console.error('❌ Error testing event retrieval:', error);
  }
}

testEventRetrieval().then(() => {
  console.log('\n✅ Test complete!');
  process.exit(0);
}).catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});