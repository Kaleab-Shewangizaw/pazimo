// "use client"

// import { useEffect, useState } from "react"
// import Image from "next/image"
// import { Button } from "@/components/ui/button"
// import { Card, CardContent } from "@/components/ui/card"
// import { Input } from "@/components/ui/input"
// import { Search, Heart, Calendar, MapPin, Ticket, Loader2 } from "lucide-react"
// import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
// import { toast } from "sonner"
// import Link from "next/link"

// type Event = {
//   _id: string
//   title: string
//   description: string
//   startDate: string
//   endDate: string
//   location: {
//     address: string
//     city: string
//     country: string
//   }
//   category: string | { name: string }
//   coverImages?: string[]
//   coverImage?: string
//   ticketTypes: Array<{
//     name: string
//     price: number
//     quantity: number
//   }>
//   status: string
//   organizer?: {
//     name: string
//     email: string
//   }
// }

// export default function WishlistPage() {
//   const [searchQuery, setSearchQuery] = useState("")
//   const [wishlistItems, setWishlistItems] = useState<Event[]>([])
//   const [isLoading, setIsLoading] = useState(true)
//   const [isRemoving, setIsRemoving] = useState<Record<string, boolean>>({})

//   useEffect(() => {
//     fetchWishlistItems()
//   }, [])

//   const fetchWishlistItems = async () => {
//     try {
//       setIsLoading(true)

//       // Check if user is logged in
//       const storedAuth = localStorage.getItem("auth-storage")
//       let userId

//       if (storedAuth) {
//         const parsedAuth = JSON.parse(storedAuth)
//         userId = parsedAuth.state?.user?._id
//       }

//       let wishlistEventIds: string[] = []

//       // If user is logged in, fetch wishlist from API
//       if (userId) {
//         const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/events/${userId}/wishlist`)

//         if (!response.ok) {
//           throw new Error("Failed to fetch wishlisthhh")
//         }

//         const data = await response.json()
//         if (data.data && Array.isArray(data.data)) {
//           wishlistEventIds = data.data.map((item: any) => item.eventId || item._id)
//         }
//       } else {
//         // If not logged in, get wishlist from localStorage
//         const localWishlist = localStorage.getItem("event-wishlist")
//         if (localWishlist) {
//           wishlistEventIds = JSON.parse(localWishlist)
//         }
//       }

//       // If we have wishlist items, fetch the event details for each
//       if (wishlistEventIds.length > 0) {
//         const eventDetails: Event[] = []

//         // Fetch details for each event in the wishlist
//         for (const eventId of wishlistEventIds) {
//           try {
//             const eventResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/events/details/${eventId}`)

//             if (eventResponse.ok) {
//               const eventData = await eventResponse.json()
//               if (eventData.data) {
//                 eventDetails.push(eventData.data)
//               }
//             }
//           } catch (error) {
//             console.error(`Error fetching details for event ${eventId}:`, error)
//           }
//         }

//         setWishlistItems(eventDetails)
//       } else {
//         setWishlistItems([])
//       }
//     } catch (error) {
//       console.error("Error fetching wishlist items:", error)
//       toast.error("Failed to load wishlist")
//     } finally {
//       setIsLoading(false)
//     }
//   }

//   const removeFromWishlist = async (eventId: string) => {
//     try {
//       // Set removing state for this specific item
//       setIsRemoving((prev) => ({ ...prev, [eventId]: true }))

//       // Check if user is logged in
//       const storedAuth = localStorage.getItem("auth-storage")
//       let userId

//       if (storedAuth) {
//         const parsedAuth = JSON.parse(storedAuth)
//         userId = parsedAuth.state?.user?._id
//       }

//       // Update local state immediately for better UX
//       setWishlistItems((prev) => prev.filter((item) => item._id !== eventId))

//       // If user is logged in, sync with backend
//       if (userId) {
//         const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/events/${userId}/wishlist`, {
//           method: "POST",
//           headers: {
//             "Content-Type": "application/json",
//           },
//           body: JSON.stringify({
//             eventId,
//             action: "remove",
//           }),
//         })

//         if (!response.ok) {
//           throw new Error("Failed to remove event from wishlist")
//         }
//       }

//       // Update localStorage
//       const localWishlist = localStorage.getItem("event-wishlist")
//       if (localWishlist) {
//         const wishlistIds = JSON.parse(localWishlist)
//         const updatedWishlist = wishlistIds.filter((id: string) => id !== eventId)
//         localStorage.setItem("event-wishlist", JSON.stringify(updatedWishlist))
//       }

//       toast.success("Removed from wishlist")
//     } catch (error) {
//       console.error("Error removing from wishlist:", error)
//       toast.error("Failed to remove from wishlist")

