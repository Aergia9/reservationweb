"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"

interface DiningRoom {
  id: number
  name: string
  price: number
  image: string
  description: string
  amenities: string[]
  maxGuests: number
  size: string
  style: string
}

interface RoomDetailsPopupProps {
  room: DiningRoom | null
  isOpen: boolean
  onClose: () => void
}

export default function RoomDetailsPopup({ room, isOpen, onClose }: RoomDetailsPopupProps) {
  if (!room) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[800px] p-0">
        <div className="p-6 overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">{room.name}</DialogTitle>
          </DialogHeader>

          <div className="mt-6">
            <img
              src={room.image || "/placeholder.svg"}
              alt={room.name}
              className="w-full h-64 lg:h-80 object-cover rounded-lg mb-6"
            />

            <div className="space-y-6">
              <div>
                <h4 className="font-semibold text-lg mb-2">Room Details</h4>
                <p className="text-muted-foreground mb-4 text-pretty">{room.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Size:</span> {room.size}
                </div>
                <div>
                  <span className="font-medium">Style:</span> {room.style}
                </div>
                <div>
                  <span className="font-medium">Max Guests:</span> {room.maxGuests}
                </div>
                <div>
                  <span className="font-medium">Price:</span> ${room.price}/event
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-3">Features</h4>
                <div className="flex flex-wrap gap-2">
                  {room.amenities.map((amenity, index) => (
                    <Badge key={index} variant="secondary">
                      {amenity}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
