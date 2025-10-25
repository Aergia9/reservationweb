import { collection, addDoc } from 'firebase/firestore'
import { db } from './firebase'

interface BookingEmailData {
  bookingId: string
  eventName: string
  customerName: string
  bookingDate: string
  bookingTime: string
  totalGuests: number
  totalPrice: number
  email: string
}

interface PaymentConfirmationData {
  bookingId: string
  eventName: string
  customerName: string
  email: string
}

export const emailService = {
  // Send booking confirmation email
  async sendBookingConfirmation(bookingData: BookingEmailData) {
    try {
      const emailDoc = {
        to: [bookingData.email],
        message: {
          subject: `Booking Confirmation - ${bookingData.eventName} (ID: ${bookingData.bookingId})`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
                .header { background-color: #f8f9fa; padding: 20px; text-align: center; }
                .content { padding: 20px; }
                .booking-details { background-color: #f8f9fa; padding: 15px; margin: 20px 0; border-radius: 5px; }
                .footer { background-color: #e9ecef; padding: 20px; text-align: center; font-size: 12px; color: #6c757d; }
                .booking-id { font-size: 18px; font-weight: bold; color: #28a745; }
                .important { background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; margin: 20px 0; border-radius: 5px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>🎉 Booking Confirmation</h1>
                  <p class="booking-id">Booking ID: ${bookingData.bookingId}</p>
                </div>
                
                <div class="content">
                  <h2>Dear ${bookingData.customerName},</h2>
                  <p>Thank you for your booking! We have received your reservation and payment proof.</p>
                  
                  <div class="booking-details">
                    <h3>📋 Booking Details</h3>
                    <p><strong>Event:</strong> ${bookingData.eventName}</p>
                    <p><strong>Booking ID:</strong> ${bookingData.bookingId}</p>
                    <p><strong>Date:</strong> ${new Date(bookingData.bookingDate).toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}</p>
                    <p><strong>Time:</strong> ${bookingData.bookingTime || 'TBD'}</p>
                    <p><strong>Total Guests:</strong> ${bookingData.totalGuests} people</p>
                    <p><strong>Total Amount:</strong> Rp${bookingData.totalPrice.toLocaleString()}</p>
                  </div>
                  
                  <div class="important">
                    <h3>⏳ Payment Review</h3>
                    <p>Our admin team is currently reviewing your payment proof. You will receive a confirmation email once your payment has been verified and approved.</p>
                    <p><strong>Please keep your Booking ID (${bookingData.bookingId}) for reference.</strong></p>
                  </div>
                  
                  <p>If you have any questions, please contact us with your booking ID.</p>
                  <p>Thank you for choosing our service!</p>
                </div>
                
                <div class="footer">
                  <p>This is an automated email. Please do not reply to this message.</p>
                  <p>© ${new Date().getFullYear()} Makassar Phinisi Sea Side Hotel</p>
                </div>
              </div>
            </body>
            </html>
          `,
          text: `
Booking Confirmation - ${bookingData.eventName}

Dear ${bookingData.customerName},

Thank you for your booking! We have received your reservation and payment proof.

Booking Details:
- Event: ${bookingData.eventName}
- Booking ID: ${bookingData.bookingId}
- Date: ${new Date(bookingData.bookingDate).toLocaleDateString()}
- Time: ${bookingData.bookingTime || 'TBD'}
- Total Guests: ${bookingData.totalGuests} people
- Total Amount: Rp${bookingData.totalPrice.toLocaleString()}

Payment Review:
Our admin team is currently reviewing your payment proof. You will receive a confirmation email once your payment has been verified and approved.

Please keep your Booking ID (${bookingData.bookingId}) for reference.

Thank you for choosing our service!

This is an automated email. Please do not reply to this message.
© ${new Date().getFullYear()} Makassar Phinisi Sea Side Hotel
          `
        }
      }

      await addDoc(collection(db, 'mail'), emailDoc)
      console.log('Booking confirmation email queued successfully')
    } catch (error) {
      console.error('Error sending booking confirmation email:', error)
      throw error
    }
  },

  // Send payment confirmation email
  async sendPaymentConfirmation(paymentData: PaymentConfirmationData) {
    try {
      const emailDoc = {
        to: [paymentData.email],
        message: {
          subject: `Payment Confirmed - ${paymentData.eventName} (ID: ${paymentData.bookingId})`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
                .header { background-color: #d4edda; padding: 20px; text-align: center; }
                .content { padding: 20px; }
                .confirmation-box { background-color: #d4edda; border: 2px solid #28a745; padding: 20px; margin: 20px 0; border-radius: 10px; text-align: center; }
                .footer { background-color: #e9ecef; padding: 20px; text-align: center; font-size: 12px; color: #6c757d; }
                .booking-id { font-size: 18px; font-weight: bold; color: #28a745; }
                .success-icon { font-size: 48px; color: #28a745; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <div class="success-icon">✅</div>
                  <h1>Payment Confirmed!</h1>
                  <p class="booking-id">Booking ID: ${paymentData.bookingId}</p>
                </div>
                
                <div class="content">
                  <h2>Dear ${paymentData.customerName},</h2>
                  
                  <div class="confirmation-box">
                    <h3>🎉 Great News!</h3>
                    <p><strong>Your payment has been confirmed and approved!</strong></p>
                    <p>Your booking for <strong>${paymentData.eventName}</strong> is now complete.</p>
                  </div>
                  
                  <p>Your booking is now confirmed and reserved. You can expect to hear from our team soon regarding any additional details for your event.</p>
                  
                  <p><strong>Important:</strong> Please keep your Booking ID (<strong>${paymentData.bookingId}</strong>) for your records and bring it with you on the day of your event.</p>
                  
                  <p>We look forward to hosting your event and making it a memorable experience!</p>
                  
                  <p>If you have any questions or need to make changes, please contact us with your booking ID.</p>
                </div>
                
                <div class="footer">
                  <p>This is an automated email. Please do not reply to this message.</p>
                  <p>© ${new Date().getFullYear()} Makassar Phinisi Sea Side Hotel</p>
                </div>
              </div>
            </body>
            </html>
          `,
          text: `
Payment Confirmed - ${paymentData.eventName}

Dear ${paymentData.customerName},

✅ Great News! Your payment has been confirmed and approved!

Your booking for ${paymentData.eventName} is now complete.
Booking ID: ${paymentData.bookingId}

Your booking is now confirmed and reserved. You can expect to hear from our team soon regarding any additional details for your event.

Important: Please keep your Booking ID (${paymentData.bookingId}) for your records and bring it with you on the day of your event.

We look forward to hosting your event and making it a memorable experience!

If you have any questions or need to make changes, please contact us with your booking ID.

This is an automated email. Please do not reply to this message.
© ${new Date().getFullYear()} Makassar Phinisi Sea Side Hotel
          `
        }
      }

      await addDoc(collection(db, 'mail'), emailDoc)
      console.log('Payment confirmation email queued successfully')
    } catch (error) {
      console.error('Error sending payment confirmation email:', error)
      throw error
    }
  }
}