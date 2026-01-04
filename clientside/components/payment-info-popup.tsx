"use client"

import React, { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Copy, CreditCard, Upload, ArrowLeft, ArrowRight } from "lucide-react"
import { toast } from "sonner"
import { Timestamp, collection, addDoc, getDocs, query, where } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from "@/lib/firebase"
import { emailService } from "@/lib/emailService"
import BookingConfirmationPopup from "./booking-confirmation-popup"

interface PaymentInfoPopupProps {
  isOpen: boolean
  onClose: () => void
  bookingDetails?: {
    bookingId: string
    eventName: string
    totalAmount: number
  }
  selectedEvent?: any // Add event details for new flow
  formData?: any // Add form data from the original booking form
  onBookingComplete?: (bookingData: any) => void // Callback when booking is complete
}

const bankAccounts = [
  {
    bank: "Mandiri",
    accountNumber: "1740098288889",
    accountName: "Makassar Phinisi Sea Side Hotel",
    color: "bg-blue-600",
    logo: "/logomandiri.png"
  },
  {
    bank: "BNI",
    accountNumber: "8881301303",
    accountName: "Makassar Phinisi Sea Side Hotel",
    color: "bg-orange-600",
    logo: "/logobni.png"
  },
  {
    bank: "BCA",
    accountNumber: "0253838288",
    accountName: "Mks Phinisi Sea Side Hotel",
    color: "bg-blue-800",
    logo: "/logobca.png"
  },
  {
    bank: "BRI",
    accountNumber: "064201001310305",
    accountName: "PT.Makassar Phinisi Seaside Hotel",
    color: "bg-red-600",
    logo: "/bri.png"
  }
]

