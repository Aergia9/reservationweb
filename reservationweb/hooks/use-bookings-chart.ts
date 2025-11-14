"use client"

import { useEffect, useMemo, useState } from "react"
import { collection, onSnapshot } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Booking } from "@/components/bookings-data-table"

export interface DailyBookingPoint {
  date: string // YYYY-MM-DD
  confirmed: number // confirmed + completed
  pending: number // pending + cancelled (treat cancelled as pending for volume visibility)
}

function toDateSafe(v: any): Date {
  try {
    if (v?.toDate) return v.toDate()
    if (typeof v === "string" || typeof v === "number") return new Date(v)
  } catch (_) {}
  return new Date(0)
}

export function useBookingsChart(range: "90d" | "30d" | "7d") {
  const [bookings, setBookings] = useState<Booking[] | null>(null)

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "booking"), (snap) => {
      const list: Booking[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))
      setBookings(list)
    })
    return () => unsub()
  }, [])

  const data: DailyBookingPoint[] = useMemo(() => {
    if (!bookings) return []
    const days = range === "90d" ? 90 : range === "30d" ? 30 : 7
    const now = new Date()
    const start = new Date(now)
    start.setDate(start.getDate() - days + 1)

    // Map of date -> counts
    const map = new Map<string, { confirmed: number; pending: number }>()

    for (const b of bookings) {
      const created = toDateSafe((b as any).createdAt)
      if (created < start || created > now) continue
      const key = created.toISOString().substring(0, 10)
      if (!map.has(key)) map.set(key, { confirmed: 0, pending: 0 })
      const entry = map.get(key)!
      const status = b.status
      if (status === "confirmed" || status === "completed") entry.confirmed++
      else entry.pending++ // pending / cancelled
    }

    // Ensure continuous dates even if zero
    const result: DailyBookingPoint[] = []
    for (let i = 0; i < days; i++) {
      const dt = new Date(start)
      dt.setDate(start.getDate() + i)
      const key = dt.toISOString().substring(0, 10)
      const entry = map.get(key) || { confirmed: 0, pending: 0 }
      result.push({ date: key, confirmed: entry.confirmed, pending: entry.pending })
    }
    return result
  }, [bookings, range])

  return { data, loading: bookings === null }
}
