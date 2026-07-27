"use client"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { User, Menu, Bell, CheckCircle, XCircle, Info, DollarSign, CalendarCheck } from "lucide-react"
import { useAuthStore } from "@/store/authStore"
import { useRouter } from "next/navigation"
import { useState, useEffect, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { io, type Socket } from "socket.io-client"
import ThemeToggle from "../theme-toggle"

interface Notification {
  _id: string
  userId: string
  type: "event_status_change" | "withdrawal_status_change"
  message: string
  read: boolean
  createdAt: string
  eventId?: string
  withdrawalId?: string
  status?: string
  amount?: number
  eventTitle?: string
}

interface OrganizerHeaderProps {
  onMenuClick?: () => void
}

const OrganizerHeader = ({ onMenuClick }: OrganizerHeaderProps) => {
  const router = useRouter()
  const { user, logout } = useAuthStore()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotifications, setShowNotifications] = useState(false)
  const [loading, setLoading] = useState(false)
  const socketRef = useRef<Socket | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Safe localStorage access with proper checks
    let token = ""
    let userId = ""
    
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const storedAuth = localStorage.getItem("auth-storage")
        if (storedAuth) {
          const parsedAuth = JSON.parse(storedAuth)
          token = parsedAuth.state?.token
          userId = parsedAuth.state?.user?._id
        }
      }
    } catch (e) {
      console.error("Failed to parse auth state from localStorage", e)
    }

    if (!token || !userId) return

    // Fetch recent notifications (limit to 5)
    const fetchNotifications = async () => {
      setLoading(true)
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/notifications/user/${userId}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          credentials: "include",
        })

        if (response.ok) {
          const data = await response.json()
          if (data.success) {
            const fetchedNotifications = data.data || []
            setNotifications(fetchedNotifications.slice(0, 5)) // Show only 5 most recent
            setUnreadCount(fetchedNotifications.filter((n: Notification) => !n.read).length)
          }
        }
      } catch (error) {
        console.error("Error fetching notifications:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchNotifications()

    // Socket.IO setup for real-time notifications
    if (!socketRef.current) {
      socketRef.current = io(process.env.NEXT_PUBLIC_SOCKET_URL as string, {
        auth: { token },
        transports: ["websocket"],
      })

      socketRef.current.emit("joinOrganizerRoom", userId)

      socketRef.current.on("eventStatusUpdated", (data: any) => {
        const newNotification: Notification = {
          _id: data._id || Date.now().toString(),
          userId: userId,
          type: "event_status_change",
          message: `Event "${data.eventTitle}" status changed to ${data.status}.`,
          read: false,
          createdAt: new Date().toISOString(),
          eventId: data.eventId,
          eventTitle: data.eventTitle,
          status: data.status,
        }
        setNotifications((prev) => [newNotification, ...prev.slice(0, 4)]) // Keep only 5
        setUnreadCount((prev) => prev + 1)
        toast.info(newNotification.message)
      })

      socketRef.current.on("withdrawalStatusUpdated", (data: any) => {
        const newNotification: Notification = {
          _id: data._id || Date.now().toString(),
          userId: userId,
          type: "withdrawal_status_change",
          message: `Your withdrawal of ${data.amount} Birr has been ${data.status}.`,
          read: false,
          createdAt: new Date().toISOString(),
          withdrawalId: data.withdrawalId,
          amount: data.amount,
          status: data.status,
        }
        setNotifications((prev) => [newNotification, ...prev.slice(0, 4)]) // Keep only 5
        setUnreadCount((prev) => prev + 1)
        toast.info(newNotification.message)
      })
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.off("eventStatusUpdated")
        socketRef.current.off("withdrawalStatusUpdated")
        socketRef.current.disconnect()
        socketRef.current = null
      }
    }
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowNotifications(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleLogout = () => {
    logout()
    router.push("/sign-in")
  }

  const handleUserClick = () => {
    router.push("/organizer")
  }

  const handleNotificationClick = () => {
    setShowNotifications(!showNotifications)
  }

  const handleViewAllNotifications = () => {
    setShowNotifications(false)
    router.push("/organizer/notifications")
  }

  const getNotificationIcon = (type: Notification["type"], status?: string) => {
    switch (type) {
      case "event_status_change":
        if (status === "published") return <CalendarCheck className="h-4 w-4 text-green-500" />
        if (status === "cancelled") return <XCircle className="h-4 w-4 text-red-500" />
        return <Info className="h-4 w-4 text-blue-500" />
      case "withdrawal_status_change":
        if (status === "approved" || status === "completed") return <DollarSign className="h-4 w-4 text-green-500" />
        if (status === "rejected") return <XCircle className="h-4 w-4 text-red-500" />
        return <Info className="h-4 w-4 text-yellow-500" />
      default:
        return <Bell className="h-4 w-4 text-gray-500" />
    }
  }

  const formatTimeAgo = (dateString: string) => {
    const now = new Date()
    const date = new Date(dateString)
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diffInSeconds < 60) return "Just now"
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`
    return date.toLocaleDateString()
  }

  return (
    <>
      <header className="md:relative dark:bg-black fixed top-0 left-0 right-0 z-50 py-4 px-4 sm:px-8 md:px-16 border-b dark:border-gray-600 border-gray-200 bg-white/95 md:bg-white backdrop-blur-sm transition-all duration-300 ease-out">
        <div className="flex flex-row items-center justify-between md:flex-row md:items-center md:justify-between gap-4 md:gap-6">
          {/* Logo for mobile */}
          <Link
            href="/organizer"
            className="flex md:hidden items-center"
            aria-label="Pazimo — organizer dashboard"
          >
            <Image
              src="/logo2.png"
              alt="Pazimo"
              width={120}
              height={80}
              priority
              className="h-8 w-auto object-contain"
            />
          </Link>

          {/* Hamburger for mobile - now only triggers external sidebar */}
          <div className="flex md:hidden items-center gap-1 ml-auto">
            <ThemeToggle />
            <button
              className="p-2 rounded-md text-gray-700 dark:text-gray-300 hover:text-[#115db1] dark:hover:text-blue-400 focus:outline-none focus:ring-2 focus:ring-[#115db1] transition-colors"
              aria-label="Open menu"
              onClick={onMenuClick}
            >
              <Menu className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          </div>

          {/* Desktop: User menu with notifications */}
          <div className="hidden md:flex flex-1 items-center justify-end gap-6">
            <div className="flex items-center gap-3">
              {/* Notification Bell */}
              <div className="relative" ref={dropdownRef}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="relative p-2 h-auto w-auto text-gray-700 dark:text-gray-300 hover:text-[#115db1] hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all duration-200 rounded-full"
                  onClick={handleNotificationClick}
                >
                  <Bell className="hidden md:flex items-center mr-2 rounded-full bg-white/40 dark:bg-white/[0.06] backdrop-blur-xl border border-white/50 dark:border-white/10 shadow-[0_4px_16px_rgba(31,38,135,0.08)] dark:shadow-none [&>button]:rounded-full [&>button]:hover:bg-white/60 dark:[&>button]:hover:bg-white/10"/>
                  {unreadCount > 0 && (
                    <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold animate-pulse">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </div>
                  )}
                </Button>
                <ThemeToggle/>

                {/* Notification Dropdown */}
                {showNotifications && (
                  <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-800 z-50 max-h-96 overflow-hidden">
                    <div className="p-4 border-b border-gray-100 dark:border-gray-800">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Notifications</h3>
                        {unreadCount > 0 && (
                          <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 text-xs">
                            {unreadCount} new
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="max-h-64 overflow-y-auto">
                      {loading ? (
                        <div className="p-4 text-center">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 dark:border-blue-500 mx-auto"></div>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Loading...</p>
                        </div>
                      ) : notifications.length === 0 ? (
                        <div className="p-6 text-center">
                          <Bell className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                          <p className="text-sm text-gray-500 dark:text-gray-400">No notifications yet</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-100 dark:divide-gray-800">
                          {notifications.map((notification) => (
                            <div
                              key={notification._id}
                              className={`p-4 border-l-4 transition-colors cursor-pointer ${
                                !notification.read
                                  ? "border-blue-500 bg-blue-50/70 hover:bg-blue-50 dark:bg-blue-500/10 dark:hover:bg-blue-500/15"
                                  : "border-transparent hover:bg-gray-50 dark:hover:bg-gray-800/60"
                              }`}
                              onClick={() => {
                                setShowNotifications(false)
                                router.push("/organizer/notifications")
                              }}
                            >
                              <div className="flex items-start gap-3">
                                <div className="flex-shrink-0 mt-1">
                                  <div className={`p-1.5 rounded-full ${
                                    notification.read ? "bg-gray-100 dark:bg-gray-800" : "bg-blue-100 dark:bg-blue-900/40"
                                  }`}>
                                    {getNotificationIcon(notification.type, notification.status)}
                                  </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm ${
                                    notification.read
                                      ? "font-medium text-gray-700 dark:text-gray-300"
                                      : "font-semibold text-gray-900 dark:text-gray-100"
                                  }`}>
                                    {notification.message}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    {formatTimeAgo(notification.createdAt)}
                                  </p>
                                </div>
                                {!notification.read && (
                                  <div className="flex-shrink-0">
                                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {notifications.length > 0 && (
                      <div className="p-3 border-t border-gray-100 dark:border-gray-800">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-900/30"
                          onClick={handleViewAllNotifications}
                        >
                          View all notifications
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>

             
            </div>
          </div>
        </div>
      </header>

      {/* Spacer div to prevent content from being hidden behind fixed header on mobile */}
      <div className="md:hidden h-20" />
    </>
  )
}

export default OrganizerHeader