//       // Refresh the wishlist to ensure it's in sync
//       fetchWishlistItems()
//     } finally {
//       setIsRemoving((prev) => ({ ...prev, [eventId]: false }))
//     }
//   }

//   const filteredItems = wishlistItems.filter(
//     (item) =>
//       item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
//       (item.location.city && item.location.city.toLowerCase().includes(searchQuery.toLowerCase())) ||
//       (item.location.country && item.location.country.toLowerCase().includes(searchQuery.toLowerCase())),
//   )

//   const formatDate = (dateString: string) => {
//     return new Date(dateString).toLocaleDateString("en-US", {
//       day: "numeric",
//       month: "long",
//       year: "numeric",
//     })
//   }

//   const formatTime = (dateString: string) => {
//     return new Date(dateString).toLocaleTimeString("en-US", {
//       hour: "2-digit",
//       minute: "2-digit",
//     })
//   }

//   if (isLoading) {
//     return (
//       <div className="flex items-center justify-center min-h-[400px]">
//         <div className="text-center">
//           <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#1a2d5a]" />
//           <p className="mt-2 text-[#1a2d5a]">Loading wishlist...</p>
//         </div>
//       </div>
//     )
//   }

//   return (
//     <div className="p-4 sm:p-6">
//       <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 mb-6 sm:mb-8">
//         <h1 className="text-xl sm:text-2xl font-bold">Wishlist</h1>
//         <div className="relative w-full sm:w-64">
//           <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
//           <Input
//             placeholder="Search events..."
//             className="pl-10 h-10 w-full"
//             value={searchQuery}
//             onChange={(e) => setSearchQuery(e.target.value)}
//           />
//         </div>
//       </div>

//       {wishlistItems.length === 0 ? (
//         <div className="text-center py-12">
//           <Heart className="h-12 w-12 mx-auto text-gray-300 mb-4" />
//           <h3 className="text-lg font-medium text-gray-900 mb-2">Your wishlist is empty</h3>
//           <p className="text-gray-500 mb-6">Save your favorite events to find them easily later.</p>
//           <Link href="/">
//             <Button>Browse Events</Button>
//           </Link>
//         </div>
//       ) : filteredItems.length === 0 ? (
//         <div className="text-center py-12">
//           <Search className="h-12 w-12 mx-auto text-gray-300 mb-4" />
//           <h3 className="text-lg font-medium text-gray-900 mb-2">No matching events found</h3>
//           <p className="text-gray-500 mb-6">Try adjusting your search criteria.</p>
//           <Button variant="outline" onClick={() => setSearchQuery("")}>
//             Clear Search
//           </Button>
//         </div>
//       ) : (
//         <div className="space-y-4">
//           {filteredItems.map((item) => (
//             <Card key={item._id}>
//               <CardContent className="p-4 sm:p-6">
//                 <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
//                   <div className="w-full sm:w-24 h-32 sm:h-24 rounded-lg overflow-hidden flex-shrink-0">
//                     <Image
//                       src={
//                         (item.coverImages && item.coverImages.length > 0)
//                           ? (item.coverImages[0].startsWith("http")
//                               ? item.coverImages[0]
//                               : `${process.env.NEXT_PUBLIC_API_URL}${item.coverImages[0].startsWith("/") ? item.coverImages[0] : `/${item.coverImages[0]}`}`)
//                           : (item.coverImage
//                               ? (item.coverImage.startsWith("http")
//                                   ? item.coverImage
//                                   : `${process.env.NEXT_PUBLIC_API_URL}${item.coverImage.startsWith("/") ? item.coverImage : `/${item.coverImage}`}`)
//                               : "/events/eventimg.png")
//                       }
//                       alt={item.title}
//                       width={96}
//                       height={96}
//                       className="w-full h-full object-cover"
//                     />
//                   </div>

//                   <div className="flex-1 w-full">
//                     <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
//                       <div className="flex-1">
//                         <h2 className="text-lg font-semibold">{item.title}</h2>
//                         <div className="mt-2 space-y-1">
//                           <p className="text-sm text-gray-500">
//                             <span className="font-medium">Date:</span> {formatDate(item.startDate)}
//                           </p>
//                           <p className="text-sm text-gray-500">
//                             <span className="font-medium">Time:</span> {formatTime(item.startDate)}
//                           </p>
//                           <p className="text-sm text-gray-500">
//                             <span className="font-medium">Location:</span> {item.location.city}, {item.location.country}
//                           </p>
//                         </div>
//                       </div>
//                       <div className="flex flex-row sm:flex-col items-center sm:items-end gap-3">
//                         <p className="text-lg font-semibold text-primary">
//                           {item.ticketTypes && item.ticketTypes[0]?.price ? `${item.ticketTypes[0].price} ETB` : "Free"}
//                         </p>
//                       </div>
//                     </div>

