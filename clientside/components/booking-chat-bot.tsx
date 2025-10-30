"use client"

import React, { useState, useRef, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Send, Bot, User, Calendar, Clock, Mail, Phone, Edit, Minus, Maximize2 } from "lucide-react"
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore'
import { db } from "@/lib/firebase"
import { toast } from "sonner"

interface Message {
  id: string
  type: 'bot' | 'user'
  content: string
  timestamp: Date
}

interface BookingInfo {
  id: string
  bookingId: string
  bookingDate: string
  bookingTime: string
  firstName: string
  lastName: string
  email: string
  phone: string
  eventName: string
  eventId: string
  adults: number
  children: number
  status: string
}

interface EventInfo {
  id: string
  startDate: string
  endDate: string
  name: string
}

type ChatStep = 
  | 'language_selection'
  | 'greeting'
  | 'ask_booking_id'
  | 'show_booking_info'
  | 'ask_verification'
  | 'verify_details'
  | 'edit_options'
  | 'edit_date'
  | 'edit_time'
  | 'confirm_changes'
  | 'ask_continue_editing'
  | 'ask_more_changes'
  | 'completed'

type Language = 'en' | 'id'

interface BookingChatBotProps {
  isOpen: boolean
  onClose: () => void
}

export default function BookingChatBot({ isOpen, onClose }: BookingChatBotProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState("")
  const [currentStep, setCurrentStep] = useState<ChatStep>('language_selection')
  const [language, setLanguage] = useState<Language>('en')
  const [bookingInfo, setBookingInfo] = useState<BookingInfo | null>(null)
  const [verificationData, setVerificationData] = useState({ email: '', phone: '' })
  const [editingField, setEditingField] = useState<'date' | 'time' | null>(null)
  const [newBookingData, setNewBookingData] = useState({ date: '', time: '' })
  const [loading, setLoading] = useState(false)
  const [hasInitialized, setHasInitialized] = useState(false)
  const [chatSize, setChatSize] = useState({ width: 320, height: 480 })
  const [isResizing, setIsResizing] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Translations object
  const translations = {
    en: {
      languageSelection: "Welcome to Claro Booking Assistant!\n\nPlease select your preferred language:\n1️⃣ English\n2️⃣ Bahasa Indonesia",
      greeting: "Good day. I am your booking assistant. I can help you modify your existing booking details such as date and time.\n\nPlease enter your booking ID:",
      askBookingId: "Please enter your booking ID:",
      searchingBooking: "Searching for your booking...",
      bookingFound: "Booking found. Here are the details:\n\n**Booking Information**\nBooking ID: {bookingId}\nName: {firstName} {lastName}\nEvent: {eventName}\nDate: {date}\nTime: {time}\nGuests: {adults} Adults, {children} Children\nStatus: {status}\n\nPlease choose an option:\n1️⃣ Continue - Proceed to edit this booking\n2️⃣ Back - Start over with a different booking ID\n\nType 1 or 2:",
      bookingNotFound: "Sorry, I could not find a booking with that ID. Please check your booking ID and try again. Make sure to enter the 6-digit booking ID (like BUP001).",
      invalidBookingId: "Please enter a valid 6-digit booking ID (letters and numbers only, like BUP001).",
      securityVerification: "For security purposes, I need to verify your identity. Please provide:",
      emailReceived: "Email received. Now please enter your phone number:",
      invalidEmail: "Please enter a valid email address.",
      verificationSuccess: "Verification successful. You can now edit your booking.",
      editOptionsMessage: "What would you like to change?\n1️⃣ Date - Change booking date\n2️⃣ Time - Change booking time\n3️⃣ Both - Change both date and time\n4️⃣ Cancel - Exit without changes\n\nType 1, 2, 3, or 4:",
      askEmail: "To proceed with editing your booking, I need to verify your identity.\n\nPlease enter your email address:",
      askPhone: "Please enter your phone number:",
      verificationFailed: "The email or phone number does not match our records. Please make sure you entered the correct information. Let's try again.\n\nPlease enter your email address:",
      editOptions: "What would you like to edit?\n\n1️⃣ Date - Change booking date\n2️⃣ Time - Change booking time\n3️⃣ Both - Change both date and time\n4️⃣ Cancel - Exit without changes\n\nType 1, 2, 3, or 4:",
      currentDate: "**Current date:**",
      currentTime: "**Current time:**",
      eventAvailable: "**Event \"{eventName}\" is available from:**",
      enterNewDate: "Please enter the new date within this range (DD-MM-YYYY format, e.g., 25-12-2025):",
      enterNewTime: "Please enter the new time (HH:MM format, e.g., 14:30):",
      invalidDate: "Please enter a valid date in DD-MM-YYYY format (e.g., 25-12-2025):",
      invalidTime: "Please enter a valid time in HH:MM format (e.g., 14:30):",
      fetchingEvent: "Fetching event information...",
      validatingDate: "Validating date...",
      newDateSet: "New date set:",
      newTimeSet: "New time set:",
      continueEditing: "Would you like to change anything else?\n1️⃣ Change time as well\n2️⃣ Confirm this change only\n3️⃣ Cancel changes\n\nType 1, 2, or 3:",
      confirmChanges: "Please confirm your changes:\n\nNew date: {date}\nNew time: {time}\n\n1️⃣ Confirm changes\n2️⃣ Make more changes\n3️⃣ Cancel\n\nType 1, 2, or 3:",
      updatingBooking: "Updating your booking...",
      bookingUpdated: "Your booking has been successfully updated.",
      noChanges: "No changes made. Have a great day.",
      completed: "Is there anything else I can help you with?\n\n1️⃣ Edit another booking\n2️⃣ Exit\n\nType 1 or 2:",
      dateAlreadyPassed: "The date {date} has already passed. Please choose a future date.\n\nPlease enter a valid date (DD-MM-YYYY format):",
      dateNotInEventPeriod: "The date {date} is not within the event period. The event \"{eventName}\" runs from {startDate} to {endDate}. Please choose a date within this range.\n\nPlease enter a valid date (DD-MM-YYYY format):",
      invalidDateFormat: "Please enter a valid date in DD-MM-YYYY format (e.g., 25-12-2025):",
      dateTooFarFuture: "The date {date} is too far in the future. Please choose a date within the next 2 years.\n\nPlease enter a valid date (DD-MM-YYYY format):",
      eventInfoNotFound: "Could not verify event date range, but the date {date} appears valid. Proceeding with basic validation.",
      currentDateAndEnterNew: "Current date: {currentDate}\n\nPlease enter the new date (DD-MM-YYYY format, e.g., 25-12-2025):",
      currentDateTimeEnterDate: "Current date: {currentDate}\nCurrent time: {currentTime}\n\nLet's start with the date. Please enter the new date (DD-MM-YYYY format, e.g., 25-12-2025):",
      invalidChoice: "Please enter 1 for Date, 2 for Time, 3 for Both, or 4 for Cancel.",
      currentDateWithEventRange: "**Current date:** {currentDate}\n\n**Event \"{eventName}\" is available from:**\n{startDate} to {endDate}\n\nPlease enter the new date within this range (DD-MM-YYYY format, e.g., 25-12-2025):",
      currentDateWithTimeAndEventRange: "**Current date:** {currentDate}\n**Current time:** {currentTime}\n\n**Event \"{eventName}\" is available from:**\n{startDate} to {endDate}\n\nLet's start with the date. Please enter the new date within this range (DD-MM-YYYY format, e.g., 25-12-2025):",
      currentTimeEnterNew: "Current time: {currentTime}\n\nPlease enter the new time (HH:MM format, e.g., 14:30):",
      notSpecified: "Not specified"
    },
    id: {
      languageSelection: "Selamat datang di Asisten Booking Claro!\n\nSilakan pilih bahasa yang Anda inginkan:\n1️⃣ English\n2️⃣ Bahasa Indonesia",
      greeting: "Selamat datang. Saya adalah asisten booking Anda. Saya dapat membantu Anda mengubah detail booking yang sudah ada seperti tanggal dan waktu.\n\nSilakan masukkan ID booking Anda:",
      askBookingId: "Silakan masukkan ID booking Anda:",
      searchingBooking: "Mencari booking Anda...",
      bookingFound: "Booking ditemukan. Berikut adalah detailnya:\n\n**Informasi Booking**\nID Booking: {bookingId}\nNama: {firstName} {lastName}\nEvent: {eventName}\nTanggal: {date}\nWaktu: {time}\nTamu: {adults} Dewasa, {children} Anak-anak\nStatus: {status}\n\nSilakan pilih opsi:\n1️⃣ Lanjutkan - Lanjut untuk mengedit booking ini\n2️⃣ Kembali - Mulai lagi dengan ID booking yang berbeda\n\nKetik 1 atau 2:",
      bookingNotFound: "Maaf, saya tidak dapat menemukan booking dengan ID tersebut. Silakan periksa ID booking Anda dan coba lagi. Pastikan memasukkan ID booking 6 digit (seperti BUP001).",
      invalidBookingId: "Silakan masukkan ID booking 6 digit yang valid (huruf dan angka saja, seperti BUP001).",
      securityVerification: "Untuk tujuan keamanan, saya perlu memverifikasi identitas Anda. Silakan berikan:",
      emailReceived: "Email diterima. Sekarang silakan masukkan nomor telepon Anda:",
      invalidEmail: "Silakan masukkan alamat email yang valid.",
      verificationSuccess: "Verifikasi berhasil. Anda sekarang dapat mengedit booking Anda.",
      editOptionsMessage: "Apa yang ingin Anda ubah?\n1️⃣ Tanggal - Ubah tanggal booking\n2️⃣ Waktu - Ubah waktu booking\n3️⃣ Keduanya - Ubah tanggal dan waktu\n4️⃣ Batal - Keluar tanpa perubahan\n\nKetik 1, 2, 3, atau 4:",
      askEmail: "Untuk melanjutkan pengeditan booking Anda, saya perlu memverifikasi identitas Anda.\n\nSilakan masukkan alamat email Anda:",
      askPhone: "Silakan masukkan nomor telepon Anda:",
      verificationFailed: "Email atau nomor telepon tidak sesuai dengan data kami. Pastikan Anda memasukkan informasi yang benar. Mari coba lagi.\n\nSilakan masukkan alamat email Anda:",
      editOptions: "Apa yang ingin Anda edit?\n\n1️⃣ Tanggal - Ubah tanggal booking\n2️⃣ Waktu - Ubah waktu booking\n3️⃣ Keduanya - Ubah tanggal dan waktu\n4️⃣ Batal - Keluar tanpa perubahan\n\nKetik 1, 2, 3, atau 4:",
      currentDate: "**Tanggal saat ini:**",
      currentTime: "**Waktu saat ini:**",
      eventAvailable: "**Event \"{eventName}\" tersedia dari:**",
      enterNewDate: "Silakan masukkan tanggal baru dalam rentang ini (format DD-MM-YYYY, contoh: 25-12-2025):",
      enterNewTime: "Silakan masukkan waktu baru (format HH:MM, contoh: 14:30):",
      invalidDate: "Silakan masukkan tanggal yang valid dalam format DD-MM-YYYY (contoh: 25-12-2025):",
      invalidTime: "Silakan masukkan waktu yang valid dalam format HH:MM (contoh: 14:30):",
      fetchingEvent: "Mengambil informasi event...",
      validatingDate: "Memvalidasi tanggal...",
      newDateSet: "Tanggal baru ditetapkan:",
      newTimeSet: "Waktu baru ditetapkan:",
      continueEditing: "Apakah Anda ingin mengubah yang lain?\n1️⃣ Ubah waktu juga\n2️⃣ Konfirmasi perubahan ini saja\n3️⃣ Batalkan perubahan\n\nKetik 1, 2, atau 3:",
      confirmChanges: "Silakan konfirmasi perubahan Anda:\n\nTanggal baru: {date}\nWaktu baru: {time}\n\n1️⃣ Konfirmasi perubahan\n2️⃣ Buat perubahan lagi\n3️⃣ Batal\n\nKetik 1, 2, atau 3:",
      updatingBooking: "Memperbarui booking Anda...",
      bookingUpdated: "Booking Anda berhasil diperbarui.",
      noChanges: "Tidak ada perubahan. Semoga hari Anda menyenangkan.",
      completed: "Apakah ada hal lain yang bisa saya bantu?\n\n1️⃣ Edit booking lain\n2️⃣ Keluar\n\nKetik 1 atau 2:",
      dateAlreadyPassed: "Tanggal {date} sudah terlewat. Silakan pilih tanggal yang akan datang.\n\nSilakan masukkan tanggal yang valid (format DD-MM-YYYY):",
      dateNotInEventPeriod: "Tanggal {date} tidak dalam periode event. Event \"{eventName}\" berlangsung dari {startDate} sampai {endDate}. Silakan pilih tanggal dalam rentang ini.\n\nSilakan masukkan tanggal yang valid (format DD-MM-YYYY):",
      invalidDateFormat: "Silakan masukkan tanggal yang valid dalam format DD-MM-YYYY (contoh: 25-12-2025):",
      dateTooFarFuture: "Tanggal {date} terlalu jauh di masa depan. Silakan pilih tanggal dalam 2 tahun ke depan.\n\nSilakan masukkan tanggal yang valid (format DD-MM-YYYY):",
      eventInfoNotFound: "Tidak dapat memverifikasi rentang tanggal event, tetapi tanggal {date} tampak valid. Melanjutkan dengan validasi dasar.",
      currentDateAndEnterNew: "Tanggal saat ini: {currentDate}\n\nSilakan masukkan tanggal baru (format DD-MM-YYYY, contoh: 25-12-2025):",
      currentDateTimeEnterDate: "Tanggal saat ini: {currentDate}\nWaktu saat ini: {currentTime}\n\nMari mulai dengan tanggal. Silakan masukkan tanggal baru (format DD-MM-YYYY, contoh: 25-12-2025):",
      invalidChoice: "Silakan masukkan 1 untuk Tanggal, 2 untuk Waktu, 3 untuk Keduanya, atau 4 untuk Batal.",
      currentDateWithEventRange: "**Tanggal saat ini:** {currentDate}\n\n**Event \"{eventName}\" tersedia dari:**\n{startDate} sampai {endDate}\n\nSilakan masukkan tanggal baru dalam rentang ini (format DD-MM-YYYY, contoh: 25-12-2025):",
      currentDateWithTimeAndEventRange: "**Tanggal saat ini:** {currentDate}\n**Waktu saat ini:** {currentTime}\n\n**Event \"{eventName}\" tersedia dari:**\n{startDate} sampai {endDate}\n\nMari mulai dengan tanggal. Silakan masukkan tanggal baru dalam rentang ini (format DD-MM-YYYY, contoh: 25-12-2025):",
      currentTimeEnterNew: "Waktu saat ini: {currentTime}\n\nSilakan masukkan waktu baru (format HH:MM, contoh: 14:30):",
      notSpecified: "Tidak ditentukan"
    }
  }

  // Helper function to get translated text
  const t = (key: string, params?: Record<string, string>): string => {
    const langTranslations = translations[language]
    let text = (langTranslations as any)[key] || key
    
    console.log('Translation debug:', { language, key, text: text.substring(0, 50) })
    
    // Replace parameters in the text
    if (params) {
      Object.entries(params).forEach(([param, value]) => {
        text = text.replace(`{${param}}`, value)
      })
    }
    
    return text
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (isOpen && !hasInitialized) {
      addBotMessage(t('languageSelection'))
      setCurrentStep('language_selection')
      setHasInitialized(true)
      // Auto-focus the input when chat opens
      setTimeout(() => {
        inputRef.current?.focus()
      }, 300)
    }
  }, [isOpen, hasInitialized])

  // Reset chat state when closing
  useEffect(() => {
    if (!isOpen) {
      setMessages([])
      setCurrentStep('language_selection')
      setLanguage('en')
      setBookingInfo(null)
      setVerificationData({ email: '', phone: '' })
      setEditingField(null)
      setNewBookingData({ date: '', time: '' })
      setHasInitialized(false)
    }
  }, [isOpen])

  const addMessage = (type: 'bot' | 'user', content: string) => {
    const messageId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const newMessage: Message = {
      id: messageId,
      type,
      content,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, newMessage])
  }

  const addBotMessage = (content: string) => {
    addMessage('bot', content)
  }

  const addUserMessage = (content: string) => {
    addMessage('user', content)
  }

  const searchBookingById = async (bookingId: string): Promise<BookingInfo | null> => {
    try {
      const bookingsQuery = query(
        collection(db, 'booking'),
        where('bookingId', '==', bookingId.toUpperCase())
      )
      const querySnapshot = await getDocs(bookingsQuery)
      
      if (!querySnapshot.empty) {
        const booking = querySnapshot.docs[0]
        const data = booking.data()
        return {
          id: booking.id,
          bookingId: data.bookingId,
          bookingDate: data.bookingDate,
          bookingTime: data.bookingTime || '',
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone,
          eventName: data.eventName,
          eventId: data.eventId || '',
          adults: data.adults || 0,
          children: data.children || 0,
          status: data.status
        }
      }
      return null
    } catch (error) {
      console.error('Error searching booking:', error)
      return null
    }
  }

  const getEventInfoByName = async (eventName: string): Promise<EventInfo | null> => {
    try {
      console.log('Looking for event with name:', eventName)
      
      if (!eventName || eventName.trim() === '') {
        console.log('Empty eventName provided')
        return null
      }

      // Clean the eventName
      const cleanEventName = eventName.trim()
      
      // Search in event collection by event name
      try {
        console.log('Searching event collection by name...')
        const eventDoc = await getDocs(query(collection(db, 'event')))
        console.log(`Found ${eventDoc.docs.length} documents in event collection`)
        
        for (const doc of eventDoc.docs) {
          const data = doc.data()
          console.log('Event doc data:', { 
            docId: doc.id, 
            title: data.title,
            name: data.name,
            eventName: data.eventName,
            startDate: data.startDate,
            endDate: data.endDate,
            eventType: data.eventType
          })
          
          // Try to match by event name (case insensitive)
          const eventTitle = (data.title || '').toLowerCase().trim()
          const eventDataName = (data.name || '').toLowerCase().trim()
          const eventDataEventName = (data.eventName || '').toLowerCase().trim()
          const searchName = cleanEventName.toLowerCase().trim()
          
          console.log('Comparing names:', {
            searchName: `"${searchName}"`,
            eventTitle: `"${eventTitle}"`,
            eventDataName: `"${eventDataName}"`,
            eventDataEventName: `"${eventDataEventName}"`,
            exactMatchTitle: eventTitle === searchName,
            exactMatchName: eventDataName === searchName,
            exactMatchEventName: eventDataEventName === searchName,
            includesMatchTitle: searchName.length > 2 && eventTitle.includes(searchName),
            includesMatchName: searchName.length > 2 && eventDataName.includes(searchName),
            includesMatchEventName: searchName.length > 2 && eventDataEventName.includes(searchName)
          })
          
          if (eventTitle === searchName || 
              eventDataName === searchName || 
              eventDataEventName === searchName ||
              (searchName.length > 2 && eventTitle.includes(searchName)) ||
              (searchName.length > 2 && eventDataName.includes(searchName)) ||
              (searchName.length > 2 && eventDataEventName.includes(searchName))) {
            console.log('✅ Found matching event by name in event collection')
            return {
              id: data.id || doc.id,
              startDate: data.startDate,
              endDate: data.endDate,
              name: data.title || data.name || data.eventName || 'Event'
            }
          }
        }
      } catch (error) {
        console.log('Error searching event collection:', error)
      }

      // Also try specialEvents collection as backup
      try {
        console.log('Searching specialEvents collection by name...')
        const specialEventDoc = await getDocs(query(collection(db, 'specialEvents')))
        console.log(`Found ${specialEventDoc.docs.length} documents in specialEvents collection`)
        
        for (const doc of specialEventDoc.docs) {
          const data = doc.data()
          console.log('Special event doc:', { 
            docId: doc.id, 
            title: data.title,
            name: data.name,
            eventName: data.eventName,
            startDate: data.startDate,
            endDate: data.endDate
          })
          
          // Try to match by event name (case insensitive)
          const eventTitle = (data.title || '').toLowerCase()
          const eventDataName = (data.name || '').toLowerCase()
          const eventDataEventName = (data.eventName || '').toLowerCase()
          const searchName = cleanEventName.toLowerCase()
          
          if (eventTitle === searchName || 
              eventDataName === searchName || 
              eventDataEventName === searchName) {
            console.log('Found matching event by name in specialEvents collection')
            return {
              id: data.id || doc.id,
              startDate: data.startDate,
              endDate: data.endDate,
              name: data.title || data.name || data.eventName || 'Special Event'
            }
          }
        }
      } catch (error) {
        console.log('Error searching specialEvents collection:', error)
      }

      console.log(`No event found with name: ${cleanEventName}`)
      return null
    } catch (error) {
      console.error('Error getting event info:', error)
      return null
    }
  }

  const isDateInEventRange = (date: string, eventInfo: EventInfo): boolean => {
    const inputDate = new Date(date)
    const startDate = new Date(eventInfo.startDate)
    const endDate = new Date(eventInfo.endDate)
    
    console.log('Date validation:', {
      inputDate: inputDate.toISOString(),
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      isValid: inputDate >= startDate && inputDate <= endDate
    })
    
    return inputDate >= startDate && inputDate <= endDate
  }

  // Comprehensive date validation function
  const validateDateForBooking = (inputDate: string, eventInfo: EventInfo): { isValid: boolean, errorMessage?: string } => {
    try {
      // Convert DD-MM-YYYY to YYYY-MM-DD for validation
      const dateForValidation = formatDateForStorage(inputDate)
      const selectedDate = new Date(dateForValidation)
      const today = new Date()
      const startDate = new Date(eventInfo.startDate)
      const endDate = new Date(eventInfo.endDate)
      
      // Set times to start of day for accurate comparison
      today.setHours(0, 0, 0, 0)
      selectedDate.setHours(0, 0, 0, 0)
      startDate.setHours(0, 0, 0, 0)
      endDate.setHours(0, 0, 0, 0)
      
      // Check if date is in the past
      if (selectedDate < today) {
        return {
          isValid: false,
          errorMessage: t('dateAlreadyPassed', { date: inputDate })
        }
      }
      
      // Check if date is within event range
      if (selectedDate < startDate || selectedDate > endDate) {
        const eventStartDisplay = formatDateForDisplay(eventInfo.startDate)
        const eventEndDisplay = formatDateForDisplay(eventInfo.endDate)
        return {
          isValid: false,
          errorMessage: t('dateNotInEventPeriod', { 
            date: inputDate, 
            eventName: eventInfo.name,
            startDate: eventStartDisplay,
            endDate: eventEndDisplay
          })
        }
      }
      
      return { isValid: true }
    } catch (error) {
      return {
        isValid: false,
        errorMessage: 'Invalid date format. Please use DD-MM-YYYY format.'
      }
    }
  }

  // Convert date from yyyy-mm-dd to dd-mm-yyyy format
  const formatDateForDisplay = (dateString: string): string => {
    if (!dateString) return dateString
    const [year, month, day] = dateString.split('-')
    return `${day}-${month}-${year}`
  }

  // Convert date from dd-mm-yyyy to yyyy-mm-dd format
  const formatDateForStorage = (dateString: string): string => {
    if (!dateString) return dateString
    if (dateString.includes('/')) {
      // Handle dd/mm/yyyy format
      const [day, month, year] = dateString.split('/')
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    }
    if (dateString.match(/^\d{2}-\d{2}-\d{4}$/)) {
      // Handle dd-mm-yyyy format
      const [day, month, year] = dateString.split('-')
      return `${year}-${month}-${day}`
    }
    return dateString // Already in yyyy-mm-dd format
  }

  const updateBookingInFirebase = async (bookingId: string, updates: any) => {
    try {
      await updateDoc(doc(db, 'booking', bookingId), {
        ...updates,
        updatedAt: new Date()
      })
      return true
    } catch (error) {
      console.error('Error updating booking:', error)
      return false
    }
  }

  const handleSendMessage = async () => {
    if (!inputValue.trim() || loading) return

    const userMessage = inputValue.trim()
    addUserMessage(userMessage)
    setInputValue("")
    setLoading(true)

    try {
      await processUserInput(userMessage)
    } catch (error) {
      console.error('Error processing input:', error)
      addBotMessage("Sorry, something went wrong. Please try again.")
    } finally {
      setLoading(false)
      // Auto-focus the input after processing
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
    }
  }

  const processUserInput = async (input: string) => {
    const trimmedInput = input.trim()
    
    switch (currentStep) {
      case 'language_selection':
        if (trimmedInput === '1') {
          console.log('Language set to English')
          setLanguage('en')
          // Use translation directly since state hasn't updated yet
          addBotMessage(translations.en.greeting)
          setCurrentStep('ask_booking_id')
        } else if (trimmedInput === '2') {
          console.log('Language set to Indonesian')
          setLanguage('id')
          // Use translation directly since state hasn't updated yet
          addBotMessage(translations.id.greeting)
          setCurrentStep('ask_booking_id')
        } else {
          console.log('Invalid language selection, current language:', language)
          // For invalid selection, use current language state
          const langSelection = language === 'id' ? translations.id.languageSelection : translations.en.languageSelection
          addBotMessage(langSelection)
        }
        break

      case 'ask_booking_id':
        if (trimmedInput.length === 6 && /^[A-Z0-9]+$/.test(trimmedInput.toUpperCase())) {
          console.log('Adding searchingBooking message, language:', language)
          const searchMessage = language === 'id' ? translations.id.searchingBooking : translations.en.searchingBooking
          addBotMessage(searchMessage)
          const booking = await searchBookingById(trimmedInput)
          
          if (booking) {
            setBookingInfo(booking)
            addBotMessage(t('bookingFound', {
              bookingId: booking.bookingId,
              firstName: booking.firstName,
              lastName: booking.lastName,
              eventName: booking.eventName,
              date: formatDateForDisplay(booking.bookingDate),
              time: booking.bookingTime || (language === 'en' ? 'Not specified' : 'Tidak ditentukan'),
              adults: booking.adults.toString(),
              children: booking.children.toString(),
              status: booking.status
            }))
            setCurrentStep('show_booking_info')
          } else {
            console.log('Adding bookingNotFound message, language:', language)
            const message = language === 'id' ? translations.id.bookingNotFound : translations.en.bookingNotFound
            addBotMessage(message)
          }
        } else {
          console.log('Adding invalidBookingId message, language:', language)
          const message = language === 'id' ? translations.id.invalidBookingId : translations.en.invalidBookingId
          addBotMessage(message)
        }
        break

      case 'show_booking_info':
        if (trimmedInput === '1') {
          const emailInstruction = language === 'en' 
            ? "1. **Email address** associated with this booking\n2. **Phone number** associated with this booking\n\nPlease enter your email address first:"
            : "1. **Alamat email** yang terkait dengan booking ini\n2. **Nomor telepon** yang terkait dengan booking ini\n\nSilakan masukkan alamat email Anda terlebih dahulu:"
          
          addBotMessage(`${t('securityVerification')}\n\n${emailInstruction}`)
          setCurrentStep('ask_verification')
        } else if (trimmedInput === '2') {
          const startOver = language === 'en' 
            ? "Sure! Let's start over. Please provide your 6-digit booking ID:"
            : "Baik! Mari mulai lagi. Silakan berikan ID booking 6 digit Anda:"
          addBotMessage(startOver)
          setCurrentStep('ask_booking_id')
          setBookingInfo(null)
        } else {
          const instruction = language === 'en' 
            ? "Please enter 1 to continue or 2 to go back."
            : "Silakan ketik 1 untuk lanjut atau 2 untuk kembali."
          addBotMessage(instruction)
        }
        break

      case 'ask_verification':
        if (trimmedInput.includes('@')) {
          setVerificationData(prev => ({ ...prev, email: trimmedInput }))
          const emailMessage = language === 'id' ? translations.id.emailReceived : translations.en.emailReceived
          addBotMessage(emailMessage)
          setCurrentStep('verify_details')
        } else {
          const invalidEmailMessage = language === 'id' ? translations.id.invalidEmail : translations.en.invalidEmail
          addBotMessage(invalidEmailMessage)
        }
        break

      case 'verify_details':
        setVerificationData(prev => ({ ...prev, phone: trimmedInput }))
        
        if (bookingInfo && 
            verificationData.email === bookingInfo.email && 
            trimmedInput === bookingInfo.phone) {
          const successMessage = language === 'id' ? translations.id.verificationSuccess : translations.en.verificationSuccess
          const optionsMessage = language === 'id' ? translations.id.editOptionsMessage : translations.en.editOptionsMessage
          addBotMessage(`${successMessage}\n\n${optionsMessage}`)
          setCurrentStep('edit_options')
        } else {
          const failMessage = language === 'id' ? translations.id.verificationFailed : translations.en.verificationFailed
          addBotMessage(failMessage)
          setVerificationData({ email: '', phone: '' })
          setCurrentStep('ask_verification')
        }
        break

      case 'edit_options':
        if (trimmedInput === '1') {
          // Fetch event info first to show date range
          if (bookingInfo?.eventName) {
            addBotMessage(t('fetchingEvent'))
            console.log('Booking eventName for edit option 1:', bookingInfo.eventName)
            const eventInfo = await getEventInfoByName(bookingInfo.eventName)
            
            if (eventInfo) {
              const eventStartDisplay = formatDateForDisplay(eventInfo.startDate)
              const eventEndDisplay = formatDateForDisplay(eventInfo.endDate)
              addBotMessage(t('currentDateWithEventRange', {
                currentDate: formatDateForDisplay(bookingInfo?.bookingDate || ''),
                eventName: eventInfo.name,
                startDate: eventStartDisplay,
                endDate: eventEndDisplay
              }))
            } else {
              addBotMessage(t('currentDateAndEnterNew', {
                currentDate: formatDateForDisplay(bookingInfo?.bookingDate || '')
              }))
            }
          } else {
            addBotMessage(t('currentDateAndEnterNew', {
              currentDate: formatDateForDisplay(bookingInfo?.bookingDate || '')
            }))
          }
          setEditingField('date')
          setCurrentStep('edit_date')
        } else if (trimmedInput === '2') {
          addBotMessage(t('currentTimeEnterNew', {
            currentTime: bookingInfo?.bookingTime || t('notSpecified')
          }))
          setEditingField('time')
          setCurrentStep('edit_time')
        } else if (trimmedInput === '3') {
          // Fetch event info first to show date range
          if (bookingInfo?.eventName) {
            addBotMessage(t('fetchingEvent'))
            const eventInfo = await getEventInfoByName(bookingInfo.eventName)
            
            if (eventInfo) {
              const eventStartDisplay = formatDateForDisplay(eventInfo.startDate)
              const eventEndDisplay = formatDateForDisplay(eventInfo.endDate)
              addBotMessage(t('currentDateWithTimeAndEventRange', {
                currentDate: formatDateForDisplay(bookingInfo?.bookingDate || ''),
                currentTime: bookingInfo?.bookingTime || t('notSpecified'),
                eventName: eventInfo.name,
                startDate: eventStartDisplay,
                endDate: eventEndDisplay
              }))
            } else {
              addBotMessage(t('currentDateTimeEnterDate', {
                currentDate: formatDateForDisplay(bookingInfo?.bookingDate || ''),
                currentTime: bookingInfo?.bookingTime || t('notSpecified')
              }))
            }
          } else {
            addBotMessage(t('currentDateTimeEnterDate', {
              currentDate: formatDateForDisplay(bookingInfo?.bookingDate || ''),
              currentTime: bookingInfo?.bookingTime || t('notSpecified')
            }))
          }
          setEditingField('date')
          setCurrentStep('edit_date')
        } else if (trimmedInput === '4') {
          addBotMessage("No changes made. Have a great day!")
          setCurrentStep('completed')
        } else {
          addBotMessage(t('invalidChoice'))
        }
        break

      case 'edit_date':
        // Accept both DD-MM-YYYY and YYYY-MM-DD formats
        if (/^\d{2}-\d{2}-\d{4}$/.test(trimmedInput) || /^\d{4}-\d{2}-\d{2}$/.test(trimmedInput)) {
          // Validate date with comprehensive checks
          if (bookingInfo?.eventName) {
            addBotMessage("Validating date...")
            const eventInfo = await getEventInfoByName(bookingInfo.eventName)
            
            if (eventInfo) {
              const validation = validateDateForBooking(trimmedInput, eventInfo)
              
              if (!validation.isValid) {
                addBotMessage(validation.errorMessage || t('invalidDateFormat'))
                return
              }
            } else {
              // Fallback: Basic date validation when event info is not available
              const dateForStorage = formatDateForStorage(trimmedInput)
              const selectedDate = new Date(dateForStorage)
              const today = new Date()
              
              // Set times to start of day for accurate comparison
              today.setHours(0, 0, 0, 0)
              selectedDate.setHours(0, 0, 0, 0)
              
              if (selectedDate < today) {
                addBotMessage(t('dateAlreadyPassed', { date: trimmedInput }))
                return
              }
              
              // Check if date is too far in the future (2 years max)
              const maxFutureDate = new Date()
              maxFutureDate.setFullYear(today.getFullYear() + 2)
              
              if (selectedDate > maxFutureDate) {
                addBotMessage(t('dateTooFarFuture', { date: trimmedInput }))
                return
              }
              
              addBotMessage(t('eventInfoNotFound', { date: trimmedInput }))
            }
          }
          
          const dateForStorage = formatDateForStorage(trimmedInput)
          setNewBookingData(prev => ({ ...prev, date: dateForStorage }))
          
          if (editingField === 'date') {
            addBotMessage(`New date set: ${formatDateForDisplay(dateForStorage)}

Would you like to change anything else?
1️⃣ Change time as well
2️⃣ Confirm this change only
3️⃣ Cancel changes

Type 1, 2, or 3:`)
            setCurrentStep('ask_continue_editing')
          } else {
            addBotMessage(`Date set: ${formatDateForDisplay(dateForStorage)}\n\nNow please enter the new time (HH:MM format):`)
            setCurrentStep('edit_time')
          }
        } else {
          addBotMessage(t('invalidDateFormat'))
        }
        break

      case 'edit_time':
        if (/^\d{2}:\d{2}$/.test(trimmedInput)) {
          setNewBookingData(prev => ({ ...prev, time: trimmedInput }))
          
          if (editingField === 'time') {
            addBotMessage(`New time set: ${trimmedInput}

Would you like to change anything else?
1️⃣ Change date as well
2️⃣ Confirm this change only
3️⃣ Cancel changes

Type 1, 2, or 3:`)
            setCurrentStep('ask_continue_editing')
          } else {
            addBotMessage(`Time set: ${trimmedInput}

Ready to update your booking:
${newBookingData.date ? `New date: ${formatDateForDisplay(newBookingData.date)}` : ''}
New time: ${trimmedInput}

Would you like to:
1️⃣ Confirm these changes
2️⃣ Make more changes
3️⃣ Cancel all changes

Type 1, 2, or 3:`)
            setCurrentStep('ask_continue_editing')
          }
        } else {
          addBotMessage("Please enter a valid time in HH:MM format (e.g., 14:30)")
        }
        break

      case 'ask_continue_editing':
        if (trimmedInput === '1') {
          if (editingField === 'date') {
            addBotMessage(`Current time: ${bookingInfo?.bookingTime || 'Not specified'}\n\nPlease enter the new time (HH:MM format):`)
            setEditingField('time')
            setCurrentStep('edit_time')
          } else if (editingField === 'time') {
            addBotMessage(`Current date: ${formatDateForDisplay(bookingInfo?.bookingDate || '')}\n\nPlease enter the new date (DD-MM-YYYY format, e.g., 25-12-2025):`)
            setEditingField('date')
            setCurrentStep('edit_date')
          } else {
            setCurrentStep('confirm_changes')
            addBotMessage(`Ready to update your booking:
${newBookingData.date ? `New date: ${newBookingData.date}` : ''}
${newBookingData.time ? `New time: ${newBookingData.time}` : ''}

1️⃣ Confirm changes
2️⃣ Cancel changes

Type 1 or 2:`)
          }
        } else if (trimmedInput === '2') {
          setCurrentStep('confirm_changes')
          addBotMessage(`Ready to update your booking:
${newBookingData.date ? `New date: ${formatDateForDisplay(newBookingData.date)}` : ''}
${newBookingData.time ? `New time: ${newBookingData.time}` : ''}

1️⃣ Confirm changes
2️⃣ Cancel changes

Type 1 or 2:`)
        } else if (trimmedInput === '3') {
          addBotMessage("Changes cancelled. Your original booking remains unchanged.")
          setCurrentStep('completed')
        } else {
          addBotMessage("Please enter 1, 2, or 3 to choose your option.")
        }
        break

      case 'confirm_changes':
        if (trimmedInput === '1') {
          addBotMessage("💾 Updating your booking...")
          
          const updates: any = {}
          if (newBookingData.date) updates.bookingDate = newBookingData.date
          if (newBookingData.time) updates.bookingTime = newBookingData.time
          
          const success = await updateBookingInFirebase(bookingInfo!.id, updates)
          
          if (success) {
            addBotMessage(`Your booking has been successfully updated!

**Updated Booking Details**
Booking ID: ${bookingInfo?.bookingId}
${newBookingData.date ? `New Date: ${formatDateForDisplay(newBookingData.date)}` : `Date: ${formatDateForDisplay(bookingInfo?.bookingDate || '')}`}
${newBookingData.time ? `New Time: ${newBookingData.time}` : `Time: ${bookingInfo?.bookingTime}`}

Would you like to make any other changes?
1️⃣ Yes - Make more changes
2️⃣ No - I'm done

Type 1 or 2:`)
            toast.success("Booking updated successfully!")
            // Update booking info with new data
            if (newBookingData.date) {
              setBookingInfo(prev => prev ? {...prev, bookingDate: newBookingData.date} : null)
            }
            if (newBookingData.time) {
              setBookingInfo(prev => prev ? {...prev, bookingTime: newBookingData.time} : null)
            }
            setNewBookingData({ date: '', time: '' })
            setCurrentStep('ask_more_changes')
          } else {
            addBotMessage("Sorry, there was an error updating your booking. Please try again or contact support.")
            setCurrentStep('completed')
          }
        } else if (trimmedInput === '2') {
          addBotMessage("Changes cancelled. Your original booking remains unchanged.")
          setCurrentStep('completed')
        } else {
          addBotMessage("Please enter 1 to confirm or 2 to cancel.")
        }
        break

      case 'ask_more_changes':
        if (trimmedInput === '1') {
          addBotMessage(`Great! What would you like to change?
1️⃣ Date - Change booking date
2️⃣ Time - Change booking time  
3️⃣ Both - Change both date and time
4️⃣ Cancel - Exit without more changes

Type 1, 2, 3, or 4:`)
          setCurrentStep('edit_options')
        } else if (trimmedInput === '2') {
          addBotMessage("Perfect! Your booking has been successfully updated. Thank you for using our service!")
          setCurrentStep('completed')
        } else {
          addBotMessage("Please enter 1 to make more changes or 2 if you're done.")
        }
        break

      case 'completed':
        addBotMessage("Chat session completed. You can close this window or start a new session. Have a great day!")
        break

      default:
        addBotMessage("I'm sorry, I didn't understand that. Let's start over.")
        setCurrentStep('ask_booking_id')
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true)
    const startX = e.clientX
    const startY = e.clientY
    const startWidth = chatSize.width
    const startHeight = chatSize.height

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(280, Math.min(600, startWidth + (startX - e.clientX)))
      const newHeight = Math.max(300, Math.min(800, startHeight + (startY - e.clientY)))
      setChatSize({ width: newWidth, height: newHeight })
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    e.preventDefault()
  }

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized)
  }

  const resetChat = () => {
    setMessages([])
    setCurrentStep('greeting')
    setBookingInfo(null)
    setVerificationData({ email: '', phone: '' })
    setEditingField(null)
    setNewBookingData({ date: '', time: '' })
    setInputValue('')
    setHasInitialized(false)
    setIsMinimized(false)
    setChatSize({ width: 320, height: 480 })
  }

  const handleClose = () => {
    resetChat()
    onClose()
  }

  return (
    <>
      {/* Mobile View - Full Screen */}
      <div className={`fixed inset-0 z-50 md:hidden ${isOpen ? 'block' : 'hidden'}`}>
        <div className="h-full bg-white flex flex-col">
          {/* Mobile Header */}
          <div className="p-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 bg-white/20 rounded-full flex items-center justify-center">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <span className="font-medium text-base">Booking Assistant</span>
                <div className="flex items-center gap-1 mt-1">
                  <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-xs text-white/80">Online</span>
                </div>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleClose}
              className="h-8 w-8 p-0 text-white hover:bg-white/20"
            >
              ✕
            </Button>
          </div>
          
          {/* Mobile Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 shadow-sm text-sm ${
                    message.type === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-white border border-gray-200 text-gray-800'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {message.type === 'bot' && (
                      <Bot className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    )}
                    {message.type === 'user' && (
                      <User className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    )}
                    <div className="whitespace-pre-wrap leading-relaxed">
                      {message.content}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 animate-pulse" />
                    <div className="text-sm text-gray-600">Typing...</div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Mobile Input Area */}
          <div className="border-t bg-white p-4 safe-area-inset-bottom">
            <div className="flex gap-3">
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                disabled={loading || currentStep === 'completed'}
                className="flex-1 text-base h-12 border-gray-300 focus:border-blue-500 rounded-full px-4"
              />
              <Button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || loading || currentStep === 'completed'}
                size="sm"
                className="bg-blue-500 hover:bg-blue-600 h-12 w-12 p-0 rounded-full"
              >
                <Send className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop View - Resizable */}
      <div className={`fixed bottom-20 right-4 z-50 ${isOpen ? 'hidden md:block' : 'hidden'}`}>
        <div 
          className={`bg-white rounded-lg shadow-2xl border border-gray-200 flex flex-col overflow-hidden relative select-none chat-transition ${
            isResizing ? 'chat-resizing' : ''
          }`}
          style={{ 
            width: `${chatSize.width}px`, 
            height: isMinimized ? 'auto' : `${chatSize.height}px`,
            minWidth: '280px',
            minHeight: isMinimized ? 'auto' : '300px',
            maxWidth: '600px',
            maxHeight: '800px'
          }}
        >
          {/* Desktop Header */}
          <div className="p-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 bg-white/20 rounded-full flex items-center justify-center">
                <Bot className="h-4 w-4" />
              </div>
              <span className="font-medium text-sm">Booking Assistant</span>
              <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse"></div>
            </div>
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={toggleMinimize}
                className="h-6 w-6 p-0 text-white hover:bg-white/20"
                title={isMinimized ? "Maximize" : "Minimize"}
              >
                {isMinimized ? <Maximize2 className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleClose}
                className="h-6 w-6 p-0 text-white hover:bg-white/20"
                title="Close"
              >
                ✕
              </Button>
            </div>
          </div>
          
          {!isMinimized && (
            <>
              {/* Desktop Messages Area */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg p-2 shadow-sm text-xs ${
                        message.type === 'user'
                          ? 'bg-blue-500 text-white'
                          : 'bg-white border border-gray-200 text-gray-800'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {message.type === 'bot' && (
                          <Bot className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        )}
                        {message.type === 'user' && (
                          <User className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        )}
                        <div className="whitespace-pre-wrap leading-relaxed">
                          {message.content}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 rounded-lg p-2">
                      <div className="flex items-center gap-2">
                        <Bot className="h-3 w-3 animate-pulse" />
                        <div className="text-xs text-gray-600">Typing...</div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Desktop Input Area */}
              <div className="border-t bg-white p-3">
                <div className="flex gap-2">
                  <Input
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type your message..."
                    disabled={loading || currentStep === 'completed'}
                    className="flex-1 text-xs h-8 border-gray-300 focus:border-blue-500"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!inputValue.trim() || loading || currentStep === 'completed'}
                    size="sm"
                    className="bg-blue-500 hover:bg-blue-600 h-8 w-8 p-0"
                  >
                    <Send className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* Resize Handle - Desktop Only */}
          {!isMinimized && (
            <div
              className="absolute top-0 left-0 w-4 h-4 cursor-nw-resize bg-gray-200 opacity-50 hover:opacity-75 rounded-br-md"
              onMouseDown={handleMouseDown}
              title="Drag to resize"
            >
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-2 h-2 border-l-2 border-t-2 border-gray-400 transform rotate-45"></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}