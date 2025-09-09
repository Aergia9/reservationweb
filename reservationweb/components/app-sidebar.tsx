"use client"

import * as React from "react"
import {
  IconCamera,
  IconChartBar,
  IconDashboard,
  IconDatabase,
  IconFileAi,
  IconFileDescription,
  IconFileWord,
  IconFolder,
  IconHelp,
  IconInnerShadowTop,
  IconListDetails,
  IconReport,
  IconSearch,
  IconSettings,
  IconUsers,
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { NavDocuments } from "@/components/nav-documents"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
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

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
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
      title: "Analytics",
      url: "/analytics",
      icon: IconChartBar,
    },
  ],
}

// ModeToggle component to be integrated into the sidebar
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
      {/* Toggle circle */}
      <div
        className={cn(
          "inline-flex h-6 w-6 items-center justify-center rounded-full shadow-lg transition-all duration-300 ease-in-out",
          isDark
            ? "translate-x-7 bg-slate-900 dark:bg-slate-800 transform"
            : "translate-x-1 bg-white dark:bg-slate-100 transform",
        )}
      >
        {/* Icons */}
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
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <a href="#">
                <IconInnerShadowTop className="!size-auto" />
                <span className="text-base font-semibold !size-auto">Claro Hotel</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
          <div className="flex items-center justify-between px-2">
              <ModeToggle />
          </div>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}