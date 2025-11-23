"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, User, Mail, Phone, Users, Loader2 } from "lucide-react"
import { toast } from "sonner"

// Sample data - in a real app, this would come from an API
const allUsers = [
  { id: 1, name: "John Doe", email: "john@example.com", phoneNumber: "+1234567890", contactPerson: "Jane Smith", date: "2 hours ago", status: "Active", role: "User" },
  { id: 2, name: "Jane Smith", email: "jane@example.com", phoneNumber: "+1987654321", contactPerson: "John Doe", date: "5 hours ago", status: "Active", role: "Admin" },
  { id: 3, name: "Robert Johnson", email: "robert@example.com", phoneNumber: "+1122334455", contactPerson: "Mary Johnson", date: "1 day ago", status: "Inactive", role: "User" },
]

export default function EditUserPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phoneNumber: "",
    contactPerson: "",
    role: "User",
    status: "Active"
  })
  const [errors, setErrors] = useState({
    name: "",
    email: "",
    phoneNumber: "",
    contactPerson: ""
  })

  useEffect(() => {
    // In a real app, you would fetch the user data from an API
    const user = allUsers.find(u => u.id === parseInt(params.id))
    if (user) {
      setFormData({
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        contactPerson: user.contactPerson,
        role: user.role,
        status: user.status
      })
    } else {
      toast.error("User not found")
      router.push("/admin/users")
    }
    setIsLoading(false)
  }, [params.id, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Reset errors
    setErrors({ name: "", email: "", phoneNumber: "", contactPerson: "" })
    
    // Validate form
    let isValid = true
    const newErrors = { name: "", email: "", phoneNumber: "", contactPerson: "" }

    if (!formData.name.trim()) {
      newErrors.name = "Name is required"
      isValid = false
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required"
      isValid = false
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Invalid email format"
      isValid = false
    }

    if (!formData.phoneNumber.trim()) {
      newErrors.phoneNumber = "Phone number is required"
      isValid = false
    } else if (!/^\+?[\d\s-]{10,}$/.test(formData.phoneNumber)) {
      newErrors.phoneNumber = "Invalid phone number format"
      isValid = false
    }

    if (!formData.contactPerson.trim()) {
      newErrors.contactPerson = "Contact person is required"
      isValid = false
    }

    if (!isValid) {
      setErrors(newErrors)
      return
    }

    setIsSubmitting(true)
    try {
      // In a real app, you would make an API call here to update the user
      await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate API call
      toast.success("User updated successfully")
      router.push("/admin/users")
    } catch (error) {
      toast.error("Failed to update user")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-8">
        <Button
          variant="ghost"
          className="hover:bg-gray-100"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Users
        </Button>
        <h1 className="text-2xl font-bold">Edit User</h1>
        <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-bold mb-4">User Details</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-gray-700 font-medium mb-2">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span>Full Name</span>
                    </div>
                  </label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className={`w-full h-12 ${errors.name ? "border-red-500" : ""}`}
                    placeholder="Enter user's full name"
                    disabled={isSubmitting}
                  />
                  {errors.name && (
                    <p className="text-sm text-red-500 mt-1">{errors.name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-2">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      <span>Email Address</span>
                    </div>
                  </label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={`w-full h-12 ${errors.email ? "border-red-500" : ""}`}
                    placeholder="Enter user's email address"
                    disabled={isSubmitting}
                  />
                  {errors.email && (
                    <p className="text-sm text-red-500 mt-1">{errors.email}</p>
                  )}
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-2">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      <span>Phone Number</span>
                    </div>
                  </label>
                  <Input
                    type="tel"
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    className={`w-full h-12 ${errors.phoneNumber ? "border-red-500" : ""}`}
                    placeholder="Enter phone number (e.g., +1234567890)"
                    disabled={isSubmitting}
                  />
                  {errors.phoneNumber && (
                    <p className="text-sm text-red-500 mt-1">{errors.phoneNumber}</p>
                  )}
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-2">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <span>Contact Person</span>
                    </div>
                  </label>
                  <Input
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                    className={`w-full h-12 ${errors.contactPerson ? "border-red-500" : ""}`}
                    placeholder="Enter contact person's name"
                    disabled={isSubmitting}
                  />
                  {errors.contactPerson && (
                    <p className="text-sm text-red-500 mt-1">{errors.contactPerson}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-bold mb-4">Role & Status</h2>

              <div className="flex gap-4 mb-6">
                <div className="flex-1">
                  <label className="block text-gray-700 font-medium mb-2">Role</label>
                  <Select
                    value={formData.role}
                    onValueChange={(value) => setFormData({ ...formData, role: value })}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="User">User</SelectItem>
                      <SelectItem value="Admin">Admin</SelectItem>
                      <SelectItem value="Organizer">Organizer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex-1">
                  <label className="block text-gray-700 font-medium mb-2">Status</label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                      <SelectItem value="Pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="border-t pt-6">
                <Button 
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update User"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
} 