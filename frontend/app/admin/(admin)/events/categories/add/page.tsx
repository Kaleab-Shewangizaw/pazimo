// "use client"

// import { useState } from "react"
// import { useRouter } from "next/navigation"
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
// import { Button } from "@/components/ui/button"
// import { Input } from "@/components/ui/input"
// import { Label } from "@/components/ui/label"
// import { Textarea } from "@/components/ui/textarea"
// import { Switch } from "@/components/ui/switch"
// import { ArrowLeft } from "lucide-react"
// import { toast } from "sonner"

// export default function AddCategoryPage() {
//   const router = useRouter()
//   const [isSubmitting, setIsSubmitting] = useState(false)
//   const [isPublished, setIsPublished] = useState(false)

//   const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
//     e.preventDefault()
//     setIsSubmitting(true)

//     const formData = new FormData(e.currentTarget)
//     const newCategory = {
//       name: formData.get('name'),
//       description: formData.get('description'),
//       isPublished
//     }

//     try {
//       const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/categories`, {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify(newCategory),
//       })

//       if (!response.ok) {
//         throw new Error('Failed to create category')
//       }

//       toast.success('Category created successfully')
//       router.push('/admin/events/categories')
//     } catch (error) {
//       console.error('Error creating category:', error)
//       toast.error('Failed to create category')
//     } finally {
//       setIsSubmitting(false)
//     }
//   }

//   return (
//     <div className="p-6">
//       {/* Header */}
//       <div className="mb-8">
//         <Button
//           variant="ghost"
//           className="mb-4"
//           onClick={() => router.back()}
//         >
//           <ArrowLeft className="h-4 w-4 mr-2" />
//           Back to Categories
//         </Button>
//         <h1 className="text-3xl font-bold text-gray-800">Add New Category</h1>
//         <p className="text-gray-600 mt-1">Create a new event category</p>
//       </div>

//       <form onSubmit={handleSubmit}>
//         <div className="grid gap-6">
//           {/* Category Details */}
//           <Card>
//             <CardHeader>
//               <CardTitle>Category Details</CardTitle>
//             </CardHeader>
//             <CardContent className="grid gap-6">
//               <div className="grid gap-2">
//                 <Label htmlFor="name">Category Name</Label>
//                 <Input
//                   id="name"
//                   name="name"
//                   placeholder="Enter category name"
//                   required
//                 />
//               </div>

//               <div className="grid gap-2">
//                 <Label htmlFor="description">Description</Label>
//                 <Textarea
//                   id="description"
//                   name="description"
//                   placeholder="Enter category description"
//                   required
//                 />
//               </div>

//               <div className="flex items-center space-x-2">
//                 <Switch
//                   id="isPublished"
//                   checked={isPublished}
//                   onCheckedChange={setIsPublished}
//                 />
//                 <Label htmlFor="isPublished">
//                   {isPublished ? "Published" : "Draft"}
//                 </Label>
//               </div>
//             </CardContent>
//           </Card>

//           {/* Submit Button */}
//           <div className="flex justify-end">
//             <Button
//               type="submit"
//               className="bg-blue-600 hover:bg-blue-700"
//               disabled={isSubmitting}
//             >
//               {isSubmitting ? "Creating..." : "Create Category"}
//             </Button>
//           </div>
//         </div>
//       </form>
//     </div>
//   )
// } 

"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { ArrowLeft, Upload } from "lucide-react"
import { toast } from "sonner"

export default function AddCategoryPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPublished, setIsPublished] = useState(false)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedImage(file)
      const reader = new FileReader()
      reader.onload = () => setImagePreview(reader.result as string)
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)

    const formData = new FormData(e.currentTarget)
    formData.append('isPublished', isPublished.toString())
    
    if (selectedImage) {
      formData.append('image', selectedImage)
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/categories`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Failed to create category')
      }

      toast.success('Category created successfully')
      router.push('/admin/events/categories')
    } catch (error) {
      console.error('Error creating category:', error)
      toast.error('Failed to create category')
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
          Back to Categories
        </Button>
        <h1 className="text-3xl font-bold text-gray-800">Add New Category</h1>
        <p className="text-gray-600 mt-1">Create a new event category</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6">
          {/* Category Details */}
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
                  placeholder="Enter category name"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Enter category description"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="image">Category Image</Label>
                <div className="flex items-center gap-4">
                  <Input
                    id="image"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" onClick={() => document.getElementById('image')?.click()}>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload
                  </Button>
                </div>
                {imagePreview && (
                  <div className="mt-2">
                    <img src={imagePreview} alt="Preview" className="w-32 h-32 object-cover rounded-lg" />
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

          {/* Submit Button */}
          <div className="flex justify-end">
            <Button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creating..." : "Create Category"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
