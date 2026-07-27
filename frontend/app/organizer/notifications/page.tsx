"use client"

import { useEffect, useState, useRef } from "react"
import { Bell, XCircle, Info, DollarSign, CalendarCheck, Check, Trash2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { io, type Socket } from "socket.io-client"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

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

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [deletingAll, setDeletingAll] = useState(false)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    const storedAuth = localStorage.getItem("auth-storage")
    let token = ""
    let userId = ""
    if (storedAuth) {
      try {
        const parsedAuth = JSON.parse(storedAuth)
        token = parsedAuth.state?.token
        userId = parsedAuth.state?.user?._id
      } catch (e) {
        console.error("Failed to parse auth state from localStorage", e)
      }
    }

    if (!token || !userId) {
      setLoading(false)
      toast.error("Please login to view notifications.")
      return
    }

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

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.message || "Failed to fetch notifications")
        }

        const data = await response.json()
        if (data.success) {
          const fetchedNotifications = data.data || []
          setNotifications(fetchedNotifications)
          setUnreadCount(fetchedNotifications.filter((n: Notification) => !n.read).length)
        } else {
          throw new Error(data.message || "Failed to fetch notifications")
        }
      } catch (error) {
        console.error("Error fetching notifications:", error)
        toast.error(error instanceof Error ? error.message : "Failed to fetch notifications")
      } finally {
        setLoading(false)
      }
    }

    fetchNotifications()

    if (!socketRef.current) {
      socketRef.current = io(process.env.NEXT_PUBLIC_SOCKET_URL as string, {
        auth: { token },
        transports: ["websocket"],
      })

      socketRef.current.on("connect", () => {
        // console.log("Socket connected (notifications page):", socketRef.current?.id)
      })

      socketRef.current.on("disconnect", () => {
        // console.log("Socket disconnected (notifications page)")
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
        setNotifications((prev) => [newNotification, ...prev])
        setUnreadCount((prev) => prev + 1)
        toast.info(newNotification.message)
      })

      socketRef.current.on("withdrawalStatusUpdated", (data: any) => {
        const newNotification: Notification = {
          _id: data._id || Date.now().toString(),
          userId: userId,
          type: "withdrawal_status_change",
          message: `Your withdrawal of ${data.amount} ${data.currency || "ETB"} has been ${data.status}.`,
          read: false,
          createdAt: new Date().toISOString(),
          withdrawalId: data.withdrawalId,
          amount: data.amount,
          status: data.status,
        }
        setNotifications((prev) => [newNotification, ...prev])
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

  const handleMarkAllAsRead = async () => {
    const unreadNotificationIds = notifications.filter((n) => !n.read).map((n) => n._id)
    if (unreadNotificationIds.length === 0) {
      toast.info("No unread notifications to mark as read.")
      return
    }

    const storedAuth = localStorage.getItem("auth-storage")
    let token = ""
    if (storedAuth) {
      try {
        const parsedAuth = JSON.parse(storedAuth)
        token = parsedAuth.state?.token
      } catch {}
    }

    if (!token) {
      toast.error("Authentication token not found. Please log in.")
      return
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/notifications/mark-read`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ notificationIds: unreadNotificationIds }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to mark notifications as read")
      }

      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      setUnreadCount(0)
      toast.success("All unread notifications marked as read.")
    } catch (error) {
      console.error("Error marking notifications as read:", error)
      toast.error(error instanceof Error ? error.message : "Failed to mark notifications as read")
    }
  }

  const handleDeleteNotification = async (notificationId: string) => {
    setDeleting(notificationId)
    
    const storedAuth = localStorage.getItem("auth-storage")
    let token = ""
    if (storedAuth) {
      try {
        const parsedAuth = JSON.parse(storedAuth)
        token = parsedAuth.state?.token
      } catch {}
    }

    if (!token) {
      toast.error("Authentication token not found. Please log in.")
      setDeleting(null)
      return
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/notifications/${notificationId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to delete notification")
      }

      setNotifications((prev) => prev.filter((n) => n._id !== notificationId))
      
      const deletedNotification = notifications.find((n) => n._id === notificationId)
      if (deletedNotification && !deletedNotification.read) {
        setUnreadCount((prev) => Math.max(0, prev - 1))
      }

      toast.success("Notification deleted successfully.")
    } catch (error) {
      console.error("Error deleting notification:", error)
      toast.error(error instanceof Error ? error.message : "Failed to delete notification")
    } finally {
      setDeleting(null)
    }
  }

  const handleDeleteAllNotifications = async () => {
    setDeletingAll(true)
    
    const storedAuth = localStorage.getItem("auth-storage")
    let token = ""
    if (storedAuth) {
      try {
        const parsedAuth = JSON.parse(storedAuth)
        token = parsedAuth.state?.token
      } catch {}
    }

    if (!token) {
      toast.error("Authentication token not found. Please log in.")
      setDeletingAll(false)
      return
    }

    try {
      const notificationIds = notifications.map((n) => n._id)
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/notifications`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ notificationIds }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to delete notifications")
      }

      const data = await response.json()
      setNotifications([])
      setUnreadCount(0)
      toast.success(data.message || "All notifications deleted successfully.")
    } catch (error) {
      console.error("Error deleting notifications:", error)
      toast.error(error instanceof Error ? error.message : "Failed to delete notifications")
    } finally {
      setDeletingAll(false)
    }
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

  const getStatusBadge = (status?: string) => {
    if (!status) return null
    
    const statusConfig = {
      published: { label: "Published", className: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 border-green-200 dark:border-green-800" },
      cancelled: { label: "Cancelled", className: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400 border-red-200 dark:border-red-800" },
      draft: { label: "Draft", className: "bg-gray-100 dark:bg-gray-800/50 text-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700" },
      approved: { label: "Approved", className: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 border-green-200 dark:border-green-800" },
      rejected: { label: "Rejected", className: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400 border-red-200 dark:border-red-800" },
      pending: { label: "Pending", className: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800" },
      completed: { label: "Completed", className: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 border-blue-200 dark:border-blue-800" },
    }

    const config = statusConfig[status as keyof typeof statusConfig]
    if (!config) return null

    return (
      <Badge className={`text-xs font-medium ${config.className}`}>
        {config.label}
      </Badge>
    )
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
          <div className="mb-6">
            <div className="h-7 w-44 animate-pulse rounded-md bg-gray-200 dark:bg-gray-800" />
            <div className="mt-2 h-4 w-28 animate-pulse rounded-md bg-gray-200 dark:bg-gray-800" />
          </div>
          <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:divide-gray-800/80 dark:border-gray-800 dark:bg-gray-950">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-start gap-4 px-5 py-4">
                <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-gray-200 dark:bg-gray-800" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
                  <div className="h-3 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
              Notifications
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {notifications.length === 0
                ? "You're all caught up"
                : unreadCount > 0
                  ? `${unreadCount} unread of ${notifications.length}`
                  : `${notifications.length} notifications, all read`}
            </p>
          </div>

          {notifications.length > 0 && (
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <Button
                  onClick={handleMarkAllAsRead}
                  variant="outline"
                  size="sm"
                  className="text-gray-700 dark:border-gray-700 dark:bg-transparent dark:text-gray-300 dark:hover:bg-gray-900"
                >
                  <Check className="mr-1.5 h-4 w-4" />
                  Mark all as read
                </Button>
              )}

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-500 hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                    disabled={deletingAll}
                  >
                    {deletingAll ? (
                      <div className="mr-1.5 h-4 w-4 animate-spin rounded-full border-b-2 border-current" />
                    ) : (
                      <Trash2 className="mr-1.5 h-4 w-4" />
                    )}
                    Clear all
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="dark:bg-black dark:border-gray-800">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2 dark:text-gray-100">
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                      Clear all notifications
                    </AlertDialogTitle>
                    <AlertDialogDescription className="dark:text-gray-400">
                      This deletes all {notifications.length} notifications. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteAllNotifications}
                      className="bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700"
                    >
                      Clear all
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>

        {/* Content */}
        {notifications.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white px-6 py-16 text-center shadow-sm dark:border-gray-800 dark:bg-gray-950">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
              <Bell className="h-6 w-6 text-gray-400 dark:text-gray-500" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
              No notifications
            </h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">
              Updates about your events and withdrawals will show up here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:divide-gray-800/80 dark:border-gray-800 dark:bg-gray-950">
            {notifications.map((notification) => (
              <div
                key={notification._id}
                className={`group relative flex items-start gap-4 px-4 py-4 transition-colors sm:px-5 ${
                  notification.read
                    ? "hover:bg-gray-50 dark:hover:bg-gray-900/40"
                    : "bg-blue-50/60 hover:bg-blue-50 dark:bg-blue-950/20 dark:hover:bg-blue-950/30"
                }`}
              >
                {!notification.read && (
                  <span className="absolute inset-y-0 left-0 w-0.5 bg-[#115db1] dark:bg-blue-400" />
                )}

                {/* Icon */}
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800/80">
                  {getNotificationIcon(notification.type, notification.status)}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm leading-relaxed ${
                      notification.read
                        ? "text-gray-600 dark:text-gray-400"
                        : "font-medium text-gray-900 dark:text-gray-100"
                    }`}
                  >
                    {notification.message}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    {getStatusBadge(notification.status)}
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {formatTimeAgo(notification.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Right rail: unread dot + delete */}
                <div className="flex shrink-0 items-center gap-1.5 self-start">
                  {!notification.read && (
                    <span className="h-2 w-2 rounded-full bg-[#115db1] dark:bg-blue-400" />
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-gray-400 opacity-100 transition-opacity hover:bg-red-50 hover:text-red-500 dark:text-gray-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                        disabled={deleting === notification._id}
                        aria-label="Delete notification"
                      >
                        {deleting === notification._id ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-current" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="dark:bg-black dark:border-gray-800">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 dark:text-gray-100">
                          <AlertTriangle className="h-5 w-5 text-red-500" />
                          Delete notification
                        </AlertDialogTitle>
                        <AlertDialogDescription className="dark:text-gray-400">
                          This notification will be permanently deleted.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
                          Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDeleteNotification(notification._id)}
                          className="bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}