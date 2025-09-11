"use client"

import {
  IconDotsVertical,
  IconLogout,
} from "@tabler/icons-react"
import { useState, useEffect } from "react"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import Link from "next/link"
import { auth } from "@/lib/firebase"
import { onAuthStateChanged, User, signOut } from "firebase/auth"
import { useRouter } from "next/navigation"

export function NavUser() {
  const { isMobile } = useSidebar()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const handleLogout = async () => {
    try {
      await signOut(auth)
      router.push("/login")
    } catch (error) {
      console.error("Error signing out: ", error)
    }
  }

  if (loading || !user) {
    return null // Don't render anything if loading or no user is logged in
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <div className="flex items-center gap-3 p-2">
          <Avatar className="h-8 w-8 rounded-lg">
            <AvatarImage 
              src={user.photoURL || "/avatars/default.jpg"} 
              alt={"ADMIN"} 
            />
            <AvatarFallback className="rounded-lg">
              {"A"}
            </AvatarFallback>
          </Avatar>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-medium">
              ADMIN
            </span>
            <span className="text-muted-foreground truncate text-xs">
              {user.email}
            </span>
          </div>
          
          {/* Dropdown menu trigger - only the three dots */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="rounded p-1 hover:bg-accent hover:text-accent-foreground">
                <IconDotsVertical className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-auto rounded-lg"
              side={isMobile ? "bottom" : "right"}
              align="end"
              sideOffset={4}
            >
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-3 p-2">
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage 
                      src={user.photoURL || "/avatars/default.jpg"} 
                      alt={"ADMIN"} 
                    />
                    <AvatarFallback className="rounded-lg">
                      {"A"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="font-medium">
                      ADMIN
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {user.email}
                    </span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="cursor-pointer p-2 text-red-600 hover:text-red-700 focus:text-red-700"
                onClick={handleLogout}
              >
                <IconLogout className="mr-2 h-4 w-4" />
                <span>Logout</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}