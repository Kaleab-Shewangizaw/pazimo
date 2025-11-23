"use client"

import type React from "react"
import { useEffect, useState } from "react" // Import useState
import { useRouter, usePathname } from "next/navigation" // Import usePathname
import { useAuthStore } from "@/store/authStore"
import Sidebar from "@/components/organizer-sidebar/sidebar"
import OrganizerHeader from "@/components/organizer-header/organizer-header" // Import the new OrganizerHeader
import { toast } from "sonner"

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname() // Get current pathname
  const { isAuthenticated, user } = useAuthStore()
  // Track hydration to avoid redirecting before zustand rehydrates from storage
  const [hasHydrated, setHasHydrated] = useState(false)

  const isOrganizerRoute = pathname.startsWith("/organizer")
  const isSignInOrSignUp = pathname === "/organizer/sign-in" || pathname === "/organizer/sign-up"

  // State for sidebar open/close
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen)
  }

  const closeSidebar = () => {
    setIsSidebarOpen(false)
  }

  // Wait for persisted auth state to rehydrate before making any redirect decisions
  useEffect(() => {
    const persist = (useAuthStore as any).persist
    if (persist?.hasHydrated) {
      setHasHydrated(persist.hasHydrated())
      const unsub = persist.onFinishHydration?.(() => setHasHydrated(true))
      return () => unsub?.()
    } else {
      // Fallback: assume hydrated after first render if persist helpers are unavailable
      setHasHydrated(true)
    }
  }, [])

  useEffect(() => {
    if (!isOrganizerRoute || !hasHydrated) return
    if (!isAuthenticated || !user) {
      toast.error("Please login to access organizer features")
      router.replace("/sign-in")
      return
    }
    if (user.role !== "organizer") {
      toast.error("Only organizers can access this area")
      router.replace("/")
      return
    }
  }, [isAuthenticated, user, router, isOrganizerRoute, hasHydrated])

  // If it's not an organizer route or it's sign-in/sign-up, render children directly without layout
  if (!isOrganizerRoute || isSignInOrSignUp) {
    return <>{children}</>
  }

  // If it's an organizer route but not authenticated or not an organizer, return null (handled by useEffect redirect)
  if (!hasHydrated || !isAuthenticated || !user || user.role !== "organizer") {
    return null
  }

  return (
    <div className="flex min-h-screen">
      {/* Organizer Sidebar */}
      <Sidebar open={isSidebarOpen} onClose={closeSidebar} />
      <div className="flex flex-col flex-1">
        {" "}
        {/* Adjust margin for desktop sidebar width */}
        {/* Organizer Header */}
        <OrganizerHeader onMenuClick={toggleSidebar} />
        <main className="flex-1 bg-gray-50">{children}</main>
      </div>
    </div>
  )
}
