"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Users, Clock } from "lucide-react"
import RoomBookingPopup from "@/components/room-booking-popup"
import { subscribeToClientEvents } from "@/lib/eventService"
import { DiningRoom, SpecialEvent } from "@/lib/types"
import { specialEventService } from "../services/special-event-service"
import { Timestamp } from 'firebase/firestore'
import { formatCurrency } from "@/lib/utils"






export default function ReservationPage() {

  const [selectedEvent, setSelectedEvent] = useState<SpecialEvent | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [firebaseEvents, setFirebaseEvents] = useState<SpecialEvent[]>([])
  const [loading, setLoading] = useState(true)

  // Subscribe to special events for real-time updates
  useEffect(() => {
    const unsubscribe = specialEventService.subscribeToSpecialEvents((event) => {
      setFirebaseEvents(event)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  // Use only Firebase events
  const allEvents = firebaseEvents



  const handleEventClick = (event: SpecialEvent) => {
    setSelectedEvent(event)
    setIsDialogOpen(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedEvent) {
      console.log("Special event booking submitted for:", selectedEvent?.name)
    }
    setIsDialogOpen(false)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Simple Centered Header with Logo */}
      <div className="flex items-center justify-center py-8">
        <img 
          src="/components/clarologo.png" 
          alt="Claro Logo" 
          className="h-20 w-auto"
        />
      </div>



      {/* Special Events Section */}
      <div className="bg-muted py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4 text-balance">Special Event Packages</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
              Enhance your dining experience with our curated special events. From wine tastings to live entertainment,
              create unforgettable memories with our exclusive packages.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-8">
            {loading ? (
              <div className="flex items-center justify-center w-full py-8">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                  <p className="text-muted-foreground">Loading events...</p>
                </div>
              </div>
            ) : (
              allEvents.map((event) => (
              <Card
                key={`event-${event.id}`}
                className="w-full max-w-sm overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-105 chili-hover border-accent/30"
                onClick={() => handleEventClick(event)}
              >
                <div className="relative">
                  <img src={event.image || "/placeholder.svg"} alt={event.name} className="w-full h-48 object-cover" />
                  <Badge className="absolute top-4 right-4 bg-secondary text-secondary-foreground">
                    Rp{formatCurrency(event.price)}/person
                  </Badge>
                  <div className="absolute bottom-4 left-4">
                    <Badge variant="outline" className="bg-white/90 text-black">
                      {event.eventType}
                    </Badge>
                  </div>
                </div>
                <CardContent className="p-6">
                  <h3 className="text-xl font-semibold mb-2">{event.name}</h3>
                  <p className="text-muted-foreground mb-4 line-clamp-2">{event.description}</p>
                  <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {event.duration instanceof Timestamp 
                        ? event.duration.toDate().toLocaleString('en-US', {
                            hour: 'numeric',
                            minute: 'numeric',
                            hour12: true
                          })
                        : 'Time not set'
                      }
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      Min {event.minGuests} guests
                    </span>
                  </div>
                  <Button variant="outline" size="sm" className="w-full bg-transparent">
                    Book Event
                  </Button>
                </CardContent>
              </Card>
              ))
            )}
          </div>
        </div>
      </div>

      <RoomBookingPopup
        selectedRoom={null}
        selectedEvent={selectedEvent}
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSubmit={handleSubmit}
      />
    </div>
  )
}