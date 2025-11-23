"use client"
import type React from "react"
import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { useAdminAuthStore } from "@/store/adminAuthStore"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { ArrowLeft, Loader2, Plus, Trash2, Info, Upload, X } from "lucide-react"
import { Switch } from "@/components/ui/switch"

interface Category {
  _id: string
  name: string
  description: string
  isPublished: boolean
}

export default function AdminEditEventPage() {
  const router = useRouter()
  const params = useParams()
  const eventId = params.id as string
  const { token } = useAdminAuthStore()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [categories, setCategories] = useState<Category[]>([])
  const [coverImage, setCoverImage] = useState<File | null>(null)
  const [currentCoverImage, setCurrentCoverImage] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    startDate: "",
    endDate: "",
    startTime: "",
    endTime: "",
    location: {
      address: "",
      city: "",
      country: "",
      coordinates: [] as number[],
    },
    category: "",
    ageRestriction: {
      minAge: "",
      maxAge: "",
      hasRestriction: false,
    },
    ticketTypes: [
      {
        name: "Regular",
        price: "",
        quantity: "",
        description: "",
        available: true,
      },
    ],
    capacity: "",
    tags: "",
  })

  useEffect(() => {
    fetchCategories()
    fetchEventData()
  }, [eventId])

  const fetchEventData = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/events/details/${eventId}`)
      if (!response.ok) throw new Error("Failed to fetch event")
      
      const data = await response.json()
      const event = data.data
      
      setFormData({
        title: event.title || "",
        description: event.description || "",
        startDate: event.startDate ? new Date(event.startDate).toISOString().split('T')[0] : "",
        endDate: event.endDate ? new Date(event.endDate).toISOString().split('T')[0] : "",
        startTime: event.startTime || "",
        endTime: event.endTime || "",
        location: {
          address: event.location?.address || "",
          city: event.location?.city || "",
          country: event.location?.country || "",
          coordinates: event.location?.coordinates || [] as number[],
        },
        category: event.category?._id || "",
        ageRestriction: {
          minAge: event.ageRestriction?.minAge?.toString() || "",
          maxAge: event.ageRestriction?.maxAge?.toString() || "",
          hasRestriction: event.ageRestriction?.hasRestriction || false,
        },
        ticketTypes: event.ticketTypes?.length > 0 ? event.ticketTypes.map((ticket: any) => ({
          name: ticket.name || "Regular",
          price: ticket.price?.toString() || "",
          quantity: ticket.quantity?.toString() || "",
          description: ticket.description || "",
          available: ticket.available !== undefined ? ticket.available : true,
        })) : [{
          name: "Regular",
          price: "",
          quantity: "",
          description: "",
          available: true,
        }],
        capacity: event.capacity?.toString() || "",
        tags: event.tags?.join(", ") || "",
      })
      setCurrentCoverImage(event.coverImage ? `${process.env.NEXT_PUBLIC_API_URL}/uploads/${event.coverImage}` : null)
    } catch (error) {
      console.error("Error fetching event:", error)
      toast.error("Failed to load event data")
      router.push("/admin/events")
    } finally {
      setIsLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/categories`)
      if (!response.ok) throw new Error("Failed to fetch categories")
      
      const data = await response.json()
      const publishedCategories = data.data.filter((cat: Category) => cat.isPublished)
      setCategories(publishedCategories)
    } catch (error) {
      console.error("Error fetching categories:", error)
      toast.error("Failed to fetch categories")
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    if (name.startsWith("location.")) {
      const locationField = name.split(".")[1]
      setFormData((prev) => ({
        ...prev,
        location: {
          ...prev.location,
          [locationField]: value,
        },
      }))
    } else if (name.startsWith("ageRestriction.")) {
      const ageField = name.split(".")[1]
      setFormData((prev) => ({
        ...prev,
        ageRestriction: {
          ...prev.ageRestriction,
          [ageField]: value,
        },
      }))
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }))
    }
  }

  const handleTicketTypeChange = (index: number, field: string, value: string | boolean) => {
    const newTicketTypes = [...formData.ticketTypes]
    newTicketTypes[index] = {
      ...newTicketTypes[index],
      [field]: value,
    }
    setFormData((prev) => ({
      ...prev,
      ticketTypes: newTicketTypes,
    }))
  }

  const addTicketType = () => {
    setFormData((prev) => ({
      ...prev,
      ticketTypes: [
        ...prev.ticketTypes,
        {
          name: "Regular",
          price: "",
          quantity: "",
          description: "",
          available: true,
        },
      ],
    }))
  }

  const removeTicketType = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      ticketTypes: prev.ticketTypes.filter((_, i) => i !== index),
    }))
  }

  const validateTicketTypes = (): boolean => {
    if (formData.ticketTypes.length === 0) {
      toast.error("Please add at least one ticket type")
      return false
    }

    for (const ticket of formData.ticketTypes) {
      if (!ticket.name || !ticket.price || !ticket.quantity) {
        toast.error("Please fill in all ticket type fields")
        return false
      }
      if (parseFloat(ticket.price) <= 0) {
        toast.error("Ticket price must be greater than 0")
        return false
      }
      if (parseInt(ticket.quantity) <= 0) {
        toast.error("Ticket quantity must be greater than 0")
        return false
      }
    }
    return true
  }

  const handleCoverImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setCoverImage(file)
    }
  }

  const removeCoverImage = () => {
    setCoverImage(null)
    setCurrentCoverImage(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      if (!formData.category) {
        toast.error("Please select a category")
        return
      }

      if (!formData.startDate || !formData.endDate || !formData.startTime || !formData.endTime) {
        toast.error("Please fill in all event date and time fields")
        return
      }

      if (!validateTicketTypes()) {
        return
      }

      const updateData = {
        title: formData.title,
        description: formData.description,
        startDate: formData.startDate,
        endDate: formData.endDate,
        startTime: formData.startTime,
        endTime: formData.endTime,
        location: formData.location,
        category: formData.category,
        capacity: parseInt(formData.capacity),
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean),
        ageRestriction: formData.ageRestriction.hasRestriction ? {
          hasRestriction: true,
          minAge: formData.ageRestriction.minAge ? parseInt(formData.ageRestriction.minAge) : undefined,
          maxAge: formData.ageRestriction.maxAge ? parseInt(formData.ageRestriction.maxAge) : undefined,
        } : { hasRestriction: false },
        ticketTypes: formData.ticketTypes.map(ticket => ({
          name: ticket.name,
          price: parseFloat(ticket.price),
          quantity: parseInt(ticket.quantity),
          description: ticket.description,
          available: ticket.available,
        })),
      }

      let response
      
      if (coverImage) {
        const formDataToSend = new FormData()
        
        // Append all fields as expected by backend
        formDataToSend.append('title', formData.title)
        formDataToSend.append('description', formData.description)
        formDataToSend.append('startDate', formData.startDate)
        formDataToSend.append('endDate', formData.endDate)
        formDataToSend.append('startTime', formData.startTime)
        formDataToSend.append('endTime', formData.endTime)
        formDataToSend.append('category', formData.category)
        formDataToSend.append('capacity', formData.capacity)
        formDataToSend.append('tags', formData.tags)
        
        // Append location as JSON string
        formDataToSend.append('location', JSON.stringify(formData.location))
        
        // Append age restriction as JSON string
        formDataToSend.append('ageRestriction', JSON.stringify(updateData.ageRestriction))
        
        // Append ticket types as JSON string
        formDataToSend.append('ticketTypes', JSON.stringify(updateData.ticketTypes))
        
        // Append the cover image file
        formDataToSend.append('coverImage', coverImage)
        
        response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/events/${eventId}`, {
          method: "PATCH",
          headers: {
            "Authorization": `Bearer ${token}`,
          },
          body: formDataToSend,
        })
      } else {
        response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/events/${eventId}`, {
          method: "PATCH",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updateData),
        })
      }

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Failed to update event")
      }

      toast.success("Event updated successfully")
      router.push("/admin/events")
    } catch (error) {
      console.error("Error updating event:", error)
      toast.error(error instanceof Error ? error.message : "Failed to update event")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading event data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <Button variant="ghost" className="mb-4" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Events
        </Button>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Edit Event (Admin)</h1>
        <p className="text-sm sm:text-base text-gray-600 mt-1">Update event information as administrator</p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Event Information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6">
            <div className="grid gap-2">
              <Label htmlFor="title">Event Title</Label>
              <Input
                id="title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
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
                  min={formData.startDate}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="startTime">Start Time</Label>
                <Input
                  id="startTime"
                  name="startTime"
                  type="time"
                  value={formData.startTime}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="endTime">End Time</Label>
                <Input
                  id="endTime"
                  name="endTime"
                  type="time"
                  value={formData.endTime}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>

            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="location.address">Venue</Label>
                <Input
                  id="location.address"
                  name="location.address"
                  value={formData.location.address}
                  onChange={handleInputChange}
                  placeholder="Enter event venue"
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
                    required
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, category: value }))}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
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

            <div className="grid gap-2">
              <Label htmlFor="capacity">Event Capacity</Label>
              <Input
                id="capacity"
                name="capacity"
                type="number"
                min="0"
                value={formData.capacity}
                onChange={handleInputChange}
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
                placeholder="e.g., music, sports, conference"
              />
            </div>

            {/* Cover Image */}
            <div className="grid gap-4">
              <Label>Cover Image</Label>
              {(currentCoverImage || coverImage) && (
                <div className="relative w-full max-w-md">
                  <img
                    src={coverImage ? URL.createObjectURL(coverImage) : currentCoverImage!}
                    alt="Cover preview"
                    className="w-full h-48 object-cover rounded-lg border"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={removeCoverImage}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <div className="flex items-center gap-4">
                <Input
                  id="coverImage"
                  type="file"
                  accept="image/*"
                  onChange={handleCoverImageChange}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('coverImage')?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {currentCoverImage || coverImage ? 'Change Cover Image' : 'Upload Cover Image'}
                </Button>
              </div>
            </div>

            {/* Age Restriction */}
            <div className="grid gap-4 p-4 border rounded-lg bg-gray-50">
              <div className="flex items-center space-x-2">
                <Switch
                  id="age-restriction-toggle"
                  checked={formData.ageRestriction.hasRestriction}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({
                      ...prev,
                      ageRestriction: {
                        ...prev.ageRestriction,
                        hasRestriction: checked,
                      },
                    }))
                  }
                />
                <Label htmlFor="age-restriction-toggle" className="cursor-pointer">
                  <div className="flex items-center gap-1">
                    <Info className="h-4 w-4 text-gray-500" />
                    <span>Enable age restriction</span>
                  </div>
                </Label>
              </div>
              {formData.ageRestriction.hasRestriction && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="ageRestriction.minAge">Minimum Age</Label>
                    <Input
                      id="ageRestriction.minAge"
                      name="ageRestriction.minAge"
                      type="number"
                      min="0"
                      max="120"
                      value={formData.ageRestriction.minAge}
                      onChange={handleInputChange}
                      placeholder="Enter minimum age"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="ageRestriction.maxAge">Maximum Age</Label>
                    <Input
                      id="ageRestriction.maxAge"
                      name="ageRestriction.maxAge"
                      type="number"
                      min="0"
                      max="120"
                      value={formData.ageRestriction.maxAge}
                      onChange={handleInputChange}
                      placeholder="Enter maximum age"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Ticket Types */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label>Ticket Types</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addTicketType}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Ticket Type
                </Button>
              </div>
              {formData.ticketTypes.map((ticket, index) => (
                <Card key={index} className="p-4">
                  <div className="flex justify-between items-start mb-4">
                    <h4 className="font-medium">Ticket Type {index + 1}</h4>
                    {formData.ticketTypes.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeTicketType(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label>Name</Label>
                      <Input
                        value={ticket.name}
                        onChange={(e) => handleTicketTypeChange(index, "name", e.target.value)}
                        placeholder="Ticket name"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Price</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={ticket.price}
                          onChange={(e) => handleTicketTypeChange(index, "price", e.target.value)}
                          placeholder="0.00"
                          required
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Quantity</Label>
                        <Input
                          type="number"
                          min="0"
                          value={ticket.quantity}
                          onChange={(e) => handleTicketTypeChange(index, "quantity", e.target.value)}
                          placeholder="0"
                          required
                        />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label>Description</Label>
                      <Input
                        value={ticket.description || ""}
                        onChange={(e) => handleTicketTypeChange(index, "description", e.target.value)}
                        placeholder="Ticket description (optional)"
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id={`available-${index}`}
                        checked={ticket.available}
                        onCheckedChange={(checked) => handleTicketTypeChange(index, "available", checked)}
                      />
                      <Label htmlFor={`available-${index}`}>Available for sale</Label>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <div className="flex justify-end gap-4">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Updating..." : "Update Event"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}