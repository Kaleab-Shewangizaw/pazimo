"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { ArrowLeft } from "lucide-react"
import { toast } from "sonner"

interface Category {
  _id: string;
  name: string;
  description: string;
  image?: string;
  isPublished: boolean;
}

export default function EditCategoryPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [category, setCategory] = useState<Category | null>(null)
  const [isPublished, setIsPublished] = useState(false)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  useEffect(() => {
    fetchCategory()
  }, [params.id])

  const fetchCategory = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/categories/${params.id}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch category')
      }

      const data = await response.json()
      setCategory(data.data.category)
      setIsPublished(Boolean(data.data.category?.isPublished))
      setImagePreview(data.data.category?.image ? `${process.env.NEXT_PUBLIC_API_URL}${data.data.category.image}` : null)
    } catch (error) {
      console.error('Error fetching category:', error)
      toast.error('Failed to fetch category')
    } finally {
      setIsLoading(false)
    }
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]

    if (!file) {
      return
    }

    setSelectedImage(file)
    const reader = new FileReader()
    reader.onload = () => setImagePreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)

    const source = new FormData(e.currentTarget)
    const formData = new FormData()
    formData.append('name', (source.get('name') as string) || '')
    formData.append('description', (source.get('description') as string) || '')
    formData.append('isPublished', isPublished.toString())

    if (selectedImage) {
      formData.append('image', selectedImage)
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/categories/${params.id}`, {
        method: 'PATCH',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Failed to update category')
      }

      toast.success('Category updated successfully')
      router.push('/admin/events/categories')
    } catch (error) {
      console.error('Error updating category:', error)
      toast.error('Failed to update category')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading category...</p>
        </div>
      </div>
    )
  }

  if (!category) {
    return (
      <div className="p-6">
        <Button
          variant="ghost"
          className="mb-4"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Categories
        </Button>
        <div className="text-center">
          <p className="text-red-500">Category not found</p>
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
          className="mb-4"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Categories
        </Button>
        <h1 className="text-3xl font-bold text-gray-800">Edit Category</h1>
        <p className="text-gray-600 mt-1">Update category details</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Category Details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6">
              <div className="grid gap-2">
                <Label htmlFor="name">Category Name</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={category.name}
                  placeholder="Enter category name"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  defaultValue={category.description}
                  placeholder="Enter category description"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="image">Category Image</Label>
                <Input
                  id="image"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                />
                {imagePreview && (
                  <div className="mt-2">
                    <img src={imagePreview} alt="Category preview" className="w-32 h-32 object-cover rounded-lg" />
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="isPublished"
                  checked={isPublished}
                  onCheckedChange={setIsPublished}
                />
                <Label htmlFor="isPublished">
                  {isPublished ? "Published" : "Draft"}
                </Label>
              </div>
            </CardContent>
          </Card>

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