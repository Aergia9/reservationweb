# WhatsApp Business API Integration

This Firebase Function provides automated customer service through WhatsApp Business API integration.

## Features

### 🤖 Automated Customer Service
- **Booking Status Inquiries**: Customers can check their booking status by sending their booking ID
- **Payment Information**: Automated responses about payment processes and status
- **Event Information**: Details about available services and event planning
- **General Help**: Comprehensive assistance menu and guidance

### 📱 Smart Message Processing
- **Booking ID Recognition**: Automatically detects booking IDs (format: BK-XXXXXX)
- **Keyword-based Responses**: Responds to common keywords in multiple languages
- **Fallback Responses**: Helpful guidance for unrecognized messages

### 🔗 Integration with Existing System
- **Firestore Integration**: Directly queries your existing booking database
- **Email Service Compatible**: Works alongside your existing email notification system
- **Analytics Tracking**: Logs customer inquiries for service improvement

## Setup Instructions

### 1. WhatsApp Business API Setup

1. **Create Meta Business Account**
   - Go to [Meta Business Manager](https://business.facebook.com)
   - Create or use existing business account

2. **Set Up WhatsApp Business API**
   - Navigate to WhatsApp Business API in Meta Business Manager
   - Create a WhatsApp Business Account
   - Add a phone number
   - Get your Phone Number ID and Access Token

### 2. Firebase Configuration

1. **Set Environment Variables**
   ```bash
   # Copy the example environment file
   cp .env.example .env
   
   # Edit .env with your actual values
   WHATSAPP_ACCESS_TOKEN=your_access_token_here
   WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id_here
   WHATSAPP_VERIFY_TOKEN=your_custom_verify_token
   ```

2. **Deploy Firebase Function**
   ```bash
   # Build and deploy
   npm run build
   firebase deploy --only functions
   ```

3. **Configure Firebase Environment**
   ```bash
   # Set environment variables in Firebase
   firebase functions:config:set whatsapp.access_token="your_access_token"
   firebase functions:config:set whatsapp.phone_number_id="your_phone_number_id"
   firebase functions:config:set whatsapp.verify_token="your_verify_token"
   ```

### 3. Webhook Configuration

1. **Get Your Function URL**
   After deployment, you'll get a URL like:
   ```
   https://us-central1-reservationweb-4b61a.cloudfunctions.net/whatsappWebhook
   ```

2. **Configure Webhook in Meta Business Manager**
   - Go to WhatsApp Business API settings
   - Add webhook URL: `https://your-function-url/whatsappWebhook`
   - Set verify token (same as WHATSAPP_VERIFY_TOKEN)
   - Subscribe to "messages" field

## How It Works

### Customer Interaction Flow

1. **Customer sends WhatsApp message** to your business number
2. **WhatsApp Business API** forwards message to your webhook
3. **Firebase Function** processes the message:
   - Identifies booking IDs
   - Recognizes keywords
   - Queries Firestore for booking data
   - Sends appropriate response

### Message Types Handled

#### Booking Inquiries
```
Customer: "Hi, what's the status of booking BK-ABC123?"
Bot: Retrieves booking details and status from Firestore
```

#### General Keywords
- "booking", "reservation" → Booking help information
- "payment", "bayar" → Payment assistance
- "event", "acara" → Event services information
- "help", "bantuan" → General assistance menu

#### Booking ID Format
- Automatically detects: `BK-ABC123`, `EV-XYZ789`, etc.
- Pattern: 2 letters + dash + 6 alphanumeric characters

### Response Examples

#### Booking Status Response
```
📋 Booking Information

Booking ID: BK-ABC123
Event: Corporate Meeting
Customer: John Doe
Date: Friday, December 15, 2023
Time: 2:00 PM
Guests: 25 people
Total: Rp2,500,000
Status: ✅ Confirmed

🎉 Your booking is confirmed! We look forward to hosting your event.
```

#### Help Menu Response
```
👋 Welcome to Makassar Phinisi Sea Side Hotel

I can help you with:

🔍 Booking Status
Send your booking ID (format: BK-ABC123)

💳 Payment Info
Send "payment" for payment assistance

🎉 Event Services
Send "event" for event information

How can I assist you today? 😊
```

## Cost Optimization

### WhatsApp Messaging Costs
- **Customer-initiated conversations**: FREE
- **Business-initiated conversations**: Paid
- **This implementation**: Uses only customer-initiated flows (FREE)

### Firebase Functions Costs
- **Estimated monthly cost**: ~$0.20 for typical usage
- **Cost factors**: Function invocations, compute time, bandwidth
- **Optimization**: 10 concurrent instances maximum

## Monitoring & Analytics

### Logs and Debugging
```bash
# View function logs
firebase functions:log

# View real-time logs
firebase functions:log --only whatsappWebhook
```

### Analytics Collection
The function automatically logs:
- Customer phone numbers (anonymized)
- Booking ID inquiries
- Message types and frequency
- Response times

### Error Handling
- **Invalid booking IDs**: Helpful error messages
- **API failures**: Graceful fallbacks
- **Database errors**: Automatic retry with user notification

## Testing

### Local Testing
```bash
# Start local emulator
npm run serve

# Test webhook verification
curl -X GET "http://localhost:5001/reservationweb-4b61a/us-central1/whatsappWebhook?hub.mode=subscribe&hub.verify_token=your_verify_token&hub.challenge=test_challenge"
```

### Production Testing
1. Send test message to your WhatsApp Business number
2. Check Firebase Function logs
3. Verify database queries work correctly

## Security Considerations

### Token Security
- Store tokens in Firebase environment configuration
- Never commit tokens to version control
- Rotate tokens regularly

### Webhook Verification
- Always verify webhook requests from WhatsApp
- Use strong, unique verify tokens
- Monitor for suspicious activity

### Data Privacy
- Log minimal customer information
- Comply with data protection regulations
- Implement data retention policies

## Troubleshooting

### Common Issues

#### "Webhook verification failed"
- Check verify token matches in both places
- Ensure webhook URL is correct
- Verify HTTPS is enabled

#### "Messages not being received"
- Check webhook subscription in Meta Business Manager
- Verify phone number is correctly configured
- Check Firebase Function logs for errors

#### "Booking not found"
- Verify booking ID format in database
- Check Firestore collection name ("bookings")
- Ensure proper field indexing

### Support Resources
- [WhatsApp Business API Documentation](https://developers.facebook.com/docs/whatsapp)
- [Firebase Functions Documentation](https://firebase.google.com/docs/functions)
- [Meta Business Manager](https://business.facebook.com)

## Extension Ideas

### Advanced Features You Can Add
1. **Multi-language Support**: Detect language and respond accordingly
2. **Rich Media**: Send images, documents, or interactive buttons
3. **Appointment Scheduling**: Allow customers to book directly via WhatsApp
4. **Payment Links**: Send secure payment links through WhatsApp
5. **Event Reminders**: Automated event reminders via WhatsApp

### Integration Opportunities
1. **CRM Integration**: Sync customer interactions with CRM systems
2. **Analytics Dashboard**: Create admin dashboard for WhatsApp metrics
3. **AI Enhancement**: Add natural language processing for better understanding
4. **Voice Messages**: Handle voice message transcription and responses