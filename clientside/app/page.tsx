"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Users, Clock, ChevronLeft, ChevronRight, Facebook, Twitter, Instagram, Youtube, MapPin, Phone, Mail, Globe, MessageCircle } from "lucide-react"
import EventBookingPopup from "@/components/event-booking-popup"
import BookingChatBot from "@/components/booking-chat-bot"
import { subscribeToClientEvents } from "@/lib/eventService"
import { SpecialEvent } from "@/lib/types"
import { specialEventService } from "../services/special-event-service"
import { sliderService, SliderImage } from "../services/slider-service"
import { Timestamp } from 'firebase/firestore'
import { formatCurrency } from "@/lib/utils"



export default function ReservationPage() {

  const [selectedEvent, setSelectedEvent] = useState<SpecialEvent | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isChatBotOpen, setIsChatBotOpen] = useState(false)
  const [firebaseEvents, setFirebaseEvents] = useState<SpecialEvent[]>([])
  const [sliderImages, setSliderImages] = useState<SliderImage[]>([])
  const [loading, setLoading] = useState(true)
  const [sliderLoading, setSliderLoading] = useState(true)
  const [currentSlide, setCurrentSlide] = useState(0)

  // Subscribe to special events for real-time updates
  useEffect(() => {
    const unsubscribe = specialEventService.subscribeToSpecialEvents((event) => {
      setFirebaseEvents(event)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  // Subscribe to slider images for real-time updates
  useEffect(() => {
    const unsubscribe = sliderService.subscribeToSliderImages((images) => {
      setSliderImages(images)
      setSliderLoading(false)
      // Reset current slide if it's out of bounds
      if (images.length > 0 && currentSlide >= images.length) {
        setCurrentSlide(0)
      }
    }, true) // Only get active images for display

    return () => unsubscribe()
  }, [])

  // Auto-slide functionality
  useEffect(() => {
    if (sliderImages.length === 0) return
    
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % sliderImages.length)
    }, 5000) // Change slide every 5 seconds

    return () => clearInterval(timer)
  }, [sliderImages.length])

  // Use only Firebase events
  const allEvents = firebaseEvents

  const nextSlide = () => {
    if (sliderImages.length === 0) return
    setCurrentSlide((prev) => (prev + 1) % sliderImages.length)
  }

  const prevSlide = () => {
    if (sliderImages.length === 0) return
    setCurrentSlide((prev) => (prev - 1 + sliderImages.length) % sliderImages.length)
  }

  const scrollToSpecialEvents = () => {
    const specialEventsSection = document.getElementById('special-events')
    if (specialEventsSection) {
      specialEventsSection.scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
      })
    }
  }



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
    <div className="min-h-screen bg-white">
      {/* Enhanced Header with Image Slider */}
      <div className="relative h-screen overflow-hidden">
        {/* Background Image Slider */}
        <div className="absolute inset-0">
          {sliderLoading ? (
            // Loading state
            <div className="w-full h-full bg-gray-800 flex items-center justify-center">
              <div className="text-center text-white">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                <p>Loading images...</p>
              </div>
            </div>
          ) : sliderImages.length === 0 ? (
            // No images state
            <div className="w-full h-full bg-gray-800 flex items-center justify-center">
              <div className="text-center text-white">
                <p className="text-xl">No slider images available</p>
                <p className="text-sm opacity-75 mt-2">Please add images through the admin dashboard</p>
              </div>
            </div>
          ) : (
            // Slider images
            sliderImages.map((image, index) => (
              <div
                key={image.id}
                className={`absolute inset-0 transition-opacity duration-1000 ${
                  index === currentSlide ? 'opacity-100' : 'opacity-0'
                }`}
              >
                <img 
                  src={image.url} 
                  alt={image.title} 
                  className="w-full h-full object-cover"
                />
              </div>
            ))
          )}
        </div>
        
        {/* Semi-transparent overlay */}
        <div className="absolute inset-0 bg-black/40"></div>
        
        {/* Navigation arrows */}
        {!sliderLoading && sliderImages.length > 1 && (
          <>
            <button
              onClick={prevSlide}
              className="absolute left-4 top-1/2 transform -translate-y-1/2 z-20 bg-black/30 hover:bg-black/50 text-white p-2 rounded-full transition-all"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              onClick={nextSlide}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 z-20 bg-black/30 hover:bg-black/50 text-white p-2 rounded-full transition-all"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}
        
        {/* Slide indicators */}
        {!sliderLoading && sliderImages.length > 1 && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20 flex space-x-2">
            {sliderImages.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`w-3 h-3 rounded-full transition-all ${
                  index === currentSlide ? 'bg-yellow-400' : 'bg-white/50 hover:bg-white/75'
                }`}
              />
            ))}
          </div>
        )}
        
        {/* Header content */}
        <div className="relative z-10 h-full flex flex-col">
          {/* Top header with centered logo - Fixed at top */}
          <div className="fixed top-0 left-0 right-0 z-50 bg-black/20 backdrop-blur-sm border-b border-white/10">
            <div className="container mx-auto px-4 py-3 flex items-center justify-center">
              <img 
                src="/clarologo.png" 
                alt="Claro Logo" 
                className="h-12 w-auto"
              />
            </div>
          </div>
          
          {/* Hero content with top padding to account for fixed header */}
          <div className="flex-1 flex items-center justify-center pt-20">
            <div className="text-center text-white px-4 max-w-4xl">
              <h1 className="text-5xl md:text-6xl font-bold mb-6">
                Unforgettable <span className="text-yellow-400">Events</span>
              </h1>
              <p className="text-xl md:text-2xl mb-8 opacity-90">
                Where luxury meets comfort in the heart of the city.
              </p>
              <button 
                onClick={scrollToSpecialEvents}
                className="bg-yellow-400 text-black px-8 py-3 rounded-lg font-semibold hover:bg-yellow-500 transition-colors cursor-pointer"
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      </div>



      {/* Special Events Section */}
      <div id="special-events" className="py-16" style={{backgroundColor: '#CD1C18'}}>
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4 text-balance text-white">Special Event Packages</h2>
            <p className="text-lg text-white/80 max-w-2xl mx-auto text-pretty">
              Enhance your dining experience with our curated special events. From wine tastings to live entertainment,
              create unforgettable memories with our exclusive packages.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-8">
            {loading ? (
              <div className="flex items-center justify-center w-full py-8">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                  <p className="text-gray-600">Loading events...</p>
                </div>
              </div>
            ) : (
              allEvents.map((event) => (
              <Card
                key={`event-${event.id}`}
                className="w-full max-w-sm overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-xl hover:scale-105 bg-white border-2 border-white/20 shadow-lg"
                onClick={() => handleEventClick(event)}
              >
                <div className="relative">
                  <img src={event.image || "/placeholder.svg"} alt={event.name} className="w-full h-48 object-cover" />
                  {event.hasPackages && event.packages && event.packages.length > 0 ? (
                    <Badge className="absolute top-4 right-4 bg-yellow-400 text-black font-semibold">
                      Package Available
                    </Badge>
                  ) : (
                    <Badge className="absolute top-4 right-4 bg-yellow-400 text-black font-semibold">
                      Rp{formatCurrency(event.price)}/person
                    </Badge>
                  )}
                  <div className="absolute bottom-4 left-4">
                    <Badge variant="outline" className="bg-white/90 text-black border-gray-300">
                      {event.eventType}
                    </Badge>
                  </div>
                </div>
                <CardContent className="p-6 bg-white">
                  <h3 className="text-xl font-semibold mb-2 text-black">{event.name}</h3>
                  <p className="text-gray-600 mb-4 line-clamp-2">{event.description}</p>
                  <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
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
                  <Button variant="outline" size="sm" className="w-full bg-white border-gray-300 text-black hover:bg-gray-50">
                    Book Event
                  </Button>
                </CardContent>
              </Card>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Contact Footer */}
      <div className="py-16" style={{backgroundColor: '#FFA896'}}>
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Left side - Company info */}
            <div>
              <h2 className="text-3xl font-bold text-white mb-4">Claro Makassar</h2>
              <p className="text-white/90 mb-6 text-lg">
                Experience comfort and elegance in the heart of Makassar. Your perfect stay for
                business, leisure, and unforgettable moments.
              </p>
              
              {/* Social Media Icons */}
              <div className="flex space-x-4 mb-8">
                <div className="bg-blue-600 p-3 rounded-lg">
                  <Facebook className="h-6 w-6 text-white" />
                </div>
                <div className="bg-blue-400 p-3 rounded-lg">
                  <Twitter className="h-6 w-6 text-white" />
                </div>
                <div className="bg-pink-600 p-3 rounded-lg">
                  <Instagram className="h-6 w-6 text-white" />
                </div>
                <div className="bg-red-600 p-3 rounded-lg">
                  <Youtube className="h-6 w-6 text-white" />
                </div>
              </div>
              
              <h3 className="text-xl font-semibold text-white mb-4">Find Us At</h3>
              <div className="flex space-x-4">
                <div className="bg-blue-500 p-3 rounded-lg">
                  <Globe className="h-6 w-6 text-white" />
                </div>
                <div className="bg-yellow-500 p-3 rounded-lg">
                  <MapPin className="h-6 w-6 text-white" />
                </div>
                <div className="bg-blue-700 p-3 rounded-lg">
                  <Facebook className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>
            
            {/* Right side - Contact info */}
            <div>
              <h3 className="text-3xl font-bold text-white mb-6">Contact Us</h3>
              <div className="space-y-4">
                <div className="flex items-center text-white">
                  <MapPin className="h-5 w-5 mr-3 text-yellow-400" />
                  <span className="text-lg">Jl. A.P. Pettarani No. 3 Makassar, South Sulawesi</span>
                </div>
                <div className="flex items-center text-white">
                  <Phone className="h-5 w-5 mr-3 text-yellow-400" />
                  <span className="text-lg">(62-411) 833 888</span>
                </div>
                <div className="flex items-center text-white">
                  <Phone className="h-5 w-5 mr-3 text-yellow-400" />
                  <span className="text-lg">(62-411) 833 777</span>
                </div>
                <div className="flex items-center text-white">
                  <Mail className="h-5 w-5 mr-3 text-yellow-400" />
                  <span className="text-lg">hotel@claromakassar.com</span>
                </div>
                <div className="flex items-center text-white">
                  <Globe className="h-5 w-5 mr-3 text-yellow-400" />
                  <span className="text-lg">www.claromakassar.com</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Copyright */}
          <div className="border-t border-white/20 mt-12 pt-6 text-center">
            <p className="text-white/80">© 2025 Claro Makassar | All Rights Reserved</p>
          </div>
        </div>
      </div>

      {/* Floating Chat Button */}
      <div className="fixed bottom-20 right-6 z-50">
        <div className="relative">
          <Button
            onClick={() => setIsChatBotOpen(true)}
            className="h-14 w-14 rounded-full bg-blue-500 hover:bg-blue-600 shadow-lg transition-all duration-200 hover:scale-110"
            size="lg"
            title="Chat with us to edit your booking"
          >
            <MessageCircle className="h-6 w-6 text-white" />
          </Button>
          {/* Online indicator */}
          <div className="absolute -top-1 -right-1 h-4 w-4 bg-green-400 rounded-full border-2 border-white animate-pulse"></div>
        </div>
      </div>

      <EventBookingPopup
        selectedEvent={selectedEvent}
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSubmit={handleSubmit}
      />
      
      <BookingChatBot
        isOpen={isChatBotOpen}
        onClose={() => setIsChatBotOpen(false)}
      />
    </div>
  )
}