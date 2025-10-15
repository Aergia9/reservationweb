"use client"

import React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { CheckCircle, Copy } from "lucide-react"
import { toast } from "sonner"

interface BookingConfirmationPopupProps {
  isOpen: boolean
  onClose: () => void
  bookingId: string
}

export default function BookingConfirmationPopup({ isOpen, onClose, bookingId }: BookingConfirmationPopupProps) {
  const copyBookingId = () => {
    navigator.clipboard.writeText(bookingId).then(() => {
      toast.success("Booking ID copied to clipboard!")
    }).catch(() => {
      toast.error("Failed to copy booking ID")
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md mx-auto bg-white border border-gray-200 shadow-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-center gap-2 text-xl font-bold text-green-600">
            <CheckCircle className="w-6 h-6" />
            Booking Confirmed!
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <Card className="bg-gray-50 border-gray-200">
            <CardContent className="p-4">
              <div className="text-center space-y-2">
                <p className="text-gray-700">
                  Thank you for your booking! Our admin team will review your payment and contact you soon.
                </p>
                
                <div className="bg-white p-3 rounded-lg border border-gray-200 mt-4">
                  <p className="text-sm text-gray-600 mb-1">Your Booking ID:</p>
                  <div className="flex items-center justify-center gap-2">
                    <span className="font-mono text-lg font-bold text-green-700">
                      {bookingId}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={copyBookingId}
                      className="h-8 w-8 p-0"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Please save this ID for your reference
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <div className="text-center">
            <Button 
              onClick={onClose}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              Continue
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}