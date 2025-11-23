"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Image, Search, Plus, Pencil, Trash2, Calendar, Clock, MapPin, Users } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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

interface Event {
  id: number
  title: string
  description: string
  date: string
  time: string
  location: string
  venue: string
  image: string
  price: string
  rating: number
  attendees: number
  categories: string[]
}

export default function EventsPage() {
  const router = useRouter()
  const [events, setEvents] = useState<Event[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("All")
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [eventToDelete, setEventToDelete] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // In a real app, this would be an API call
    const fetchEvents = async () => {
      try {
        // Simulating API call with sample data
        const sampleEvents: Event[] = [
          {
            id: 1,
            title: "Addis International Film Festival",
            description: "Experience the best of international and local cinema at Ethiopia's premier film festival featuring award-winning films, director Q&As, and special screenings.",
            date: "June 5-12, 2025",
            time: "Various times",
            location: "Addis Ababa",
            venue: "Multiple venues across the city",
            image: "/events/thelab.png",
            price: "From 500 ETB",
            rating: 4.8,
            attendees: 5000,
            categories: ["Film", "Arts", "Culture"],
          },
          {
            id: 2,
            title: "Ethiopian Coffee & Cultural Festival",
            description: "Celebrate Ethiopia's rich coffee heritage with tastings, traditional ceremonies, music performances, and cultural exhibitions from across the country.",
            date: "July 8-10, 2025",
            time: "10:00 AM - 8:00 PM",
            location: "Addis Ababa",
            venue: "Millennium Hall",
            image: "/events/eventimg.png",
            price: "From 300 ETB",
            rating: 4.7,
            attendees: 8000,
            categories: ["Culture", "Food", "Music"],
          },
          {
            id: 3,
            title: "Tech Innovation Summit Africa",
            description: "Join tech leaders, entrepreneurs, and investors from across Africa for keynotes, workshops, and networking focused on the continent's digital transformation.",
            date: "August 15-17, 2025",
            time: "9:00 AM - 6:00 PM",
            location: "Addis Ababa",
            venue: "Skylight Hotel Convention Center",
            image: "/events/thelab.png",
            price: "From 1500 ETB",
            rating: 4.9,
            attendees: 3000,
            categories: ["Technology", "Business", "Innovation"],
          },
        ]
        setEvents(sampleEvents)
      } catch (error) {
        toast.error('Failed to load events')
        console.error('Error fetching events:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchEvents()
  }, [])

  const filteredEvents = events.filter(event => {
    const matchesSearch = event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         event.venue.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = categoryFilter === "All" || event.categories.includes(categoryFilter)
    return matchesSearch && matchesCategory
  })

  const handleDelete = (eventId: number) => {
    setEventToDelete(eventId)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    // In a real app, you would make an API call here to delete the event
            // console.log("Deleting event:", eventToDelete)
    setEvents(events.filter(event => event.id !== eventToDelete))
    setDeleteDialogOpen(false)
    setEventToDelete(null)
    toast.success('Event deleted successfully')
  }

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Manage Events</h1>
        <p className="text-gray-600 mt-1">Create and manage events across the platform</p>
      </div>

      {/* Filters and Search */}
      <Card className="border-none shadow-sm mb-6">
        <div className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative flex-1 md:flex-none">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-full md:w-[300px] border-gray-200"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px] border-gray-200">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Categories</SelectItem>
                <SelectItem value="Film">Film</SelectItem>
                <SelectItem value="Arts">Arts</SelectItem>
                <SelectItem value="Culture">Culture</SelectItem>
                <SelectItem value="Food">Food</SelectItem>
                <SelectItem value="Music">Music</SelectItem>
                <SelectItem value="Technology">Technology</SelectItem>
                <SelectItem value="Business">Business</SelectItem>
                <SelectItem value="Innovation">Innovation</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button 
            className="bg-blue-600 hover:bg-blue-700"
            onClick={() => router.push("/admin/events/add")}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add New Event
          </Button>
        </div>
      </Card>

      {/* Events Table */}
      <Card className="border-none shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/80">
                <TableHead className="font-semibold">Event</TableHead>
                <TableHead className="font-semibold">Details</TableHead>
                <TableHead className="font-semibold">Location</TableHead>
                <TableHead className="font-semibold">Categories</TableHead>
                <TableHead className="font-semibold">Performance</TableHead>
                <TableHead className="font-semibold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEvents.map((event) => (
                <TableRow key={event.id} className="hover:bg-gray-50/50 transition-colors">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-20 rounded-md bg-gray-100 flex items-center justify-center overflow-hidden">
                        <Image className="h-4 w-4 text-gray-500" />
                      </div>
                      <div>
                        <span className="font-medium text-gray-900">{event.title}</span>
                        <div className="text-sm text-gray-500">{event.price}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-gray-600 space-y-1">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>{event.date}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span>{event.time}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-gray-600 space-y-1">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        <span>{event.venue}</span>
                      </div>
                      <div className="text-sm text-gray-500">{event.location}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {event.categories.map((category, index) => (
                        <Badge
                          key={index}
                          variant="outline"
                          className="bg-blue-50 text-blue-700 border-blue-200"
                        >
                          {category}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-gray-600">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        <span>{event.attendees.toLocaleString()}+ attending</span>
                      </div>
                      <div className="text-sm text-gray-500">Rating: {event.rating.toFixed(1)}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-blue-600 hover:text-blue-700"
                        onClick={() => router.push(`/admin/events/${event.id}/edit`)}
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-red-600 hover:text-red-700" 
                        onClick={() => handleDelete(event.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the event
              and remove it from all pages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
} 