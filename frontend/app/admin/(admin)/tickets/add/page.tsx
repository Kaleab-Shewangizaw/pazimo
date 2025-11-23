"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft } from "lucide-react"
import { toast } from "sonner"

// Sample data - in a real app, this would come from an API
const events = [
  { id: 1, title: "Tech Conference 2024", organizer: "Tech Events Inc" },
  { id: 2, title: "Summer Music Festival", organizer: "Music Promotions" },
  { id: 3, title: "Business Workshop", organizer: "Business Solutions" },
  { id: 4, title: "Art Exhibition", organizer: "Art Gallery" },
  { id: 5, title: "Sports Tournament", organizer: "Sports Events" }
]

const ticketTypes = [
  "VIP Pass",
  "General Admission",
  "Early Bird",
  "Student Pass",
  "Season Pass",
  "Group Pass",
  "Premium Access"
]

export default function AddTicketPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // In a real app, you would make an API call here to create the ticket
      // console.log("Creating new ticket...")
      toast.success("Ticket created successfully")
      router.push("/admin/tickets")
    } catch (error) {
      console.error("Error creating ticket:", error)
      toast.error("Failed to create ticket")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <Button
          variant="ghost"
          className="mb-4"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Tickets
        </Button>
        <h1 className="text-3xl font-bold text-gray-800">Add New Ticket</h1>
        <p className="text-gray-600 mt-1">Create a new ticket for an event</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6">
          {/* Event Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Event Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6">
              <div className="grid gap-2">
                <Label htmlFor="event">Select Event</Label>
                <Select required>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an event" />
                  </SelectTrigger>
                  <SelectContent>
                    {events.map((event) => (
                      <SelectItem key={event.id} value={event.id.toString()}>
                        {event.title} - {event.organizer}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Ticket Details */}
          <Card>
            <CardHeader>
              <CardTitle>Ticket Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6">
              <div className="grid gap-2">
                <Label htmlFor="ticketType">Ticket Type</Label>
                <Select required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select ticket type" />
                  </SelectTrigger>
                  <SelectContent>
                    {ticketTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Enter ticket description and benefits"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="price">Price ($)</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="quantity">Quantity Available</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    placeholder="Enter quantity"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="startDate">Sale Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="endDate">Sale End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    required
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="terms">Terms & Conditions</Label>
                <Textarea
                  id="terms"
                  placeholder="Enter ticket terms and conditions"
                  required
                />
              </div>
            </CardContent>
          </Card>

          {/* Additional Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Additional Settings</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6">
              <div className="grid gap-2">
                <Label htmlFor="maxPerPerson">Maximum Tickets Per Person</Label>
                <Input
                  id="maxPerPerson"
                  type="number"
                  min="1"
                  placeholder="Enter maximum tickets per person"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="refundPolicy">Refund Policy</Label>
                <Select required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select refund policy" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="refundable">Refundable</SelectItem>
                    <SelectItem value="non-refundable">Non-refundable</SelectItem>
                    <SelectItem value="partial-refund">Partial Refund</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-end">
            <Button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creating..." : "Create Ticket"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
} 