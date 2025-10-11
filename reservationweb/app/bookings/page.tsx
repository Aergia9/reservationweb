"use client"

import { useState, useEffect } from "react"
import { collection, onSnapshot, doc, updateDoc, deleteDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CalendarDays, Users, DollarSign, CheckCircle } from "lucide-react"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { DataTable, type Booking } from "@/components/bookings-data-table"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean
    bookingId: string | null
    bookingDetails: string
  }>({
    isOpen: false,
    bookingId: null,
    bookingDetails: ""
  })

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "booking"), (snapshot) => {
      const bookingsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Booking))
      
      // Sort by creation date (newest first)
      bookingsData.sort((a, b) => {
        const aDate = a.createdAt?.toDate?.() || new Date(a.createdAt)
        const bDate = b.createdAt?.toDate?.() || new Date(b.createdAt)
        return bDate.getTime() - aDate.getTime()
      })
      
      setBookings(bookingsData)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const updateBookingStatus = async (bookingId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, "booking", bookingId), {
        status: newStatus,
        updatedAt: new Date()
      })
      toast.success(`Booking status updated to ${newStatus}`)
    } catch (error) {
      console.error("Error updating booking status:", error)
      toast.error("Failed to update booking status")
    }
  }

  const updatePaymentStatus = async (bookingId: string, newPaymentStatus: string) => {
    try {
      await updateDoc(doc(db, "booking", bookingId), {
        paymentStatus: newPaymentStatus,
        updatedAt: new Date()
      })
      toast.success(`Payment status updated to ${newPaymentStatus}`)
    } catch (error) {
      console.error("Error updating payment status:", error)
      toast.error("Failed to update payment status")
    }
  }

  const updateBooking = async (bookingId: string, updatedData: Partial<Booking>) => {
    try {
      await updateDoc(doc(db, "booking", bookingId), {
        ...updatedData,
        updatedAt: new Date()
      })
      toast.success("Booking updated successfully")
    } catch (error) {
      console.error("Error updating booking:", error)
      toast.error("Failed to update booking")
    }
  }

  const deleteBooking = async (bookingIds: string[]) => {
    if (bookingIds.length === 0) return
    
    const bookingDetails = bookingIds.map(id => {
      const booking = bookings.find(b => b.id === id)
      if (booking) {
        const bookingName = booking.eventName || "Unknown"
        return `${booking.firstName} ${booking.lastName} - ${bookingName} on ${booking.bookingDate}`
      }
      return "Unknown booking"
    }).join(", ")
    
    setDeleteDialog({
      isOpen: true,
      bookingId: bookingIds.join(","), // Store multiple IDs as comma-separated string
      bookingDetails: `${bookingIds.length} booking(s): ${bookingDetails}`
    })
  }

  const confirmDelete = async () => {
    if (deleteDialog.bookingId) {
      const bookingIds = deleteDialog.bookingId.split(",")
      try {
        // Delete all selected bookings
        await Promise.all(
          bookingIds.map(id => deleteDoc(doc(db, "booking", id)))
        )
        toast.success(`${bookingIds.length} booking(s) deleted successfully`)
        setDeleteDialog({ isOpen: false, bookingId: null, bookingDetails: "" })
      } catch (error) {
        console.error("Error deleting bookings:", error)
        toast.error("Failed to delete booking(s)")
      }
    }
  }

  const formatPrice = (price: number) => {
    return `Rp${price.toLocaleString()}`
  }

  // Calculate statistics
  const totalBookings = bookings.length
  const totalRevenue = bookings
    .filter(booking => booking.status === "confirmed" || booking.status === "completed")
    .reduce((sum, booking) => sum + booking.totalPrice, 0)
  const pendingBookings = bookings.filter(booking => booking.status === "pending").length
  const confirmedBookings = bookings.filter(booking => booking.status === "confirmed").length

  if (loading) {
    return (
      <SidebarProvider
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 72)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as React.CSSProperties
        }
      >
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />
          <div className="flex flex-1 flex-col">
            <div className="@container/main flex flex-1 flex-col gap-2">
              <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                <div className="px-4 lg:px-6">
                  <div className="max-w-none mx-auto">
                    <div className="flex h-64 items-center justify-center">
                      <div className="text-lg">Loading bookings...</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <div className="px-4 lg:px-6">
                <div className="max-w-none mx-auto space-y-6">
                  <div className="flex items-center justify-between space-y-2">
                    <h1 className="text-3xl font-bold">Bookings</h1>
                  </div>
                  
                  {/* Statistics Cards */}
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
                        <CalendarDays className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{totalBookings}</div>
                        <p className="text-xs text-muted-foreground">All time bookings</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{formatPrice(totalRevenue)}</div>
                        <p className="text-xs text-muted-foreground">Confirmed and completed bookings only</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{pendingBookings}</div>
                        <p className="text-xs text-muted-foreground">Awaiting confirmation</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Confirmed</CardTitle>
                        <CheckCircle className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{confirmedBookings}</div>
                        <p className="text-xs text-muted-foreground">Ready to serve</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Bookings Table */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Recent Bookings</CardTitle>
                      <CardDescription>Manage all your restaurant bookings here.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <DataTable 
                        data={bookings} 
                        onStatusUpdate={updateBookingStatus}
                        onPaymentStatusUpdate={updatePaymentStatus}
                        onDelete={deleteBooking}
                        onUpdate={updateBooking}
                      />
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.isOpen} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, isOpen: open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this booking?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the booking for:
              <br />
              <strong>{deleteDialog.bookingDetails}</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteDialog({ isOpen: false, bookingId: null, bookingDetails: "" })}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Delete Booking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  )
}