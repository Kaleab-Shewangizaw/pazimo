"use client"

// This is a placeholder for your actual component
// Replace with your actual implementation
import { useEffect, useState } from "react"
import CategoryIconsSkeleton from "./category-icons-skeleton"

export default function CategoryIcons() {
  const [loading, setLoading] = useState(true)

  // Simulate loading delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false)
    }, 1200)

    return () => clearTimeout(timer)
  }, [])

  if (loading) {
    return <CategoryIconsSkeleton />
  }

  const categories = [
    { name: "Music", icon: "🎵" },
    { name: "Sports", icon: "⚽" },
    { name: "Arts", icon: "🎨" },
    { name: "Food", icon: "🍔" },
    { name: "Tech", icon: "💻" },
    { name: "Comedy", icon: "😂" },
  ]

  return (
    <div className="px-4 sm:px-8 md:px-16 py-4">
      <div className="flex justify-between overflow-x-auto pb-2 gap-4">
        {categories.map((category, index) => (
          <div key={index} className="flex flex-col items-center space-y-2 min-w-[80px]">
            <div className="h-16 w-16 rounded-full bg-[#f0f4f9] flex items-center justify-center text-2xl">
              {category.icon}
            </div>
            <span className="text-sm">{category.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