//                     <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
//                       <p className="text-sm text-gray-500">{typeof item.category === 'object' && item.category !== null && 'name' in item.category ? item.category.name : item.category}</p>
//                       <div className="flex gap-2 w-full sm:w-auto">
//                         <Dialog>
//                           <DialogTrigger asChild>
//                             <Button variant="outline" size="sm" className="w-full sm:w-auto">
//                               View Details
//                             </Button>
//                           </DialogTrigger>
//                           <DialogContent className="sm:max-w-[400px] p-4">
//                             <DialogHeader>
//                               <DialogTitle className="text-lg font-bold">{item.title}</DialogTitle>
//                             </DialogHeader>
//                             <div className="mt-3 space-y-4">
//                               <div className="relative h-36 rounded-lg overflow-hidden">
//                                 <Image
//                                   src={
//                                     (item.coverImages && item.coverImages.length > 0)
//                                       ? (item.coverImages[0].startsWith("http")
//                                           ? item.coverImages[0]
//                                           : `${process.env.NEXT_PUBLIC_API_URL}${item.coverImages[0].startsWith("/") ? item.coverImages[0] : `/${item.coverImages[0]}`}`)
//                                       : (item.coverImage
//                                           ? (item.coverImage.startsWith("http")
//                                               ? item.coverImage
//                                               : `${process.env.NEXT_PUBLIC_API_URL}${item.coverImage.startsWith("/") ? item.coverImage : `/${item.coverImage}`}`)
//                                           : "/events/eventimg.png")
//                                   }
//                                   alt={item.title}
//                                   fill
//                                   className="object-cover"
//                                 />
//                               </div>

//                               <div className="space-y-3">
//                                 <div className="flex items-center gap-2 text-sm text-gray-500">
//                                   <Calendar className="h-4 w-4" />
//                                   <span>
//                                     {formatDate(item.startDate)} at {formatTime(item.startDate)}
//                                   </span>
//                                 </div>
//                                 <div className="flex items-center gap-2 text-sm text-gray-500">
//                                   <MapPin className="h-4 w-4" />
//                                   <span>
//                                     {item.location.city}, {item.location.country}
//                                   </span>
//                                 </div>
//                                 <div className="flex items-center gap-2 text-sm text-gray-500">
//                                   <Ticket className="h-4 w-4" />
//                                   <span>Category: {typeof item.category === 'object' && item.category !== null && 'name' in item.category ? item.category.name : item.category}</span>
//                                 </div>
//                               </div>

//                               <div className="space-y-1">
//                                 <h3 className="font-semibold text-sm">Description</h3>
//                                 <p className="text-sm text-gray-500">{item.description}</p>
//                               </div>

//                               <div className="pt-3 border-t">
//                                 <div className="flex items-center justify-between">
//                                   <p className="text-sm font-medium">
//                                     Organizer: {item.organizer?.name || "Event Organizer"}
//                                   </p>
//                                   <p className="text-lg font-semibold text-primary">
//                                     {item.ticketTypes && item.ticketTypes[0]?.price
//                                       ? `${item.ticketTypes[0].price} ETB`
//                                       : "Free"}
//                                   </p>
//                                 </div>
//                               </div>

//                               <div className="pt-3 border-t">
//                                 <Link href={`event_detail?id=${item._id}`} passHref>
//                                   <Button className="w-full">Get Tickets</Button>
//                                 </Link>
//                               </div>
//                             </div>
//                           </DialogContent>
//                         </Dialog>
//                         <Button
//                           variant="outline"
//                           size="sm"
//                           className="w-full sm:w-auto"
//                           onClick={() => removeFromWishlist(item._id)}
//                           disabled={isRemoving[item._id]}
//                         >
//                           {isRemoving[item._id] ? (
//                             <Loader2 className="h-4 w-4 mr-2 animate-spin" />
//                           ) : (
//                             <Heart className="h-4 w-4 mr-2 fill-current" />
//                           )}
//                           Remove
//                         </Button>
//                       </div>
//                     </div>
//                   </div>
//                 </div>
//               </CardContent>
//             </Card>
//           ))}
//         </div>
//       )}
//     </div>
//   )
// }



"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Search, Heart, Calendar, MapPin, Ticket, Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { toast } from "sonner"
import Link from "next/link"

