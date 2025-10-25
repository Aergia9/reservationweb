"use client"

import * as React from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { ArrowUpDown, ChevronDown, MoreHorizontal, Eye, Check, X, Download, Trash2, Edit } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { emailService } from "@/lib/emailService"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"

export interface Booking {
  id: string
  bookingId?: string // New custom booking ID
  bookingDate: string
  bookingTime: string
  guests?: string // Keep for backward compatibility
  adults?: number
  children?: number
  totalGuests?: number
  firstName: string
  lastName: string
  email: string
  phone: string
  specialRequests?: string // Keep for backward compatibility
  paymentImageUrl?: string
  paymentStatus?: "pending" | "approved" | "rejected"
  userId?: string
  userEmail?: string
  bookingType: "event"
  eventId?: string | null
  eventName?: string | null
  totalPrice: number
  status: "pending" | "confirmed" | "cancelled" | "completed"
  createdAt: any
  updatedAt: any
  // Package information
  hasPackage?: boolean
  packageId?: string | null
  packageName?: string | null
  packagePrice?: number | null
  packagePeopleCount?: number | null
}

interface DataTableProps {
  data: Booking[]
  onStatusUpdate: (bookingId: string, newStatus: string) => void
  onPaymentStatusUpdate?: (bookingId: string, newStatus: string) => void
  onDelete?: (bookingIds: string[]) => void
  onUpdate?: (bookingId: string, updatedData: Partial<Booking>) => void
}

