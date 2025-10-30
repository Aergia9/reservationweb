"use client"

import React, { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Timestamp, collection, addDoc, getDocs, query, where } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from "@/lib/firebase"
import { SpecialEvent } from "@/lib/types"
import { emailService } from "@/lib/emailService"
import { toast } from "sonner"

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

interface EventBookingPopupProps {
  selectedEvent: SpecialEvent | null
  isOpen: boolean
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
}

export default function EventBookingPopup({ selectedEvent, isOpen, onClose, onSubmit }: EventBookingPopupProps) {
  const [formData, setFormData] = useState({
    bookingDate: '',
    bookingTime: '',
    adults: '',
    children: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    paymentImage: null as File | null,
    selectedPackage: '' // Add package selection
  })
  const [loading, setLoading] = useState(false)
  const [paymentImagePreview, setPaymentImagePreview] = useState<string | null>(null)
  const [error, setError] = useState('')

  // Helper function to get selected package details
  const getSelectedPackage = () => {
    if (!selectedEvent?.hasPackages || !selectedEvent.packages || !formData.selectedPackage) {
      return null;
    }
    return selectedEvent.packages.find(pkg => pkg.id === formData.selectedPackage);
  };

  // Helper function to generate booking ID
  const generateBookingId = (eventName: string, orderNumber: number): string => {
    if (!eventName) return `BK${String(orderNumber).padStart(4, '0')}`;
    
    const words = eventName.trim().split(/\s+/);
    let abbreviation = '';
    
    if (words.length === 1) {
      // One word: take first 3 letters
      abbreviation = words[0].substring(0, 3).toUpperCase();
    } else if (words.length === 2) {
      // Two words: first 2 letters from first word, first letter from second word
      abbreviation = (words[0].substring(0, 2) + words[1].substring(0, 1)).toUpperCase();
    } else {
      // Three or more words: first letter from each of the first three words
      abbreviation = (words[0].substring(0, 1) + words[1].substring(0, 1) + words[2].substring(0, 1)).toUpperCase();
    }
    
    return `${abbreviation}${String(orderNumber).padStart(3, '0')}`;
  };

  // Helper function to calculate total price
  const calculateTotalPrice = () => {
    if (selectedEvent) {
      const selectedPkg = getSelectedPackage();
      if (selectedPkg) {
        return selectedPkg.price;
      }
      const totalGuests = (parseInt(formData.adults) || 0) + (parseInt(formData.children) || 0);
      return selectedEvent.price * (totalGuests || 1);
    }
    
    return 0;
  };

  // Helper function to get booking button text
  const getBookingButtonText = () => {
    if (loading) return 'Submitting...';
    
    if (selectedEvent) {
      const selectedPkg = getSelectedPackage();
      if (selectedPkg) {
        return `Book Event - ${selectedPkg.name} - Rp${selectedPkg.price.toLocaleString()}`;
      }
      return `Book Event - Rp${selectedEvent.price.toLocaleString()}/person`;
    }
    
    return 'Book';
  };

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setFormData({
        bookingDate: '',
        bookingTime: '',
        adults: '',
        children: '',
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        paymentImage: null,
        selectedPackage: ''
      })
      setPaymentImagePreview(null)
      setError('')
    }
  }, [isOpen])

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

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('Please select a valid image file')
        return
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image must be smaller than 5MB')
        return
      }
      
      setFormData(prev => ({
        ...prev,
        paymentImage: file
      }))
      
      // Create preview
      const reader = new FileReader()
      reader.onload = (e) => {
        setPaymentImagePreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate payment image is required
    if (!formData.paymentImage) {
      setError('Please upload payment proof image to complete your booking')
      return
    }
    
    // Validate package selection for events with packages
    if (selectedEvent?.hasPackages && selectedEvent.packages && selectedEvent.packages.length > 0 && !formData.selectedPackage) {
      setError('Please select a package for this event')
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
      let paymentImageUrl = ''
      
      // Upload payment image to Firebase Storage
      if (formData.paymentImage) {
        const timestamp = Date.now()
        const fileName = `payment_${timestamp}_${formData.paymentImage.name}`
        const storageRef = ref(storage, `payment-proofs/${fileName}`)
        
        const snapshot = await uploadBytes(storageRef, formData.paymentImage)
        paymentImageUrl = await getDownloadURL(snapshot.ref)
      }

      // Generate unique booking ID using timestamp
      const eventName = selectedEvent?.name || 'booking';
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substr(2, 3).toUpperCase();
      
      // Create a more unique booking ID
      let bookingId: string;
      if (!eventName || eventName === 'booking') {
        bookingId = `BK${String(timestamp).slice(-6)}`;
      } else {
        const words = eventName.trim().split(/\s+/);
        let abbreviation = '';
        
        if (words.length === 1) {
          abbreviation = words[0].substring(0, 3).toUpperCase();
        } else if (words.length === 2) {
          abbreviation = (words[0].substring(0, 2) + words[1].substring(0, 1)).toUpperCase();
        } else {
          abbreviation = (words[0].substring(0, 1) + words[1].substring(0, 1) + words[2].substring(0, 1)).toUpperCase();
        }
        
        // Use timestamp last 3 digits + random suffix for uniqueness
        const uniqueNumber = String(timestamp).slice(-3) + randomSuffix.slice(0, 1);
        bookingId = `${abbreviation}${uniqueNumber}`;
      }

      // Prepare booking data
      const selectedPkg = getSelectedPackage();
      const totalGuests = (parseInt(formData.adults) || 0) + (parseInt(formData.children) || 0);
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
        // Package information
        hasPackage: Boolean(selectedPkg),
        packageId: selectedPkg?.id || null,
        packageName: selectedPkg?.name || null,
        packagePrice: selectedPkg?.price || null,
        packagePeopleCount: selectedPkg?.peopleCount || null,
        totalPrice: calculateTotalPrice(),
        status: 'pending',
        paymentStatus: 'pending', // New field for payment review
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      }

      // Save to Firestore
      await addDoc(collection(db, 'booking'), bookingData)
      
      // Send booking confirmation email
      try {
        await emailService.sendBookingConfirmation({
          bookingId: bookingId,
          eventName: selectedEvent?.name || 'Room Booking',
          customerName: `${formData.firstName} ${formData.lastName}`,
          bookingDate: formData.bookingDate,
          bookingTime: formData.bookingTime,
          totalGuests: (parseInt(formData.adults) || 0) + (parseInt(formData.children) || 0),
          totalPrice: calculateTotalPrice(),
          email: formData.email
        })
        console.log('Room booking confirmation email sent successfully')
      } catch (emailError) {
        console.error('Error sending room booking confirmation email:', emailError)
        // Don't break the booking flow if email fails
      }
      
      // Call original onSubmit for any additional logic
      onSubmit(e)
      
      // Success - close modal
      onClose()
      
      toast.success('Booking submitted successfully! Payment proof uploaded. We will review and contact you soon.')
      
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
          flex items-center justify-center bg-white
          sm:w-[98vw] sm:h-[98vh] sm:max-w-[1100px] sm:max-h-[95vh]
        "
        style={{ minWidth: 0, minHeight: 0 }}
      >
        <div className="p-6 w-full h-full overflow-y-auto flex flex-col bg-white text-black">
          <DialogHeader>
            <DialogTitle className="text-2xl text-black">
              {selectedEvent?.name}
            </DialogTitle>
          </DialogHeader>
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
                    <p className="text-gray-700 mb-4 text-pretty">{selectedEvent.description}</p>
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
                    
                    {/* Package or Regular Pricing Display */}
                    {selectedEvent.hasPackages && selectedEvent.packages && selectedEvent.packages.length > 0 ? (
                      <div>
                        <span className="font-medium">Packages Available:</span>
                        <div className="mt-2 space-y-1">
                          {selectedEvent.packages.map((pkg, index) => (
                            <div key={index} className="text-sm">
                              <span className="font-medium">{pkg.name}:</span> Rp{pkg.price.toLocaleString()} for {pkg.peopleCount} people
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <span className="font-medium">Price:</span> Rp{selectedEvent.price.toLocaleString()}/person
                      </div>
                    )}
                  </div>
                  <div>
                    <h4 className="font-semibold mb-3 text-gray-800">Includes</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedEvent.includes.map((item: string, index: number) => (
                        <Badge key={index} variant="outline" className="bg-white text-gray-800 border-gray-300">
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

                  <div className="bg-gray-50 p-6 rounded-lg border">
                    <h4 className="font-semibold text-lg mb-4 text-gray-800">Book This Special Event</h4>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                      <div>
                        <Label htmlFor="bookingDate" className="text-gray-800 font-medium">Booking Date</Label>
                        <Input 
                          type="date" 
                          id="bookingDate" 
                          value={formData.bookingDate}
                          onChange={handleInputChange}
                          min={selectedEvent.startDate || undefined}
                          max={selectedEvent.endDate || undefined}
                          required 
                          className="bg-white border-gray-300 text-gray-800"
                        />
                      </div>
                      <div>
                        <Label htmlFor="bookingTime" className="text-gray-800 font-medium">Booking Time</Label>
                        <Input 
                          type="time" 
                          id="bookingTime" 
                          value={formData.bookingTime}
                          onChange={handleInputChange}
                          className="bg-white border-gray-300 text-gray-800"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4 mb-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="adults" className="text-gray-800 font-medium">Adults (minimum: {selectedEvent.minGuests})</Label>
                          <Input
                            type="number"
                            id="adults"
                            min="1"
                            value={formData.adults}
                            onChange={handleInputChange}
                            required
                            className="bg-white border-gray-300 text-gray-800"
                          />
                        </div>
                        <div>
                          <Label htmlFor="children" className="text-gray-800 font-medium">Children</Label>
                          <Input
                            type="number"
                            id="children"
                            min="0"
                            value={formData.children}
                            onChange={handleInputChange}
                            className="bg-white border-gray-300 text-gray-800"
                          />
                        </div>
                      </div>
                      
                      {/* Package Selection */}
                      {selectedEvent.hasPackages && selectedEvent.packages && selectedEvent.packages.length > 0 && (
                        <div>
                          <Label htmlFor="package" className="text-gray-800 font-medium">
                            Select Package *
                          </Label>
                          <Select 
                            value={formData.selectedPackage} 
                            onValueChange={(value: string) => setFormData({ ...formData, selectedPackage: value })}
                          >
                            <SelectTrigger className="bg-white border-gray-300 text-gray-900 focus:border-gray-500" style={{color: '#1f2937'}}>
                              <SelectValue placeholder="Choose a package" className="text-gray-900" style={{color: '#1f2937'}} />
                            </SelectTrigger>
                            <SelectContent className="bg-white border-gray-300 max-h-64 overflow-y-auto">
                              {selectedEvent.packages.map((pkg, index) => (
                                <SelectItem 
                                  key={pkg.id || index} 
                                  value={pkg.id || index.toString()} 
                                  className="p-3 hover:bg-gray-50 focus:bg-gray-50 text-gray-900"
                                  style={{color: '#1f2937'}}
                                >
                                  <div className="flex justify-between items-center w-full" style={{color: '#1f2937'}}>
                                    <span className="font-medium text-gray-900" style={{color: '#1f2937'}}>{pkg.name}</span>
                                    <span className="text-sm text-gray-700 ml-2" style={{color: '#374151'}}>
                                      Rp{pkg.price.toLocaleString()} for {pkg.peopleCount} people
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          
                          {/* Selected Package Details */}
                          {formData.selectedPackage && (() => {
                            const selectedPkg = getSelectedPackage();
                            return selectedPkg && (
                              <div className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                                <h5 className="font-medium text-gray-800 mb-2">Selected Package: {selectedPkg.name}</h5>
                                <div className="text-sm text-gray-700 space-y-1">
                                  <div>
                                    <strong className="text-gray-800">Price:</strong> Rp{selectedPkg.price.toLocaleString()} for {selectedPkg.peopleCount} people
                                  </div>
                                  {selectedPkg.description && (
                                    <div>
                                      <strong className="text-gray-800">Description:</strong> <span className="text-gray-700">{selectedPkg.description}</span>
                                    </div>
                                  )}
                                  <div>
                                    <strong className="text-gray-800">Includes:</strong> <span className="text-gray-700">{selectedPkg.includes.join(', ')}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-800">Organizer Information</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="firstName" className="text-gray-800 font-medium">First Name</Label>
                        <Input 
                          type="text" 
                          id="firstName" 
                          value={formData.firstName}
                          onChange={handleInputChange}
                          required 
                          className="bg-white border-gray-300 text-gray-800"
                        />
                      </div>
                      <div>
                        <Label htmlFor="lastName" className="text-gray-800 font-medium">Last Name</Label>
                        <Input 
                          type="text" 
                          id="lastName" 
                          value={formData.lastName}
                          onChange={handleInputChange}
                          required 
                          className="bg-white border-gray-300 text-gray-800"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="email" className="text-gray-800 font-medium">Email Address</Label>
                      <Input 
                        type="email" 
                        id="email" 
                        value={formData.email}
                        onChange={handleInputChange}
                        required 
                        className="bg-white border-gray-300 text-gray-800"
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone" className="text-gray-800 font-medium">Phone Number</Label>
                      <Input 
                        type="tel" 
                        id="phone" 
                        value={formData.phone}
                        onChange={handleInputChange}
                        required 
                        className="bg-white border-gray-300 text-gray-800"
                      />
                    </div>

                    {/* Payment Proof Upload */}
                    <div className="space-y-4 pt-4 border-t">
                      <h4 className="font-semibold text-lg text-gray-800">Payment Proof</h4>
                      <p className="text-sm text-gray-700">
                        Please upload your payment proof to complete the booking. Admin will review and confirm your booking.
                      </p>
                      
                      <div>
                        <Label htmlFor="paymentImage" className="text-gray-800 font-medium">Upload Payment Receipt *</Label>
                        <Input 
                          type="file" 
                          id="paymentImage" 
                          accept="image/*"
                          onChange={handleImageChange}
                          required 
                          className="mt-1"
                        />
                        {paymentImagePreview && (
                          <div className="mt-3">
                            <img 
                              src={paymentImagePreview} 
                              alt="Payment proof preview" 
                              className="max-w-full h-48 object-contain border rounded-lg"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4 mt-auto">
                    <Button type="button" variant="outline" onClick={onClose} className="flex-1 bg-transparent border-gray-300 hover:bg-gray-50 hover:text-gray-900">
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      variant="outline"
                      className="flex-1 bg-transparent border-gray-300 hover:bg-gray-50 text-red-600 hover:text-red-700"
                      disabled={loading}
                    >
                      {getBookingButtonText()}
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
