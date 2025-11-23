"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, Clock, Search, Trash2, MapPin, Users, Eye, EyeOff, Info, Star, Signal, Ticket, Pencil } from "lucide-react"
import { useAdminAuthStore } from "@/store/adminAuthStore"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface Event {
  _id: string
  title: string
  description: string
  category: {
    _id: string
    name: string
    description: string
  }
  startDate: string
  endDate: string
  location: {
    address: string
    city: string
    country: string
  }
  status: string
  capacity: number
  bannerStatus: boolean
  ticketTypes: Array<{
    name: string
    price: number
    quantity: number
  }>
  coverImage: string
  organizer: {
    _id: string
    firstName: string
    lastName: string
    email: string
    phone: string
  }
  ticketsSold?: number
}

export default function EventsPage() {
  const router = useRouter()
  const { token, admin } = useAdminAuthStore()
  const isPartner = admin?.role === 'partner'
  const [events, setEvents] = useState<Event[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("All")
  const [categoryFilter, setCategoryFilter] = useState("All")
  const [publishFilter, setPublishFilter] = useState("All")
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [eventToDelete, setEventToDelete] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(5)
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false)

  const fetchEvents = async () => {
    if (!token) return
    try {
      setIsLoading(true)
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/events?detailed=true`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      })

      if (!response.ok) {
        throw new Error("Failed to fetch events")
      }

      const data = await response.json()
      const regularEvents = (data.data || []).filter((event: any) => !event.isInvitationEvent)
      setEvents(regularEvents)
    } catch (error) {
      // console.error("Error fetching events:", error)
      toast.error(error instanceof Error ? error.message : "Failed to fetch events")
    } finally {
      setIsLoading(false)
    }
  }
  
  useEffect(() => {
    fetchEvents()
  }, [token])

  const overviewStats = useMemo(() => {
    const liveEvents = events.filter(event => event.status === 'published').length;
    const bannerEvents = events.filter(event => event.bannerStatus).length;
    const totalTicketsSold = events.reduce((acc, event) => acc + (event.ticketsSold || 0), 0);
    return { liveEvents, bannerEvents, totalTicketsSold };
  }, [events]);


  const filteredEvents = events.filter((event) => {
    const matchesSearch =
      event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.location.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.location.city.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "All" || event.status === statusFilter
    const matchesCategory = categoryFilter === "All" || event.category?.name === categoryFilter
    const matchesPublish =
      publishFilter === "All" ||
      (publishFilter === "Published" && event.status === "published") ||
      (publishFilter === "Unpublished" && event.status !== "published")
    return matchesSearch && matchesStatus && matchesCategory && matchesPublish
  })

  // Pagination calculations
  const totalEvents = filteredEvents.length
  const totalPages = Math.ceil(totalEvents / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedEvents = filteredEvents.slice(startIndex, endIndex)

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, statusFilter, categoryFilter, publishFilter])

  const handleDelete = (eventId: string) => {
    setEventToDelete(eventId)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!eventToDelete) return

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/events/${eventToDelete}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      })

      if (!response.ok) {
        throw new Error("Failed to delete event")
      }

      toast.success("Event deleted successfully")
      fetchEvents() // Refresh the events list
    } catch (error) {
      // console.error("Error deleting event:", error)
      toast.error("Failed to delete event")
    } finally {
      setDeleteDialogOpen(false)
      setEventToDelete(null)
    }
  }

  const handleTogglePublish = async (eventId: string, currentStatus: boolean) => {
    try {
      const newStatus = currentStatus ? "draft" : "published"
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/events/${eventId}/publish`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) {
        throw new Error("Failed to update event status")
      }

      toast.success(`Event ${newStatus === "published" ? "published" : "unpublished"} successfully`)
      fetchEvents() // Refresh the events list
    } catch (error) {
      // console.error("Error updating event status:", error)
      toast.error(error instanceof Error ? error.message : "Failed to update event status")
    }
  }


  const handleToggleBanner = async (eventId: string, currentStatus: boolean) => {
    try {
      const newBannerStatus = !currentStatus
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/events/${eventId}/banner`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ bannerStatus: newBannerStatus }),
      })

      if (!response.ok) {
        throw new Error("Failed to update banner status")
      }

      toast.success(`Event ${newBannerStatus ? "added to" : "removed from"} banner successfully`)
      
      // Update the state locally to reflect the change immediately
      setEvents(events.map(event => 
        event._id === eventId 
          ? { ...event, bannerStatus: newBannerStatus } 
          : event
      ));

    } catch (error) {
      // console.error("Error updating banner status:", error)
      toast.error(error instanceof Error ? error.message : "Failed to update banner status")
    }
  }

  const handleViewEvent = (event: Event) => {
    setSelectedEvent(event)
    setIsEventDialogOpen(true)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading events...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}  
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">All Events</h1>
        <p className="text-gray-600 mt-1">Manage and view all events in the system</p>
      </div>

       {/* Overview Cards */}
       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="bg-green-100 p-3 rounded-full">
              <Signal className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Live Events</p>
              <p className="text-2xl font-bold text-gray-800">{overviewStats.liveEvents}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="bg-yellow-100 p-3 rounded-full">
              <Star className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Banner Events</p>
              <p className="text-2xl font-bold text-gray-800">{overviewStats.bannerEvents}</p>
            </div>
          </CardContent>
        </Card>
        {/* <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="bg-blue-100 p-3 rounded-full">
              <Ticket className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Total Tickets Sold</p>
              <p className="text-2xl font-bold text-gray-800">{overviewStats.totalTicketsSold}</p>
            </div>
          </CardContent>
        </Card> */}
      </div>

      {/* Filters and Search */}
      <Card className="border-none shadow-sm mb-6">
        <div className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative flex-1 md:flex-none">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-full md:w-[300px] border-gray-200"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] border-gray-200">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px] border-gray-200">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Categories</SelectItem>
              <SelectItem value="conference">Conference</SelectItem>
              <SelectItem value="seminar">Seminar</SelectItem>
              <SelectItem value="workshop">Workshop</SelectItem>
              <SelectItem value="concert">Concert</SelectItem>
              <SelectItem value="exhibition">Exhibition</SelectItem>
              <SelectItem value="sports">Sports</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          <Select value={publishFilter} onValueChange={setPublishFilter}>
            <SelectTrigger className="w-[180px] border-gray-200">
              <SelectValue placeholder="Filter by visibility" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Visibility</SelectItem>
              <SelectItem value="Published">Published</SelectItem>
              <SelectItem value="Unpublished">Unpublished</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Events Table */}
      <Card className="border-none shadow-sm">
        <CardContent className="p-4">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/80">
                <TableHead className="font-semibold">Event Title</TableHead>
                <TableHead className="font-semibold">Date </TableHead>
                <TableHead className="font-semibold">Location</TableHead>
                <TableHead className="font-semibold">Category</TableHead>
                <TableHead className="font-semibold">Capacity</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedEvents.map((event) => (
                <TableRow key={event._id} className="hover:bg-gray-50/50 transition-colors">
                  <TableCell>
                    <span className="font-medium text-gray-900">{event.title}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Calendar className="h-4 w-4" />
                      <span>{new Date(event.startDate).toLocaleDateString()}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-gray-600">
                      <MapPin className="h-4 w-4" />
                      {event.location.address}, {event.location.city}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                      {event.category?.name}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Users className="h-4 w-4" />
                      {event.capacity}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`${
                        event.status === "published"
                          ? "bg-green-50 text-green-700 border-green-200"
                          : event.status === "draft"
                            ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                            : event.status === "cancelled"
                              ? "bg-red-50 text-red-700 border-red-200"
                              : "bg-blue-50 text-blue-700 border-blue-200"
                      }`}
                    >
                      {event.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-blue-600 hover:text-blue-700"
                        onClick={() => handleViewEvent(event)}
                      >
                        <Info className="h-4 w-4" />
                      </Button>
                      {!isPartner && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-green-600 hover:text-green-700"
                            onClick={() => router.push(`/admin/events/edit/${event._id}`)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={
                              event.bannerStatus
                                ? "text-yellow-500 hover:text-yellow-600"
                                : "text-gray-400 hover:text-gray-500"
                            }
                            onClick={() => handleToggleBanner(event._id, event.bannerStatus)}
                          >
                            <Star className={`h-4 w-4 ${event.bannerStatus ? "fill-current" : ""}`} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={
                              event.status === "published"
                                ? "text-gray-600 hover:text-gray-700"
                                : "text-blue-600 hover:text-blue-700"
                            }
                            onClick={() => handleTogglePublish(event._id, event.status === "published")}
                          >
                            {event.status === "published" ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => handleDelete(event._id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">
              Showing {startIndex + 1} to {Math.min(endIndex, totalEvents)} of {totalEvents} events
            </span>
            <Select
              value={itemsPerPage.toString()}
              onValueChange={(value) => {
                setItemsPerPage(Number(value))
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="w-[100px] border-gray-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-gray-600">per page</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="border-gray-200"
            >
              First
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="border-gray-200"
            >
              Previous
            </Button>

            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNumber
                if (totalPages <= 5) {
                  pageNumber = i + 1
                } else if (currentPage <= 3) {
                  pageNumber = i + 1
                } else if (currentPage >= totalPages - 2) {
                  pageNumber = totalPages - 4 + i
                } else {
                  pageNumber = currentPage - 2 + i
                }

                return (
                  <Button
                    key={pageNumber}
                    variant={currentPage === pageNumber ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(pageNumber)}
                    className={currentPage === pageNumber ? "" : "border-gray-200"}
                  >
                    {pageNumber}
                  </Button>
                )
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="border-gray-200"
            >
              Next
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="border-gray-200"
            >
              Last
            </Button>
          </div>
        </div>
      )}


<Dialog open={isEventDialogOpen} onOpenChange={setIsEventDialogOpen}>
  <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle className="text-2xl font-bold text-gray-900">Event Details</DialogTitle>
    </DialogHeader>
    {selectedEvent && (
      <div className="space-y-8 pr-2">
     
              {/* Event Header */}
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <h3 className="text-2xl font-bold text-gray-900">{selectedEvent.title}</h3>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                        {selectedEvent.category?.name}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`${
                          selectedEvent.status === "published"
                            ? "bg-green-50 text-green-700 border-green-200"
                            : selectedEvent.status === "draft"
                              ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                              : selectedEvent.status === "cancelled"
                                ? "bg-red-50 text-red-700 border-red-200"
                                : "bg-blue-50 text-blue-700 border-blue-200"
                        }`}
                      >
                        {selectedEvent.status}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Description</h4>
                  <p className="text-gray-600">{selectedEvent.description}</p>
                </div>
              </div>

              {/* Event Details Grid */}
              <div className="grid grid-cols-2 gap-6">
                {/* Date and Time */}
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-50 p-2 rounded-lg">
                        <Calendar className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">Date</p>
                        <p className="font-medium text-gray-900">{new Date(selectedEvent.startDate).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-50 p-2 rounded-lg">
                        <Clock className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">Time</p>
                        <p className="font-medium text-gray-900">{new Date(selectedEvent.startDate).toLocaleTimeString()}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Location */}
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <div className="flex items-start gap-3">
                    <div className="bg-blue-50 p-2 rounded-lg">
                      <MapPin className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Location</p>
                      <p className="font-medium text-gray-900">{selectedEvent.location.address}</p>
                      <p className="text-gray-600">{selectedEvent.location.city}, {selectedEvent.location.country}</p>
                    </div>
                  </div>
                </div>

                {/* Capacity */}
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-50 p-2 rounded-lg">
                      <Users className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Capacity</p>
                      <p className="font-medium text-gray-900">{selectedEvent.capacity} attendees</p>
                    </div>
                  </div>
                </div>

                {/* Organizer Information */}
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-50 p-2 rounded-lg">
                        <Users className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">Organizer</p>
                        <p className="font-medium text-gray-900">
                          {selectedEvent.organizer?.firstName && selectedEvent.organizer?.lastName
                            ? `${selectedEvent.organizer.firstName} ${selectedEvent.organizer.lastName}`
                            : 'Unknown Organizer'}
                        </p>
                      </div>
                    </div>
                    {selectedEvent.organizer?.email && (
                      <div className="ml-10">
                        <p className="text-sm text-gray-600">{selectedEvent.organizer.email}</p>
                      </div>
                    )}
                    {selectedEvent.organizer?.phone && (
                      <div className="ml-10">
                        <p className="text-sm text-gray-600">{selectedEvent.organizer.phone}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Ticket Types */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium text-gray-900">Available Ticket Types</h4>
                  {selectedEvent.ticketTypes.some(type => 
                    type.name.includes('Wave') || type.name.includes('First') || type.name.includes('Second') || type.name.includes('Final')
                  ) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-purple-300 text-purple-600 hover:bg-purple-50"
                      onClick={async () => {
                        try {
                          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/events/update-ticket-availability`, {
                            method: 'POST',
                            headers: {
                              'Authorization': `Bearer ${token}`,
                              'Content-Type': 'application/json'
                            }
                          })
                          const data = await response.json()
                          if (response.ok) {
                            toast.success(data.message || 'Ticket availability updated successfully')
                            fetchEvents() // Refresh events to show updated ticket status
                          } else {
                            toast.error(data.message || 'Failed to update ticket availability')
                          }
                        } catch (error) {
                          toast.error('Failed to update ticket availability')
                        }
                      }}
                    >
                      <Clock className="mr-2 h-4 w-4" />
                      Update Wave Status
                    </Button>
                  )}
                </div>
                <div className="grid gap-3">
                  {selectedEvent.ticketTypes.map((type, index) => (
                    <div key={index} className="bg-white p-4 rounded-lg border border-gray-200">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium text-gray-900">{type.name}</p>
                          <p className="text-sm text-gray-600">Available: {type.quantity} tickets</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-gray-900">{type.price.toFixed(2)} birr</p>
                          <p className="text-sm text-gray-600">per ticket</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the event and remove all associated data from
              our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
