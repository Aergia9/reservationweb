"use client"

import * as React from "react"
import {
  IconChartBar,
  IconDashboard,
  IconFolder,
  IconInnerShadowTop,
  IconCalendarEvent,
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import Link from "next/link"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { auth } from "@/lib/firebase"
import { onAuthStateChanged, User } from "firebase/auth"

const data = {
  navMain: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: IconDashboard,
    },
    {
      title: "Event",
      url: "/event",
      icon: IconFolder,
    },
    {
      title: "Bookings",
      url: "/bookings",
      icon: IconCalendarEvent,
    },
    {
      title: "Analytics",
      url: "/analytics",
      icon: IconChartBar,
    },
  ],
}

// ModeToggle component
export function ModeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="relative inline-flex h-8 w-14 items-center rounded-full bg-muted">
        <div className="h-6 w-6 rounded-full bg-background shadow-sm" />
      </div>
    )
  }

  const isDark = theme === "dark"

  const toggleTheme = () => {
    setTheme(isDark ? "light" : "dark")
  }

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        "relative inline-flex h-8 w-14 items-center rounded-full transition-all duration-300 ease-in-out focus:outline-none hover:scale-105",
        isDark ? "bg-slate-800 dark:bg-slate-700" : "bg-slate-200 dark:bg-slate-600",
      )}
      aria-label="Toggle theme"
    >
      <div
        className={cn(
          "inline-flex h-6 w-6 items-center justify-center rounded-full shadow-lg transition-all duration-300 ease-in-out",
          isDark
            ? "translate-x-7 bg-slate-900 dark:bg-slate-800 transform"
            : "translate-x-1 bg-white dark:bg-slate-100 transform",
        )}
      >
        <Sun
          className={cn(
            "h-3 w-3 transition-all duration-300 ease-in-out",
            isDark ? "scale-0 rotate-180 opacity-0" : "scale-100 rotate-0 opacity-100",
          )}
        />
        <Moon
          className={cn(
            "absolute h-3 w-3 transition-all duration-300 ease-in-out",
            isDark ? "scale-100 rotate-0 opacity-100" : "scale-0 -rotate-180 opacity-0",
          )}
        />
      </div>
    </button>
  )
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <div className="flex items-center gap-2 p-1">
          <IconInnerShadowTop className="h-6 w-6" />
          <span className="text-xl font-semibold">Claro Hotel</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <div className="flex flex-col gap-1 p-2">
          {data.navMain.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.title}
                href={item.url}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-all hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <Icon className="h-4 w-4" />
                {item.title}
              </Link>
            )
          })}
        </div>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center justify-between px-2 mb-2">
          <ModeToggle />
        </div>
        <NavUser/>
      </SidebarFooter>
    </Sidebar>
  )
}