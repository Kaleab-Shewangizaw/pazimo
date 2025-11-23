"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar, Clock, MapPin, Users, Ticket, Wallet, ArrowLeft, Mail, Phone, TrendingUp, DollarSign, CalendarDays, Search, Filter, ChevronLeft, ChevronRight } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface OrganizerData {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  events: EventData[];
  createdAt: string;
}

interface EventData {
  _id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  location: {
    address: string;
    city: string;
    country: string;
  };
  status: string;
  ticketTypes: TicketType[];
  tickets: TicketData[];
  capacity: number;
}

interface TicketType {
  name: string;
  price: number;
  quantity: number;
  description: string;
  available: boolean;
  startDate?: string;
  endDate?: string;
}

interface TicketData {
  _id: string;
  event: string;
  user: {
    firstName: string;
    lastName: string;
    email: string;
  };
  ticketType: string;
  price: number;
  status: string;
  createdAt: string;
}

interface WithdrawalData {
  _id: string;
  organizerId: string;
  amount: number;
  status: 'pending' | 'completed' | 'rejected';
  notes: string;
  createdAt: string;
}

export default function OrganizerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { id } = use(params)
  const [organizer, setOrganizer] = useState<OrganizerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState<EventData | null>(null)
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState("")
  const [withdrawNotes, setWithdrawNotes] = useState("")
  const [isSubmittingWithdraw, setIsSubmittingWithdraw] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(5)
  const [currentPageStats, setCurrentPageStats] = useState({
    totalTickets: 0,
    totalRevenue: 0
  });
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalEvents: 0,
    totalRevenue: 0,
    activeOrganizers: 0
  });

  useEffect(() => {
    fetchOrganizerDetails()
  }, [id])

  const fetchOrganizerDetails = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/${id}`, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch organizer details')
      }

      const data = await response.json()
      const organizerData = data.user

      // Fetch events for the organizer
      const eventsResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/events/organizer/${id}`, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      })

      if (eventsResponse.ok) {
        const eventsData = await eventsResponse.json()
        setOrganizer({
          ...organizerData,
          events: eventsData.events || []
        })
      } else {
        setOrganizer(organizerData)
      }
    } catch (error) {
      console.error('Error fetching organizer details:', error)
      toast.error('Failed to fetch organizer details')
    } finally {
      setLoading(false)
    }
  }

  const fetchEventTickets = async (eventId: string) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tickets/event/${eventId}`, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch event tickets')
      }

      const data = await response.json()
      return data.tickets || []
    } catch (error) {
      console.error('Error fetching event tickets:', error)
      toast.error('Failed to fetch event tickets')
      return []
    }
  }

  const handleViewEvent = async (event: EventData) => {
    const tickets = await fetchEventTickets(event._id)
    setSelectedEvent({ ...event, tickets })
  }

  const handleWithdraw = async () => {
    if (!organizer) return

    try {
      setIsSubmittingWithdraw(true)
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/withdrawals`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizerId: organizer._id,
          amount: parseFloat(withdrawAmount),
          notes: withdrawNotes,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to process withdrawal')
      }

      toast.success('Withdrawal request submitted successfully')
      setWithdrawDialogOpen(false)
      setWithdrawAmount("")
      setWithdrawNotes("")
      fetchOrganizerDetails() // Refresh data
    } catch (error) {
      console.error('Error processing withdrawal:', error)
      toast.error('Failed to process withdrawal')
    } finally {
      setIsSubmittingWithdraw(false)
    }
  }

  const filteredEvents = organizer?.events.filter((event) => {
    const matchesSearch = event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.location.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.location.country.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesStatus = statusFilter === "all" || event.status === statusFilter

    return matchesSearch && matchesStatus
  }) || []

  const paginatedEvents = filteredEvents.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const totalPages = Math.ceil(filteredEvents.length / itemsPerPage)

  // Calculate stats for current page whenever paginatedEvents changes
  useEffect(() => {
    const stats = paginatedEvents.reduce((acc, event) => {
      const eventTickets = event.tickets?.length || 0;
      const eventRevenue = event.tickets?.reduce((sum, ticket) => sum + (Number(ticket.price) || 0), 0) || 0;
      return {
        totalTickets: acc.totalTickets + eventTickets,
        totalRevenue: acc.totalRevenue + eventRevenue
      };
    }, { totalTickets: 0, totalRevenue: 0 });

    setCurrentPageStats(stats);
  }, [paginatedEvents]);

  // Calculate stats whenever organizer data changes
  useEffect(() => {
    if (!organizer) return;

    // Calculate total events
    const totalEvents = organizer.events?.length || 0;

    // Calculate total revenue from all events
    const totalRevenue = organizer.events?.reduce((sum, event) => 
      sum + (event.tickets?.reduce((ticketSum, ticket) => ticketSum + (Number(ticket.price) || 0), 0) || 0), 0) || 0;

    // Calculate total unique users (from tickets)
    const uniqueUsers = new Set();
    organizer.events?.forEach(event => {
      event.tickets?.forEach(ticket => {
        if (ticket.user?.email) {
          uniqueUsers.add(ticket.user.email);
        }
      });
    });

    // Calculate active organizers (those with published events)
    const activeOrganizers = organizer.events?.filter(event => event.status === 'published').length > 0 ? 1 : 0;

    setStats({
      totalUsers: uniqueUsers.size,
      totalEvents,
      totalRevenue,
      activeOrganizers
    });
  }, [organizer]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading organizer details...</p>
        </div>
      </div>
    )
  }

  if (!organizer) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">Organizer not found</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => router.push('/admin/organizers')}
          >
            Back to Organizers
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto py-10 p-10">
        {/* Header Section */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="outline"
            onClick={() => router.push('/admin/organizers')}
            className="hover:bg-primary/10 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Organizers
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              {organizer.firstName} {organizer.lastName}
            </h1>
            <div className="flex items-center gap-4 mt-2 text-muted-foreground">
              <div className="flex items-center gap-1">
                <Mail className="h-4 w-4" />
                {organizer.email}
              </div>
              <div className="flex items-center gap-1">
                <Phone className="h-4 w-4" />
                {organizer.phoneNumber}
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-primary/10">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Total Users</div>
                  <div className="text-2xl font-bold mt-1">{stats.totalUsers.toLocaleString()}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-primary/10">
                  <Calendar className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Total Events</div>
                  <div className="text-2xl font-bold mt-1">{stats.totalEvents.toLocaleString()}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-primary/10">
                  <DollarSign className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Total Revenue</div>
                  <div className="text-2xl font-bold mt-1">{stats.totalRevenue.toLocaleString()} birr</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-primary/10">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Active Organizers</div>
                  <div className="text-2xl font-bold mt-1">{stats.activeOrganizers}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Current Page Summary */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex justify-between items-center">
              <div className="text-sm text-muted-foreground">
                Showing page {currentPage} of {totalPages}
              </div>
              <div className="flex gap-6">
                <div className="text-right">
                  <div className="text-sm font-medium text-muted-foreground">Current Page Tickets</div>
                  <div className="text-lg font-semibold">{currentPageStats.totalTickets}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-muted-foreground">Current Page Revenue</div>
                  <div className="text-lg font-semibold">{currentPageStats.totalRevenue.toFixed(2)} birr</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Withdraw Button */}
        <div className="mb-8">
          <Button
            onClick={() => setWithdrawDialogOpen(true)}
            className="w-full h-12 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 transition-all duration-300"
          >
            <Wallet className="h-5 w-5 mr-2" />
            Process Withdrawal  
          </Button>
        </div>

        {/* Events List with Filters */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Events</h2>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery("")
                  setStatusFilter("all")
                }}
              >
                <Filter className="h-4 w-4 mr-2" />
                Clear Filters
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-card rounded-lg border">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Events List */}
          {filteredEvents.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center">
                <div className="text-muted-foreground">
                  {organizer?.events.length === 0
                    ? "No events found for this organizer"
                    : "No events match the current filters"}
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {paginatedEvents.map((event) => (
                <Card key={event._id} className="overflow-hidden hover:shadow-lg transition-all duration-300">
                  <CardContent className="p-0">
                    <div className="p-6">
                      <div className="flex justify-between items-start">
                        <div className="space-y-3">
                          <h3 className="font-semibold text-xl">{event.title}</h3>
                          <p className="text-muted-foreground line-clamp-2">{event.description}</p>
                          <div className="flex items-center gap-6 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              {new Date(event.startDate).toLocaleDateString()}
                            </div>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4" />
                              {event.location.city}, {event.location.country}
                            </div>
                            <div className="flex items-center gap-2">
                              <Ticket className="h-4 w-4" />
                              {event.ticketTypes.length} Types
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge 
                            variant={event.status === 'published' ? 'default' : 'secondary'}
                            className={`px-3 py-1 ${
                              event.status === 'published' 
                                ? 'bg-[#1a2d5a] text-white' 
                                : 'bg-[#1a2d5a]/10 text-[#1a2d5a]'
                            }`}
                          >
                            {event.status}
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewEvent(event)}
                            className="hover:bg-[#1a2d5a]/10 transition-colors"
                          >
                            View Details
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Event Summary */}
                    <div className="bg-muted/50 p-6 border-t">
                      <div className="grid grid-cols-3 gap-6">
                        <div>
                          <div className="text-sm font-medium text-muted-foreground">Tickets Sold</div>
                          <div className="text-xl font-semibold mt-1">{event.tickets?.length || 0}</div>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-muted-foreground">Revenue</div>
                          <div className="text-xl font-semibold mt-1">
                            {(event.tickets?.reduce((sum, ticket) => sum + (Number(ticket.price) || 0), 0) || 0).toFixed(2)} birr
                          </div>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-muted-foreground">Capacity</div>
                          <div className="text-xl font-semibold mt-1">{event.capacity}</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-muted-foreground">
                      Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredEvents.length)} of {filteredEvents.length} events
                    </p>
                    <Select
                      value={itemsPerPage.toString()}
                      onValueChange={(value) => {
                        setItemsPerPage(Number(value))
                        setCurrentPage(1)
                      }}
                    >
                      <SelectTrigger className="w-[100px]">
                        <SelectValue placeholder="Per page" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5 per page</SelectItem>
                        <SelectItem value="10">10 per page</SelectItem>
                        <SelectItem value="20">20 per page</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="hover:bg-[#1a2d5a]/10 transition-colors"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <Button
                          key={page}
                          variant={page === currentPage ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(page)}
                          className={page === currentPage 
                            ? "bg-[#1a2d5a] hover:bg-[#1a2d5a]/90 text-white" 
                            : "hover:bg-[#1a2d5a]/10 transition-colors"
                          }
                        >
                          {page}
                        </Button>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="hover:bg-[#1a2d5a]/10 transition-colors"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Withdraw Dialog */}
        <Dialog open={withdrawDialogOpen} onOpenChange={setWithdrawDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="text-2xl font-semibold">Process Withdrawal</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <Label>Amount (birr)</Label>
                <Input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={withdrawNotes}
                  onChange={(e) => setWithdrawNotes(e.target.value)}
                  placeholder="Add any notes about this withdrawal"
                  rows={3}
                  className="resize-none"
                />
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="text-sm font-medium text-muted-foreground">Available Balance</div>
                <div className="text-xl font-semibold mt-1">
                  {organizer.events.reduce((sum, event) => 
                    sum + (event.tickets?.reduce((ticketSum, ticket) => ticketSum + ticket.price, 0) || 0), 0) || 0} birr
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setWithdrawDialogOpen(false)}
                className="hover:bg-muted"
              >
                Cancel
              </Button>
              <Button
                onClick={handleWithdraw}
                disabled={!withdrawAmount || isSubmittingWithdraw}
                className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
              >
                {isSubmittingWithdraw ? 'Processing...' : 'Process Withdrawal'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Event Details Dialog */}
        <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-semibold">{selectedEvent?.title}</DialogTitle>
              <div className="text-muted-foreground mt-2">
                {selectedEvent?.description}
              </div>
            </DialogHeader>

            <div className="space-y-8">
              {/* Event Details */}
              <div className="grid grid-cols-2 gap-6">
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <h3 className="font-semibold text-lg mb-4">Event Details</h3>
                    <div className="space-y-4 text-sm">
                      <div className="flex items-center gap-3">
                        <Calendar className="h-5 w-5 text-primary" />
                        <span>
                          {new Date(selectedEvent?.startDate || '').toLocaleDateString()} - {new Date(selectedEvent?.endDate || '').toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <MapPin className="h-5 w-5 text-primary" />
                        <span>
                          {selectedEvent?.location.address}, {selectedEvent?.location.city}, {selectedEvent?.location.country}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Users className="h-5 w-5 text-primary" />
                        <span>Capacity: {selectedEvent?.capacity}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge 
                          variant={selectedEvent?.status === 'published' ? 'default' : 'secondary'}
                          className={`px-3 py-1 ${
                            selectedEvent?.status === 'published' 
                              ? 'bg-[#1a2d5a] text-white' 
                              : 'bg-[#1a2d5a]/10 text-[#1a2d5a]'
                          }`}
                        >
                          {selectedEvent?.status}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <h3 className="font-semibold text-lg mb-4">Ticket Summary</h3>
                    <div className="space-y-4 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Total Tickets Sold:</span>
                        <span className="font-semibold">{selectedEvent?.tickets.length}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Total Revenue:</span>
                        <span className="font-semibold">
                          {selectedEvent?.tickets.reduce((sum, ticket) => sum + ticket.price, 0)} birr
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Remaining Capacity:</span>
                        <span className="font-semibold">
                          {(selectedEvent?.capacity || 0) - (selectedEvent?.tickets.length || 0)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Ticket Types */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Ticket Types</h3>
                <div className="grid gap-4">
                  {selectedEvent?.ticketTypes.map((ticket, index) => (
                    <Card key={index} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <Ticket className="h-5 w-5 text-primary" />
                              <span className="font-semibold text-lg">{ticket.name}</span>
                            </div>
                            <p className="text-muted-foreground">{ticket.description}</p>
                            {ticket.startDate && ticket.endDate && (
                              <p className="text-sm text-muted-foreground">
                                Available: {new Date(ticket.startDate).toLocaleDateString()} - {new Date(ticket.endDate).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                          <div className="text-right space-y-2">
                            <p className="font-semibold text-lg">{ticket.price} birr</p>
                            <p className="text-sm text-muted-foreground">Quantity: {ticket.quantity}</p>
                            <Badge 
                              variant={ticket.available ? 'default' : 'secondary'}
                              className={`px-3 py-1 ${
                                ticket.available 
                                  ? 'bg-[#1a2d5a] text-white' 
                                  : 'bg-[#1a2d5a]/10 text-[#1a2d5a]'
                              }`}
                            >
                              {ticket.available ? 'Available' : 'Sold Out'}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Sold Tickets */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Sold Tickets</h3>
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Customer</TableHead>
                        <TableHead>Ticket Type</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Purchase Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedEvent?.tickets.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            No tickets sold yet
                          </TableCell>
                        </TableRow>
                      ) : (
                        selectedEvent?.tickets.map((ticket) => (
                          <TableRow key={ticket._id} className="hover:bg-muted/50">
                            <TableCell>
                              <div className="font-medium">
                                {ticket.user.firstName} {ticket.user.lastName}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {ticket.user.email}
                              </div>
                            </TableCell>
                            <TableCell>{ticket.ticketType}</TableCell>
                            <TableCell>{ticket.price} birr</TableCell>
                            <TableCell>
                              <Badge 
                                variant={ticket.status === 'active' ? 'default' : 'secondary'}
                                className={`px-3 py-1 ${
                                  ticket.status === 'active' 
                                    ? 'bg-[#1a2d5a] text-white' 
                                    : 'bg-[#1a2d5a]/10 text-[#1a2d5a]'
                                }`}
                              >
                                {ticket.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {new Date(ticket.createdAt).toLocaleDateString()}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
} 