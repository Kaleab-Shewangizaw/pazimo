"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Users,
  Calendar,
  DollarSign,
  Building2,
  Ticket,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  Plus,
  Clock,

} from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAdminAuthStore } from "@/store/adminAuthStore"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts"
import { ChartContainer, ChartTooltipContent, ChartTooltip } from "@/components/ui/chart"

interface Event {
  _id: string
  title: string
  startDate: string
  endDate: string
  status: string
  ticketSales: number
  revenue: number
  organizer: {
    firstName: string
    lastName: string
  }
  category: {
    _id: string
    name: string
    description: string
  }
}

interface User {
  _id: string
  firstName: string
  lastName: string
  email: string
  phoneNumber: string
  role: string
  createdAt: string
}

interface WithdrawalRequest {
  _id: string
  organizer: {
    firstName: string
    lastName: string
    email: string
  }
  amount: number
  bankAccount: string
  requestDate: string
  status: "pending" | "approved" | "rejected"
  reason?: string
}

interface DashboardStats {
  totalUsers: number
  totalEvents: number
  totalRevenue: number
  activeOrganizers: number
  activeEvents: number
  pendingWithdrawals: number
}

interface RevenueData {
  name: string
  revenue: number
}

interface EventRegistrationData {
  name: string
  count: number
}

