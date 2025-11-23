'use client';

import { useAuthStore } from "@/store/authStore"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

interface Ticket {
  id: string;
  name: string;
  price: number;
  available: number;
}

interface Event {
  id: string;
  title: string;
  date: string;
  location: string;
  tickets: Ticket[];
}

export default function BuyTickets({ params }: { params: { eventId: string } }) {
  const { user } = useAuthStore()
  const router = useRouter()
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedTickets, setSelectedTickets] = useState<{ [key: string]: number }>({})

  useEffect(() => {
    if (!user) {
      router.push('/sign-in')
      return
    }

    // Fetch event details
    const fetchEvent = async () => {
      try {
        const response = await fetch(`http://localhost:3000/api/events/${params.eventId}`)
        if (!response.ok) throw new Error('Failed to fetch event')
        const data = await response.json()
        setEvent(data)
      } catch (error) {
        toast.error('Failed to load event details')
        console.error(error)
      } finally {
        setLoading(false)
      }
    }

    fetchEvent()
  }, [params.eventId, user, router])

  const handleTicketQuantityChange = (ticketId: string, quantity: number) => {
    setSelectedTickets(prev => ({
      ...prev,
      [ticketId]: Math.max(0, Math.min(quantity, event?.tickets.find(t => t.id === ticketId)?.available || 0))
    }))
  }

  const calculateTotal = () => {
    return Object.entries(selectedTickets).reduce((total, [ticketId, quantity]) => {
      const ticket = event?.tickets.find(t => t.id === ticketId)
      return total + (ticket?.price || 0) * quantity
    }, 0)
  }

  const handlePurchase = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/tickets/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventId: params.eventId,
          tickets: Object.entries(selectedTickets).map(([ticketId, quantity]) => ({
            ticketId,
            quantity
          }))
        }),
      })

      if (!response.ok) throw new Error('Failed to purchase tickets')

      toast.success('Tickets purchased successfully!')
      router.push('/my-tickets')
    } catch (error) {
      toast.error('Failed to purchase tickets')
      console.error(error)
    }
  }

  if (loading) {
    return <div className="container mx-auto px-4 py-8">Loading...</div>
  }

  if (!event) {
    return <div className="container mx-auto px-4 py-8">Event not found</div>
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">{event.title}</h1>
        
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-sm text-gray-500">Date</p>
              <p className="font-medium">{new Date(event.date).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Location</p>
              <p className="font-medium">{event.location}</p>
            </div>
          </div>

          <h2 className="text-xl font-semibold mb-4">Available Tickets</h2>
          <div className="space-y-4">
            {event.tickets.map((ticket) => (
              <div key={ticket.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <h3 className="font-medium">{ticket.name}</h3>
                    <p className="text-sm text-gray-500">${ticket.price} per ticket</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTicketQuantityChange(ticket.id, (selectedTickets[ticket.id] || 0) - 1)}
                    >
                      -
                    </Button>
                    <Input
                      type="number"
                      min="0"
                      max={ticket.available}
                      value={selectedTickets[ticket.id] || 0}
                      onChange={(e) => handleTicketQuantityChange(ticket.id, parseInt(e.target.value) || 0)}
                      className="w-20 text-center"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTicketQuantityChange(ticket.id, (selectedTickets[ticket.id] || 0) + 1)}
                    >
                      +
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-gray-500">
                  {ticket.available} tickets remaining
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">Order Summary</h2>
            <p className="text-2xl font-bold">${calculateTotal()}</p>
          </div>

          <Button
            className="w-full"
            onClick={handlePurchase}
            disabled={Object.values(selectedTickets).every(qty => qty === 0)}
          >
            Purchase Tickets
          </Button>
        </div>
      </div>
    </div>
  )
} 