export function DataTable({ data, onStatusUpdate, onPaymentStatusUpdate, onDelete, onUpdate }: DataTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState({})
  const [selectedPaymentImage, setSelectedPaymentImage] = React.useState<string | null>(null)
  const [paymentDialogOpen, setPaymentDialogOpen] = React.useState(false)
  const [selectedBooking, setSelectedBooking] = React.useState<Booking | null>(null)
  const [editDialogOpen, setEditDialogOpen] = React.useState(false)
  const [editingBooking, setEditingBooking] = React.useState<Booking | null>(null)

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      case "confirmed":
        return "bg-green-100 text-green-800"
      case "cancelled":
        return "bg-red-100 text-red-800"
      case "completed":
        return "bg-blue-100 text-blue-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      case "approved":
        return "bg-green-100 text-green-800"
      case "rejected":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const openPaymentDialog = (booking: Booking) => {
    setSelectedBooking(booking)
    setSelectedPaymentImage(booking.paymentImageUrl || null)
    setPaymentDialogOpen(true)
  }

  const handlePaymentApproval = async (bookingId: string, approved: boolean) => {
    const newPaymentStatus = approved ? "approved" : "rejected"
    const newBookingStatus = approved ? "confirmed" : "cancelled"
    
    onPaymentStatusUpdate?.(bookingId, newPaymentStatus)
    onStatusUpdate(bookingId, newBookingStatus)
    
    // Send payment confirmation email if approved
    if (approved) {
      try {
        // Find the booking data to get customer details
        const booking = data.find(b => b.id === bookingId)
        if (booking && booking.email) {
          await emailService.sendPaymentConfirmation({
            bookingId: booking.bookingId || bookingId,
            eventName: booking.eventName || 'Event',
            customerName: `${booking.firstName} ${booking.lastName}`,
            email: booking.email
          })
          console.log('Payment confirmation email sent successfully')
        }
      } catch (emailError) {
        console.error('Error sending payment confirmation email:', emailError)
        // Don't break the approval flow if email fails
      }
    }
    
    toast.success(`Payment ${approved ? "approved" : "rejected"} and booking ${approved ? "confirmed" : "cancelled"}`)
    setPaymentDialogOpen(false)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const formatPrice = (price: number) => {
    return `Rp${price.toLocaleString()}`
  }

  const exportToCSV = async () => {
    try {
      const headers = [
        "Booking ID",
        "Customer",
        "Type",
        "Service",
        "Date & Time",
        "Guests",
        "Email",
        "Phone",
        "Price",
        "Payment Status",
        "Status",
        "Payment Image URL",
        "Created At"
      ]

      const csvData = data.map(booking => {
        return [
          booking.id,
          `${booking.firstName} ${booking.lastName}`,
          booking.bookingType,
          booking.eventName || "",
          `${booking.bookingDate} ${booking.bookingTime}`,
          booking.guests,
          booking.email,
          booking.phone,
          formatPrice(booking.totalPrice),
          booking.paymentStatus || "pending",
          booking.status,
          booking.paymentImageUrl || "No image",
          booking.createdAt?.toDate?.()?.toLocaleDateString() || "N/A"
        ]
      })

      const csvContent = [
        headers.join(","),
        ...csvData.map(row => row.map(cell => `"${cell}"`).join(","))
      ].join("\n")

      // Simple CSV download without images for now
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const link = document.createElement("a")
      const url = URL.createObjectURL(blob)
      link.setAttribute("href", url)
      link.setAttribute("download", `bookings-${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = "hidden"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
      toast.success("Bookings exported to CSV successfully! Image URLs included in the CSV.")
    } catch (error) {
      console.error('Export failed:', error)
      toast.error("Failed to export bookings. Please try again.")
    }
  }

  const columns: ColumnDef<Booking>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "bookingId",
      header: "Booking ID",
      cell: ({ row }) => (
        <div className="font-mono text-sm font-medium">
          {row.original.bookingId || (row.original.id ? row.original.id.substring(0, 8) + "..." : "No ID")}
        </div>
      ),
    },
    {
      accessorKey: "firstName",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Customer
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => (
        <div>
          <div className="font-medium">
            {row.getValue("firstName")} {row.original.lastName}
          </div>
          <div className="text-sm text-muted-foreground">
            {row.original.email}
          </div>
        </div>
      ),
    },
    {
      accessorKey: "bookingType",
      header: "Type",
      cell: ({ row }) => (
        <Badge variant="secondary">
          Event
        </Badge>
      ),
    },
    {
      accessorKey: "eventName",
      header: "Event",
      cell: ({ row }) => (
        <div className="font-medium">
          {row.original.eventName}
        </div>
      ),
    },
    {
      accessorKey: "bookingDate",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Date & Time
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{formatDate(row.getValue("bookingDate"))}</div>
          <div className="text-sm text-muted-foreground">{row.original.bookingTime}</div>
        </div>
      ),
    },
    {
      accessorKey: "guests",
      header: ({ column }) => (
        <div className="text-center">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-8 px-2 lg:px-3"
          >
            Guests
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        </div>
      ),
      cell: ({ row }) => {
        const booking = row.original;
        if (booking.adults !== undefined || booking.children !== undefined) {
          const adults = booking.adults || 0;
          const children = booking.children || 0;
          const total = booking.totalGuests || (adults + children);
          return (
            <div className="flex flex-col items-center justify-center text-center">
              <div className="font-medium">{total} Total</div>
              <div className="text-xs text-gray-600">{adults} Adults, {children} Children</div>
            </div>
          );
        }
        // Fallback for old booking format
        return <div className="flex justify-center text-center">{row.getValue("guests") || "N/A"}</div>;
      },
    },
    {
      accessorKey: "phone",
      header: "Contact",
      cell: ({ row }) => (
        <div className="space-y-1">
          <div className="text-sm">{row.original.email}</div>
          <div className="text-sm text-muted-foreground">{row.getValue("phone")}</div>
        </div>
      ),
    },
    {
      accessorKey: "totalPrice",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Price
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => (
        <div className="font-medium">{formatPrice(row.getValue("totalPrice"))}</div>
      ),
    },
    {
      accessorKey: "paymentStatus",
      header: "Payment",
      cell: ({ row }) => {
        const booking = row.original
        const paymentStatus = booking.paymentStatus || "pending"
        
        return (
          <Badge className={getPaymentStatusColor(paymentStatus)}>
            {paymentStatus}
          </Badge>
        )
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge className={getStatusColor(row.getValue("status"))}>
          {row.getValue("status")}
        </Badge>
      ),
    },
    {
      id: "status-update",
      header: "Status",
      enableHiding: false,
      cell: ({ row }) => {
        const booking = row.original

        return (
          <Select
            value={booking.status}
            onValueChange={(value) => onStatusUpdate(booking.id, value)}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        )
      },
    },
    {
      id: "edit-actions",
      header: "Edit",
      enableHiding: false,
      cell: ({ row }) => {
        const booking = row.original
        
        return (
          <div className="flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditingBooking(booking)
                setEditDialogOpen(true)
              }}
              className="h-8 w-16"
            >
              <Edit className="h-4 w-4 mr-1" />
              Edit
            </Button>
          </div>
        )
      },
    },
    {
      id: "actions",
      header: "Payment Review",
      enableHiding: false,
      cell: ({ row }) => {
        const booking = row.original
        const hasPaymentImage = booking.paymentImageUrl
        
        return (
          <div className="flex justify-center">
            {hasPaymentImage ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => openPaymentDialog(booking)}
                className="h-8 w-20"
              >
                <Eye className="h-4 w-4 mr-1" />
                Review
              </Button>
            ) : (
              <span className="text-sm text-muted-foreground">No image</span>
            )}
          </div>
        )
      },
    },
  ]

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  })

  return (
    <div className="w-full">
      <div className="flex items-center py-4 gap-4">
        <Input
          placeholder="Filter customers..."
          value={(table.getColumn("firstName")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("firstName")?.setFilterValue(event.target.value)
          }
          className="max-w-sm"
        />
        
        {/* Event Filter */}
        <Select
          value={(table.getColumn("eventName")?.getFilterValue() as string) ?? "all"}
          onValueChange={(value) =>
            table.getColumn("eventName")?.setFilterValue(value === "all" ? "" : value)
          }
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by Event" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Events</SelectItem>
            {Array.from(new Set(data.map(booking => booking.eventName).filter(Boolean))).map((name) => (
              <SelectItem key={name} value={name!}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <div className="flex gap-2 ml-auto">
          {Object.keys(rowSelection).filter(key => rowSelection[key as keyof typeof rowSelection]).length > 0 && onDelete && (
            <Button
              variant="outline"
              onClick={() => {
                const selectedIndices = Object.keys(rowSelection).filter(key => rowSelection[key as keyof typeof rowSelection])
                const selectedBookings = data.filter((_, index) => selectedIndices.includes(index.toString()))
                if (selectedBookings.length > 0) {
                  onDelete(selectedBookings.map(booking => booking.id))
                }
              }}
              className="h-10 text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Selected ({Object.keys(rowSelection).filter(key => rowSelection[key as keyof typeof rowSelection]).length})
            </Button>
          )}
          <Button
            variant="outline"
            onClick={exportToCSV}
            className="h-10"
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                Columns <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => {
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) =>
                      column.toggleVisibility(!!value)
                    }
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                )
              })}
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} of{" "}
          {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>

      {/* Payment Review Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Payment Review</DialogTitle>
            <DialogDescription>
              Review the payment proof for booking by {selectedBooking?.firstName} {selectedBooking?.lastName}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Booking Details */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Customer:</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">{selectedBooking?.firstName} {selectedBooking?.lastName}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Event:</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">{selectedBooking?.eventName}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Date & Time:</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">{selectedBooking?.bookingDate} at {selectedBooking?.bookingTime}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Total Price:</p>
                <p className="text-sm font-medium text-green-600 dark:text-green-400">{formatPrice(selectedBooking?.totalPrice || 0)}</p>
              </div>
            </div>

            {/* Payment Image */}
            {selectedPaymentImage && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Payment Proof:</p>
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
                  <img 
                    src={selectedPaymentImage} 
                    alt="Payment proof" 
                    className="max-w-full max-h-96 mx-auto object-contain rounded-md"
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setPaymentDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedBooking && handlePaymentApproval(selectedBooking.id, false)}
              className="bg-red-600 hover:bg-red-700"
            >
              <X className="h-4 w-4 mr-2" />
              Reject Payment
            </Button>
            <Button
              onClick={() => selectedBooking && handlePaymentApproval(selectedBooking.id, true)}
              className="bg-green-600 hover:bg-green-700"
            >
              <Check className="h-4 w-4 mr-2" />
              Approve Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Booking Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Booking</DialogTitle>
            <DialogDescription>
              Edit booking details for {editingBooking?.firstName} {editingBooking?.lastName}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Booking Date
                </label>
                <input
                  type="date"
                  value={editingBooking?.bookingDate || ''}
                  onChange={(e) => {
                    if (editingBooking) {
                      setEditingBooking({
                        ...editingBooking,
                        bookingDate: e.target.value
                      })
                    }
                  }}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Booking Time
                </label>
                <input
                  type="time"
                  value={editingBooking?.bookingTime || ''}
                  onChange={(e) => {
                    if (editingBooking) {
                      setEditingBooking({
                        ...editingBooking,
                        bookingTime: e.target.value
                      })
                    }
                  }}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Adults
                </label>
                <input
                  type="number"
                  min="1"
                  value={editingBooking?.adults || 1}
                  onChange={(e) => {
                    if (editingBooking) {
                      setEditingBooking({
                        ...editingBooking,
                        adults: parseInt(e.target.value) || 1
                      })
                    }
                  }}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Children
                </label>
                <input
                  type="number"
                  min="0"
                  value={editingBooking?.children || 0}
                  onChange={(e) => {
                    if (editingBooking) {
                      setEditingBooking({
                        ...editingBooking,
                        children: parseInt(e.target.value) || 0
                      })
                    }
                  }}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (editingBooking && onUpdate) {
                  onUpdate(editingBooking.id, {
                    bookingDate: editingBooking.bookingDate,
                    bookingTime: editingBooking.bookingTime,
                    adults: editingBooking.adults,
                    children: editingBooking.children
                  })
                  setEditDialogOpen(false)
                }
              }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Check className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}