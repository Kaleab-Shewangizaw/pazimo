"use client"

import { useEffect, useState, useRef } from "react"
import { Bell, CheckCircle, XCircle, Info, DollarSign, CalendarCheck, Check, Trash2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
  const [deleting, setDeleting] = useState<string | null>(null) // Track which notification is being deleted
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

    // Fetch existing notifications
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

    // Socket.IO setup
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
      // console.log("Emitted joinOrganizerRoom (notifications page):", userId)

      socketRef.current.on("eventStatusUpdated", (data: any) => {
        // console.log("Received eventStatusUpdated (notifications page):", data)
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
        // console.log("Received withdrawalStatusUpdated (notifications page):", data)
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

      // Remove the notification from state
      setNotifications((prev) => prev.filter((n) => n._id !== notificationId))
      
      // Update unread count if the deleted notification was unread
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
        if (status === "published") return <CalendarCheck className="h-6 w-6 text-green-500" />
        if (status === "cancelled") return <XCircle className="h-6 w-6 text-red-500" />
        return <Info className="h-6 w-6 text-blue-500" />
      case "withdrawal_status_change":
        if (status === "approved" || status === "completed") return <DollarSign className="h-6 w-6 text-green-500" />
        if (status === "rejected") return <XCircle className="h-6 w-6 text-red-500" />
        return <Info className="h-6 w-6 text-yellow-500" />
      default:
        return <Bell className="h-6 w-6 text-gray-500" />
    }
  }

  const getStatusBadge = (status?: string) => {
    if (!status) return null
    
    const statusConfig = {
      published: { label: "Published", className: "bg-green-100 text-green-800 border-green-200" },
      cancelled: { label: "Cancelled", className: "bg-red-100 text-red-800 border-red-200" },
      draft: { label: "Draft", className: "bg-gray-100 text-gray-800 border-gray-200" },
      approved: { label: "Approved", className: "bg-green-100 text-green-800 border-green-200" },
      rejected: { label: "Rejected", className: "bg-red-100 text-red-800 border-red-200" },
      pending: { label: "Pending", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
      completed: { label: "Completed", className: "bg-blue-100 text-blue-800 border-blue-200" },
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mx-auto mb-4"></div>
              <p className="text-lg font-medium text-gray-600">Loading notifications...</p>
              <p className="text-sm text-gray-500 mt-2">Please wait while we fetch your updates</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Bell className="h-8 w-8 text-blue-600" />
                {unreadCount > 0 && (
                  <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </div>
                )}
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Notifications
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  {notifications.length} total • {unreadCount} unread
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {notifications.length > 0 && unreadCount > 0 && (
                <Button
                  onClick={handleMarkAllAsRead}
                  variant="outline"
                  className="bg-white hover:bg-gray-50 border-blue-200 text-blue-700 hover:text-blue-800 transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Mark All as Read
                </Button>
              )}
              
              {notifications.length > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="bg-white hover:bg-red-50 border-red-200 text-red-700 hover:text-red-800 transition-all duration-200 shadow-sm hover:shadow-md"
                      disabled={deletingAll}
                    >
                      {deletingAll ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600 mr-2"></div>
                      ) : (
                        <Trash2 className="h-4 w-4 mr-2" />
                      )}
                      Delete All
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-red-500" />
                        Delete All Notifications
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete all {notifications.length} notifications? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteAllNotifications}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        Delete All
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        </div>

        {/* Notifications Content */}
        {notifications.length === 0 ? (
          <Card className="w-full max-w-2xl mx-auto bg-white/80 backdrop-blur-sm border-0 shadow-xl">
            <CardContent className="p-8 sm:p-12 text-center">
              <div className="flex justify-center mb-6">
                <div className="relative">
                  <Bell className="h-20 w-20 text-gray-300" />
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full opacity-20 animate-pulse"></div>
                </div>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-3">No notifications yet</h2>
              <p className="text-gray-600 text-lg leading-relaxed max-w-md mx-auto">
                When you receive notifications about your events, withdrawals, or account updates, they will appear here.
              </p>
              <div className="mt-6 flex justify-center">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4 max-w-4xl mx-auto">
            {notifications.map((notification, index) => (
              <Card
                key={notification._id}
                className={`group transition-all duration-300 hover:shadow-lg transform hover:-translate-y-1 ${
                  notification.read 
                    ? "bg-white/80 backdrop-blur-sm border-gray-200" 
                    : "bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 shadow-md"
                }`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className="flex-shrink-0 mt-1">
                      <div className={`p-2 rounded-full ${
                        notification.read 
                          ? "bg-gray-100" 
                          : "bg-blue-100 animate-pulse"
                      }`}>
                        {getNotificationIcon(notification.type, notification.status)}
                      </div>
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className={`font-semibold text-sm sm:text-base leading-relaxed ${
                          notification.read ? "text-gray-700" : "text-blue-900"
                        }`}>
                          {notification.message}
                        </p>
                        <div className="flex items-center gap-2">
                          {!notification.read && (
                            <div className="flex-shrink-0">
                              <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                            </div>
                          )}
                          
                          {/* Delete Button */}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all duration-200 opacity-0 group-hover:opacity-100"
                                disabled={deleting === notification._id}
                              >
                                {deleting === notification._id ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle className="flex items-center gap-2">
                                  <AlertTriangle className="h-5 w-5 text-red-500" />
                                  Delete Notification
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this notification? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteNotification(notification._id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-wrap">
                          {getStatusBadge(notification.status)}
                          <span className="text-xs text-gray-500 font-medium">
                            {formatTimeAgo(notification.createdAt)}
                          </span>
                        </div>
                        
                        {!notification.read && (
                          <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">
                            New
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