export default function AdminDashboardPage() {
  const router = useRouter()
  const { token } = useAdminAuthStore()
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalEvents: 0,
    totalRevenue: 0,
    activeOrganizers: 0,
    activeEvents: 0,
    pendingWithdrawals: 0,
  })
  const [activeEvents, setActiveEvents] = useState<Event[]>([])
  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalRequest[]>([])
  const [revenueChartData, setRevenueChartData] = useState<RevenueData[]>([])
  const [eventRegistrationsChartData, setEventRegistrationsChartData] = useState<EventRegistrationData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Suppress browser extension errors
    const originalError = console.error
    console.error = (...args) => {
      if (args[0]?.includes?.('runtime.lastError') || args[0]?.includes?.('message channel closed')) {
        return
      }
      originalError.apply(console, args)
    }
    
    fetchDashboardData()
    const interval = setInterval(fetchWithdrawalRequests, 30000)
    return () => {
      clearInterval(interval)
      console.error = originalError
    }
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      // Fetch dashboard stats
      const statsResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/dashboard/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!statsResponse.ok) {
        const errorData = await statsResponse.json();
        throw new Error(errorData.message || 'Failed to fetch dashboard stats');
      }
      const statsData = await statsResponse.json();
      setStats(statsData.data);

      // Fetch revenue chart data
      const revenueChartResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/dashboard/charts/revenue`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!revenueChartResponse.ok) {
        const errorData = await revenueChartResponse.json();
        throw new Error(errorData.message || 'Failed to fetch revenue chart data');
      }
      const revenueChartData = await revenueChartResponse.json();
      setRevenueChartData(revenueChartData.data);

      // Fetch event registrations chart data
      const eventRegistrationsChartResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/dashboard/charts/event-registrations`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!eventRegistrationsChartResponse.ok) {
        const errorData = await eventRegistrationsChartResponse.json();
        throw new Error(errorData.message || 'Failed to fetch event registrations chart data');
      }
      const eventRegistrationsChartData = await eventRegistrationsChartResponse.json();
      setEventRegistrationsChartData(eventRegistrationsChartData.data);

      // Fetch active events
      const eventsResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/events?status=published&limit=5`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!eventsResponse.ok) {
        const errorData = await eventsResponse.json();
        throw new Error(errorData.message || 'Failed to fetch active events');
      }
      const eventsData = await eventsResponse.json();
      setActiveEvents(eventsData.data || []);

      // Fetch withdrawal requests
      const withdrawalsResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/withdrawals?status=pending&limit=5`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!withdrawalsResponse.ok) {
        const errorData = await withdrawalsResponse.json();
        throw new Error(errorData.message || 'Failed to fetch withdrawal requests');
      }
      const withdrawalsData = await withdrawalsResponse.json();
      setWithdrawalRequests(withdrawalsData.data || []);
    } catch (error: any) {
      // console.error('Error fetching dashboard data:', error);
      toast.error(error.message || 'Failed to fetch dashboard data');
    } finally {
      setLoading(false)
    }
  }

  const fetchWithdrawalRequests = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/withdrawals?status=pending&limit=5`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch withdrawal requests");
      }

      const data = await response.json();
      if (data.success) {
        setWithdrawalRequests(data.withdrawals);
      }
    } catch (error) {
      // console.error("Error fetching withdrawal requests:", error);
      toast.error("Failed to fetch withdrawal requests");
    }
  };

  const handleWithdrawalAction = async (requestId: string, action: "approve" | "reject") => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/withdrawals/${requestId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: action === "approve" ? "approved" : "rejected",
          notes: `Withdrawal request ${action}d by admin`
        })
      })

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to ${action} withdrawal request`);
      }

      // Update local state
      setWithdrawalRequests((prev) => prev.filter((req) => req._id !== requestId))
      setStats((prev) => ({ ...prev, pendingWithdrawals: prev.pendingWithdrawals - 1 }))

      toast.success(`Withdrawal request ${action}d successfully`)
    } catch (error: any) {
      // console.error(`Error ${action}ing withdrawal:`, error)
      toast.error(error.message || `Failed to ${action} withdrawal request`)
    }
  }

  const statsCards = [
  {
    title: "Total Users",
      value: stats.totalUsers,
    icon: Users,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      borderColor: "border-l-blue-600",
  
     
  },
  {
    title: "Total Events",
      value: stats.totalEvents,
    icon: Calendar,
      iconBg: "bg-indigo-100",
      iconColor: "text-indigo-600",
      borderColor: "border-l-indigo-600",
   
     
  },
  {
    title: "Total Revenue",
      value: `${stats.totalRevenue.toFixed(2)} Birr`,
    icon: DollarSign,
    iconBg: "bg-green-100",
    iconColor: "text-green-600",  
      borderColor: "border-l-green-600",
     
     
    },
    {
      title: "Organizer Revenue (97%)",
      value: `${(stats.totalRevenue * 0.97).toFixed(2)} Birr`,
      icon: DollarSign,
      iconBg: "bg-purple-100",
      iconColor: "text-purple-600",
      borderColor: "border-l-purple-600",
     
      trendUp: true,
    },
    {
      title: "Pazimo Commission (3%)",
      value: `${(stats.totalRevenue * 0.03).toFixed(2)} Birr`,
      icon: DollarSign,
      iconBg: "bg-red-100",
      iconColor: "text-red-600",
      borderColor: "border-l-red-600",
      
    
    },
    {
      title: "Active Events",
      value: stats.activeEvents,
      icon: Ticket,
    iconBg: "bg-orange-100",
    iconColor: "text-orange-600",
      borderColor: "border-l-orange-600",
     
   
    },
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-200 border-t-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          
          <Button onClick={fetchDashboardData} className="bg-blue-600 hover:bg-blue-700 text-white">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh Data
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          {statsCards.map((stat, index) => (
            <Card
              key={index}
              className={`border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300 border-l-4 ${stat.borderColor}`}
            >
              <CardContent className="p-2">
                <div className="flex flex-col">
                  <p className="text-xs font-medium text-gray-600 mb-1">{stat.title}</p>
                  <p className="text-lg font-bold text-gray-900 mb-2">{stat.value}</p>
                  <div className="flex items-center gap-1">
                    {stat.trendUp ? (
                      <ArrowUpRight className="h-3 w-3 text-green-600" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3 text-red-600" />
                    )}
                   
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card className="border border-gray-200 shadow-lg hover:shadow-xl">
            <CardHeader>
              <CardTitle>Revenue Over Time</CardTitle>
              <CardDescription>Monthly revenue from ticket sales.</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={{}} className="min-h-[200px] w-full">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={revenueChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip content={<ChartTooltipContent />} />
                    <Legend />
                    <Line type="monotone" dataKey="revenue" stroke="#8884d8" activeDot={{ r: 8 }} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
          <Card className="border border-gray-200 shadow-lg hover:shadow-xl">
            <CardHeader>
              <CardTitle>Event Registrations</CardTitle>
              <CardDescription>Monthly new event creations.</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={{}} className="min-h-[200px] w-full">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={eventRegistrationsChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip content={<ChartTooltipContent />} />
                    <Legend />
                    <Bar dataKey="count" fill="#82ca9d" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Active Events */}
          <Card className="border border-gray-200 shadow-lg hover:shadow-xl lg:col-span-2 border-t-4 border-t-blue-600">
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Calendar className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Active Events</h3>
                    <p className="text-gray-600 text-sm">Currently published events</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push("/admin/events")}
                  className="border-blue-300 text-blue-600 hover:bg-blue-50"
                >
                  <Eye className="mr-2 h-4 w-4" />
                  View All
                </Button>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-200">
                      <TableHead className="font-semibold text-gray-700">Event</TableHead>
                      <TableHead className="font-semibold text-gray-700">Organizer</TableHead>
                      <TableHead className="font-semibold text-gray-700">Date</TableHead>
                      <TableHead className="font-semibold text-gray-700">Category</TableHead>
                      <TableHead className="font-semibold text-gray-700">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeEvents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-gray-500 py-12">
                          <Calendar className="h-8 w-8 text-blue-400 mx-auto mb-3" />
                          <p className="font-medium">No active events</p>
                          <p className="text-sm">Published events will appear here</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      activeEvents.map((event) => (
                        <TableRow
                          key={event._id}
                          className="cursor-pointer hover:bg-blue-50 transition-colors border-gray-100"
                          onClick={() => router.push(`/admin/events/${event._id}`)}
                        >
                          <TableCell className="font-medium text-gray-900">{event.title}</TableCell>
                          <TableCell className="text-gray-600">
                            {event.organizer?.firstName} {event.organizer?.lastName}
                          </TableCell>
                          <TableCell className="text-gray-600">
                            {new Date(event.startDate).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize border-blue-300 text-blue-700 bg-blue-50">
                              {event.category?.name || 'Uncategorized'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={event.status === "published" ? "default" : "secondary"}
                              className={
                                event.status === "published"
                                  ? "bg-green-100 text-green-800 border-green-200"
                                  : "bg-gray-100 text-gray-800 border-gray-200"
                              }
                            >
                              {event.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card className="border border-gray-200 shadow-lg hover:shadow-xl border-t-4 border-t-green-600">
            <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Plus className="h-5 w-5 text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
                </div>
                <div className="space-y-3">
                  <Button
                    className="w-full justify-start bg-green-600 hover:bg-green-700 text-white shadow-md hover:shadow-lg transition-all duration-200"
                    onClick={() => router.push("/admin/events")}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    All Events
                  </Button>
                  <Button
                    className="w-full justify-start border-blue-300 text-blue-600 hover:bg-blue-50"
                    variant="outline"
                    onClick={() => router.push("/admin/organizers")}
                  >
                    <Building2 className="mr-2 h-4 w-4" />
                    Manage Organizers
                  </Button>
                  <Button
                    className="w-full justify-start border-green-300 text-green-600 hover:bg-green-50"
                    variant="outline"
                    onClick={() => router.push("/admin/withdrawals")}
                  >
                    <DollarSign className="mr-2 h-4 w-4" />
                    Process Withdrawals
                  </Button>
                  <Button
                    className="w-full justify-start border-purple-300 text-purple-600 hover:bg-purple-50"
                    variant="outline"
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
                        } else {
                          toast.error(data.message || 'Failed to update ticket availability')
                        }
                      } catch (error) {
                        toast.error('Failed to update ticket availability')
                      }
                    }}
                  >
                    <Clock className="mr-2 h-4 w-4" />
                    Update Ticket Status
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* System Status */}
            <Card className="border border-gray-200 shadow-lg hover:shadow-xl border-t-4 border-t-orange-600">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <AlertCircle className="h-5 w-5 text-orange-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">System Status</h3>
                </div>
                <div className="space-y-4">
                  {stats.pendingWithdrawals > 0 && (
                    <div className="flex items-start gap-3 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                      <div className="p-1 bg-yellow-100 rounded">
                        <AlertCircle className="h-4 w-4 text-yellow-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-yellow-800">Pending Withdrawals</p>
                        <p className="text-xs text-yellow-700 mt-1">
                          {stats.pendingWithdrawals} requests require attention
                        </p>
                        <Button
                          size="sm"
                          className="mt-2 bg-yellow-600 hover:bg-yellow-700 text-white"
                          onClick={() => router.push("/admin/withdrawals")}
                        >
                          Review
                        </Button>
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="p-1 bg-green-100 rounded">
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-green-800">Active Events</p>
                      <p className="text-xs text-green-600 mt-1">{stats.activeEvents} events currently running</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
