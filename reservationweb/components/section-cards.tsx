import { IconTrendingDown, IconTrendingUp } from "@tabler/icons-react"
import { useDashboardStats } from "@/hooks/use-dashboard-stats"
import { Skeleton } from "@/components/ui/skeleton"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

function StatValue({ value, prefix = "", suffix = "", loading }: { value: number; prefix?: string; suffix?: string; loading: boolean }) {
  if (loading) return <Skeleton className="h-8 w-24" />
  const formatted = prefix + (suffix === "%" ? value.toFixed(1) : value.toLocaleString()) + suffix
  return (
    <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
      {formatted}
    </CardTitle>
  )
}

function ChangeBadge({ pct, loading }: { pct: number; loading: boolean }) {
  if (loading) return <Skeleton className="h-5 w-16 rounded-full" />
  const isUp = pct >= 0
  const Icon = isUp ? IconTrendingUp : IconTrendingDown
  return (
    <Badge variant="outline" className={isUp ? "text-green-600" : "text-red-600"}>
      <Icon />
      {`${isUp ? "+" : ""}${pct.toFixed(1)}%`}
    </Badge>
  )
}

export function SectionCards() {
  const { stats, loading } = useDashboardStats()
  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {/* Revenue */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Total Revenue (last 30d)</CardDescription>
          <StatValue value={stats?.totalRevenue || 0} prefix="Rp" loading={loading} />
          <CardAction>
            <ChangeBadge pct={stats?.revenueChangePct || 0} loading={loading} />
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {loading ? <Skeleton className="h-4 w-40" /> : stats && (stats.revenueChangePct >= 0 ? "Trending up" : "Trending down")}
            {!loading && <IconTrendingUp className="size-4" />}
          </div>
          <div className="text-muted-foreground">Confirmed & completed bookings</div>
        </CardFooter>
      </Card>
      {/* New Customers */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>New Customers (30d)</CardDescription>
          <StatValue value={stats?.newCustomers || 0} loading={loading} />
          <CardAction>
            <ChangeBadge pct={stats?.newCustomersChangePct || 0} loading={loading} />
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {loading ? <Skeleton className="h-4 w-48" /> : stats && (stats.newCustomersChangePct >= 0 ? "Up vs prev 30d" : "Down vs prev 30d")}
          </div>
          <div className="text-muted-foreground">First-time booking customers</div>
        </CardFooter>
      </Card>
      {/* Active Customers */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Active Customers (30d)</CardDescription>
          <StatValue value={stats?.activeCustomers || 0} loading={loading} />
          <CardAction>
            <ChangeBadge pct={stats?.activeCustomersChangePct || 0} loading={loading} />
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {loading ? <Skeleton className="h-4 w-44" /> : stats && (stats.activeCustomersChangePct >= 0 ? "Retention improving" : "Retention falling")}
          </div>
          <div className="text-muted-foreground">Customers with ≥1 booking in window</div>
        </CardFooter>
      </Card>
      {/* Growth Rate */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Booking Growth (30d)</CardDescription>
          <StatValue value={stats?.growthRate || 0} suffix="%" loading={loading} />
          <CardAction>
            <ChangeBadge pct={stats?.growthRate || 0} loading={loading} />
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            {loading ? <Skeleton className="h-4 w-48" /> : stats && (stats.growthRate >= 0 ? "Growth vs prev 30d" : "Decline vs prev 30d")}
          </div>
          <div className="text-muted-foreground">Bookings period-over-period</div>
        </CardFooter>
      </Card>
    </div>
  )
}
