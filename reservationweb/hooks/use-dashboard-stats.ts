"use client"

import { useEffect, useMemo, useState } from "react"
import { collection, onSnapshot } from "firebase/firestore"
import { db } from "@/lib/firebase"

import type { Booking } from "@/components/bookings-data-table"

export interface DashboardStats {
  totalRevenue: number
  revenueChangePct: number

  newCustomers: number
  newCustomersChangePct: number

  activeCustomers: number
  activeCustomersChangePct: number

  growthRate: number
}

function toDateSafe(value: any): Date {
  try {
    if (value?.toDate) return value.toDate()
    if (typeof value === "string" || typeof value === "number") return new Date(value)
  } catch (_) {}
  return new Date(0)
}

function pctChange(current: number, prev: number): number {
  if (prev <= 0 && current > 0) return 100
  if (prev === 0) return 0
  return ((current - prev) / prev) * 100
}

export function useDashboardStats() {
  const [bookings, setBookings] = useState<Booking[] | null>(null)

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "booking"), (snap) => {
      const list: Booking[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))
      setBookings(list)
    })
    return () => unsub()
  }, [])

  const stats: DashboardStats | null = useMemo(() => {
    if (!bookings) return null

    const now = new Date()
    const days = 30
    const startCurrent = new Date(now)
    startCurrent.setDate(startCurrent.getDate() - days)
    const startPrev = new Date(startCurrent)
    startPrev.setDate(startPrev.getDate() - days)

    // Helper maps
    const firstSeen = new Map<string, Date>()
    const seenThisPeriod = new Set<string>()
    const seenPrevPeriod = new Set<string>()

    let revenueCurrent = 0
    let revenuePrev = 0

    let bookingsCurrent = 0
    let bookingsPrev = 0

    // Build unique customer id using phone preferred, else email, else name fallback
    function customerKey(b: Booking): string {
      return (b.phone?.trim() || b.email?.trim() || `${b.firstName}|${b.lastName}` || b.id).toLowerCase()
    }

    for (const b of bookings) {
      const created = toDateSafe((b as any).createdAt)
      const key = customerKey(b)

      // Track first seen date per customer
      const prevFirst = firstSeen.get(key)
      if (!prevFirst || created < prevFirst) firstSeen.set(key, created)

      const inCurrent = created >= startCurrent && created <= now
      const inPrev = created >= startPrev && created < startCurrent

      if (inCurrent) {
        bookingsCurrent++
        seenThisPeriod.add(key)
      } else if (inPrev) {
        bookingsPrev++
        seenPrevPeriod.add(key)
      }

      const isRevenue = b.status === "confirmed" || b.status === "completed"
      const price = Number(b.totalPrice || 0)
      if (inCurrent && isRevenue) revenueCurrent += price
      else if (inPrev && isRevenue) revenuePrev += price
    }

    // New customers are those whose first booking is in current window
    let newCustomersCurrent = 0
    let newCustomersPrev = 0
    for (const [, first] of firstSeen) {
      if (first >= startCurrent && first <= now) newCustomersCurrent++
      else if (first >= startPrev && first < startCurrent) newCustomersPrev++
    }

    // Active customers defined as customers with at least one booking in the current window
    const activeCustomersCurrent = seenThisPeriod.size
    const activeCustomersPrev = seenPrevPeriod.size

    const growthRate = pctChange(bookingsCurrent, bookingsPrev)

    return {
      totalRevenue: revenueCurrent,
      revenueChangePct: pctChange(revenueCurrent, revenuePrev),
      newCustomers: newCustomersCurrent,
      newCustomersChangePct: pctChange(newCustomersCurrent, newCustomersPrev),
      activeCustomers: activeCustomersCurrent,
      activeCustomersChangePct: pctChange(activeCustomersCurrent, activeCustomersPrev),
      growthRate,
    }
  }, [bookings])

  return { stats, loading: bookings === null }
}
