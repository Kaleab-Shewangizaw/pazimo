"use client"

// This is a placeholder for your actual component
// Replace with your actual implementation
import { useEffect, useState } from "react"
import UpcomingEventsSkeleton from "./upcoming-events-skeleton"

export default function UpcomingEvents() {
  const [loading, setLoading] = useState(true)

  // Simulate loading delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false)
    }, 2000)

    return () => clearTimeout(timer)
  }, [])

  if (loading) {
    return <UpcomingEventsSkeleton />
  }

  return (
    <div className="px-4 sm:px-8 md:px-16 py-6">
      <div className="space-y-4">
        {Array(3)
          .fill(0)
          .map((_, index) => (
            <div key={index} className="flex flex-col sm:flex-row gap-4 border rounded-lg p-4">
              <div className="w-full sm:w-48 h-32 bg-gray-300 rounded-md relative">
                <div className="absolute bottom-2 left-2 bg-white text-[#1a2d5a] text-xs px-2 py-1 rounded font-semibold">
                  {index === 0 ? "TODAY" : index === 1 ? "TOMORROW" : "JUN 18"}
                </div>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Tech Conference {2023 + index}</h3>
                <p className="text-sm text-gray-500">Convention Center • 9:00 AM</p>
                <div className="flex gap-2 mt-2">
                  <div className="h-8 w-8 rounded-full bg-[#f0f4f9] flex items-center justify-center text-xs">AI</div>
                  <div className="h-8 w-8 rounded-full bg-[#f0f4f9] flex items-center justify-center text-xs">ML</div>
                  <div className="h-8 w-8 rounded-full bg-[#f0f4f9] flex items-center justify-center text-xs">Web3</div>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <p className="text-sm text-gray-500">Starting at $99</p>
                  <button  className="bg-[#1a2d5a] text-white px-3 py-2 rounded text-sm">Get Tickets</button>
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}
