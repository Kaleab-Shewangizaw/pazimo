"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAdminAuthStore } from "@/store/adminAuthStore"
import { toast } from "sonner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Calendar,
  Users,
  Eye,
  Ticket,
  ChevronLeft,
  ChevronRight,
  Wallet,
  Banknote,
  Search,
  RefreshCw,
  DollarSign,
  Building2,
} from "lucide-react"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface OrganizerData {
  _id: string
  firstName: string
  lastName: string
  email: string
  phoneNumber: string
  events: EventData[]
  createdAt: string
  totalRevenue?: number
}

interface EventData {
  _id: string
  title: string
  description: string
  startDate: string
  endDate: string
  location: {
    address: string
    city: string
    country: string
  }
  status: string
  ticketTypes: TicketType[]
  tickets: TicketData[]
  capacity: number
}

interface TicketType {
  name: string
  price: number
  quantity: number
  description: string
  available: boolean
  startDate?: string
  endDate?: string
}

interface TicketData {
  _id: string
  event: string
  user: {
    firstName: string
    lastName: string
    email: string
  }
  ticketType: string
  price: number
  status: string
  createdAt: string
}

interface RevenueBreakdown {
  eventId: string
  eventTitle: string
  totalRevenue: number
  ticketTypeBreakdown: {
    name: string
    price: number
    quantitySold: number
    revenue: number
  }[]
  totalTicketsSold: number
}

interface OrganizerBalance {
  totalRevenue: number
  organizerRevenue: number
  pazimoCommission: number
  pendingWithdrawals: number
  availableBalance: number
  revenueBreakdown: RevenueBreakdown[]
  summary: {
    totalEvents: number
    totalTicketsSold: number
    averageTicketPrice: number
  }
}

// Add payment method type
type PaymentMethod = 'telebirr' | 'mpesa' | 'bank';

