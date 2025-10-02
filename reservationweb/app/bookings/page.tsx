"use client"

import { useState, useEffect } from "react"
import { collection, onSnapshot, doc, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CalendarDays, Users, DollarSign, CheckCircle } from "lucide-react"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { DataTable, type Booking } from "@/components/bookings-data-table"

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

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
    } catch (error) {
      console.error("Error updating booking status:", error)
    }
  }

  const formatPrice = (price: number) => {
    return `Rp${price.toLocaleString()}`
  }

  // Calculate statistics
  const totalBookings = bookings.length
  const totalRevenue = bookings
    .filter(booking => booking.status !== "cancelled")
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
                  <div className="max-w-7xl mx-auto">
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
                <div className="max-w-7xl mx-auto space-y-6">
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
                        <p className="text-xs text-muted-foreground">Excluding cancelled bookings</p>
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
                      <DataTable data={bookings} onStatusUpdate={updateBookingStatus} />
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}