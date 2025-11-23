"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useEventStore } from '@/store/eventStore'
import { useAuthStore } from '@/store/authStore'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Calendar, MapPin, Users, Clock, Tag } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface Category {
  _id: string;
  name: string;
  description: string;
  isPublished: boolean;
}

interface Event {
  _id: string;
  title: string;
  description: string;
  category: Category | string;
  startDate: string;
  endDate: string;
  location: {
    address: string;
    city: string;
    country: string;
  };
  capacity: number;
  ticketTypes: Array<{
    name: string;
    price: number;
    quantity: number;
    description: string;
  }>;
  tags: string[];
  status: string;
  coverImages: string[];
}

export default function EventDetailsPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { currentEvent, fetchEvent, updateEvent, deleteEvent, publishEvent, isLoading } = useEventStore()
  const { isAuthenticated, token } = useAuthStore()
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    startDate: '',
    endDate: '',
    location: {
      address: '',
      city: '',
      country: '',
      coordinates: [0, 0]
    },
    capacity: 0,
    tags: '',
    ticketTypes: [
      {
        name: '',
        price: 0,
        quantity: 0,
        description: '',
        available: true
      }
    ]
  })
  const [coverImage, setCoverImage] = useState<File | null>(null)
  const [event, setEvent] = useState<Event | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoadingCategories, setIsLoadingCategories] = useState(true)

  useEffect(() => {
    if (!isAuthenticated || !token) {
      toast.error('Please login to view event details')
      router.push('/sign-in')
      return
    }
    fetchEvent(params.id)
    fetchCategories()
  }, [fetchEvent, params.id, isAuthenticated, token, router])

  const fetchCategories = async () => {
    try {
      setIsLoadingCategories(true)
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/categories`)

      if (!response.ok) {
        throw new Error("Failed to fetch categories")
      }

      const data = await response.json()
      // Only show published categories
      setCategories(data.data.filter((cat: Category) => cat.isPublished))
    } catch (error) {
      console.error("Error fetching categories:", error)
      toast.error("Failed to fetch categories")
    } finally {
      setIsLoadingCategories(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAuthenticated || !token) {
      toast.error('Please login to update event')
      router.push('/sign-in')
      return
    }

    try {
      const data = new FormData()
      
      // Append basic event data
      data.append('title', formData.title)
      data.append('description', formData.description)
      data.append('category', formData.category)
      data.append('startDate', formData.startDate)
      data.append('endDate', formData.endDate)
      data.append('capacity', formData.capacity.toString())
      data.append('tags', formData.tags)
      
      // Append location data
      data.append('location[address]', formData.location.address)
      data.append('location[city]', formData.location.city)
      data.append('location[country]', formData.location.country)
      data.append('location[coordinates][0]', formData.location.coordinates[0].toString())
      data.append('location[coordinates][1]', formData.location.coordinates[1].toString())
      
      // Append ticket types
      formData.ticketTypes.forEach((ticket, index) => {
        data.append(`ticketTypes[${index}][name]`, ticket.name)
        data.append(`ticketTypes[${index}][price]`, ticket.price.toString())
        data.append(`ticketTypes[${index}][quantity]`, ticket.quantity.toString())
        data.append(`ticketTypes[${index}][description]`, ticket.description)
        data.append(`ticketTypes[${index}][available]`, ticket.available.toString())
      })
      
      // Append cover image if selected
      if (coverImage) {
        data.append('coverImage', coverImage)
      }

      await updateEvent(params.id, data)
      setIsEditing(false)
      toast.success('Event updated successfully')
    } catch (error) {
      toast.error('Failed to update event')
    }
  }

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this event?')) {
      try {
        await deleteEvent(params.id)
        router.push('/organizer/events')
      } catch (error) {
        toast.error('Failed to delete event')
      }
    }
  }

  const handlePublish = async () => {
    try {
      await publishEvent(params.id)
      toast.success('Event published successfully')
    } catch (error) {
      toast.error('Failed to publish event')
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleLocationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      location: {
        ...prev.location,
        [name]: value
      }
    }))
  }

  const handleTicketTypeChange = (index: number, field: string, value: string | number | boolean) => {
    setFormData(prev => ({
      ...prev,
      ticketTypes: prev.ticketTypes.map((ticket, i) => 
        i === index ? { ...ticket, [field]: value } : ticket
      )
    }))
  }

  const addTicketType = () => {
    setFormData(prev => ({
      ...prev,
      ticketTypes: [
        ...prev.ticketTypes,
        {
          name: '',
          price: 0,
          quantity: 0,
          description: '',
          available: true
        }
      ]
    }))
  }

  const removeTicketType = (index: number) => {
    setFormData(prev => ({
      ...prev,
      ticketTypes: prev.ticketTypes.filter((_, i) => i !== index)
    }))
  }

  if (!isAuthenticated || !token) {
    return null
  }

  if (isLoading) {
    return <div>Loading...</div>
  }

  if (!currentEvent) {
    return <div>Event not found</div>
  }

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Event Details</CardTitle>
          <div className="space-x-2">
            {currentEvent.status === 'draft' && (
              <Button onClick={handlePublish}>
                Publish Event
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setIsEditing(!isEditing)}
            >
              {isEditing ? 'Cancel Edit' : 'Edit Event'}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
            >
              Delete Event
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Event Title</Label>
                    <Input
                      id="title"
                      name="title"
                      value={formData.title}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                      disabled={isLoadingCategories}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={isLoadingCategories ? "Loading categories..." : "Select category"} />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category._id} value={category._id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>

              {/* Date and Time */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Date and Time</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Start Date and Time</Label>
                    <Input
                      id="startDate"
                      name="startDate"
                      type="datetime-local"
                      value={formData.startDate}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">End Date and Time</Label>
                    <Input
                      id="endDate"
                      name="endDate"
                      type="datetime-local"
                      value={formData.endDate}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Location */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Location</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="address">Address</Label>
                    <Input
                      id="address"
                      name="address"
                      value={formData.location.address}
                      onChange={handleLocationChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      name="city"
                      value={formData.location.city}
                      onChange={handleLocationChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      name="country"
                      value={formData.location.country}
                      onChange={handleLocationChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="capacity">Capacity</Label>
                    <Input
                      id="capacity"
                      name="capacity"
                      type="number"
                      value={formData.capacity}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Ticket Types */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">Ticket Types</h3>
                  <Button type="button" variant="outline" onClick={addTicketType}>
                    Add Ticket Type
                  </Button>
                </div>
                {formData.ticketTypes.map((ticket, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg">
                    <div className="space-y-2">
                      <Label htmlFor={`ticket-name-${index}`}>Name</Label>
                      <Input
                        id={`ticket-name-${index}`}
                        value={ticket.name}
                        onChange={(e) => handleTicketTypeChange(index, 'name', e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`ticket-price-${index}`}>Price</Label>
                      <Input
                        id={`ticket-price-${index}`}
                        type="number"
                        value={ticket.price}
                        onChange={(e) => handleTicketTypeChange(index, 'price', parseFloat(e.target.value))}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`ticket-quantity-${index}`}>Quantity</Label>
                      <Input
                        id={`ticket-quantity-${index}`}
                        type="number"
                        value={ticket.quantity}
                        onChange={(e) => handleTicketTypeChange(index, 'quantity', parseInt(e.target.value))}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`ticket-description-${index}`}>Description</Label>
                      <Input
                        id={`ticket-description-${index}`}
                        value={ticket.description}
                        onChange={(e) => handleTicketTypeChange(index, 'description', e.target.value)}
                        required
                      />
                    </div>
                    {index > 0 && (
                      <div className="col-span-2">
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={() => removeTicketType(index)}
                        >
                          Remove Ticket Type
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Cover Image */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Cover Image</h3>
                <div className="space-y-2">
                  <Label htmlFor="coverImage">Upload Cover Image</Label>
                  <Input
                    id="coverImage"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setCoverImage(e.target.files?.[0] || null)}
                  />
                </div>
              </div>

              {/* Tags */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Tags</h3>
                <div className="space-y-2">
                  <Label htmlFor="tags">Tags (comma-separated)</Label>
                  <Input
                    id="tags"
                    name="tags"
                    value={formData.tags}
                    onChange={handleInputChange}
                    placeholder="e.g., music, concert, live"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  Save Changes
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              <div className="relative">
                <img 
                  src={currentEvent.coverImage} 
                  alt={currentEvent.title}
                  className="w-full h-64 object-cover rounded-lg"
                />
                <Badge 
                  className={`absolute top-4 right-4 ${
                    currentEvent.status === 'published' ? 'bg-green-500' :
                    currentEvent.status === 'draft' ? 'bg-gray-500' :
                    'bg-red-500'
                  }`}
                >
                  {currentEvent.status}
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h2 className="text-2xl font-bold">{currentEvent.title}</h2>
                    <p className="text-gray-600 mt-2">{currentEvent.description}</p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center text-gray-600">
                      <Calendar className="h-4 w-4 mr-2" />
                      <span>{new Date(currentEvent.startDate).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center text-gray-600">
                      <Clock className="h-4 w-4 mr-2" />
                      <span>{new Date(currentEvent.startDate).toLocaleTimeString()}</span>
                    </div>
                    <div className="flex items-center text-gray-600">
                      <MapPin className="h-4 w-4 mr-2" />
                      <span>{currentEvent.location.address}, {currentEvent.location.city}</span>
                    </div>
                    <div className="flex items-center text-gray-600">
                      <Users className="h-4 w-4 mr-2" />
                      <span>{currentEvent.capacity} capacity</span>
                    </div>
                    <div className="flex items-center text-gray-600">
                      <Tag className="h-4 w-4 mr-2" />
                      <div className="flex flex-wrap gap-2">
                        {currentEvent.tags.map((tag, index) => (
                          <Badge key={index} variant="secondary">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Ticket Types</h3>
                  <div className="space-y-4">
                    {currentEvent.ticketTypes.map((ticket, index) => (
                      <Card key={index}>
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-medium">{ticket.name}</h4>
                              <p className="text-gray-600">{ticket.description}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold">${ticket.price}</p>
                              <p className="text-sm text-gray-600">{ticket.quantity} available</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
} 