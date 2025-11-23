"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useAdminAuthStore } from "@/store/adminAuthStore"
import { toast } from "sonner"
import { ArrowLeft, Calendar, Clock, MapPin, User, Ticket, CreditCard } from "lucide-react"

interface TicketDetails {
  _id: string
  ticketId: string
  event: {
    _id: string
    title: string
    startDate: string
    endDate: string
    location: {
      address: string
      city: string
      country: string
    }
    organizer: {
      _id: string
      name: string
      email: string
    }
    category: {
      _id: string
      name: string
      description: string
    }
    coverImage: string
  }
  user: {
    _id: string
    firstName: string
    lastName: string
    email: string
  }
  ticketType: string
  price: number
  purchaseDate: string
  status: 'active' | 'used' | 'cancelled' | 'expired'
  qrCode: string
  checkedIn: boolean
  checkedInAt: string | null
  seatNumber: string | null
  createdAt: string
  updatedAt: string
}

export default function TicketDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { token } = useAdminAuthStore()
  const [ticket, setTicket] = useState<TicketDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const resolvedParams = use(params)

  useEffect(() => {
    const fetchTicketDetails = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/tickets/${resolvedParams.id}`, {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.message || 'Failed to fetch ticket details')
        }

        const data = await response.json()
        if (!data.ticket) {
          throw new Error('No ticket data received')
        }

        // Validate required fields
        if (!data.ticket.event || !data.ticket.user) {
          throw new Error('Invalid ticket data: missing required fields')
        }

        setTicket(data.ticket)
      } catch (error) {
        console.error('Error fetching ticket details:', error)
        toast.error(error instanceof Error ? error.message : 'Failed to fetch ticket details')
        router.push('/admin/tickets') // Redirect to tickets list on error
      } finally {
        setLoading(false)
      }
    }

    fetchTicketDetails()
  }, [resolvedParams.id, token, router])

  if (loading) {
    return (
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Ticket Details</h1>
          <p className="text-gray-600 mt-1">Loading ticket details...</p>
        </div>
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Ticket Details</h1>
          <p className="text-gray-600 mt-1">Ticket not found</p>
        </div>
      </div>
    )
  }

  // Ensure all required data is present before rendering
  if (!ticket.event || !ticket.user) {
    return (
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Ticket Details</h1>
          <p className="text-gray-600 mt-1">Invalid ticket data</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Tickets
        </Button>
        <h1 className="text-3xl font-bold text-gray-800">Ticket Details</h1>
        <p className="text-gray-600 mt-1">View detailed information about this ticket</p>
      </div>

      <div className="grid gap-6">
        {/* Event Information */}
        <Card>
          <CardHeader>
            <CardTitle>Event Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg">{ticket.event.title}</h3>
                <div className="mt-2 space-y-2">
                  <div className="flex items-center text-gray-600">
                    <Calendar className="h-4 w-4 mr-2" />
                    <span>{new Date(ticket.event.startDate).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center text-gray-600">
                    <Clock className="h-4 w-4 mr-2" />
                    <span>{new Date(ticket.event.startDate).toLocaleTimeString()}</span>
                  </div>
                  <div className="flex items-center text-gray-600">
                    <MapPin className="h-4 w-4 mr-2" />
                    <span>{ticket.event.location.address}, {ticket.event.location.city}, {ticket.event.location.country}</span>
                  </div>
                  <div className="flex items-center text-gray-600">
                    <User className="h-4 w-4 mr-2" />
                    <span>Organizer: {ticket.event.organizer.name}</span>
                  </div>
                  <div className="flex items-center text-gray-600">
                    <Ticket className="h-4 w-4 mr-2" />
                    <span>Category: {ticket.event.category?.name || 'Uncategorized'}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ticket Information */}
        <Card>
          <CardHeader>
            <CardTitle>Ticket Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Ticket ID</p>
                  <p className="font-medium">{ticket.ticketId}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Ticket Type</p>
                  <p className="font-medium">{ticket.ticketType}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Price</p>
                  <p className="font-medium">{ticket.price.toFixed(2)} birr</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
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
                </div>
                <div>
                  <p className="text-sm text-gray-500">Purchase Date</p>
                  <p className="font-medium">{new Date(ticket.purchaseDate).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Check-in Status</p>
                  <p className="font-medium">
                    {ticket.checkedIn ? (
                      <span className="text-green-600">Checked in at {new Date(ticket.checkedInAt!).toLocaleString()}</span>
                    ) : (
                      <span className="text-gray-600">Not checked in</span>
                    )}
                  </p>
                </div>
                {ticket.seatNumber && (
                  <div>
                    <p className="text-sm text-gray-500">Seat Number</p>
                    <p className="font-medium">{ticket.seatNumber}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-500">Created At</p>
                  <p className="font-medium">{new Date(ticket.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Last Updated</p>
                  <p className="font-medium">{new Date(ticket.updatedAt).toLocaleString()}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Attendee Information */}
        <Card>
          <CardHeader>
            <CardTitle>Attendee Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Name</p>
                  <p className="font-medium">{ticket.user.firstName} {ticket.user.lastName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-medium">{ticket.user.email}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* QR Code */}
        {ticket.qrCode && (
          <Card>
            <CardHeader>
              <CardTitle>Ticket QR Code</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center">
                <img src={ticket.qrCode} alt="Ticket QR Code" className="w-48 h-48" />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
} 