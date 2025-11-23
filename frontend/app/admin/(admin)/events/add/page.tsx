"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAdminAuthStore } from "@/store/adminAuthStore"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { ArrowLeft } from "lucide-react"

interface Category {
  _id: string;
  name: string;
  description: string;
  isPublished: boolean;
}

export default function AddEventPage() {
  const router = useRouter()
  const { token } = useAdminAuthStore()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoadingCategories, setIsLoadingCategories] = useState(true)

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    startDate: "",
    endDate: "",
    location: {
      address: "",
      city: "",
      country: ""
    },
    category: "",
    ticketTypes: [
      {
        name: "Regular",
        price: "",
        quantity: "",
        description: ""
      }
    ],
    capacity: "",
    tags: "",
    coverImage: null as File | null
  })

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    try {
      setIsLoadingCategories(true)
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/categories`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch categories')
      }

      const data = await response.json()
      setCategories(data.data)
    } catch (error) {
      // console.error('Error fetching categories:', error)
      toast.error('Failed to fetch categories')
    } finally {
      setIsLoadingCategories(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    if (name.startsWith('location.')) {
      const locationField = name.split('.')[1]
      setFormData(prev => ({
        ...prev,
        location: {
          ...prev.location,
          [locationField]: value
        }
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }))
    }
  }

  const handleTicketTypeChange = (index: number, field: string, value: string) => {
    const newTicketTypes = [...formData.ticketTypes]
    newTicketTypes[index] = {
      ...newTicketTypes[index],
      [field]: value
    }
    setFormData(prev => ({
      ...prev,
      ticketTypes: newTicketTypes
    }))
  }

  const addTicketType = () => {
    setFormData(prev => ({
      ...prev,
      ticketTypes: [
        ...prev.ticketTypes,
        {
          name: "",
          price: "",
          quantity: "",
          description: ""
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

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFormData(prev => ({
        ...prev,
        coverImage: e.target.files![0]
      }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const formDataToSend = new FormData()
      
      // Append basic event data
      formDataToSend.append('title', formData.title)
      formDataToSend.append('description', formData.description)
      formDataToSend.append('category', formData.category)
      formDataToSend.append('startDate', formData.startDate)
      formDataToSend.append('endDate', formData.endDate)
      formDataToSend.append('capacity', formData.capacity)
      formDataToSend.append('tags', formData.tags)
      
      // Append location data
      formDataToSend.append('location[address]', formData.location.address)
      formDataToSend.append('location[city]', formData.location.city)
      formDataToSend.append('location[country]', formData.location.country)
      
      // Append ticket types
      formData.ticketTypes.forEach((ticket, index) => {
        formDataToSend.append(`ticketTypes[${index}][name]`, ticket.name)
        formDataToSend.append(`ticketTypes[${index}][price]`, ticket.price)
        formDataToSend.append(`ticketTypes[${index}][quantity]`, ticket.quantity)
        formDataToSend.append(`ticketTypes[${index}][description]`, ticket.description)
      })
      
      // Append cover image if selected
      if (formData.coverImage) {
        formDataToSend.append('coverImage', formData.coverImage)
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/events`, {
        method: 'POST',
        body: formDataToSend,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to create event')
      }

      toast.success('Event created successfully')
      router.push('/admin/events')
    } catch (error) {
      // console.error('Error creating event:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create event')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <Button
          variant="ghost"
          className="mb-4"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Events
        </Button>
        <h1 className="text-3xl font-bold text-gray-800">Add New Event</h1>
        <p className="text-gray-600 mt-1">Create a new event in the system</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Event Title</Label>
                <Input
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="Enter event title"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Enter event description"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    name="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    name="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="location.address">Address</Label>
                  <Input
                    id="location.address"
                    name="location.address"
                    value={formData.location.address}
                    onChange={handleInputChange}
                    placeholder="Enter event address"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="location.city">City</Label>
                    <Input
                      id="location.city"
                      name="location.city"
                      value={formData.location.city}
                      onChange={handleInputChange}
                      placeholder="Enter city"
                      required
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="location.country">Country</Label>
                    <Input
                      id="location.country"
                      name="location.country"
                      value={formData.location.country}
                      onChange={handleInputChange}
                      placeholder="Enter country"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-2">
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
                      <SelectItem key={category._id} value={category.name.toLowerCase()}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="capacity">Event Capacity</Label>
                <Input
                  id="capacity"
                  name="capacity"
                  type="number"
                  min="0"
                  value={formData.capacity}
                  onChange={handleInputChange}
                  placeholder="Enter event capacity"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="tags">Tags (comma-separated)</Label>
                <Input
                  id="tags"
                  name="tags"
                  value={formData.tags}
                  onChange={handleInputChange}
                  placeholder="Enter tags (e.g., music, sports, conference)"
                />
              </div>
            </CardContent>
          </Card>

          {/* Ticket Types */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Ticket Types</CardTitle>
              <Button
                type="button"
                variant="outline"
                onClick={addTicketType}
              >
                Add Ticket Type
              </Button>
            </CardHeader>
            <CardContent className="grid gap-6">
              {formData.ticketTypes.map((ticketType, index) => (
                <div key={index} className="grid gap-4 p-4 border rounded-lg">
                  <div className="flex justify-between items-center">
                    <h3 className="font-medium">Ticket Type {index + 1}</h3>
                    {index > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => removeTicketType(index)}
                      >
                        Remove
                      </Button>
                    )}
                  </div>

                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor={`ticket-name-${index}`}>Name</Label>
                      <Input
                        id={`ticket-name-${index}`}
                        value={ticketType.name}
                        onChange={(e) => handleTicketTypeChange(index, 'name', e.target.value)}
                        placeholder="e.g., Regular, VIP, Early Bird"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor={`ticket-price-${index}`}>Price</Label>
                        <Input
                          id={`ticket-price-${index}`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={ticketType.price}
                          onChange={(e) => handleTicketTypeChange(index, 'price', e.target.value)}
                          placeholder="Enter price"
                          required
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor={`ticket-quantity-${index}`}>Quantity Available</Label>
                        <Input
                          id={`ticket-quantity-${index}`}
                          type="number"
                          min="0"
                          value={ticketType.quantity}
                          onChange={(e) => handleTicketTypeChange(index, 'quantity', e.target.value)}
                          placeholder="Enter quantity"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor={`ticket-description-${index}`}>Description</Label>
                      <Textarea
                        id={`ticket-description-${index}`}
                        value={ticketType.description}
                        onChange={(e) => handleTicketTypeChange(index, 'description', e.target.value)}
                        placeholder="Enter ticket type description"
                        required
                      />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Event Image */}
          <Card>
            <CardHeader>
              <CardTitle>Event Image</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2">
                <Label htmlFor="coverImage">Cover Image</Label>
                <Input
                  id="coverImage"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  required
                />
                <p className="text-sm text-gray-500">
                  Upload a cover image for your event (recommended size: 1200x600 pixels)
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating Event...' : 'Create Event'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
} 