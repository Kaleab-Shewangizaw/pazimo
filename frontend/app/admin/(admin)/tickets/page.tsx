"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useAdminAuthStore } from "@/store/adminAuthStore"
import { toast } from "sonner"
import { Search, Eye, Calendar, Clock, MapPin, Users, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface Ticket {
  _id: string
  ticketId: string
  event: {
    _id: string
    title: string
    organizer: {
      _id: string
      name: string
    }
  }
  user: {
    name: string
  }
  ticketType: string
  price: number
  status: 'active' | 'used' | 'cancelled' | 'expired'
  purchaseDate: string
}

interface Event {
  _id: string
  title: string
  organizer: {
    _id: string
    name: string
  }
  startDate: string
  endDate: string
  location: {
    address: string
    city: string
    country: string
  }
  capacity: number
  ticketTypes: Array<{
    name: string
    price: number
    quantity: number
  }>
}

export default function TicketsPage() {
  const { token } = useAdminAuthStore()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [events, setEvents] = useState<Record<string, Event>>({})
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(5)
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false)

  useEffect(() => {
    const fetchTickets = async () => {
      if (!token) {
        console.error('No admin token available')
        toast.error('Authentication required. Please login as admin.')
        setLoading(false)
        return
      }
      
      try {
        console.log('Fetching tickets with token:', token ? 'Token present' : 'No token')
        console.log('API URL:', `${process.env.NEXT_PUBLIC_API_URL}/api/tickets/admin/all`)
        
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tickets/admin/all`, {
          headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
        })

        console.log('Response status:', response.status)
        console.log('Response ok:', response.ok)

        if (!response.ok) {
          const errorText = await response.text()
          console.error('Error response:', errorText)
          throw new Error(`Failed to fetch tickets: ${response.status} ${errorText}`)
        }

        const data = await response.json()
        console.log('Tickets data received:', data)
        
        if (data.success && data.data) {
          console.log('Setting tickets data:', data.data.length, 'tickets')
          setTickets(data.data)
        } else {
          throw new Error("Invalid ticket data received")
        }
      } catch (error) {
        console.error("Error fetching tickets:", error)
        toast.error(`Failed to fetch tickets: ${error.message}`)
      } finally {
        setLoading(false)
      }
    }

    fetchTickets()
  }, [token])

  // Filter tickets based on search query and status
  const filteredTickets = tickets.filter((ticket) => {
    const searchLower = searchQuery.toLowerCase()
    
    const matchesSearch = 
      (ticket.event?.title?.toLowerCase() || "").includes(searchLower) ||
      (ticket.user?.name?.toLowerCase() || "").includes(searchLower) ||
      (ticket.ticketType?.toLowerCase() || "").includes(searchLower) ||
      (ticket.ticketId?.toLowerCase() || "").includes(searchLower)

    const matchesStatus = statusFilter === "all" || ticket.status === statusFilter

    return matchesSearch && matchesStatus
  })

  // Calculate pagination
  const totalTickets = filteredTickets.length
  const totalPages = Math.ceil(totalTickets / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedTickets = filteredTickets.slice(startIndex, endIndex)

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, statusFilter])

  const handleViewEvent = (eventId: string) => {
    const event = events[eventId]
    if (event) {
      setSelectedEvent(event)
      setIsEventDialogOpen(true)
    }
  }

  const handleDeleteTicket = async (ticketId: string) => {
    if (!confirm('Are you sure you want to delete this ticket?')) {
      return
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tickets/${ticketId}`, {
        method: 'DELETE',
        headers: {
          "Authorization": `Bearer ${token}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to delete ticket')
      }

      setTickets(tickets.filter(ticket => ticket._id !== ticketId))
      toast.success('Ticket deleted successfully')
    } catch (error) {
      console.error('Error deleting ticket:', error)
      toast.error('Failed to delete ticket')
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Tickets</h1>
          <p className="text-gray-600 mt-1">Loading tickets...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Tickets</h1>
        <p className="text-gray-600 mt-1">Manage and view all tickets</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Tickets</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
            <div className="flex flex-1 items-center space-x-2">
              <div className="relative flex-1 md:max-w-sm">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                <Input
                  placeholder="Search tickets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Select
                value={statusFilter}
                onValueChange={setStatusFilter}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="used">Used</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-md border">
              <Table>
              <TableHeader>
                <TableRow>
                    <TableHead>#</TableHead>
                  <TableHead>Ticket ID</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Purchase Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedTickets.map((ticket, idx) => {
                  const rowNumber = startIndex + idx + 1
                  return (
                    <TableRow key={ticket._id}>
                      <TableCell className="w-12 text-gray-600">{rowNumber}</TableCell>
                      <TableCell className="font-medium">{ticket.ticketId}</TableCell>
                      <TableCell>{ticket.event?.title || 'N/A'}</TableCell>
                      <TableCell>{ticket.user?.name || 'N/A'}</TableCell>
                      <TableCell>{ticket.ticketType}</TableCell>
                      <TableCell>{ticket.price.toFixed(2)} birr</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            ticket.status === "active"
                              ? "default"
                              : ticket.status === "cancelled"
                              ? "destructive"
                              : ticket.status === "used"
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {ticket.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(ticket.purchaseDate).toLocaleString()}</TableCell>
                      <TableCell>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteTicket(ticket._id)}
                          className="h-8 w-8 p-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {paginatedTickets.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-4">
                      No tickets found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalTickets > itemsPerPage && (
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <p className="text-sm text-gray-600">Items per page:</p>
                <Select
                  value={itemsPerPage.toString()}
                  onValueChange={(value) => {
                    setItemsPerPage(Number(value))
                    setCurrentPage(1)
                  }}
                >
                  <SelectTrigger className="h-8 w-[70px]">
                    <SelectValue placeholder={itemsPerPage} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <p className="text-sm text-gray-600">
                  Showing {startIndex + 1}-{Math.min(endIndex, totalTickets)} of {totalTickets}
                </p>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="px-2 py-1 text-sm border rounded disabled:opacity-50"
                  >
                    First
                  </button>
                  <button
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-2 py-1 text-sm border rounded disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-2 py-1 text-sm border rounded disabled:opacity-50"
                  >
                    Next
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="px-2 py-1 text-sm border rounded disabled:opacity-50"
                  >
                    Last
                  </button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Event Details Dialog */}
      <Dialog open={isEventDialogOpen} onOpenChange={setIsEventDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Event Details</DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">{selectedEvent.title}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Calendar className="h-4 w-4" />
                    <span>{new Date(selectedEvent.startDate).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Clock className="h-4 w-4" />
                    <span>{new Date(selectedEvent.startDate).toLocaleTimeString()}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <MapPin className="h-4 w-4" />
                    <span>
                      {selectedEvent.location.address}, {selectedEvent.location.city}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Users className="h-4 w-4" />
                    <span>Capacity: {selectedEvent.capacity}</span>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Ticket Types</h4>
                <div className="grid gap-2">
                  {selectedEvent.ticketTypes.map((type, index) => (
                    <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <span>{type.name}</span>
                      <span>{type.price.toFixed(2)} birr</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
} 