export default function OrganizersPage() {
  const router = useRouter()
  const { token, admin } = useAdminAuthStore()
  const isPartner = admin?.role === 'partner'
  const [organizers, setOrganizers] = useState<OrganizerData[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [organizerPage, setOrganizerPage] = useState(1)
  const [organizerTotalPages, setOrganizerTotalPages] = useState(1)
  const [organizerItemsPerPage, setOrganizerItemsPerPage] = useState(10)
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState("")
  const [withdrawNotes, setWithdrawNotes] = useState("")
  const [isSubmittingWithdraw, setIsSubmittingWithdraw] = useState(false)
  const [stats, setStats] = useState({
    totalOrganizers: 0,
    totalEvents: 0,
    totalRevenue: 0,
    activeEvents: 0,
  })
  const [selectedOrganizer, setSelectedOrganizer] = useState<OrganizerData | null>(null)
  const [bankDetails, setBankDetails] = useState({
    accountName: "",
    accountNumber: "",
    bankName: "",
  })
  const [organizerBalance, setOrganizerBalance] = useState<OrganizerBalance | null>(null)
  const [selectedOrganizerForBalance, setSelectedOrganizerForBalance] = useState<OrganizerData | null>(null)
  const [balanceDialogOpen, setBalanceDialogOpen] = useState(false)
  const [organizerDetailsDialogOpen, setOrganizerDetailsDialogOpen] = useState(false)

  useEffect(() => {
    fetchOrganizers()
  }, [organizerPage, organizerItemsPerPage])

  const fetchOrganizers = async () => {
    try {
      setLoading(true)
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/users?role=organizer&page=${organizerPage}&limit=${organizerItemsPerPage}`,
        {
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      )

      if (!response.ok) {
        throw new Error("Failed to fetch organizers")
      }

      const data = await response.json()
      const organizersArray = data.data?.users || []

      // Fetch events for each organizer with tickets
      const organizersWithEvents = await Promise.all(
        organizersArray.map(async (organizer: OrganizerData) => {
          const eventsResponse = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/events/organizer/${organizer._id}`,
            {
              headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
            },
          )
          
          if (eventsResponse.ok) {
            const eventsData = await eventsResponse.json()
            const events = eventsData.events || []
            
            // Fetch tickets for each event
            const eventsWithTickets = await Promise.all(
              events.map(async (event: EventData) => {
                const tickets = await fetchEventTickets(event._id)
                return {
                  ...event,
                  tickets: tickets || []
                }
              })
            )
            
            return {
              ...organizer,
              events: eventsWithTickets,
            }
          }
          return organizer
        }),
      )

      // Fetch revenue data for each organizer using the balance API
      const organizersWithRevenue = await Promise.all(
        organizersWithEvents.map(async (organizer: OrganizerData) => {
          try {
            const balanceResponse = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL}/api/withdrawals/organizer/${organizer._id}/balance`,
              {
                headers: {
                  Accept: "application/json",
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
              }
            )

            if (balanceResponse.ok) {
              const balanceData = await balanceResponse.json()
              return {
                ...organizer,
                totalRevenue: balanceData.data?.totalRevenue || 0,
              }
            }
            return organizer
          } catch (error) {
            console.error(`Error fetching revenue for organizer ${organizer._id}:`, error)
            return organizer
          }
        })
      )

      // Calculate stats
      const totalEvents = organizersWithRevenue.reduce(
        (sum: number, org: OrganizerData) => sum + (org.events?.length || 0),
        0,
      )
      const activeEvents = organizersWithRevenue.reduce(
        (sum: number, org: OrganizerData) =>
          sum + (org.events?.filter((event: EventData) => event.status === "published")?.length || 0),
        0,
      )
      const totalRevenue = organizersWithRevenue.reduce(
        (sum: number, org: OrganizerData) =>
          sum + (org.totalRevenue || 0),
        0,
      )

      setStats({
        totalOrganizers: data.data?.total || 0,
        totalEvents,
        totalRevenue,
        activeEvents,
      })

      setOrganizers(organizersWithRevenue)
      if (data.data?.total) {
        setOrganizerTotalPages(Math.ceil(data.data.total / organizerItemsPerPage))
      }
    } catch (error) {
      console.error("Error fetching organizers:", error)
      toast.error("Failed to fetch organizers")
    } finally {
      setLoading(false)
    }
  }

  const fetchEventTickets = async (eventId: string) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tickets/event/${eventId}`, {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        console.warn(`Failed to fetch tickets for event ${eventId}: ${response.status}`)
        return []
      }

      const data = await response.json()
      return data.tickets || []
    } catch (error) {
      console.warn(`Error fetching tickets for event ${eventId}:`, error)
      return []
    }
  }

  const handleViewEvent = async (event: EventData) => {
    const tickets = await fetchEventTickets(event._id)
    router.push(`/admin/organizers/${event._id}`)
  }

  const handleWithdraw = async () => {
    if (!selectedOrganizer) return

    try {
      setIsSubmittingWithdraw(true)
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/withdrawals`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          organizerId: selectedOrganizer._id,
          amount: Number.parseFloat(withdrawAmount),
          notes: withdrawNotes,
          bankDetails,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to process withdrawal")
      }

      toast.success("Withdrawal request created successfully")
      setWithdrawDialogOpen(false)
      setWithdrawAmount("")
      setWithdrawNotes("")
      setBankDetails({
        accountName: "",
        accountNumber: "",
        bankName: "",
      })
      fetchOrganizers()
    } catch (error) {
      console.error("Error processing withdrawal:", error)
      toast.error("Failed to process withdrawal")
    } finally {
      setIsSubmittingWithdraw(false)
    }
  }

  const fetchOrganizerBalance = async (organizerId: string) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/withdrawals/organizer/${organizerId}/balance`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch organizer balance");
      }

      const data = await response.json();
      if (data.success) {
        setOrganizerBalance(data.data);
      } else {
        throw new Error(data.message || "Failed to fetch organizer balance");
      }
    } catch (error) {
      console.error("Error fetching organizer balance:", error);
      toast.error("Failed to fetch organizer balance");
    }
  };

  const handleViewBalance = async (organizer: OrganizerData) => {
    setSelectedOrganizerForBalance(organizer)
    await fetchOrganizerBalance(organizer._id)
    setBalanceDialogOpen(true)
  }

  const handleViewOrganizerDetails = (organizer: OrganizerData) => {
    setSelectedOrganizer(organizer)
    setOrganizerDetailsDialogOpen(true)
  }

  // Helper function to calculate revenue from all tickets (active, used, etc.)
  const calculateRevenue = (tickets: TicketData[]) => {
    if (!tickets || tickets.length === 0) return 0
    return tickets.reduce((sum, ticket) => {
      // Count all tickets regardless of status (active, used, etc.)
      return sum + (ticket.price || 0)
    }, 0)
  }

  // Helper function to calculate revenue by status if needed
  const calculateRevenueByStatus = (tickets: TicketData[], status: string) => {
    if (!tickets || tickets.length === 0) return 0
    return tickets.reduce((sum, ticket) => {
      if (ticket.status === status) {
        return sum + (ticket.price || 0)
      }
      return sum
    }, 0)
  }

  const filteredOrganizers = organizers.filter((organizer) => {
    const fullName = `${organizer.firstName} ${organizer.lastName}`.toLowerCase()
    const email = organizer.email.toLowerCase()
    const phone = organizer.phoneNumber?.toLowerCase() || ""
    const searchLower = searchQuery.toLowerCase()

    return fullName.includes(searchLower) || email.includes(searchLower) || phone.includes(searchLower)
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-200 border-t-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">Loading organizers...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-10 p-10 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Event Organizers</h1>
            <p className="text-gray-600 mt-1">Manage organizers and their events</p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full lg:w-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search organizers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-full sm:w-[300px]"
              />
            </div>
            <Select
              value={organizerItemsPerPage.toString()}
              onValueChange={(value) => {
                setOrganizerItemsPerPage(Number(value))
                setOrganizerPage(1)
              }}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Items per page" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5 per page</SelectItem>
                <SelectItem value="10">10 per page</SelectItem>
                <SelectItem value="15">15 per page</SelectItem>
                <SelectItem value="20">20 per page</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={fetchOrganizers} className="bg-blue-600 hover:bg-blue-700 text-white">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <Card className="border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300 border-l-4 border-l-blue-600">
            <CardContent className="p-4">
              <div className="flex flex-col">
                <p className="text-xs font-medium text-gray-600 mb-1">Total Organizers</p>
                <p className="text-xl font-bold text-gray-900">{stats.totalOrganizers}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300 border-l-4 border-l-indigo-600">
            <CardContent className="p-4">
              <div className="flex flex-col">
                <p className="text-xs font-medium text-gray-600 mb-1">Total Events</p>
                <p className="text-xl font-bold text-gray-900">{stats.totalEvents}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300 border-l-4 border-l-green-600">
            <CardContent className="p-4">
              <div className="flex flex-col">
                <p className="text-xs font-medium text-gray-600 mb-1">Active Events</p>
                <p className="text-xl font-bold text-gray-900">{stats.activeEvents}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300 border-l-4 border-l-emerald-600">
            <CardContent className="p-4">
              <div className="flex flex-col">
                <p className="text-xs font-medium text-gray-600 mb-1">Total Revenue</p>
                <p className="text-lg font-bold text-gray-900">{stats.totalRevenue.toFixed(2)} Birr</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300 border-l-4 border-l-purple-600">
            <CardContent className="p-4">
              <div className="flex flex-col">
                <p className="text-xs font-medium text-gray-600 mb-1">Organizer Revenue (97%)</p>
                <p className="text-lg font-bold text-gray-900">{(stats.totalRevenue * 0.97).toFixed(2)} Birr</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300 border-l-4 border-l-red-600">
            <CardContent className="p-4">
              <div className="flex flex-col">
                <p className="text-xs font-medium text-gray-600 mb-1">Pazimo Commission (3%)</p>
                <p className="text-lg font-bold text-gray-900">{(stats.totalRevenue * 0.03).toFixed(2)} Birr</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Organizers Directory Table */}
        <Card className="border border-gray-200 shadow-lg hover:shadow-xl mb-8 border-t-4 border-t-blue-600">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Building2 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Organizers Directory</h3>
                <p className="text-gray-600 text-sm">Manage all event organizers and their activities</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-200">
                    <TableHead className="font-semibold text-gray-700">Name</TableHead>
                    <TableHead className="font-semibold text-gray-700">Email</TableHead>
                    <TableHead className="font-semibold text-gray-700">Phone</TableHead>
                    <TableHead className="font-semibold text-gray-700">Events</TableHead>
                    <TableHead className="font-semibold text-gray-700">Active Events</TableHead>
                    <TableHead className="font-semibold text-gray-700">Joined</TableHead>
                    <TableHead className="font-semibold text-gray-700 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrganizers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-gray-500 py-12">
                        <Building2 className="h-8 w-8 text-blue-400 mx-auto mb-3" />
                        <p className="font-medium">No organizers found</p>
                        <p className="text-sm">Organizers will appear here once registered</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredOrganizers.map((organizer) => {
                      const activeEvents =
                        organizer.events?.filter((event: EventData) => event.status === "published")?.length || 0

                      return (
                        <TableRow
                          key={organizer._id}
                          className="cursor-pointer hover:bg-blue-50 transition-colors border-gray-100"
                        >
                          <TableCell className="font-medium text-gray-900">
                            {organizer.firstName} {organizer.lastName}
                          </TableCell>
                          <TableCell className="text-gray-600">{organizer.email}</TableCell>
                          <TableCell className="text-gray-600">{organizer.phoneNumber}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="border-blue-300 text-blue-700 bg-blue-50">
                              {organizer.events?.length || 0} Events
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-green-100 text-green-800 border-green-200">
                              {activeEvents} Active
                            </Badge>
                          </TableCell>
                          <TableCell className="text-gray-600">
                            {new Date(organizer.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewBalance(organizer)}
                                className="border-green-300 text-green-600 hover:bg-green-50"
                              >
                                <Wallet className="h-4 w-4 mr-1" />
                                Balance
                              </Button>
                              {!isPartner && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedOrganizer(organizer)
                                    setWithdrawDialogOpen(true)
                                  }}
                                  className="border-orange-300 text-orange-600 hover:bg-orange-50"
                                >
                                  <Banknote className="h-4 w-4 mr-1" />
                                  Withdraw
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewOrganizerDetails(organizer)}
                                className="border-blue-300 text-blue-600 hover:bg-blue-50"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Organizers Pagination */}
            <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm text-gray-600">
                Showing {(organizerPage - 1) * organizerItemsPerPage + 1} to{" "}
                {Math.min(organizerPage * organizerItemsPerPage, organizerTotalPages * organizerItemsPerPage)} of{" "}
                {organizerTotalPages * organizerItemsPerPage} organizers
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOrganizerPage((prev) => Math.max(prev - 1, 1))}
                  disabled={organizerPage === 1}
                  className="border-gray-300 hover:bg-gray-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: organizerTotalPages }, (_, i) => i + 1).map((page) => (
                    <Button
                      key={page}
                      variant={organizerPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => setOrganizerPage(page)}
                      className={
                        organizerPage === page
                          ? "bg-blue-600 hover:bg-blue-700 text-white"
                          : "border-gray-300 hover:bg-gray-50"
                      }
                    >
                      {page}
                    </Button>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOrganizerPage((prev) => Math.min(prev + 1, organizerTotalPages))}
                  disabled={organizerPage === organizerTotalPages}
                  className="border-gray-300 hover:bg-gray-50"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Withdrawal Dialog */}
        <Dialog open={withdrawDialogOpen} onOpenChange={setWithdrawDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-gray-900">Process Withdrawal</DialogTitle>
              <DialogDescription>
                Create a withdrawal request for {selectedOrganizer?.firstName} {selectedOrganizer?.lastName}
              </DialogDescription>
            </DialogHeader>
            {selectedOrganizer && (
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 mb-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Total Revenue</p>
                    <p className="font-semibold text-gray-900">{(selectedOrganizer.totalRevenue || 0).toFixed(2)} Birr</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Available Balance (97%)</p>
                    <p className="font-semibold text-green-600">{((selectedOrganizer.totalRevenue || 0) * 0.97).toFixed(2)} Birr</p>
                  </div>
                </div>
              </div>
            )}
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-gray-700">Amount (Birr)</Label>
                <Input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="border-gray-300"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-700">Payment Method</Label>
                <Select
                  value={bankDetails.bankName}
                  onValueChange={(value: PaymentMethod) => setBankDetails((prev) => ({ ...prev, bankName: value }))}
                >
                  <SelectTrigger className="border-gray-300">
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="telebirr">Telebirr</SelectItem>
                    <SelectItem value="mpesa">M-Pesa</SelectItem>
                    <SelectItem value="bank">Bank Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {bankDetails.bankName === 'telebirr' && (
                <div className="space-y-2">
                  <Label className="text-gray-700">Telebirr Phone Number</Label>
                  <Input
                    value={bankDetails.accountNumber}
                    onChange={(e) => setBankDetails((prev) => ({ ...prev, accountNumber: e.target.value }))}
                    placeholder="Enter Telebirr phone number"
                    className="border-gray-300"
                  />
                </div>
              )}

              {bankDetails.bankName === 'mpesa' && (
                <div className="space-y-2">
                  <Label className="text-gray-700">M-Pesa Phone Number</Label>
                  <Input
                    value={bankDetails.accountNumber}
                    onChange={(e) => setBankDetails((prev) => ({ ...prev, accountNumber: e.target.value }))}
                    placeholder="Enter M-Pesa phone number"
                    className="border-gray-300"
                  />
                </div>
              )}

{bankDetails.bankName === 'bank' && (
  <>
    <div className="space-y-2">
      <Label className="text-gray-700">Bank Name</Label>
      <Select
        value={bankDetails.accountName}
        onValueChange={(value) => setBankDetails((prev) => ({ ...prev, accountName: value }))}
      >
        <SelectTrigger className="border-gray-300">
          <SelectValue placeholder="Select bank" />
        </SelectTrigger>
       <SelectContent>
  <SelectItem value="Commercial Bank of Ethiopia">Commercial Bank of Ethiopia</SelectItem>
  <SelectItem value="Awash International Bank">Awash International Bank</SelectItem>
  <SelectItem value="Bank of Abyssinia">Bank of Abyssinia</SelectItem>
  <SelectItem value="Dashen Bank">Dashen Bank</SelectItem>
  <SelectItem value="Hibret Bank">Hibret Bank</SelectItem>
  <SelectItem value="Nib International Bank">Nib International Bank</SelectItem>
  <SelectItem value="Cooperative Bank of Oromia">Cooperative Bank of Oromia</SelectItem>
  <SelectItem value="Lion International Bank">Lion International Bank</SelectItem>
  <SelectItem value="Wegagen Bank">Wegagen Bank</SelectItem>
  <SelectItem value="Zemen Bank">Zemen Bank</SelectItem>
  <SelectItem value="Oromia International Bank">Oromia International Bank</SelectItem>
  <SelectItem value="Global Bank Ethiopia">Global Bank Ethiopia</SelectItem>
  <SelectItem value="Enat Bank">Enat Bank</SelectItem>
  <SelectItem value="Addis International Bank">Addis International Bank</SelectItem>
  <SelectItem value="Abay Bank">Abay Bank</SelectItem>
  <SelectItem value="Berhan International Bank">Berhan International Bank</SelectItem>
  <SelectItem value="Bunna International Bank">Bunna International Bank</SelectItem>
  <SelectItem value="ZamZam Bank">ZamZam Bank</SelectItem>
  <SelectItem value="Shabelle Bank">Shabelle Bank</SelectItem>
  <SelectItem value="Hijra Bank">Hijra Bank</SelectItem>
  <SelectItem value="Siinqee Bank">Siinqee Bank</SelectItem>
  <SelectItem value="Ahadu Bank">Ahadu Bank</SelectItem>
  <SelectItem value="Goh Betoch Bank">Goh Betoch Bank</SelectItem>
  <SelectItem value="Tsedey Bank">Tsedey Bank</SelectItem>
  <SelectItem value="Tsehay Bank">Tsehay Bank</SelectItem>
  <SelectItem value="Gadaa Bank">Gadaa Bank</SelectItem>
  <SelectItem value="Amhara Bank">Amhara Bank</SelectItem>
  <SelectItem value="Rammis Bank">Rammis Bank</SelectItem>
</SelectContent>

      </Select>
    </div>
    <div className="space-y-2">
      <Label className="text-gray-700">Bank Account Number</Label>
      <Input
        value={bankDetails.accountNumber}
        onChange={(e) => setBankDetails((prev) => ({ ...prev, accountNumber: e.target.value }))}
        placeholder="Enter account number"
        className="border-gray-300"
      />
    </div>
  </>
)}

              <div className="space-y-2">
                <Label className="text-gray-700">Notes</Label>
                <Textarea
                  value={withdrawNotes}
                  onChange={(e) => setWithdrawNotes(e.target.value)}
                  placeholder="Add any notes about this withdrawal"
                  rows={3}
                  className="border-gray-300"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setWithdrawDialogOpen(false)} className="border-gray-300">
                Cancel
              </Button>
              <Button
                onClick={handleWithdraw}
                disabled={!withdrawAmount || isSubmittingWithdraw || !bankDetails.bankName || !bankDetails.accountNumber}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {isSubmittingWithdraw ? "Processing..." : "Create Withdrawal"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Balance Dialog */}
        <Dialog open={balanceDialogOpen} onOpenChange={setBalanceDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-gray-900">
                Revenue Details for {selectedOrganizerForBalance?.firstName} {selectedOrganizerForBalance?.lastName}
              </DialogTitle>
            </DialogHeader>

            {organizerBalance && (
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <Card className="border border-gray-200 shadow-md">
                    <CardContent className="p-4">
                      <div className="text-sm font-medium text-gray-600">Total Revenue</div>
                      <div className="text-2xl font-bold text-green-600 mt-1">
                        {organizerBalance.totalRevenue.toFixed(2)} Birr
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border border-gray-200 shadow-md">
                    <CardContent className="p-4">
                      <div className="text-sm font-medium text-gray-600">Organizer Revenue (97%)</div>
                      <div className="text-2xl font-bold text-blue-600 mt-1">
                        {(organizerBalance.organizerRevenue || organizerBalance.totalRevenue * 0.97).toFixed(2)} Birr
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border border-gray-200 shadow-md">
                    <CardContent className="p-4">
                      <div className="text-sm font-medium text-gray-600">Pazimo Commission (3%)</div>
                      <div className="text-2xl font-bold text-red-600 mt-1">
                        {(organizerBalance.pazimoCommission || organizerBalance.totalRevenue * 0.03).toFixed(2)} Birr
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border border-gray-200 shadow-md">
                    <CardContent className="p-4">
                      <div className="text-sm font-medium text-gray-600">Available Balance</div>
                      <div className="text-2xl font-bold text-purple-600 mt-1">
                        {organizerBalance.availableBalance.toFixed(2)} Birr
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border border-gray-200 shadow-md">
                    <CardContent className="p-4">
                      <div className="text-sm font-medium text-gray-600">Total Tickets Sold</div>
                      <div className="text-2xl font-bold text-indigo-600 mt-1">
                        {organizerBalance.summary.totalTicketsSold}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Event Breakdown */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Event Breakdown</h3>
                  {organizerBalance.revenueBreakdown.map((event) => (
                    <Card key={event.eventId} className="border border-gray-200 shadow-md">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h4 className="font-medium text-gray-900">{event.eventTitle}</h4>
                            <p className="text-sm text-gray-600">{event.totalTicketsSold} tickets sold</p>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-green-600">{event.totalRevenue.toFixed(2)} Birr</div>
                            <div className="text-sm text-gray-600">Total Revenue</div>
                          </div>
                        </div>

                        {/* Ticket Type Breakdown */}
                        <div className="mt-4">
                          <h5 className="text-sm font-medium text-gray-700 mb-2">Ticket Type Breakdown</h5>
                          <div className="space-y-2">
                            {event.ticketTypeBreakdown.map((type) => (
                              <div key={type.name} className="flex justify-between items-center text-sm">
                                <div>
                                  <span className="font-medium text-gray-900">{type.name}</span>
                                  <span className="text-gray-600 ml-2">({type.quantitySold} sold)</span>
                                </div>
                                <div className="text-right">
                                  <div className="text-green-600 font-medium">{type.revenue.toFixed(2)} Birr</div>
                                  <div className="text-gray-600">{type.price.toFixed(2)} Birr each</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Pending Withdrawals */}
                {organizerBalance.pendingWithdrawals > 0 && (
                  <div className="mt-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                    <h3 className="text-lg font-semibold text-yellow-800">Pending Withdrawals</h3>
                    <p className="text-yellow-700">{organizerBalance.pendingWithdrawals.toFixed(2)} Birr pending</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Organizer Details Dialog */}
        <Dialog open={organizerDetailsDialogOpen} onOpenChange={setOrganizerDetailsDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-gray-900">
                Organizer Details
              </DialogTitle>
            </DialogHeader>

            {selectedOrganizer && (
              <div className="space-y-6">
                {/* Basic Information */}
                <Card className="border border-gray-200 shadow-md">
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Full Name</p>
                        <p className="text-gray-900">{selectedOrganizer.firstName} {selectedOrganizer.lastName}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">Email</p>
                        <p className="text-gray-900">{selectedOrganizer.email}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">Phone Number</p>
                        <p className="text-gray-900">{selectedOrganizer.phoneNumber || 'Not provided'}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">Joined Date</p>
                        <p className="text-gray-900">{new Date(selectedOrganizer.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Events Overview */}
                <Card className="border border-gray-200 shadow-md">
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Events Overview</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className="p-4 bg-blue-50 rounded-lg">
                        <p className="text-sm font-medium text-blue-600">Total Events</p>
                        <p className="text-2xl font-bold text-blue-700">{selectedOrganizer.events?.length || 0}</p>
                      </div>
                      <div className="p-4 bg-green-50 rounded-lg">
                        <p className="text-sm font-medium text-green-600">Active Events</p>
                        <p className="text-2xl font-bold text-green-700">
                          {selectedOrganizer.events?.filter(event => event.status === "published")?.length || 0}
                        </p>
                      </div>
                      <div className="p-4 bg-purple-50 rounded-lg">
                        <p className="text-sm font-medium text-purple-600">Total Revenue</p>
                        <p className="text-2xl font-bold text-purple-700">
                          {selectedOrganizer.events.reduce(
                            (sum, event) =>
                              sum + calculateRevenue(event.tickets || []),
                            0
                          ).toFixed(2)} Birr
                        </p>
                      </div>
                    </div>

                    {/* Events List */}
                    <div className="mt-6">
                      <h4 className="text-md font-semibold text-gray-900 mb-3">Recent Events</h4>
                      <div className="space-y-3">
                        {selectedOrganizer.events?.slice(0, 5).map((event) => (
                          <div key={event._id} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                            <div className="flex justify-between items-start">
                              <div>
                                <h5 className="font-medium text-gray-900">{event.title}</h5>
                                <p className="text-sm text-gray-600">{event.location.address}, {event.location.city}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge
                                    className={
                                      event.status === "published"
                                        ? "bg-green-100 text-green-800"
                                        : "bg-yellow-100 text-yellow-800"
                                    }
                                  >
                                    {event.status}
                                  </Badge>
                                  <span className="text-sm text-gray-600">
                                    {new Date(event.startDate).toLocaleDateString()}
                                  </span>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-medium text-gray-600">Tickets Sold</p>
                                <p className="text-lg font-bold text-blue-600">{event.tickets?.length || 0}</p>
                                <p className="text-sm text-gray-600">
                                  Revenue: {calculateRevenue(event.tickets || []).toFixed(2)} Birr
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Ticket Statistics */}
                <Card className="border border-gray-200 shadow-md">
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Ticket Statistics</h3>
                    <div className="space-y-4">
                      {selectedOrganizer.events?.map((event) => (
                        <div key={event._id} className="border-b border-gray-200 pb-4 last:border-0">
                          <h4 className="font-medium text-gray-900 mb-2">{event.title}</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {event.ticketTypes?.map((type) => (
                              <div key={type.name} className="p-3 bg-gray-50 rounded-lg">
                                <p className="text-sm font-medium text-gray-900">{type.name}</p>
                                <div className="flex justify-between items-center mt-1">
                                  <span className="text-sm text-gray-600">
                                    {type.quantity} available
                                  </span>
                                  <span className="text-sm font-medium text-green-600">
                                    {type.price.toFixed(2)} Birr
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