export default function PaymentInfoPopup({ isOpen, onClose, bookingDetails, selectedEvent, formData, onBookingComplete }: PaymentInfoPopupProps) {
  const [paymentProof, setPaymentProof] = useState<File | null>(null)
  const [paymentProofPreview, setPaymentProofPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [completedBookingId, setCompletedBookingId] = useState<string>("")

  // Reset state when popup closes
  useEffect(() => {
    if (!isOpen) {
      setPaymentProof(null)
      setPaymentProofPreview(null)
      setUploading(false)
      setShowConfirmation(false)
      setCompletedBookingId("")
    }
  }, [isOpen])

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success(`${label} copied to clipboard!`)
    }).catch(() => {
      toast.error("Failed to copy to clipboard")
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const handlePaymentProofChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setPaymentProof(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        setPaymentProofPreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleUploadPaymentProof = async () => {
    if (!paymentProof) {
      toast.error("Please select a payment proof image")
      return
    }

    if (!selectedEvent || !formData) {
      toast.error("No booking data available")
      return
    }

    setUploading(true)
    try {
      // Upload payment proof to Firebase Storage
      let paymentImageUrl = ''
      if (paymentProof) {
        const timestamp = Date.now()
        const fileName = `payment_${timestamp}_${paymentProof.name}`
        const storageRef = ref(storage, `payment-proofs/${fileName}`)
        const snapshot = await uploadBytes(storageRef, paymentProof)
        paymentImageUrl = await getDownloadURL(snapshot.ref)
      }

      // Generate unique booking ID using timestamp
      const eventName = selectedEvent?.name || 'booking'
      const timestamp = Date.now()
      const randomSuffix = Math.random().toString(36).substr(2, 3).toUpperCase()

      // Create a more unique booking ID
      let bookingId: string
      if (!eventName || eventName === 'booking') {
        bookingId = `BK${String(timestamp).slice(-6)}`
      } else {
        const words = eventName.trim().split(/\s+/)
        let abbreviation = ''

        if (words.length === 1) {
          abbreviation = words[0].substring(0, 3).toUpperCase()
        } else if (words.length === 2) {
          abbreviation = (words[0].substring(0, 2) + words[1].substring(0, 1)).toUpperCase()
        } else {
          abbreviation = (words[0].substring(0, 1) + words[1].substring(0, 1) + words[2].substring(0, 1)).toUpperCase()
        }

        // Use timestamp last 3 digits + random suffix for uniqueness
        const uniqueNumber = String(timestamp).slice(-3) + randomSuffix.slice(0, 1)
        bookingId = `${abbreviation}${uniqueNumber}`
      }

      // Prepare booking data using formData from the original form
      const selectedPkg = selectedEvent?.packages?.find((pkg: any) => pkg.id === formData.selectedPackage)
      const totalGuests = (parseInt(formData.adults) || 0) + (parseInt(formData.children) || 0)

      const bookingData = {
        bookingId: bookingId,
        bookingDate: formData.bookingDate,
        bookingTime: formData.bookingTime,
        adults: parseInt(formData.adults) || 0,
        children: parseInt(formData.children) || 0,
        totalGuests: totalGuests,
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        paymentImageUrl,
        bookingType: 'event',
        eventId: selectedEvent?.id || null,
        eventName: selectedEvent?.name || null,
        hasPackage: Boolean(selectedPkg),
        packageId: selectedPkg?.id || null,
        packageName: selectedPkg?.name || null,
        packagePrice: selectedPkg?.price || null,
        packagePeopleCount: selectedPkg?.peopleCount || null,
        totalPrice: calculateTotalPrice(),
        status: 'pending',
        paymentStatus: 'reviewing',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      }

      // Save to Firestore
      await addDoc(collection(db, 'booking'), bookingData)

      // Send booking confirmation email
      try {
        await emailService.sendBookingConfirmation({
          bookingId: bookingId,
          eventName: selectedEvent?.name || 'Event',
          customerName: `${formData.firstName} ${formData.lastName}`,
          bookingDate: formData.bookingDate,
          bookingTime: formData.bookingTime,
          totalGuests: totalGuests,
          totalPrice: calculateTotalPrice(),
          email: formData.email
        })
        console.log('Booking confirmation email sent successfully')
      } catch (emailError) {
        console.error('Error sending booking confirmation email:', emailError)
        // Don't break the booking flow if email fails
      }

      // Store booking ID and show confirmation popup
      setCompletedBookingId(bookingId)
      setShowConfirmation(true)

    } catch (error) {
      console.error('Error completing booking:', error)
      toast.error("Failed to complete booking. Please try again.")
    } finally {
      setUploading(false)
    }
  }

  // Handle confirmation popup close
  const handleConfirmationClose = () => {
    setShowConfirmation(false)

    // Call the booking complete callback
    if (onBookingComplete) {
      onBookingComplete({ bookingId: completedBookingId })
    }

    // Close the payment popup
    onClose()

    toast.success('Thank you! We will contact you soon.')
  }

  // Helper functions for booking logic
  const generateBookingId = (eventName: string, orderNumber: number) => {
    const prefix = eventName.substring(0, 3).toUpperCase()
    const paddedOrder = orderNumber.toString().padStart(3, '0')
    return `${prefix}${paddedOrder}`
  }

  const calculateTotalPrice = () => {
    if (!selectedEvent || !formData) return 0

    const selectedPkg = selectedEvent.packages?.find((pkg: any) => pkg.id === formData.selectedPackage)
    if (selectedPkg) {
      return selectedPkg.price
    }

    const adults = parseInt(formData.adults) || 0
    const children = parseInt(formData.children) || 0
    
    // Check if event has children pricing enabled
    if (selectedEvent.hasChildrenPrice && selectedEvent.childrenPrice !== undefined) {
      return (adults * selectedEvent.price) + (children * selectedEvent.childrenPrice)
    }
    
    // Default: single price for all guests
    return (adults + children) * (selectedEvent.price || 0)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg mx-auto max-h-[90vh] overflow-y-auto bg-white border border-black shadow-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold text-gray-800">
            <CreditCard className="h-6 w-6" />
            Payment Information
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Event Summary */}
          {selectedEvent && (
            <Card className="bg-gray-50">
              <CardContent className="p-4">
                <h3 className="font-semibold text-gray-800 mb-2">Event Summary</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Event:</span>
                    <span className="font-medium">{selectedEvent.name}</span>
                  </div>
                  {formData && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Adults:</span>
                        <span className="font-medium">{formData.adults || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Children:</span>
                        <span className="font-medium">{formData.children || 0}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between border-t pt-2 mt-2">
                    <span className="text-gray-600">Total Price:</span>
                    <span className="font-bold text-green-600 text-lg">
                      Rp {bookingDetails?.totalAmount ? bookingDetails.totalAmount.toLocaleString() : '0'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Payment Instructions */}
          <div className="text-center p-4 bg-yellow-50 rounded-lg border-l-4 border-yellow-400">
            <p className="text-sm text-yellow-800">
              <strong>Step 1: Choose a bank and make the transfer</strong><br />
              <strong>Step 2: Upload your payment proof to complete booking</strong>
            </p>
          </div>
            {/* Bank Accounts */}
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-800 mb-3">Choose Bank Account for Transfer:</h3>
              {bankAccounts.map((bank, index) => (
                <Card key={index} className="border border-gray-200 hover:border-gray-300 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <img 
                          src={bank.logo} 
                          alt={`${bank.bank} Logo`}
                          className={`${bank.bank === 'BCA' ? 'h-12' : 'h-8'} w-auto object-contain`}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                            e.currentTarget.nextElementSibling?.classList.remove('hidden')
                          }}
                        />
                        <div className={`hidden px-3 py-1 rounded-full text-white text-sm font-medium ${bank.color}`}>
                          {bank.bank}
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Account Number:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-gray-800">{bank.accountNumber}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(bank.accountNumber, "Account number")}
                            className="h-6 w-6 p-0"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Account Name:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-800 text-right">{bank.accountName}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(bank.accountName, "Account name")}
                            className="h-6 w-6 p-0"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Upload Payment Proof */}
            <Card className="bg-white">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Upload className="h-5 w-5 text-gray-800" />
                  <h3 className="font-semibold text-gray-800">Upload Payment Proof</h3>
                </div>
                
                <div className="space-y-3">
                  <Label htmlFor="payment-proof" className="text-sm font-medium text-gray-800">
                    Upload your transfer receipt/proof:
                  </Label>
                  <Input
                    id="payment-proof"
                    type="file"
                    accept="image/*"
                    onChange={handlePaymentProofChange}
                    className="cursor-pointer w-full"
                  />
                  
                  {paymentProofPreview && (
                    <div className="mt-3">
                      <p className="text-sm text-gray-800 mb-2">Preview:</p>
                      <img 
                        src={paymentProofPreview} 
                        alt="Payment proof preview" 
                        className="max-w-full h-32 object-contain border rounded-lg bg-white"
                      />
                    </div>
                  )}
                  
                  <Button
                    onClick={handleUploadPaymentProof}
                    disabled={!paymentProof || uploading}
                    className="w-full bg-white hover:bg-gray-50 text-black border border-gray-300"
                  >
                    {uploading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-800 mr-2"></div>
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Complete Booking
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
      </DialogContent>
      
      {/* Booking Confirmation Popup */}
      <BookingConfirmationPopup
        isOpen={showConfirmation}
        onClose={handleConfirmationClose}
        bookingId={completedBookingId}
      />
    </Dialog>
  )
}