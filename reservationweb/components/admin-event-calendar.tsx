"use client"

import type React from "react"

import { useState, useMemo, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, ChevronLeft, ChevronRight, Plus, Filter, Trash2, Clock, MapPin } from "lucide-react"
import { cn } from "@/lib/utils"
import { addEvent, deleteEvent, subscribeToEvents } from "@/lib/eventService"
import { AdminEvent } from "@/lib/types"

type ViewMode = "day" | "week" | "month" | "year"

type DatePickerMode = "month" | "year" | "decade"

// Using AdminEvent type from shared types
type Event = AdminEvent

// Initial mock events for demonstration
const mockEvents: Event[] = [
  {
    id: "1",
    title: "Team Meeting",
    description: "Weekly team sync",
         startDate: new Date(2024, 11, 15),
    endDate: new Date(2024, 11, 15),
    startTime: "09:00",
    endTime: "10:00",
    category: "meeting",
    location: "Conference Room A",
  },
  {
    id: "2",
    title: "Project Deadline",
    description: "Submit final report",
    startDate: new Date(2024, 11, 20),
    endDate: new Date(2024, 11, 20),
    startTime: "17:00",
    endTime: "17:30",
    category: "deadline",
  },
  {
    id: "3",
    title: "Company Event",
    description: "Annual holiday party",
    startDate: new Date(2024, 11, 22),
    endDate: new Date(2024, 11, 22),
    startTime: "18:00",
    endTime: "22:00",
    category: "event",
    location: "Main Hall",
  },
  {
    id: "4",
    title: "Conference Trip",
    description: "Tech conference in San Francisco",
    startDate: new Date(2024, 11, 18),
    endDate: new Date(2024, 11, 21),
    startTime: "08:00",
    endTime: "18:00",
    category: "event",
    location: "San Francisco",
  },
  {
    id: "5",
    title: "Client Presentation",
    description: "Present quarterly results",
    startDate: new Date(2024, 11, 15),
    endDate: new Date(2024, 11, 15),
    startTime: "14:00",
    endTime: "15:30",
    category: "meeting",
    location: "Conference Room B",
  },
]

