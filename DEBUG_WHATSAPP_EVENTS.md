# 🔧 Debug Guide: WhatsApp Bot Event Issue

## Issue Description
WhatsApp bot shows "Error mengambil data event" even though 2 active events exist in web interface.

## Enhanced Debugging Features Added

### 1. **Comprehensive Logging**
The WhatsApp bot now logs detailed information:
- Total events found in database
- Each event processing details (name, price, endDate)
- Date conversion logic (Timestamp vs String)
- Ongoing event filtering results
- Error details with stack traces

### 2. **Improved Error Handling**
- Handles missing `createdAt` field gracefully
- Better date parsing for different formats
- Detailed error reporting for troubleshooting

### 3. **Robust Query Logic**
- Fallback to unordered query if `createdAt` field missing
- Enhanced null/undefined checks
- Better field validation

## Testing Your Enhanced Bot

### **Step 1: Test WhatsApp Bot**
1. Send **"2"** to your WhatsApp Business number
2. The bot will now log detailed information to Firebase Functions logs

### **Step 2: Check Firebase Logs**
```
firebase functions:log --only whatsappWebhook
```

### **Step 3: Look for These Log Messages**
- `Getting events from Firestore collection 'event'`
- `Found X total events in database`
- `Processing event: [name]` with details
- `Event [name] - ongoing check:` with date comparisons
- `Added ongoing event: [name]` or `Filtered out expired event: [name]`
- `Found X ongoing events`

## Possible Issues & Solutions

### **Issue 1: Collection Name Mismatch**
- **Check**: Events stored in different collection name
- **Solution**: Update collection name in WhatsApp function

### **Issue 2: Date Format Problems**
- **Check**: `endDate` field format in Firestore
- **Solution**: Ensure dates are stored as Firestore Timestamps

### **Issue 3: Missing Fields**
- **Check**: Required fields (`name`, `price`, `endDate`) missing
- **Solution**: Add missing fields to event documents

### **Issue 4: Date Filtering Logic**
- **Check**: Events filtered out due to date logic
- **Solution**: Verify `endDate` values and current date comparison

## Expected Event Data Structure

Your events should have these fields in Firestore:
```json
{
  "name": "Event Name",
  "price": 1000000,
  "description": "Event description",
  "endDate": "Firestore Timestamp or Date String",
  "startDate": "Firestore Timestamp or Date String", 
  "duration": "Event duration",
  "minGuests": 10,
  "createdAt": "Firestore Timestamp"
}
```

## Quick Test Commands

### **Test WhatsApp Bot:**
Send to your WhatsApp number: `2`

### **Check Logs:**
```bash
cd c:\tesprogram\KP\reservationweb\functions
firebase functions:log --only whatsappWebhook --limit 20
```

### **View Firestore Data:**
Check Firebase Console → Firestore Database → `event` collection

## Next Steps

1. **Test the bot** by sending "2" to WhatsApp
2. **Check the logs** to see detailed processing information
3. **Share the log output** so we can identify the exact issue
4. **Verify Firestore data** structure matches expected format

The enhanced logging will help us pinpoint exactly where the issue occurs! 🎯