type Event = {
  _id: string
  title: string
  description?: string
  startDate: string
  endDate?: string
  location?: {
    address?: string
    city?: string
    country?: string
  }
  category?: string | { name: string }
  coverImages?: string[]
  coverImage?: string
  ticketTypes?: Array<{
    name: string
    price: number
    quantity: number
  }>
  status?: string
  organizer?: {
    name?: string
    email?: string
  }
}

export default function WishlistPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [wishlistItems, setWishlistItems] = useState<Event[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRemoving, setIsRemoving] = useState<Record<string, boolean>>({})

  useEffect(() => {
    fetchWishlistItems()
  }, [])

  const fetchWishlistItems = async () => {
    try {
      setIsLoading(true)

      const storedAuth = localStorage.getItem("auth-storage")
      let userId

      if (storedAuth) {
        const parsedAuth = JSON.parse(storedAuth)
        userId = parsedAuth.state?.user?._id
      }

      let wishlistEventIds: string[] = []

      if (userId) {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/events/${userId}/wishlist`)

        if (!response.ok) throw new Error("Failed to fetch wishlist")

        const data = await response.json()
        if (data.data && Array.isArray(data.data)) {
          wishlistEventIds = data.data.map((item: any) => item.eventId || item._id)
        }
      } else {
        const localWishlist = localStorage.getItem("event-wishlist")
        if (localWishlist) wishlistEventIds = JSON.parse(localWishlist)
      }

      if (wishlistEventIds.length > 0) {
        const eventDetails: Event[] = []

        for (const eventId of wishlistEventIds) {
          try {
            const eventResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/events/details/${eventId}`)
            if (eventResponse.ok) {
              const eventData = await eventResponse.json()
              if (eventData.data) eventDetails.push(eventData.data)
            }
          } catch (error) {
            console.error(`Error fetching details for event ${eventId}:`, error)
          }
        }

        setWishlistItems(eventDetails)
      } else {
        setWishlistItems([])
      }
    } catch (error) {
      console.error("Error fetching wishlist items:", error)
      toast.error("Failed to load wishlist")
    } finally {
      setIsLoading(false)
    }
  }

  const removeFromWishlist = async (eventId: string) => {
    try {
      setIsRemoving((prev) => ({ ...prev, [eventId]: true }))

      const storedAuth = localStorage.getItem("auth-storage")
      let userId

      if (storedAuth) {
        const parsedAuth = JSON.parse(storedAuth)
        userId = parsedAuth.state?.user?._id
      }

      setWishlistItems((prev) => prev.filter((item) => item._id !== eventId))

      if (userId) {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/events/${userId}/wishlist`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventId, action: "remove" }),
        })

        if (!response.ok) throw new Error("Failed to remove event from wishlist")
      }

      const localWishlist = localStorage.getItem("event-wishlist")
      if (localWishlist) {
        const wishlistIds = JSON.parse(localWishlist)
        const updatedWishlist = wishlistIds.filter((id: string) => id !== eventId)
        localStorage.setItem("event-wishlist", JSON.stringify(updatedWishlist))
      }

      toast.success("Removed from wishlist")
    } catch (error) {
      console.error("Error removing from wishlist:", error)
      toast.error("Failed to remove from wishlist")
      fetchWishlistItems()
    } finally {
      setIsRemoving((prev) => ({ ...prev, [eventId]: false }))
    }
  }

  const filteredItems = wishlistItems.filter(
    (item) =>
      item.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.location?.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.location?.country?.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const formatDate = (dateString: string) =>
    dateString
      ? new Date(dateString).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" })
      : "N/A"

  const formatTime = (dateString: string) =>
    dateString
      ? new Date(dateString).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
      : "N/A"

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#1a2d5a]" />
          <p className="mt-2 text-[#1a2d5a]">Loading wishlist...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold">Wishlist</h1>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input
            placeholder="Search events..."
            className="pl-10 h-10 w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {wishlistItems.length === 0 ? (
        <div className="text-center py-12">
          <Heart className="h-12 w-12 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Your wishlist is empty</h3>
          <p className="text-gray-500 mb-6">Save your favorite events to find them easily later.</p>
          <Link href="/">
            <Button>Browse Events</Button>
          </Link>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-12">
          <Search className="h-12 w-12 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No matching events found</h3>
          <p className="text-gray-500 mb-6">Try adjusting your search criteria.</p>
          <Button variant="outline" onClick={() => setSearchQuery("")}>
            Clear Search
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredItems.map((item) => (
            <Card key={item._id}>
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
                  <div className="w-full sm:w-24 h-32 sm:h-24 rounded-lg overflow-hidden flex-shrink-0">
                    <Image
                      src={
                        item.coverImages?.[0]
                          ? item.coverImages[0].startsWith("http")
                            ? item.coverImages[0]
                            : `${process.env.NEXT_PUBLIC_API_URL}${item.coverImages[0].startsWith("/") ? item.coverImages[0] : `/${item.coverImages[0]}`}`
                          : item.coverImage
                          ? item.coverImage.startsWith("http")
                            ? item.coverImage
                            : `${process.env.NEXT_PUBLIC_API_URL}${item.coverImage.startsWith("/") ? item.coverImage : `/${item.coverImage}`}`
                          : "/events/eventimg.png"
                      }
                      alt={item.title}
                      width={96}
                      height={96}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="flex-1 w-full">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex-1">
                        <h2 className="text-lg font-semibold">{item.title || "Untitled Event"}</h2>
                        <div className="mt-2 space-y-1">
                          <p className="text-sm text-gray-500">
                            <span className="font-medium">Date:</span> {formatDate(item.startDate)}
                          </p>
                          <p className="text-sm text-gray-500">
                            <span className="font-medium">Time:</span> {formatTime(item.startDate)}
                          </p>
                          <p className="text-sm text-gray-500">
                            <span className="font-medium">Location:</span>{" "}
                            {item.location?.city && item.location?.country
                              ? `${item.location.city}, ${item.location.country}`
                              : "Location not available"}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-row sm:flex-col items-center sm:items-end gap-3">
                        <p className="text-lg font-semibold text-primary">
                          {item.ticketTypes?.[0]?.price ? `${item.ticketTypes[0].price} ETB` : "Free"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <p className="text-sm text-gray-500">
                        {typeof item.category === "object" && item.category !== null && "name" in item.category
                          ? item.category.name
                          : item.category || "Uncategorized"}
                      </p>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="w-full sm:w-auto">
                              View Details
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-[400px] p-4">
                            <DialogHeader>t
                              <DialogTitle className="text-lg font-bold">{item.title || "Untitled Event"}</DialogTitle>
                            </DialogHeader>
                            <div className="mt-3 space-y-4">
                              <div className="relative h-36 rounded-lg overflow-hidden">
                                <Image
                                  src={
                                    item.coverImages?.[0]
                                      ? item.coverImages[0].startsWith("http")
                                        ? item.coverImages[0]
                                        : `${process.env.NEXT_PUBLIC_API_URL}${item.coverImages[0].startsWith("/") ? item.coverImages[0] : `/${item.coverImages[0]}`}`
                                      : item.coverImage
                                      ? item.coverImage.startsWith("http")
                                        ? item.coverImage
                                        : `${process.env.NEXT_PUBLIC_API_URL}${item.coverImage.startsWith("/") ? item.coverImage : `/${item.coverImage}`}`
                                      : "/events/eventimg.png"
                                  }
                                  alt={item.title || "Event image"}
                                  fill
                                  className="object-cover"
                                />
                              </div>

                              <div className="space-y-3">
                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                  <Calendar className="h-4 w-4" />
                                  <span>
                                    {formatDate(item.startDate)} at {formatTime(item.startDate)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                  <MapPin className="h-4 w-4" />
                                  <span>
                                    {item.location?.city && item.location?.country
                                      ? `${item.location.city}, ${item.location.country}`
                                      : "Location not available"}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                  <Ticket className="h-4 w-4" />
                                  <span>
                                    Category:{" "}
                                    {typeof item.category === "object" && item.category !== null && "name" in item.category
                                      ? item.category.name
                                      : item.category || "Uncategorized"}
                                  </span>
                                </div>
                              </div>

                              <div className="space-y-1">
                                <h3 className="font-semibold text-sm">Description</h3>
                                <p className="text-sm text-gray-500">{item.description || "No description provided."}</p>
                              </div>

                              <div className="pt-3 border-t">
                                <div className="flex items-center justify-between">
                                  <p className="text-sm font-medium">
                                    Organizer: {item.organizer?.name || "Event Organizer"}
                                  </p>
                                  <p className="text-lg font-semibold text-primary">
                                    {item.ticketTypes?.[0]?.price ? `${item.ticketTypes[0].price} ETB` : "Free"}
                                  </p>
                                </div>
                              </div>

                              <div className="pt-3 border-t">
                                <Link href={`event_detail?id=${item._id}`} passHref>
                                  <Button className="w-full">Get Tickets</Button>
                                </Link>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full sm:w-auto"
                          onClick={() => removeFromWishlist(item._id)}
                          disabled={isRemoving[item._id]}
                        >
                          {isRemoving[item._id] ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Heart className="h-4 w-4 mr-2 fill-current" />
                          )}
                          Remove
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