export function AdminEventCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<ViewMode>("month")
  const [datePickerMode, setDatePickerMode] = useState<DatePickerMode>("month")
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [isAddEventOpen, setIsAddEventOpen] = useState(false)
  const [isYearEventsOpen, setIsYearEventsOpen] = useState(false)
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [newEvent, setNewEvent] = useState({
    name: "",
    description: "",
    price: "",
    image: "",
    includes: "",
    duration: "",
    eventType: "",
    minGuests: "",
    startDate: "",
    startTime: "",
    endTime: "",
  })
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Handle image file selection
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        alert("Image size should be less than 2MB")
        return
      }
      
      setSelectedImageFile(file)
      // Create preview URL
      const previewUrl = URL.createObjectURL(file)
      setImagePreview(previewUrl)
    }
  }

  // Subscribe to Firebase events on component mount
  useEffect(() => {
    const unsubscribe = subscribeToEvents((firebaseEvents) => {
      setEvents(firebaseEvents)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const categoryColors = {
    meeting: "bg-blue-100 text-blue-800 border-blue-200",
    deadline: "bg-red-100 text-red-800 border-red-200",
    event: "bg-green-100 text-green-800 border-green-200",
    reminder: "bg-yellow-100 text-yellow-800 border-yellow-200",
  }

  const filteredEvents = useMemo(() => {
    return events.filter((event) => selectedCategory === "all" || event.category === selectedCategory)
  }, [events, selectedCategory])

  const handleAddEvent = async () => {
    if (!newEvent.name || !newEvent.price) {
      alert("Please fill in all required fields (Name and Price)")
      return
    }

    setIsSubmitting(true)
    try {
      // Import the special event service
      const { specialEventService } = await import('@/services/special-event-service')

      // Create special event data - ensure all fields are properly typed
      const specialEventData = {
        name: newEvent.name,
        description: newEvent.description,
        price: parseFloat(newEvent.price) || 0,
        image: newEvent.image || "/placeholder.svg",
        includes: newEvent.includes ? newEvent.includes.split(',').map(item => item.trim()).filter(item => item) : [],
        duration: newEvent.duration || `${newEvent.startTime} - ${newEvent.endTime}`,
        eventType: newEvent.eventType || "Special Event",
        minGuests: parseInt(newEvent.minGuests) || 1,
        eventDate: newEvent.startDate || undefined,
        startTime: newEvent.startTime || undefined,
        endTime: newEvent.endTime || undefined,
      }

      console.log('Submitting event data:', specialEventData)

      // Add special event to Firebase (with image upload if provided)
      const eventId = await specialEventService.addSpecialEvent(specialEventData, selectedImageFile || undefined)
      
      console.log('Event successfully added with ID:', eventId)

      // Reset form
      setNewEvent({
        name: "",
        description: "",
        price: "",
        image: "",
        includes: "",
        duration: "",
        eventType: "",
        minGuests: "",
        startDate: "",
        startTime: "",
        endTime: "",
      })
      setSelectedImageFile(null)
      setImagePreview("")
      setIsAddEventOpen(false)
      alert("Special event added successfully!")
    } catch (error) {
      console.error("Failed to add special event:", error)
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
      alert(`Failed to add event: ${errorMessage}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRemoveEvent = async (eventId: string) => {
    try {
      await deleteEvent(eventId)
    } catch (error) {
      console.error("Failed to delete event:", error)
      // You could add a toast notification here
    }
  }

  const isMultiDayEvent = (event: Event) => {
    return event.startDate.toDateString() !== event.endDate.toDateString()
  }

  const isDateInEventRange = (date: Date, event: Event) => {
    const dateTime = date.getTime()
    const startTime = event.startDate.getTime()
    const endTime = event.endDate.getTime()
    return dateTime >= startTime && dateTime <= endTime
  }

  const navigateDate = (direction: "prev" | "next") => {
    const newDate = new Date(currentDate)

    switch (viewMode) {
      case "day":
        newDate.setDate(newDate.getDate() + (direction === "next" ? 1 : -1))
        break
      case "week":
        newDate.setDate(newDate.getDate() + (direction === "next" ? 7 : -7))
        break
      case "month":
        newDate.setMonth(newDate.getMonth() + (direction === "next" ? 1 : -1))
        break
      case "year":
        newDate.setFullYear(newDate.getFullYear() + (direction === "next" ? 1 : -1))
        break
    }

    setCurrentDate(newDate)
  }

  const handleDateClick = (date: Date) => {
    setCurrentDate(date)
    if (datePickerMode === "year") {
      setDatePickerMode("month")
    } else if (datePickerMode === "month") {
      setViewMode("month")
      setDatePickerMode("month")
    }
  }

  const handleHeaderClick = () => {
    if (viewMode === "month") {
      const yearMatch = currentDate.toLocaleDateString("en-US", { year: "numeric" }).match(/\d{4}/)
      if (yearMatch) {
        const year = Number.parseInt(yearMatch[0])
        setSelectedYear(year)
        setIsYearEventsOpen(true)
      } else {
        setDatePickerMode("year")
      }
    } else if (viewMode === "year") {
      setDatePickerMode("decade")
    }
  }

  const handleYearClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    const year = currentDate.getFullYear()
    setSelectedYear(year)
    setIsYearEventsOpen(true)
  }

  const getDateRangeText = () => {
    const options: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "long",
      day: viewMode === "day" ? "numeric" : undefined,
    }

    switch (viewMode) {
      case "day":
        return currentDate.toLocaleDateString("en-US", options)
      case "week":
        const weekStart = new Date(currentDate)
        weekStart.setDate(currentDate.getDate() - currentDate.getDay())
        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekStart.getDate() + 6)
        return `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
      case "month":
        return currentDate.toLocaleDateString("en-US", { year: "numeric", month: "long" })
      case "year":
        return currentDate.getFullYear().toString()
    }
  }

  const getEventsForYear = (year: number) => {
    return events.filter((event) => event.startDate.getFullYear() === year || event.endDate.getFullYear() === year)
  }

  const renderDatePicker = () => {
    if (datePickerMode === "year") {
      return <YearPicker currentDate={currentDate} onDateClick={handleDateClick} />
    } else if (datePickerMode === "decade") {
      return <DecadePicker currentDate={currentDate} onDateClick={handleDateClick} />
    }
    return null
  }

  const renderCalendarGrid = () => {
    if (datePickerMode !== "month") {
      return renderDatePicker()
    }

    if (viewMode === "month") {
      return (
        <MonthView
          currentDate={currentDate}
          events={filteredEvents}
          onRemoveEvent={handleRemoveEvent}
          categoryColors={categoryColors}
          isDateInEventRange={isDateInEventRange}
          isMultiDayEvent={isMultiDayEvent}
          onDateClick={(date) => {
            setCurrentDate(date)
            setViewMode("day")
          }}
        />
      )
    } else if (viewMode === "week") {
      return (
        <WeekView
          currentDate={currentDate}
          events={filteredEvents}
          onRemoveEvent={handleRemoveEvent}
          categoryColors={categoryColors}
          isDateInEventRange={isDateInEventRange}
        />
      )
    } else if (viewMode === "day") {
      return (
        <DayView
          currentDate={currentDate}
          events={filteredEvents}
          onRemoveEvent={handleRemoveEvent}
          categoryColors={categoryColors}
          isDateInEventRange={isDateInEventRange}
        />
      )
    } else {
      return <YearView currentDate={currentDate} events={filteredEvents} isDateInEventRange={isDateInEventRange} />
    }
  }

  // Show loading state while Firebase data is loading
  if (loading) {
    return (
      <div className="flex flex-col space-y-2 w-full h-full min-h-screen">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <h1 className="text-lg font-semibold text-foreground">Event Management</h1>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-muted-foreground">Loading events...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    // root becomes a full-height flex column so the calendar can expand
    <div className="flex flex-col space-y-2 w-full h-full min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          <h1 className="text-lg font-semibold text-foreground">Special Events Management</h1>
        </div>

        <Dialog open={isAddEventOpen} onOpenChange={setIsAddEventOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-primary hover:bg-primary/90">
              <Plus className="h-3 w-3 mr-1" />
              Add Special Event
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Special Event</DialogTitle>
              <p className="text-sm text-muted-foreground">Create a special event that will appear on the client website</p>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Event Name *</Label>
                <Input
                  id="name"
                  value={newEvent.name}
                  onChange={(e) => setNewEvent({ ...newEvent, name: e.target.value })}
                  placeholder="Special event name"
                  required
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  placeholder="Event description"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="price">Price per Person *</Label>
                  <Input
                    id="price"
                    type="number"
                    value={newEvent.price}
                    onChange={(e) => setNewEvent({ ...newEvent, price: e.target.value })}
                    placeholder="150"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="minGuests">Minimum Guests</Label>
                  <Input
                    id="minGuests"
                    type="number"
                    value={newEvent.minGuests}
                    onChange={(e) => setNewEvent({ ...newEvent, minGuests: e.target.value })}
                    placeholder="1"
                    min="1"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="eventType">Event Type</Label>
                <Input
                  id="eventType"
                  value={newEvent.eventType}
                  onChange={(e) => setNewEvent({ ...newEvent, eventType: e.target.value })}
                  placeholder="e.g., Culinary Experience, Entertainment"
                />
              </div>
              <div>
                <Label htmlFor="includes">What's Included (comma-separated)</Label>
                <Textarea
                  id="includes"
                  value={newEvent.includes}
                  onChange={(e) => setNewEvent({ ...newEvent, includes: e.target.value })}
                  placeholder="5-Course Dinner, Wine Pairings, Sommelier Service"
                />
              </div>
              <div>
                <Label htmlFor="duration">Duration</Label>
                <Input
                  id="duration"
                  value={newEvent.duration}
                  onChange={(e) => setNewEvent({ ...newEvent, duration: e.target.value })}
                  placeholder="3 hours"
                />
              </div>
              <div>
                <Label htmlFor="imageFile">Event Image</Label>
                <Input
                  id="imageFile"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="mb-2"
                />
                {imagePreview && (
                  <div className="mt-2">
                    <img 
                      src={imagePreview} 
                      alt="Preview" 
                      className="w-full h-32 object-cover rounded-lg border"
                    />
                  </div>
                )}
                <div className="mt-2">
                  <Label htmlFor="imageUrl">Or enter Image URL</Label>
                  <Input
                    id="imageUrl"
                    value={newEvent.image}
                    onChange={(e) => setNewEvent({ ...newEvent, image: e.target.value })}
                    placeholder="/placeholder.svg"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="startDate">Event Date (for reference)</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={newEvent.startDate}
                  onChange={(e) => setNewEvent({ ...newEvent, startDate: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startTime">Start Time (for reference)</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={newEvent.startTime}
                    onChange={(e) => setNewEvent({ ...newEvent, startTime: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="endTime">End Time (for reference)</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={newEvent.endTime}
                    onChange={(e) => setNewEvent({ ...newEvent, endTime: e.target.value })}
                  />
                </div>
              </div>
              <Button onClick={handleAddEvent} className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Adding Event..." : "Add Special Event"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-2">
        {/* View Mode Selector */}
        <div className="flex gap-1">
          {(["day", "week", "month", "year"] as ViewMode[]).map((mode) => (
            <Button
              key={mode}
              variant={viewMode === mode ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setViewMode(mode)
                setDatePickerMode("month")
              }}
              className="capitalize text-xs px-2 h-7"
            >
              {mode}
            </Button>
          ))}
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2">
          <Filter className="h-3 w-3 text-muted-foreground" />
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-32 h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="meeting">Meetings</SelectItem>
              <SelectItem value="deadline">Deadlines</SelectItem>
              <SelectItem value="event">Events</SelectItem>
              <SelectItem value="reminder">Reminders</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => navigateDate("prev")} className="h-7 px-2">
          <ChevronLeft className="h-3 w-3" />
        </Button>
        <div className="flex items-center gap-1">
          {viewMode === "month" ? (
            <>
              <Button
                variant="ghost"
                className="text-sm font-medium text-foreground hover:bg-muted h-7 px-2"
                onClick={handleHeaderClick}
              >
                {currentDate.toLocaleDateString("en-US", { month: "long" })}
              </Button>
              <Button
                variant="ghost"
                className="text-sm font-medium text-foreground hover:bg-muted h-7 px-2"
                onClick={handleYearClick}
              >
                {currentDate.getFullYear()}
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              className="text-sm font-medium text-foreground hover:bg-muted h-7 px-2"
              onClick={handleHeaderClick}
            >
              {getDateRangeText()}
            </Button>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => navigateDate("next")} className="h-7 px-2">
          <ChevronRight className="h-3 w-3" />
        </Button>
      </div>

      {/* Year Events Popup Dialog */}
      <Dialog open={isYearEventsOpen} onOpenChange={setIsYearEventsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Events in {selectedYear}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {selectedYear && getEventsForYear(selectedYear).length === 0 ? (
              <div className="text-center text-muted-foreground py-8">No events found for {selectedYear}</div>
            ) : (
              selectedYear &&
              getEventsForYear(selectedYear).map((event) => (
                <div key={event.id} className={cn("p-3 rounded-lg border", categoryColors[event.category])}>
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold">{event.title}</h3>
                    <Badge variant="secondary" className="capitalize text-xs">
                      {event.category}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{event.description}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {event.startDate.toLocaleDateString()}
                      {event.startDate.toDateString() !== event.endDate.toDateString() &&
                        ` - ${event.endDate.toLocaleDateString()}`}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {event.startTime} - {event.endTime}
                    </div>
                    {event.location && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {event.location}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Calendar Grid - allow the grid to grow and scroll */}
      <div className="w-full flex-1 min-h-0 overflow-auto">{renderCalendarGrid()}</div>
    </div>
  )
}

function MonthView({
  currentDate,
  events,
  onRemoveEvent,
  categoryColors,
  isDateInEventRange,
  isMultiDayEvent,
  onDateClick,
}: {
  currentDate: Date
  events: Event[]
  onRemoveEvent: (id: string) => void
  categoryColors: Record<string, string>
  isDateInEventRange: (date: Date, event: Event) => boolean
  isMultiDayEvent: (event: Event) => boolean
  onDateClick?: (date: Date) => void
}) {
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
  const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
  const startDate = new Date(firstDayOfMonth)
  startDate.setDate(startDate.getDate() - firstDayOfMonth.getDay())

  const days = []
  const currentDateObj = new Date(startDate)

  for (let i = 0; i < 42; i++) {
    days.push(new Date(currentDateObj))
    currentDateObj.setDate(currentDateObj.getDate() + 1)
  }

  const getEventsForDate = (date: Date) => {
    return events.filter((event) => isDateInEventRange(date, event))
  }

  return (
    // stretch month card to fill available container and allow internal scrolling
    <Card className="w-full h-full">
      <CardContent className="p-2 h-full min-h-0">
        <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden h-full">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="p-2 text-center font-medium text-muted-foreground bg-muted text-xs">
              {day}
            </div>
          ))}
          {days.map((day, index) => {
            const dayEvents = getEventsForDate(day)
            const isCurrentMonth = day.getMonth() === currentDate.getMonth()
            const isToday = day.toDateString() === new Date().toDateString()

            return (
              <div
                key={index}
                // day cell is a column so events can grow and scroll inside
                className={cn(
                  "flex flex-col p-1 bg-background cursor-pointer hover:bg-muted/50 transition-colors relative min-h-0",
                  !isCurrentMonth && "bg-muted/30 text-muted-foreground",
                  isToday && "bg-accent text-accent-foreground",
                )}
                onClick={() => onDateClick?.(day)}
              >
                <div className={cn("text-sm mb-1", isToday && "font-bold")}>{day.getDate()}</div>
                {dayEvents.length > 0 && (
                  // allow event list to scroll if it grows
                  <div className="space-y-px overflow-auto max-h-36">
                    {dayEvents.slice(0, 2).map((event) => (
                      <div
                        key={event.id}
                        className={cn(
                          "text-xs px-1 py-0.5 rounded text-center truncate",
                          categoryColors[event.category],
                        )}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {event.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="text-xs text-muted-foreground text-center">+{dayEvents.length - 2} more</div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function YearPicker({
  currentDate,
  onDateClick,
}: {
  currentDate: Date
  onDateClick: (date: Date) => void
}) {
  const currentYear = currentDate.getFullYear()
  const months = Array.from({ length: 12 }, (_, i) => {
    return new Date(currentYear, i, 1)
  })

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-center text-lg">{currentYear}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2">
          {months.map((month, index) => (
            <Button
              key={index}
              variant="outline"
              className="h-12 text-sm bg-transparent"
              onClick={() => onDateClick(month)}
            >
              {month.toLocaleDateString("en-US", { month: "short" })}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function DecadePicker({
  currentDate,
  onDateClick,
}: {
  currentDate: Date
  onDateClick: (date: Date) => void
}) {
  const currentYear = currentDate.getFullYear()
  const startYear = Math.floor(currentYear / 10) * 10
  const years = Array.from({ length: 12 }, (_, i) => startYear + i - 1)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-center text-lg">{startYear}s</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2">
          {years.map((year) => (
            <Button
              key={year}
              variant={year === currentYear ? "default" : "outline"}
              className="h-12 text-sm"
              onClick={() => onDateClick(new Date(year, currentDate.getMonth(), 1))}
            >
              {year}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function WeekView({
  currentDate,
  events,
  onRemoveEvent,
  categoryColors,
  isDateInEventRange,
}: {
  currentDate: Date
  events: Event[]
  onRemoveEvent: (id: string) => void
  categoryColors: Record<string, string>
  isDateInEventRange: (date: Date, event: Event) => boolean
}) {
  const weekStart = new Date(currentDate)
  weekStart.setDate(currentDate.getDate() - currentDate.getDay())

  const weekDays = []
  for (let i = 0; i < 7; i++) {
    const day = new Date(weekStart)
    day.setDate(weekStart.getDate() + i)
    weekDays.push(day)
  }

  const getEventsForDate = (date: Date) => {
    return events.filter((event) => isDateInEventRange(date, event))
  }

  return (
    // stretch week view and make day content scrollable
    <Card className="w-full h-full">
      <CardContent className="p-0 h-full min-h-0">
        <div className="grid grid-cols-7 gap-0 h-full">
          {weekDays.map((day, index) => {
            const dayEvents = getEventsForDate(day)
            const isToday = day.toDateString() === new Date().toDateString()

            return (
              <div key={index} className="border-r last:border-r-0 flex flex-col">
                <div
                  className={cn(
                    "p-2 text-center border-b font-medium",
                    isToday && "bg-primary text-primary-foreground",
                  )}
                >
                  <div className="text-sm">{day.toLocaleDateString("en-US", { weekday: "short" })}</div>
                  <div className="text-lg">{day.getDate()}</div>
                  {dayEvents.length > 0 && <div className="text-xs opacity-75">{dayEvents.length} events</div>}
                </div>
                <div className="p-2 min-h-0 flex-1 space-y-2 overflow-auto">
                  {dayEvents.map((event) => (
                    <div
                      key={event.id}
                      className={cn("p-2 rounded border text-sm group relative", categoryColors[event.category])}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">{event.title}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100"
                          onClick={() => onRemoveEvent(event.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-1 text-xs opacity-75">
                        <Clock className="h-3 w-3" />
                        {event.startTime} - {event.endTime}
                      </div>
                      {event.location && (
                        <div className="flex items-center gap-1 text-xs opacity-75">
                          <MapPin className="h-3 w-3" />
                          {event.location}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function DayView({
  currentDate,
  events,
  onRemoveEvent,
  categoryColors,
  isDateInEventRange,
}: {
  currentDate: Date
  events: Event[]
  onRemoveEvent: (id: string) => void
  categoryColors: Record<string, string>
  isDateInEventRange: (date: Date, event: Event) => boolean
}) {
  const dayEvents = events
    .filter((event) => isDateInEventRange(currentDate, event))
    .sort((a, b) => a.startTime.localeCompare(b.startTime))

  return (
    // allow day view to stretch and scroll
    <Card className="w-full h-full">
      <CardHeader>
        <CardTitle className="text-center">
          {currentDate.toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-auto min-h-0">
        <div className="space-y-4">
          {dayEvents.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">No events scheduled for this day</div>
          ) : (
            dayEvents.map((event) => {
              const isMultiDay = event.startDate.toDateString() !== event.endDate.toDateString()

              return (
                <div
                  key={event.id}
                  className={cn(
                    "p-4 rounded-lg border group relative",
                    categoryColors[event.category],
                    isMultiDay && "border-l-4 border-l-primary",
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-2">{event.title}</h3>
                      <p className="text-sm mb-3">{event.description}</p>
                      <div className="flex items-center gap-4 text-sm flex-wrap">
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {event.startTime} - {event.endTime}
                        </div>
                        {isMultiDay && (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {event.startDate.toLocaleDateString()} - {event.endDate.toLocaleDateString()}
                          </div>
                        )}
                        {event.location && (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            {event.location}
                          </div>
                        )}
                        <Badge variant="secondary" className="capitalize">
                          {event.category}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="opacity-0 group-hover:opacity-100"
                      onClick={() => onRemoveEvent(event.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function YearView({
  currentDate,
  events,
  isDateInEventRange,
}: {
  currentDate: Date
  events: Event[]
  isDateInEventRange: (date: Date, event: Event) => boolean
}) {
  const months = Array.from({ length: 12 }, (_, i) => {
    return new Date(currentDate.getFullYear(), i, 1)
  })

  const getEventsForMonth = (month: Date) => {
    const monthStart = new Date(month.getFullYear(), month.getMonth(), 1)
    const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0)

    return events.filter((event) => {
      return event.startDate <= monthEnd && event.endDate >= monthStart
    }).length
  }

  return (
    // stretch year view and allow scrolling
    <Card className="w-full h-full">
      <CardHeader>
        <CardTitle className="text-center">{currentDate.getFullYear()}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-auto min-h-0">
        <div className="grid grid-cols-3 gap-4">
          {months.map((month, index) => {
            const eventCount = getEventsForMonth(month)

            return (
              <Card key={index} className="p-4 text-center hover:bg-muted/50 transition-colors">
                <h3 className="font-semibold mb-2">{month.toLocaleDateString("en-US", { month: "long" })}</h3>
                <div className="text-2xl font-bold text-primary mb-1">{eventCount}</div>
                <div className="text-sm text-muted-foreground">{eventCount === 1 ? "event" : "events"}</div>
              </Card>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
