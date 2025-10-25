# 📧 Automated Email System Documentation

## Overview
The booking system now includes automated email notifications using Firebase's Email Trigger extension. Emails are sent automatically at key points in the booking process.

## 🎯 Email Types

### 1. **Booking Confirmation Email**
**When:** Sent immediately after customer completes booking and uploads payment proof
**To:** Customer's email address
**Content:**
- Booking confirmation with ID
- Event details (name, date, time, guests, price)
- Payment review notice
- Instructions to keep booking ID

### 2. **Payment Confirmation Email**
**When:** Sent when admin approves/confirms payment in admin dashboard
**To:** Customer's email address  
**Content:**
- Payment approval confirmation
- Booking completion notice
- Instructions for event day

## ⚙️ How It Works

### Technical Implementation

1. **Firebase Email Extension Setup**
   - Uses `mail` collection in Firestore
   - Each email document triggers automatic sending
   - Supports HTML and plain text formats

2. **Email Service (`/lib/emailService.ts`)**
   ```typescript
   emailService.sendBookingConfirmation(bookingData)
   emailService.sendPaymentConfirmation(paymentData)
   ```

3. **Integration Points**
   - **Event Bookings:** `payment-info-popup.tsx` 
   - **Room Bookings:** `room-booking-popup.tsx`
   - **Admin Confirmations:** `bookings-data-table.tsx`

### Document Structure
```json
{
  "to": ["customer@example.com"],
  "message": {
    "subject": "Email Subject",
    "html": "HTML content",
    "text": "Plain text content"
  }
}
```

## 🔧 Configuration Required

### 1. Firebase Email Extension
Make sure the Firebase Email Trigger extension is properly configured with:
- SMTP settings (SendGrid, Gmail, etc.)
- Proper authentication
- Mail collection access

### 2. Firestore Security Rules
Ensure the `mail` collection has proper write permissions:
```javascript
// Allow email writing for authenticated users
match /mail/{document} {
  allow create: if request.auth != null;
}
```

## 📝 Email Templates

### Booking Confirmation Template Features
- ✅ Professional HTML design
- ✅ Responsive layout
- ✅ Booking details table
- ✅ Payment review notice
- ✅ Company branding
- ✅ Fallback plain text version

### Payment Confirmation Template Features
- ✅ Success-focused design
- ✅ Clear confirmation message
- ✅ Event day instructions
- ✅ Professional styling
- ✅ Fallback plain text version

## 🚀 Testing

To test the email system:

1. **Manual Test via Firestore Console:**
   ```json
   // Add to 'mail' collection
   {
     "to": ["test@example.com"],
     "message": {
       "subject": "Test Email",
       "text": "This is a test email",
       "html": "<h1>Test Email</h1>"
     }
   }
   ```

2. **End-to-End Test:**
   - Make a booking with valid email
   - Check customer receives booking confirmation
   - Admin approves payment
   - Check customer receives payment confirmation

## 🔍 Monitoring

### Email Delivery Status
Check Firestore `mail` collection documents for:
- `delivery.state`: success/error/pending
- `delivery.info`: delivery details
- `delivery.error`: error messages if failed

### Logs
Monitor console for:
- `Booking confirmation email sent successfully`
- `Payment confirmation email sent successfully` 
- Email error messages

## 🛠️ Troubleshooting

### Common Issues

1. **Emails not sending:**
   - Check Firebase Email extension configuration
   - Verify SMTP settings
   - Check Firestore permissions

2. **Email content issues:**
   - Verify data passed to email service
   - Check template formatting
   - Test with simpler content first

3. **Missing customer data:**
   - Ensure booking forms capture email correctly
   - Verify data is saved to Firestore
   - Check booking data structure

### Debug Steps
1. Check console logs for errors
2. Verify Firestore `mail` collection has documents
3. Check email extension logs in Firebase console
4. Test with simple manual email first

## 📞 Support Information

For email delivery issues:
- Check Firebase Email extension documentation
- Verify email provider (SendGrid, etc.) configuration
- Monitor Firebase extension logs
- Test email delivery status in Firestore

---

*This email system provides professional, automated communication that enhances customer experience and reduces manual admin work.*