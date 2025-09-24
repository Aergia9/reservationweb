"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MapPin, Users, Clock } from "lucide-react"
import RoomBookingPopup from "@/components/room-booking-popup"
import { LoginForm } from "@/components/login-popup"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { subscribeToClientEvents } from "@/lib/eventService"
import { DiningRoom, SpecialEvent } from "@/lib/types"


const diningRooms: DiningRoom[] = [
  {
    id: 1,
    name: "Grand Ballroom",
    price: 1200,
    image: "/luxury-ocean-view-hotel.png",
    description:
      "Elegant ballroom perfect for large dinner events and celebrations. Features crystal chandeliers, hardwood floors, and panoramic city views.",
    amenities: ["Crystal Chandeliers", "Dance Floor", "Sound System", "City Views"],
    maxGuests: 150,
    size: "2,500 sq ft",
    style: "Elegant & Formal",
  },
  {
    id: 2,
    name: "Executive Dining Room",
    price: 800,
    image: "/placeholder-k45u6.png",
    description:
      "Sophisticated dining space ideal for corporate dinner events and business gatherings. Features modern decor and state-of-the-art AV equipment.",
    amenities: ["AV Equipment", "Projector Screen", "WiFi", "Modern Decor"],
    maxGuests: 50,
    size: "1,200 sq ft",
    style: "Modern & Professional",
  },
]

const specialEvents: SpecialEvent[] = [
  {
    id: 1,
    name: "Wine Tasting Dinner",
    price: 150,
    image: "/placeholder-k45u6.png",
    description:
      "An exquisite evening featuring a 5-course dinner paired with premium wines from our sommelier's selection.",
    includes: ["5-Course Dinner", "Wine Pairings", "Sommelier Service", "Welcome Cocktail"],
    duration: "3 hours",
    eventType: "Culinary Experience",
    minGuests: 8,
  },
  {
    id: 2,
    name: "Live Jazz Dinner",
    price: 120,
    image: "/placeholder-59hss.png",
    description: "Enjoy a sophisticated dinner accompanied by live jazz performances in an intimate setting.",
    includes: ["3-Course Dinner", "Live Jazz Band", "Cocktail Service", "Reserved Seating"],
    duration: "2.5 hours",
    eventType: "Entertainment",
    minGuests: 4,
  },
]

export default function ReservationPage() {
  const [selectedRoom, setSelectedRoom] = useState<DiningRoom | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<SpecialEvent | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isLoginOpen, setIsLoginOpen] = useState(false)
  const [firebaseEvents, setFirebaseEvents] = useState<SpecialEvent[]>([])
  const [loading, setLoading] = useState(true)

  // Subscribe to Firebase events on component mount
  useEffect(() => {
    const unsubscribe = subscribeToClientEvents((events) => {
      setFirebaseEvents(events)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  // Combine hardcoded events with Firebase events for backward compatibility
  const allEvents = [...specialEvents, ...firebaseEvents]

  const handleRoomClick = (room: DiningRoom) => {
    setSelectedRoom(room)
    setSelectedEvent(null)
    setIsDialogOpen(true)
  }

  const handleEventClick = (event: SpecialEvent) => {
    setSelectedEvent(event)
    setSelectedRoom(null)
    setIsDialogOpen(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedRoom) {
      console.log("Dinner event booking submitted for room:", selectedRoom?.name)
    } else if (selectedEvent) {
      console.log("Special event booking submitted for:", selectedEvent?.name)
    }
    setIsDialogOpen(false)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header Information Section */}
      <div className="relative h-96 bg-gradient-to-r from-primary/20 to-secondary/20">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: "url('/luxury-hotel-exterior-palms.png')",
          }}
        >
          <div className="absolute inset-0 bg-black/40" />
        </div>
        <div className="absolute top-4 right-4 z-20">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsLoginOpen(true)}
            className="bg-black/30 border-white/30 text-white hover:bg-black/50"
          >
            Sign In
          </Button>
        </div>
        <div className="relative z-10 flex items-center justify-center h-full">
          <div className="flex flex-col items-center text-center text-white px-4">
            <h1 className="text-5xl font-bold mb-4 text-balance">Dining Event</h1>
            <p className="text-xl mb-6 text-pretty max-w-2xl">
              Host unforgettable dinner events in our stunning venues. From intimate gatherings to grand celebrations,
              we provide the perfect setting for your special occasions.
            </p>
            <div className="flex items-center justify-center gap-2 text-lg">
              <MapPin className="h-5 w-5" />
              <a href="https://maps.app.goo.gl/qwftenBTfdiSuNck7">
                Jl. A. P. Pettarani No.03, Mannuruki, Kec. Tamalate, Kota Makassar, Sulawesi Selatan 90221
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Dining Rooms Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4 text-balance">Dining Room List</h2>
        </div>

        <div className="flex flex-wrap justify-center gap-8">
          {diningRooms.map((room) => (
            <Card
              key={`room-${room.id}`}
              className="w-full max-w-sm overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-105"
              onClick={() => handleRoomClick(room)}
            >
              <div className="relative">
                <img src={room.image || "/placeholder.svg"} alt={room.name} className="w-full h-48 object-cover" />
                <Badge className="absolute top-4 right-4 bg-primary text-primary-foreground">${room.price}/event</Badge>
              </div>
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold mb-2">{room.name}</h3>
                <p className="text-muted-foreground mb-4 line-clamp-2">{room.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Up to {room.maxGuests} guests</span>
                  <Button variant="outline" size="sm">
                    View Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
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
                className="w-full max-w-sm overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-105"
                onClick={() => handleEventClick(event)}
              >
                <div className="relative">
                  <img src={event.image || "/placeholder.svg"} alt={event.name} className="w-full h-48 object-cover" />
                  <Badge className="absolute top-4 right-4 bg-secondary text-secondary-foreground">
                    ${event.price}/person
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
                      {event.duration}
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
        selectedRoom={selectedRoom}
        selectedEvent={selectedEvent}
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSubmit={handleSubmit}
      />

      <Dialog open={isLoginOpen} onOpenChange={setIsLoginOpen}>
        <DialogContent 
          className="w-full h-full max-w-[1100px] max-h-[95vh] p-0 flex items-center justify-center sm:w-[98vw] sm:h-[98vh] sm:max-w-[1100px] sm:max-h-[95vh]"
          style={{ minWidth: 0, minHeight: 0 }}
        >
          <div className="p-6 w-full h-full overflow-y-auto">
            <LoginForm />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}