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

// Sample data - in a real app, this would come from an API
const bannerData = {
  id: 1,
  title: "Summer Sale",
  image: "/banners/summer-sale.jpg",
  position: "Homepage Top",
  startDate: "2024-03-01",
  endDate: "2024-03-31",
  priority: "High",
  clicks: 1250,
  impressions: 5000,
  isPublished: true
}

export default function EditBannerPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // In a real app, you would make an API call here to update the banner
      // console.log("Updating banner:", params.id)
      toast.success("Banner updated successfully")
      router.push("/admin/banners")
    } catch (error) {
      // console.error("Error updating banner:", error)
      toast.error("Failed to update banner")
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
        <h1 className="text-3xl font-bold text-gray-800">Edit Banner</h1>
        <p className="text-gray-600 mt-1">Update banner details and settings</p>
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
                  defaultValue={bannerData.title}
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="image">Banner Image</Label>
                <div className="flex items-center gap-4">
                  <div className="w-32 h-20 bg-gray-100 rounded overflow-hidden">
                    <img 
                      src={bannerData.image} 
                      alt={bannerData.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <Input
                    id="image"
                    type="file"
                    accept="image/*"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="position">Position</Label>
                <Select defaultValue={bannerData.position} required>
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
                    defaultValue={bannerData.startDate}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    defaultValue={bannerData.endDate}
                    required
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="priority">Priority</Label>
                <Select defaultValue={bannerData.priority} required>
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

              <div className="grid gap-2">
                <Label>Performance Metrics</Label>
                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <div className="text-sm text-gray-500">Clicks</div>
                    <div className="text-lg font-medium">{bannerData.clicks}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Impressions</div>
                    <div className="text-lg font-medium">{bannerData.impressions}</div>
                  </div>
                </div>
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
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
} 