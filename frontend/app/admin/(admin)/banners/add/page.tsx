"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft } from "lucide-react"
import { toast } from "sonner"

export default function AddBannerPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // In a real app, you would make an API call here to create the banner
      // console.log("Creating new banner...")
      toast.success("Banner created successfully")
      router.push("/admin/banners")
    } catch (error) {
      // console.error("Error creating banner:", error)
      toast.error("Failed to create banner")
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
          Back to Banners
        </Button>
        <h1 className="text-3xl font-bold text-gray-800">Add New Banner</h1>
        <p className="text-gray-600 mt-1">Create a new promotional banner</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6">
          {/* Banner Details */}
          <Card>
            <CardHeader>
              <CardTitle>Banner Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6">
              <div className="grid gap-2">
                <Label htmlFor="title">Banner Title</Label>
                <Input
                  id="title"
                  placeholder="Enter banner title"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="image">Banner Image</Label>
                <Input
                  id="image"
                  type="file"
                  accept="image/*"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="position">Position</Label>
                <Select required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select banner position" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Homepage Top">Homepage Top</SelectItem>
                    <SelectItem value="Homepage Middle">Homepage Middle</SelectItem>
                    <SelectItem value="Homepage Bottom">Homepage Bottom</SelectItem>
                    <SelectItem value="Category Page">Category Page</SelectItem>
                    <SelectItem value="Sidebar">Sidebar</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    required
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="priority">Priority</Label>
                <Select required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="Low">Low</SelectItem>
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
              {isSubmitting ? "Creating..." : "Create Banner"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
} 