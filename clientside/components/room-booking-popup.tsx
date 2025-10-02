"use client"

import React, { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Timestamp, collection, addDoc } from 'firebase/firestore'
import { User } from 'firebase/auth'
import { db } from "@/lib/firebase"
import { DiningRoom, SpecialEvent } from "@/lib/types"

// Image Slider Component
interface ImageSliderProps {
  images: string[]
  eventName: string
  className?: string
}

function ImageSlider({ images, eventName, className }: ImageSliderProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [autoSlideEnabled, setAutoSlideEnabled] = useState(true)

  // Debug logging
  console.log('ImageSlider rendered with:', {
    imagesCount: images.length,
    currentIndex: currentImageIndex,
    images: images,
    eventName: eventName
  });

  // Auto-slide every 3 seconds (disabled in fullscreen)
  React.useEffect(() => {
    if (!autoSlideEnabled || images.length <= 1 || isFullscreen) return;
    
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % images.length);
    }, 3000); // 3 seconds - much more comfortable
    
    return () => clearInterval(interval);
  }, [autoSlideEnabled, images.length, isFullscreen]);

  // Ensure valid images array
  if (!images || images.length === 0) {
    console.error('ImageSlider: No images provided');
    return (
      <div className={className}>
        <img 
          src="/placeholder.svg" 
          alt="No images available"
          className="w-full h-full object-cover rounded-lg"
        />
      </div>
    );
  }

  const nextImage = () => {
    const newIndex = (currentImageIndex + 1) % images.length;
    console.log('Next image:', newIndex);
    setCurrentImageIndex(newIndex);
    // Pause auto-slide temporarily when user interacts
    setAutoSlideEnabled(false);
    setTimeout(() => setAutoSlideEnabled(true), 2000); // Resume after 2 seconds
  }

  const prevImage = () => {
    const newIndex = (currentImageIndex - 1 + images.length) % images.length;
    console.log('Previous image:', newIndex);
    setCurrentImageIndex(newIndex);
    // Pause auto-slide temporarily when user interacts
    setAutoSlideEnabled(false);
    setTimeout(() => setAutoSlideEnabled(true), 2000); // Resume after 2 seconds
  }

  const goToImage = (index: number) => {
    console.log('Go to image:', index);
    setCurrentImageIndex(index);
    // Pause auto-slide temporarily when user interacts
    setAutoSlideEnabled(false);
    setTimeout(() => setAutoSlideEnabled(true), 2000); // Resume after 2 seconds
  }

  const openFullscreen = () => {
    setIsFullscreen(true);
    setAutoSlideEnabled(false); // Pause auto-slide in fullscreen
  }

  const closeFullscreen = () => {
    setIsFullscreen(false);
    setAutoSlideEnabled(true); // Resume auto-slide when closing fullscreen
  }

  return (
    <div className={`relative ${className}`}>
      <div className="relative w-full h-full rounded-lg overflow-hidden">
        <div 
          key={currentImageIndex}
          className="w-full h-full animate-fade-in"
        >
          <img
            src={images[currentImageIndex] || "/placeholder.svg"}
            alt={`${eventName} - Image ${currentImageIndex + 1}`}
            className="w-full h-full object-cover cursor-pointer transition-all duration-300 ease-in-out hover:scale-105"
            onClick={openFullscreen}
            onError={(e) => {
              console.log('Image failed to load:', images[currentImageIndex]);
              e.currentTarget.src = '/placeholder.svg';
            }}
          />
        </div>
        
        {/* Navigation Arrows */}
        {images.length > 1 && (
          <>
            <button
              onClick={prevImage}
              className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-opacity-70 transition-opacity"
              aria-label="Previous image"
            >
              ←
            </button>
            <button
              onClick={nextImage}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-opacity-70 transition-opacity"
              aria-label="Next image"
            >
              →
            </button>
          </>
        )}
        
        {/* Image Counter */}
        <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">
          {currentImageIndex + 1} / {images.length}
        </div>
      </div>
      
      {/* Thumbnail Navigation */}
      {images.length > 1 && (
        <div className="flex gap-2 mt-4 mb-12 overflow-x-auto pb-2">
          {images.map((image, index) => (
            <button
              key={index}
              onClick={() => goToImage(index)}
              className={`flex-shrink-0 w-16 h-12 rounded border-2 overflow-hidden transition-all duration-300 hover:scale-105 ${
                index === currentImageIndex ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <img
                src={image || "/placeholder.svg"}
                alt={`${eventName} thumbnail ${index + 1}`}
                className="w-full h-full object-cover transition-all duration-300"
                onError={(e) => {
                  e.currentTarget.src = '/placeholder.svg';
                }}
              />
            </button>
          ))}
        </div>
      )}

      {/* Fullscreen Modal */}
      {isFullscreen && (
        <div className="fixed inset-0 bg-white bg-opacity-30 z-50 flex items-center justify-center backdrop-blur-sm">
          <div className="relative w-full h-full flex items-center justify-center p-4">
            {/* Close button */}
            <button
              onClick={closeFullscreen}
              className="absolute top-4 right-4 z-10 bg-white bg-opacity-90 hover:bg-opacity-100 text-black rounded-full w-10 h-10 flex items-center justify-center transition-all duration-200 shadow-lg"
              aria-label="Close fullscreen"
            >
              ✕
            </button>
            
            {/* Fullscreen image */}
            <div className="relative w-full h-full flex items-center justify-center">
              <div 
                key={currentImageIndex}
                className="animate-fade-in flex items-center justify-center"
                style={{ width: '90vw', height: '90vh' }}
              >
                <img
                  src={images[currentImageIndex] || "/placeholder.svg"}
                  alt={`${eventName} - Image ${currentImageIndex + 1}`}
                  className="object-contain"
                  style={{ width: '100%', height: '100%' }}
                  onError={(e) => {
                    console.log('Fullscreen image failed to load:', images[currentImageIndex]);
                    e.currentTarget.src = '/placeholder.svg';
                  }}
                />
              </div>
              
              {/* Navigation arrows for fullscreen - only show if multiple images */}
              {images.length > 1 && (
                <>
                  <button
                    onClick={prevImage}
                    className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-60 hover:bg-opacity-80 text-white rounded-full w-12 h-12 flex items-center justify-center transition-all duration-200 text-xl font-bold"
                    aria-label="Previous image"
                  >
                    ←
                  </button>
                  <button
                    onClick={nextImage}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-60 hover:bg-opacity-80 text-white rounded-full w-12 h-12 flex items-center justify-center transition-all duration-200 text-xl font-bold"
                    aria-label="Next image"
                  >
                    →
                  </button>
                </>
              )}
              
              {/* Image counter for fullscreen */}
              {images.length > 1 && (
                <div className="absolute top-16 left-4 bg-black bg-opacity-60 text-white px-3 py-1 rounded-full text-sm font-medium">
                  {currentImageIndex + 1} / {images.length}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface RoomBookingPopupProps {
  selectedRoom: DiningRoom | null
  selectedEvent: SpecialEvent | null
  isOpen: boolean
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
  user: User | null
  onLoginRequired: () => void
}

export default function RoomBookingPopup({ selectedRoom, selectedEvent, isOpen, onClose, onSubmit, user, onLoginRequired }: RoomBookingPopupProps) {
  const [formData, setFormData] = useState({
    bookingDate: '',
    bookingTime: '',
    guests: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    specialRequests: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Auto-fill email when user is available
  useEffect(() => {
    if (user?.email && formData.email === '') {
      setFormData(prev => ({
        ...prev,
        email: user.email || ''
      }))
    }
  }, [user, formData.email])

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setFormData({
        bookingDate: '',
        bookingTime: '',
        guests: '',
        firstName: '',
        lastName: '',
        email: user?.email || '',
        phone: '',
        specialRequests: ''
      })
      setError('')
    }
  }, [isOpen, user])

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return 'Date not set'
    const date = new Date(dateStr)
    return date.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).replace(/\//g, '-')
  }

  const isDateInRange = (selectedDate: string, startDate: string, endDate: string) => {
    if (!selectedDate || !startDate || !endDate) return false
    const selected = new Date(selectedDate)
    const start = new Date(startDate)
    const end = new Date(endDate)
    return selected >= start && selected <= end
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target
    setFormData(prev => ({
      ...prev,
      [id]: value
    }))
  }

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Check if user is logged in
    if (!user) {
      onLoginRequired()
      return
    }

    // Validate date range for events
    if (selectedEvent && selectedEvent.startDate && selectedEvent.endDate) {
      if (!isDateInRange(formData.bookingDate, selectedEvent.startDate, selectedEvent.endDate)) {
        setError(`Booking date must be between ${formatDateDisplay(selectedEvent.startDate)} and ${formatDateDisplay(selectedEvent.endDate)}`)
        return
      }
    }

    setLoading(true)
    setError('')

    try {
      // Prepare booking data
      const bookingData = {
        ...formData,
        userId: user.uid,
        userEmail: user.email,
        bookingType: selectedRoom ? 'room' : 'event',
        roomId: selectedRoom?.id || null,
        roomName: selectedRoom?.name || null,
        eventId: selectedEvent?.id || null,
        eventName: selectedEvent?.name || null,
        totalPrice: selectedRoom ? selectedRoom.price : selectedEvent?.price || 0,
        status: 'pending',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      }

      // Save to Firestore
      await addDoc(collection(db, 'booking'), bookingData)
      
      // Call original onSubmit for any additional logic
      onSubmit(e)
      
      // Success - close modal
      onClose()
      
      alert('Booking submitted successfully! We will contact you soon.')
      
    } catch (error) {
      console.error('Error saving booking:', error)
      setError('Failed to submit booking. Please try again.')
    } finally {
      setLoading(false)
    }
  }
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
                      <span className="font-medium">Price:</span> Rp{selectedRoom.price.toLocaleString()}/event
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
                <form onSubmit={handleBookingSubmit} className="space-y-6 flex flex-col flex-1">
                  {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                      {error}
                    </div>
                  )}
                  
                  {!user && (
                    <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
                      Please sign in to make a booking.
                    </div>
                  )}

                  <div className="bg-muted p-6 rounded-lg">
                    <h4 className="font-semibold text-lg mb-4">Book Your Dinner Event</h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                      <div>
                        <Label htmlFor="bookingDate">Event Date</Label>
                        <Input 
                          type="date" 
                          id="bookingDate" 
                          value={formData.bookingDate}
                          onChange={handleInputChange}
                          required 
                        />
                      </div>
                      <div>
                        <Label htmlFor="bookingTime">Event Time</Label>
                        <Input 
                          type="time" 
                          id="bookingTime" 
                          value={formData.bookingTime}
                          onChange={handleInputChange}
                          required 
                        />
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
                          value={formData.guests}
                          onChange={handleInputChange}
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
                        <Input 
                          type="text" 
                          id="firstName" 
                          value={formData.firstName}
                          onChange={handleInputChange}
                          required 
                        />
                      </div>
                      <div>
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input 
                          type="text" 
                          id="lastName" 
                          value={formData.lastName}
                          onChange={handleInputChange}
                          required 
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="email">Email Address</Label>
                      <Input 
                        type="email" 
                        id="email" 
                        value={formData.email}
                        onChange={handleInputChange}
                        required 
                      />
                    </div>

                    <div>
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input 
                        type="tel" 
                        id="phone" 
                        value={formData.phone}
                        onChange={handleInputChange}
                        required 
                      />
                    </div>

                    <div>
                      <Label htmlFor="eventtype">Event Type</Label>
                      <Input type="text" id="eventtype" placeholder="Birthday, Corporate, Wedding, etc." required />
                    </div>

                    <div>
                      <Label htmlFor="specialRequests">Special Requests</Label>
                      <Textarea
                        id="specialRequests"
                        placeholder="Catering preferences, decorations, special arrangements..."
                        rows={3}
                        value={formData.specialRequests}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 mt-auto">
                    <Button type="button" variant="outline" onClick={onClose} className="flex-1 bg-transparent">
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      className="flex-1 bg-primary hover:bg-primary/90"
                      disabled={loading || !user}
                    >
                      {loading ? 'Submitting...' : `Book Room - Rp${selectedRoom.price.toLocaleString()}`}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}
          {selectedEvent && (
            <div className="flex flex-col lg:flex-row gap-8 mt-6 flex-1 min-h-0">
              <div className="order-1 lg:w-1/2 flex flex-col">
                {/* Image Slider for Multiple Images */}
                {(() => {
                  console.log('Event images debug:', {
                    hasImages: Boolean(selectedEvent.images),
                    imagesLength: selectedEvent.images?.length,
                    images: selectedEvent.images,
                    singleImage: selectedEvent.image,
                    eventName: selectedEvent.name
                  });
                  
                  // Always show slider if images array exists and has items
                  const shouldUseSlider = selectedEvent.images && selectedEvent.images.length > 0;
                  
                  if (shouldUseSlider) {
                    console.log('Rendering ImageSlider with images:', selectedEvent.images);
                    return (
                      <div className="w-full h-64 lg:h-80 mb-12">
                        <ImageSlider 
                          images={selectedEvent.images!} 
                          eventName={selectedEvent.name}
                          className="w-full h-full"
                        />
                      </div>
                    );
                  } else {
                    console.log('Rendering single image fallback');
                    return (
                      <div className="w-full h-64 lg:h-80 mb-12">
                        <img
                          src={selectedEvent.image || "/placeholder.svg"}
                          alt={selectedEvent.name}
                          className="w-full h-full object-cover rounded-lg cursor-pointer"
                          onError={(e) => {
                            console.log('Image failed to load:', selectedEvent.image);
                            e.currentTarget.src = '/placeholder.svg';
                          }}
                        />
                      </div>
                    );
                  }
                })()}
                <div className="space-y-6 mt-16">
                  <div>
                    <h4 className="font-semibold text-lg mb-2">Special Event Details</h4>
                    <p className="text-muted-foreground mb-4 text-pretty">{selectedEvent.description}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Type:</span> {selectedEvent.eventType}
                    </div>
                    <div>
                      <span className="font-medium">Event Dates:</span> {
                        (() => {
                          if ((selectedEvent.startDate && selectedEvent.startDate !== null && selectedEvent.startDate !== '') && 
                              (selectedEvent.endDate && selectedEvent.endDate !== null && selectedEvent.endDate !== '')) {
                            return selectedEvent.startDate === selectedEvent.endDate ?
                              formatDateDisplay(selectedEvent.startDate) :
                              `${formatDateDisplay(selectedEvent.startDate)} - ${formatDateDisplay(selectedEvent.endDate)}`;
                          } else {
        return 'Dates flexible';
      }
    })()
  }
                    </div>
                    <div>
                      <span className="font-medium">Min Guests:</span> {selectedEvent.minGuests}
                    </div>
                    <div>
                      <span className="font-medium">Price:</span> Rp{selectedEvent.price.toLocaleString()}/person
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
                <form onSubmit={handleBookingSubmit} className="space-y-6 flex flex-col flex-1">
                  {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                      {error}
                    </div>
                  )}
                  
                  {!user && (
                    <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
                      Please sign in to make a booking.
                    </div>
                  )}

                  <div className="bg-muted p-6 rounded-lg">
                    <h4 className="font-semibold text-lg mb-4">Book This Special Event</h4>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                      <div>
                        <Label htmlFor="bookingDate">Booking Date</Label>
                        <Input 
                          type="date" 
                          id="bookingDate" 
                          value={formData.bookingDate}
                          onChange={handleInputChange}
                          min={selectedEvent.startDate || undefined}
                          max={selectedEvent.endDate || undefined}
                          required 
                        />
                      </div>
                      <div>
                        <Label htmlFor="bookingTime">Booking Time</Label>
                        <Input 
                          type="time" 
                          id="bookingTime" 
                          value={formData.bookingTime}
                          onChange={handleInputChange}
                          required 
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4 mb-4">
                      <div>
                        <Label htmlFor="guests">Number of Guests (minimum: {selectedEvent.minGuests})</Label>
                        <Input
                          type="number"
                          id="guests"
                          min={selectedEvent.minGuests}
                          value={formData.guests}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="font-semibold">Organizer Information</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="firstName">First Name</Label>
                        <Input 
                          type="text" 
                          id="firstName" 
                          value={formData.firstName}
                          onChange={handleInputChange}
                          required 
                        />
                      </div>
                      <div>
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input 
                          type="text" 
                          id="lastName" 
                          value={formData.lastName}
                          onChange={handleInputChange}
                          required 
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="email">Email Address</Label>
                      <Input 
                        type="email" 
                        id="email" 
                        value={formData.email}
                        onChange={handleInputChange}
                        required 
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input 
                        type="tel" 
                        id="phone" 
                        value={formData.phone}
                        onChange={handleInputChange}
                        required 
                      />
                    </div>
                    <div>
                      <Label htmlFor="specialRequests">Special Requests</Label>
                      <Textarea
                        id="specialRequests"
                        placeholder="Catering preferences, decorations, special arrangements..."
                        rows={3}
                        value={formData.specialRequests}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4 mt-auto">
                    <Button type="button" variant="outline" onClick={onClose} className="flex-1 bg-transparent">
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      className="flex-1 bg-primary hover:bg-primary/90"
                      disabled={loading || !user}
                    >
                      {loading ? 'Submitting...' : `Book Event - Rp${selectedEvent.price.toLocaleString()}/person`}
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
