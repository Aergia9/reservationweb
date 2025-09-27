"use client"

import type React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Timestamp } from 'firebase/firestore'
import { DiningRoom, SpecialEvent } from "@/lib/types"

interface RoomBookingPopupProps {
  selectedRoom: DiningRoom | null
  selectedEvent: SpecialEvent | null
  isOpen: boolean
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
}

export default function RoomBookingPopup({ selectedRoom, selectedEvent, isOpen, onClose, onSubmit }: RoomBookingPopupProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="
          w-full h-full max-w-[1100px] max-h-[95vh] p-0
          flex items-center justify-center
          sm:w-[98vw] sm:h-[98vh] sm:max-w-[1100px] sm:max-h-[95vh]
        "
        style={{ minWidth: 0, minHeight: 0 }}
      >
        <div className="p-6 w-full h-full overflow-y-auto flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              {selectedRoom?.name || selectedEvent?.name}
            </DialogTitle>
          </DialogHeader>

          {selectedRoom && (
            <div className="flex flex-col lg:flex-row gap-8 mt-6 flex-1 min-h-0">
              {/* Left: Image & Details */}
              <div className="order-1 lg:w-1/2 flex flex-col">
                <img
                  src={selectedRoom.image || "/placeholder.svg"}
                  alt={selectedRoom.name}
                  className="w-full h-64 lg:h-80 object-cover rounded-lg mb-6"
                />

                <div className="space-y-6">
                  <div>
                    <h4 className="font-semibold text-lg mb-2">Dining Room Event Details</h4>
                    <p className="text-muted-foreground mb-4 text-pretty">{selectedRoom.description}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Size:</span> {selectedRoom.size}
                    </div>
                    <div>
                      <span className="font-medium">Style:</span> {selectedRoom.style}
                    </div>
                    <div>
                      <span className="font-medium">Max Guests:</span> {selectedRoom.maxGuests}
                    </div>
                    <div>
                      <span className="font-medium">Price:</span> ${selectedRoom.price}/event
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3">Features</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedRoom.amenities.map((amenity, index) => (
                        <Badge key={index} variant="secondary">
                          {amenity}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Booking Form */}
              <div className="order-2 lg:w-1/2 flex flex-col">
                <form onSubmit={onSubmit} className="space-y-6 flex flex-col flex-1">
                  <div className="bg-muted p-6 rounded-lg">
                    <h4 className="font-semibold text-lg mb-4">Book Your Dinner Event</h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                      <div>
                        <Label htmlFor="eventdate">Event Date</Label>
                        <Input type="date" id="eventdate" required />
                      </div>
                      <div>
                        <Label htmlFor="eventtime">Event Time</Label>
                        <Input type="time" id="eventtime" required />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                      <div>
                        <Label htmlFor="guests">Number of Guests</Label>
                        <Input
                          type="number"
                          id="guests"
                          min="1"
                          max={selectedRoom.maxGuests}
                          defaultValue="1"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="duration">Event Duration (hours)</Label>
                        <Input type="number" id="duration" min="2" max="8" defaultValue="4" required />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-semibold">Event Organizer Information</h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="firstName">First Name</Label>
                        <Input type="text" id="firstName" required />
                      </div>
                      <div>
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input type="text" id="lastName" required />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="email">Email Address</Label>
                      <Input type="email" id="email" required />
                    </div>

                    <div>
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input type="tel" id="phone" required />
                    </div>

                    <div>
                      <Label htmlFor="eventtype">Event Type</Label>
                      <Input type="text" id="eventtype" placeholder="Birthday, Corporate, Wedding, etc." required />
                    </div>

                    <div>
                      <Label htmlFor="requests">Special Requests</Label>
                      <Textarea
                        id="requests"
                        placeholder="Catering preferences, decorations, special arrangements..."
                        rows={3}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 mt-auto">
                    <Button type="button" variant="outline" onClick={onClose} className="flex-1 bg-transparent">
                      Cancel
                    </Button>
                    <Button type="submit" className="flex-1 bg-primary hover:bg-primary/90">
                      Book Event - ${selectedRoom.price}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}
          {selectedEvent && (
            <div className="flex flex-col lg:flex-row gap-8 mt-6 flex-1 min-h-0">
              <div className="order-1 lg:w-1/2 flex flex-col">
                <img
                  src={selectedEvent.image || "/placeholder.svg"}
                  alt={selectedEvent.name}
                  className="w-full h-64 lg:h-80 object-cover rounded-lg mb-6"
                />
                <div className="space-y-6">
                  <div>
                    <h4 className="font-semibold text-lg mb-2">Special Event Details</h4>
                    <p className="text-muted-foreground mb-4 text-pretty">{selectedEvent.description}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Type:</span> {selectedEvent.eventType}
                    </div>
                    <div>
                      <span className="font-medium">Duration:</span> {
    selectedEvent.duration instanceof Timestamp ?
    selectedEvent.duration.toDate().toLocaleString('en-US', {
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    })
    : 'Time not set'
  }
                    </div>
                    <div>
                      <span className="font-medium">Min Guests:</span> {selectedEvent.minGuests}
                    </div>
                    <div>
                      <span className="font-medium">Price:</span> ${selectedEvent.price}/person
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-3">Includes</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedEvent.includes.map((item: string, index: number) => (
                        <Badge key={index} variant="secondary">
                          {item}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="order-2 lg:w-1/2 flex flex-col">
                <form onSubmit={onSubmit} className="space-y-6 flex flex-col flex-1">
                  <div className="bg-muted p-6 rounded-lg">
                    <h4 className="font-semibold text-lg mb-4">Book This Special Event</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                      <div>
                        <Label htmlFor="eventdate">Event Date</Label>
                        <Input type="date" id="eventdate" required />
                      </div>
                      <div>
                        <Label htmlFor="eventtime">Event Time</Label>
                        <Input type="time" id="eventtime" required />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                      <div>
                        <Label htmlFor="guests">Number of Guests</Label>
                        <Input
                          type="number"
                          id="guests"
                          min={selectedEvent.minGuests}
                          defaultValue={selectedEvent.minGuests}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="duration">Event Duration (hours)</Label>
                        <Input type="number" id="duration" min="1" max="12" defaultValue="3" required />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="font-semibold">Organizer Information</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="firstName">First Name</Label>
                        <Input type="text" id="firstName" required />
                      </div>
                      <div>
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input type="text" id="lastName" required />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="email">Email Address</Label>
                      <Input type="email" id="email" required />
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input type="tel" id="phone" required />
                    </div>
                    <div>
                      <Label htmlFor="requests">Special Requests</Label>
                      <Textarea
                        id="requests"
                        placeholder="Catering preferences, decorations, special arrangements..."
                        rows={3}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4 mt-auto">
                    <Button type="button" variant="outline" onClick={onClose} className="flex-1 bg-transparent">
                      Cancel
                    </Button>
                    <Button type="submit" className="flex-1 bg-primary hover:bg-primary/90">
                      Book Event - ${selectedEvent.price}/person
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
