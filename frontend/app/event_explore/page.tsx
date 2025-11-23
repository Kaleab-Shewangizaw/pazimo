// // // // "use client"

// // // // import Link from "next/link"
// // // // import { Suspense, lazy, useEffect, useState } from "react"
// // // // import { ChevronDown, X } from "lucide-react"
// // // // import { Button } from "@/components/ui/button"
// // // // import { Checkbox } from "@/components/ui/checkbox"
// // // // import { Slider } from "@/components/ui/slider"
// // // // import { Badge } from "@/components/ui/badge"
// // // // import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
// // // // import EventCardSkeleton from "@/components/skeleton/event-card-skeleton"
// // // // import { toast } from "sonner"
// // // // import { useAuthStore } from "@/store/authStore"
// // // // import { useRouter } from "next/navigation"

// // // // const EventGrid = lazy(() => import("@/components/skeleton/event-grid"))

// // // // type Event = {
// // // //   _id: string
// // // //   title: string
// // // //   description: string
// // // //   startDate: string
// // // //   endDate: string
// // // //   location: {
// // // //     address: string
// // // //     city: string
// // // //     country: string
// // // //   }
// // // //   category: {
// // // //     _id: string
// // // //     name: string
// // // //     description: string
// // // //   }
// // // //   coverImages: string[]
// // // //   ticketTypes: Array<{
// // // //     name: string
// // // //     price: number
// // // //     quantity: number
// // // //   }>
// // // //   status: string
// // // //   ageLimit?: string
// // // // }

// // // // const AGE_RESTRICTIONS = ["3+", "13+", "18+", "21+", "25+"]

// // // // export default function EventSearchPage() {
// // // //   const [isClient, setIsClient] = useState(false)
// // // //   const [events, setEvents] = useState<Event[]>([])
// // // //   const [filteredEvents, setFilteredEvents] = useState<Event[]>([])
// // // //   const [isLoading, setIsLoading] = useState(true)
// // // //   const [selectedCategories, setSelectedCategories] = useState<string[]>([])
// // // //   const [categoriesFromEvents, setCategoriesFromEvents] = useState<string[]>([])
// // // //   const [selectedAge, setSelectedAge] = useState<string>("")
// // // //   const [priceRange, setPriceRange] = useState<[number, number]>([0, 2000])
// // // //   const [sortBy, setSortBy] = useState<string>("newest")
// // // //   const [currentPage, setCurrentPage] = useState(1)
// // // //   const eventsPerPage = 9
// // // //   const [wishlist, setWishlist] = useState<string[]>([])
// // // //   const [isWishlistLoading, setIsWishlistLoading] = useState(false)
// // // //   const { user } = useAuthStore()
// // // //   const router = useRouter()

// // // //   useEffect(() => {
// // // //     setIsClient(true)
// // // //     fetchEvents()
// // // //   }, [])

// // // //   useEffect(() => {
// // // //     if (isClient && user?.role === "organizer") {
// // // //       router.replace("/organizer/events")
// // // //     }
// // // //   }, [isClient, user, router])

// // // //   useEffect(() => {
// // // //     filterEvents()
// // // //   }, [events, selectedCategories, selectedAge, priceRange, sortBy])

// // // //   useEffect(() => {
// // // //     const fetchWishlist = async () => {
// // // //       try {
// // // //         const storedAuth = localStorage.getItem("auth-storage")
// // // //         if (!storedAuth) {
// // // //           const localWishlist = localStorage.getItem("event-wishlist")
// // // //           if (localWishlist) setWishlist(JSON.parse(localWishlist))
// // // //           return
// // // //         }
// // // //         const parsedAuth = JSON.parse(storedAuth)
// // // //         const userId = parsedAuth.state?.user?.id || parsedAuth.state?.user?._id
// // // //         if (!userId) {
// // // //           const localWishlist = localStorage.getItem("event-wishlist")
// // // //           if (localWishlist) setWishlist(JSON.parse(localWishlist))
// // // //           return
// // // //         }
// // // //         const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/events/${userId}/wishlist`)
// // // //         if (!response.ok) throw new Error("Failed to fetch wishlist")
// // // //         const data = await response.json()
// // // //         if (data.data && Array.isArray(data.data)) {
// // // //           const wishlistIds = data.data.map((item: any) => item.eventId || item._id)
// // // //           setWishlist(wishlistIds)
// // // //         }
// // // //       } catch {
// // // //         const localWishlist = localStorage.getItem("event-wishlist")
// // // //         if (localWishlist) setWishlist(JSON.parse(localWishlist))
// // // //       }
// // // //     }
// // // //     fetchWishlist()
// // // //   }, [])

// // // //   const fetchEvents = async () => {
// // // //     try {
// // // //       setIsLoading(true)
// // // //       const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/events`)
// // // //       if (!response.ok) throw new Error("Failed to fetch events")
// // // //       const data = await response.json()
// // // //       const categories = Array.from(new Set(data.data.map((event: Event) => event.category?.name || 'Uncategorized'))) as string[]
// // // //       setCategoriesFromEvents(categories)
// // // //       setEvents(data.data)
// // // //       setFilteredEvents(data.data)
// // // //     } catch (error) {
// // // //       console.error("Error fetching events:", error)
// // // //       toast.error("Failed to fetch events")
// // // //     } finally {
// // // //       setIsLoading(false)
// // // //     }
// // // //   }

// // // //   const filterEvents = () => {
// // // //     let filtered = [...events]

// // // //     if (selectedCategories.length > 0) {
// // // //       filtered = filtered.filter(event => selectedCategories.includes(event.category?.name || 'Uncategorized'))
// // // //     }

// // // //     if (selectedAge) {
// // // //       const selected = parseInt(selectedAge)
// // // //       filtered = filtered.filter(event => {
// // // //         const eventAge = parseInt(event.ageLimit || "0")
// // // //         return eventAge <= selected
// // // //       })
// // // //     }

// // // //     filtered = filtered.filter(event => {
// // // //       const prices = event.ticketTypes.map(t => t.price)
// // // //       const minPrice = prices.length ? Math.min(...prices) : 0
// // // //       return minPrice >= priceRange[0] && minPrice <= priceRange[1]
// // // //     })

// // // //     filtered.sort((a, b) => {
// // // //       const priceA = Math.min(...(a.ticketTypes.map(t => t.price)))
// // // //       const priceB = Math.min(...(b.ticketTypes.map(t => t.price)))
// // // //       switch (sortBy) {
// // // //         case "price-low": return priceA - priceB
// // // //         case "price-high": return priceB - priceA
// // // //         case "newest": return new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
// // // //         case "popular": return 0
// // // //         default: return 0
// // // //       }
// // // //     })

// // // //     setFilteredEvents(filtered)
// // // //     setCurrentPage(1)
// // // //   }

// // // //   const handleCategoryChange = (category: string) => {
// // // //     setSelectedCategories(prev => prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category])
// // // //   }

// // // //   const handleAgeChange = (age: string) => {
// // // //     setSelectedAge(prev => prev === age ? "" : age)
// // // //   }

// // // //   const removeCategory = (category: string) => {
// // // //     setSelectedCategories(prev => prev.filter(c => c !== category))
// // // //   }

// // // //   const indexOfLastEvent = currentPage * eventsPerPage
// // // //   const indexOfFirstEvent = indexOfLastEvent - eventsPerPage
// // // //   const currentEvents = filteredEvents.slice(indexOfFirstEvent, indexOfLastEvent)
// // // //   const totalPages = Math.ceil(filteredEvents.length / eventsPerPage)

// // // //   const toggleWishlist = async (eventId: string) => {
// // // //     try {
// // // //       setIsWishlistLoading(true)
// // // //       const storedAuth = localStorage.getItem("auth-storage")
// // // //       let userId
// // // //       if (storedAuth) {
// // // //         const parsedAuth = JSON.parse(storedAuth)
// // // //         userId = parsedAuth.state?.user?.id || parsedAuth.state?.user?._id
// // // //       }
// // // //       const isRemoving = wishlist.includes(eventId)
// // // //       const newWishlist = isRemoving
// // // //         ? wishlist.filter((id) => id !== eventId)
// // // //         : [...wishlist, eventId]
// // // //       setWishlist(newWishlist)
// // // //       localStorage.setItem("event-wishlist", JSON.stringify(newWishlist))
// // // //       if (userId) {
// // // //         await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/events/${userId}/wishlist`, {
// // // //           method: "POST",
// // // //           headers: { "Content-Type": "application/json" },
// // // //           body: JSON.stringify({ eventId }),
// // // //         })
// // // //       }
// // // //       toast.success(isRemoving ? "Removed from wishlist" : "Added to wishlist")
// // // //     } catch (error) {
// // // //       toast.error("Failed to update wishlist")
// // // //     } finally {
// // // //       setIsWishlistLoading(false)
// // // //     }
// // // //   }

// // // //   return (
// // // //     <div className="container mx-auto px-6 py-8">
// // // //       <nav className="flex items-center text-sm text-gray-500 mb-8">
// // // //         <Link href="/" className="hover:text-[#0D47A1]">Home</Link>
// // // //         <span className="mx-2">/</span>
// // // //         <Link href="/search" className="hover:text-[#0D47A1]">Search</Link>
// // // //         <span className="mx-2">/</span>
// // // //         <span className="text-gray-900">Events</span>
// // // //       </nav>

// // // //       <div className="flex flex-col lg:flex-row gap-8">
// // // //         <div className="w-full lg:w-72 flex-shrink-0">
// // // //           <div className="mb-8">
// // // //             <h2 className="text-lg font-medium mb-4">Applied Filters:</h2>
// // // //             <div className="flex flex-wrap gap-2">
// // // //               {selectedCategories.map(category => (
// // // //                 <Badge key={category} variant="outline" className="flex items-center gap-1 px-3 py-1 rounded-full">
// // // //                   {category}
// // // //                   <button className="ml-1" onClick={() => removeCategory(category)}>
// // // //                     <X className="h-4 w-4" />
// // // //                   </button>
// // // //                 </Badge>
// // // //               ))}
// // // //             </div>
// // // //           </div>

// // // //           <div className="border rounded-lg p-6 space-y-8">
// // // //             <div>
// // // //               <h3 className="text-lg font-medium mb-4">Categories</h3>
// // // //               <div className="space-y-3">
// // // //                 {categoriesFromEvents.map(category => (
// // // //                   <div key={category} className="flex items-center space-x-2">
// // // //                     <Checkbox id={category} checked={selectedCategories.includes(category)} onCheckedChange={() => handleCategoryChange(category)} />
// // // //                     <label htmlFor={category} className="text-sm font-medium leading-none">{category}</label>
// // // //                   </div>
// // // //                 ))}
// // // //               </div>
// // // //             </div>

// // // //             <div className="border-t pt-6">
// // // //               <h3 className="text-lg font-medium mb-4">Age</h3>
// // // //               <div className="flex flex-wrap gap-3">
// // // //                 {AGE_RESTRICTIONS.map(age => (
// // // //                   <Button key={age} variant={selectedAge === age ? "default" : "outline"} size="sm" className="rounded-full" onClick={() => handleAgeChange(age)}>
// // // //                     {age}
// // // //                   </Button>
// // // //                 ))}
// // // //               </div>
// // // //             </div>

// // // //             <div className="border-t pt-6">
// // // //               <h3 className="text-lg font-medium mb-4">Price</h3>
// // // //               <Slider defaultValue={[0, 2000]} max={2000} step={100} value={priceRange} onValueChange={(value) => setPriceRange(value as [number, number])} className="my-8" />
// // // //               <div className="flex justify-between">
// // // //                 <span className="text-sm">{priceRange[0]} ETB</span>
// // // //                 <span className="text-sm">{priceRange[1]} ETB</span>
// // // //               </div>
// // // //             </div>
// // // //           </div>
// // // //         </div>

// // // //         <div className="flex-1">
// // // //           <div className="flex justify-between items-center mb-8">
// // // //             <p className="text-gray-600">
// // // //               Showing {indexOfFirstEvent + 1}-{Math.min(indexOfLastEvent, filteredEvents.length)} of {filteredEvents.length} Results
// // // //             </p>
// // // //             <div className="flex items-center">
// // // //               <Select value={sortBy} onValueChange={setSortBy}>
// // // //                 <SelectTrigger className="w-[180px]">
// // // //                   <SelectValue placeholder="Sort by" />
// // // //                 </SelectTrigger>
// // // //                 <SelectContent>
// // // //                   <SelectItem value="price-low">Price: Low to High</SelectItem>
// // // //                   <SelectItem value="price-high">Price: High to Low</SelectItem>
// // // //                   <SelectItem value="newest">Newest First</SelectItem>
// // // //                   <SelectItem value="popular">Most Popular</SelectItem>
// // // //                 </SelectContent>
// // // //               </Select>
// // // //             </div>
// // // //           </div>

// // // //           {currentEvents.length === 0 && !isLoading && (
// // // //             <p className="text-center text-gray-500 mt-10">No events match your filters.</p>
// // // //           )}

// // // //           {isClient ? (
// // // //             <Suspense fallback={<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">{Array(6).fill(0).map((_, index) => <EventCardSkeleton key={index} />)}</div>}>
// // // //               <EventGrid 
// // // //                 events={currentEvents} 
// // // //                 wishlist={wishlist}
// // // //                 onToggleWishlist={toggleWishlist}
// // // //                 isWishlistLoading={isWishlistLoading}
// // // //               />
// // // //             </Suspense>
// // // //           ) : (
// // // //             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
// // // //               {Array(6).fill(0).map((_, index) => <EventCardSkeleton key={index} />)}
// // // //             </div>
// // // //           )}

// // // //           {totalPages > 1 && (
// // // //             <div className="flex justify-center mt-12">
// // // //               <nav className="flex items-center gap-2">
// // // //                 <Button variant="outline" size="icon" className="w-9 h-9" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1}>
// // // //                   <span className="sr-only">Previous page</span>
// // // //                   <ChevronDown className="h-4 w-4 rotate-90" />
// // // //                 </Button>
// // // //                 {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
// // // //                   <Button key={page} variant={currentPage === page ? "default" : "outline"} size="sm" className={`w-9 h-9 ${currentPage === page ? 'bg-[#0D47A1] text-white hover:bg-[#0D47A1]/90' : ''}`} onClick={() => setCurrentPage(page)}>
// // // //                     {page}
// // // //                   </Button>
// // // //                 ))}
// // // //                 <Button variant="outline" size="icon" className="w-9 h-9" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages}>
// // // //                   <span className="sr-only">Next page</span>
// // // //                   <ChevronDown className="h-4 w-4 -rotate-90" />
// // // //                 </Button>
// // // //               </nav>
// // // //             </div>
// // // //           )}
// // // //         </div>
// // // //       </div>
// // // //     </div>
// // // //   )
// // // // }

// // // "use client"

// // // import Link from "next/link"
// // // import { Suspense, lazy, useEffect, useState } from "react"
// // // import { ChevronDown, X } from "lucide-react"
// // // import { Button } from "@/components/ui/button"
// // // import { Checkbox } from "@/components/ui/checkbox"
// // // import { Slider } from "@/components/ui/slider"
// // // import { Badge } from "@/components/ui/badge"
// // // import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
// // // import EventCardSkeleton from "@/components/skeleton/event-card-skeleton"
// // // import { toast } from "sonner"
// // // import { useAuthStore } from "@/store/authStore"
// // // import { useRouter } from "next/navigation"

// // // const EventGrid = lazy(() => import("@/components/skeleton/event-grid"))

// // // type Event = {
// // //   _id: string
// // //   title: string
// // //   description: string
// // //   startDate: string
// // //   endDate: string
// // //   location: {
// // //     address: string
// // //     city: string
// // //     country: string
// // //   }
// // //   category: {
// // //     _id: string
// // //     name: string
// // //     description: string
// // //   }
// // //   coverImages: string[]
// // //   ticketTypes: Array<{
// // //     name: string
// // //     price: number
// // //     quantity: number
// // //     endDate?: string // Added for sold out checking
// // //   }>
// // //   status: string
// // //   ageLimit?: string
// // //   capacity?: number // Added for sold out checking
// // // }

// // // const AGE_RESTRICTIONS = ["3+", "13+", "18+", "21+", "25+"]

// // // // Function to check if event is sold out
// // // const isEventSoldOut = (event: Event) => {
// // //   const now = new Date()

// // //   // Check if event date has passed
// // //   if (new Date(event.startDate) <= now) {
// // //     return true
// // //   }

// // //   // Check if all ticket types are sold out or expired
// // //   if (event.ticketTypes && event.ticketTypes.length > 0) {
// // //     return event.ticketTypes.every((ticket) => {
// // //       // Check if quantity is 0
// // //       if (ticket.quantity === 0) {
// // //         return true
// // //       }
// // //       // Check if ticket type has an end date and it has passed
// // //       if (ticket.endDate && new Date(ticket.endDate) <= now) {
// // //         return true
// // //       }
// // //       return false
// // //     })
// // //   }

// // //   return false
// // // }

// // // export default function EventSearchPage() {
// // //   const [isClient, setIsClient] = useState(false)
// // //   const [events, setEvents] = useState<Event[]>([])
// // //   const [filteredEvents, setFilteredEvents] = useState<Event[]>([])
// // //   const [isLoading, setIsLoading] = useState(true)
// // //   const [selectedCategories, setSelectedCategories] = useState<string[]>([])
// // //   const [categoriesFromEvents, setCategoriesFromEvents] = useState<string[]>([])
// // //   const [selectedAge, setSelectedAge] = useState<string>("")
// // //   const [priceRange, setPriceRange] = useState<[number, number]>([0, 2000])
// // //   const [sortBy, setSortBy] = useState<string>("newest")
// // //   const [currentPage, setCurrentPage] = useState(1)
// // //   const [showSoldOut, setShowSoldOut] = useState<boolean>(true) // New state for showing/hiding sold out events
// // //   const eventsPerPage = 9
// // //   const [wishlist, setWishlist] = useState<string[]>([])
// // //   const [isWishlistLoading, setIsWishlistLoading] = useState(false)
// // //   const { user } = useAuthStore()
// // //   const router = useRouter()

// // //   useEffect(() => {
// // //     setIsClient(true)
// // //     fetchEvents()
// // //   }, [])

// // //   useEffect(() => {
// // //     if (isClient && user?.role === "organizer") {
// // //       router.replace("/organizer/events")
// // //     }
// // //   }, [isClient, user, router])

// // //   useEffect(() => {
// // //     filterEvents()
// // //   }, [events, selectedCategories, selectedAge, priceRange, sortBy, showSoldOut])

// // //   useEffect(() => {
// // //     const fetchWishlist = async () => {
// // //       try {
// // //         const storedAuth = localStorage.getItem("auth-storage")
// // //         if (!storedAuth) {
// // //           const localWishlist = localStorage.getItem("event-wishlist")
// // //           if (localWishlist) setWishlist(JSON.parse(localWishlist))
// // //           return
// // //         }

// // //         const parsedAuth = JSON.parse(storedAuth)
// // //         const userId = parsedAuth.state?.user?.id || parsedAuth.state?.user?._id

// // //         if (!userId) {
// // //           const localWishlist = localStorage.getItem("event-wishlist")
// // //           if (localWishlist) setWishlist(JSON.parse(localWishlist))
// // //           return
// // //         }

// // //         const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/events/${userId}/wishlist`)
// // //         if (!response.ok) throw new Error("Failed to fetch wishlist")

// // //         const data = await response.json()
// // //         if (data.data && Array.isArray(data.data)) {
// // //           const wishlistIds = data.data.map((item: any) => item.eventId || item._id)
// // //           setWishlist(wishlistIds)
// // //         }
// // //       } catch {
// // //         const localWishlist = localStorage.getItem("event-wishlist")
// // //         if (localWishlist) setWishlist(JSON.parse(localWishlist))
// // //       }
// // //     }

// // //     fetchWishlist()
// // //   }, [])

// // //   const fetchEvents = async () => {
// // //     try {
// // //       setIsLoading(true)
// // //       const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/events`)
// // //       if (!response.ok) throw new Error("Failed to fetch events")

// // //       const data = await response.json()
// // //       const categories = Array.from(
// // //         new Set(data.data.map((event: Event) => event.category?.name || "Uncategorized")),
// // //       ) as string[]

// // //       setCategoriesFromEvents(categories)
// // //       setEvents(data.data)
// // //       setFilteredEvents(data.data)
// // //     } catch (error) {
// // //       console.error("Error fetching events:", error)
// // //       toast.error("Failed to fetch events")
// // //     } finally {
// // //       setIsLoading(false)
// // //     }
// // //   }

// // //   const filterEvents = () => {
// // //     let filtered = [...events]

// // //     // Filter by categories
// // //     if (selectedCategories.length > 0) {
// // //       filtered = filtered.filter((event) => selectedCategories.includes(event.category?.name || "Uncategorized"))
// // //     }

// // //     // Filter by age
// // //     if (selectedAge) {
// // //       const selected = Number.parseInt(selectedAge)
// // //       filtered = filtered.filter((event) => {
// // //         const eventAge = Number.parseInt(event.ageLimit || "0")
// // //         return eventAge <= selected
// // //       })
// // //     }

// // //     // Filter by price range
// // //     filtered = filtered.filter((event) => {
// // //       const prices = event.ticketTypes.map((t) => t.price)
// // //       const minPrice = prices.length ? Math.min(...prices) : 0
// // //       return minPrice >= priceRange[0] && minPrice <= priceRange[1]
// // //     })

// // //     // Filter by sold out status
// // //     if (!showSoldOut) {
// // //       filtered = filtered.filter((event) => !isEventSoldOut(event))
// // //     }

// // //     // Sort events
// // //     filtered.sort((a, b) => {
// // //       const priceA = Math.min(...a.ticketTypes.map((t) => t.price))
// // //       const priceB = Math.min(...b.ticketTypes.map((t) => t.price))

// // //       switch (sortBy) {
// // //         case "price-low":
// // //           return priceA - priceB
// // //         case "price-high":
// // //           return priceB - priceA
// // //         case "newest":
// // //           return new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
// // //         case "popular":
// // //           return 0
// // //         case "availability": // New sort option - available events first
// // //           const aSoldOut = isEventSoldOut(a)
// // //           const bSoldOut = isEventSoldOut(b)
// // //           if (aSoldOut && !bSoldOut) return 1
// // //           if (!aSoldOut && bSoldOut) return -1
// // //           return new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
// // //         default:
// // //           return 0
// // //       }
// // //     })

// // //     setFilteredEvents(filtered)
// // //     setCurrentPage(1)
// // //   }

// // //   const handleCategoryChange = (category: string) => {
// // //     setSelectedCategories((prev) =>
// // //       prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category],
// // //     )
// // //   }

// // //   const handleAgeChange = (age: string) => {
// // //     setSelectedAge((prev) => (prev === age ? "" : age))
// // //   }

// // //   const removeCategory = (category: string) => {
// // //     setSelectedCategories((prev) => prev.filter((c) => c !== category))
// // //   }

// // //   const indexOfLastEvent = currentPage * eventsPerPage
// // //   const indexOfFirstEvent = indexOfLastEvent - eventsPerPage
// // //   const currentEvents = filteredEvents.slice(indexOfFirstEvent, indexOfLastEvent)
// // //   const totalPages = Math.ceil(filteredEvents.length / eventsPerPage)

// // //   // Count sold out events for display
// // //   const soldOutCount = filteredEvents.filter((event) => isEventSoldOut(event)).length
// // //   const availableCount = filteredEvents.length - soldOutCount

// // //   const toggleWishlist = async (eventId: string) => {
// // //     try {
// // //       setIsWishlistLoading(true)
// // //       const storedAuth = localStorage.getItem("auth-storage")
// // //       let userId

// // //       if (storedAuth) {
// // //         const parsedAuth = JSON.parse(storedAuth)
// // //         userId = parsedAuth.state?.user?.id || parsedAuth.state?.user?._id
// // //       }

// // //       const isRemoving = wishlist.includes(eventId)
// // //       const newWishlist = isRemoving ? wishlist.filter((id) => id !== eventId) : [...wishlist, eventId]

// // //       setWishlist(newWishlist)
// // //       localStorage.setItem("event-wishlist", JSON.stringify(newWishlist))

// // //       if (userId) {
// // //         await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/events/${userId}/wishlist`, {
// // //           method: "POST",
// // //           headers: { "Content-Type": "application/json" },
// // //           body: JSON.stringify({ eventId }),
// // //         })
// // //       }

// // //       toast.success(isRemoving ? "Removed from wishlist" : "Added to wishlist")
// // //     } catch (error) {
// // //       toast.error("Failed to update wishlist")
// // //     } finally {
// // //       setIsWishlistLoading(false)
// // //     }
// // //   }

// // //   return (
// // //     <div className="container mx-auto px-6 py-8">
// // //       <nav className="flex items-center text-sm text-gray-500 mb-8">
// // //         <Link href="/" className="hover:text-[#0D47A1]">
// // //           Home
// // //         </Link>
// // //         <span className="mx-2">/</span>
// // //         <Link href="/search" className="hover:text-[#0D47A1]">
// // //           Search
// // //         </Link>
// // //         <span className="mx-2">/</span>
// // //         <span className="text-gray-900">Events</span>
// // //       </nav>

// // //       <div className="flex flex-col lg:flex-row gap-8">
// // //         <div className="w-full lg:w-72 flex-shrink-0">
// // //           <div className="mb-8">
// // //             <h2 className="text-lg font-medium mb-4">Applied Filters:</h2>
// // //             <div className="flex flex-wrap gap-2">
// // //               {selectedCategories.map((category) => (
// // //                 <Badge key={category} variant="outline" className="flex items-center gap-1 px-3 py-1 rounded-full">
// // //                   {category}
// // //                   <button className="ml-1" onClick={() => removeCategory(category)}>
// // //                     <X className="h-4 w-4" />
// // //                   </button>
// // //                 </Badge>
// // //               ))}
// // //               {!showSoldOut && (
// // //                 <Badge variant="outline" className="flex items-center gap-1 px-3 py-1 rounded-full">
// // //                   Hide Sold Out
// // //                   <button className="ml-1" onClick={() => setShowSoldOut(true)}>
// // //                     <X className="h-4 w-4" />
// // //                   </button>
// // //                 </Badge>
// // //               )}
// // //             </div>
// // //           </div>

// // //           <div className="border rounded-lg p-6 space-y-8">
// // //             <div>
// // //               <h3 className="text-lg font-medium mb-4">Categories</h3>
// // //               <div className="space-y-3">
// // //                 {categoriesFromEvents.map((category) => (
// // //                   <div key={category} className="flex items-center space-x-2">
// // //                     <Checkbox
// // //                       id={category}
// // //                       checked={selectedCategories.includes(category)}
// // //                       onCheckedChange={() => handleCategoryChange(category)}
// // //                     />
// // //                     <label htmlFor={category} className="text-sm font-medium leading-none">
// // //                       {category}
// // //                     </label>
// // //                   </div>
// // //                 ))}
// // //               </div>
// // //             </div>

// // //             <div className="border-t pt-6">
// // //               <h3 className="text-lg font-medium mb-4">Age</h3>
// // //               <div className="flex flex-wrap gap-3">
// // //                 {AGE_RESTRICTIONS.map((age) => (
// // //                   <Button
// // //                     key={age}
// // //                     variant={selectedAge === age ? "default" : "outline"}
// // //                     size="sm"
// // //                     className="rounded-full"
// // //                     onClick={() => handleAgeChange(age)}
// // //                   >
// // //                     {age}
// // //                   </Button>
// // //                 ))}
// // //               </div>
// // //             </div>

// // //             <div className="border-t pt-6">
// // //               <h3 className="text-lg font-medium mb-4">Price</h3>
// // //               <Slider
// // //                 defaultValue={[0, 2000]}
// // //                 max={2000}
// // //                 step={100}
// // //                 value={priceRange}
// // //                 onValueChange={(value) => setPriceRange(value as [number, number])}
// // //                 className="my-8"
// // //               />
// // //               <div className="flex justify-between">
// // //                 <span className="text-sm">{priceRange[0]} ETB</span>
// // //                 <span className="text-sm">{priceRange[1]} ETB</span>
// // //               </div>
// // //             </div>

// // //             {/* New Availability Filter */}
// // //             <div className="border-t pt-6">
// // //               <h3 className="text-lg font-medium mb-4">Availability</h3>
// // //               <div className="flex items-center space-x-2">
// // //                 <Checkbox id="show-sold-out" checked={showSoldOut} onCheckedChange={(checked) => setShowSoldOut(checked === true)} />
// // //                 <label htmlFor="show-sold-out" className="text-sm font-medium leading-none">
// // //                   Show sold out events
// // //                 </label>
// // //               </div>
// // //               <div className="mt-3 text-xs text-gray-500">
// // //                 <p>
// // //                   {availableCount} available • {soldOutCount} sold out
// // //                 </p>
// // //               </div>
// // //             </div>
// // //           </div>
// // //         </div>

// // //         <div className="flex-1">
// // //           <div className="flex justify-between items-center mb-8">
// // //             <p className="text-gray-600">
// // //               Showing {indexOfFirstEvent + 1}-{Math.min(indexOfLastEvent, filteredEvents.length)} of{" "}
// // //               {filteredEvents.length} Results
// // //               {soldOutCount > 0 && (
// // //                 <span className="text-sm text-gray-500 ml-2">
// // //                   ({availableCount} available, {soldOutCount} sold out)
// // //                 </span>
// // //               )}
// // //             </p>
// // //             <div className="flex items-center">
// // //               <Select value={sortBy} onValueChange={setSortBy}>
// // //                 <SelectTrigger className="w-[180px]">
// // //                   <SelectValue placeholder="Sort by" />
// // //                 </SelectTrigger>
// // //                 <SelectContent>
// // //                   <SelectItem value="availability">Availability</SelectItem>
// // //                   <SelectItem value="price-low">Price: Low to High</SelectItem>
// // //                   <SelectItem value="price-high">Price: High to Low</SelectItem>
// // //                   <SelectItem value="newest">Newest First</SelectItem>
// // //                   <SelectItem value="popular">Most Popular</SelectItem>
// // //                 </SelectContent>
// // //               </Select>
// // //             </div>
// // //           </div>

// // //           {currentEvents.length === 0 && !isLoading && (
// // //             <p className="text-center text-gray-500 mt-10">No events match your filters.</p>
// // //           )}

// // //           {isClient ? (
// // //             <Suspense
// // //               fallback={
// // //                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
// // //                   {Array(6)
// // //                     .fill(0)
// // //                     .map((_, index) => (
// // //                       <EventCardSkeleton key={index} />
// // //                     ))}
// // //                 </div>
// // //               }
// // //             >
// // //               <EventGrid
// // //                 events={currentEvents}
// // //                 wishlist={wishlist}
// // //                 onToggleWishlist={toggleWishlist}
// // //                 isWishlistLoading={isWishlistLoading}
// // //                 isEventSoldOut={isEventSoldOut} // Pass the sold out function
// // //               />
// // //             </Suspense>
// // //           ) : (
// // //             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
// // //               {Array(6)
// // //                 .fill(0)
// // //                 .map((_, index) => (
// // //                   <EventCardSkeleton key={index} />
// // //                 ))}
// // //             </div>
// // //           )}

// // //           {totalPages > 1 && (
// // //             <div className="flex justify-center mt-12">
// // //               <nav className="flex items-center gap-2">
// // //                 <Button
// // //                   variant="outline"
// // //                   size="icon"
// // //                   className="w-9 h-9 bg-transparent"
// // //                   onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
// // //                   disabled={currentPage === 1}
// // //                 >
// // //                   <span className="sr-only">Previous page</span>
// // //                   <ChevronDown className="h-4 w-4 rotate-90" />
// // //                 </Button>
// // //                 {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
// // //                   <Button
// // //                     key={page}
// // //                     variant={currentPage === page ? "default" : "outline"}
// // //                     size="sm"
// // //                     className={`w-9 h-9 ${currentPage === page ? "bg-[#0D47A1] text-white hover:bg-[#0D47A1]/90" : ""}`}
// // //                     onClick={() => setCurrentPage(page)}
// // //                   >
// // //                     {page}
// // //                   </Button>
// // //                 ))}
// // //                 <Button
// // //                   variant="outline"
// // //                   size="icon"
// // //                   className="w-9 h-9 bg-transparent"
// // //                   onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
// // //                   disabled={currentPage === totalPages}
// // //                 >
// // //                   <span className="sr-only">Next page</span>
// // //                   <ChevronDown className="h-4 w-4 -rotate-90" />
// // //                 </Button>
// // //               </nav>
// // //             </div>
// // //           )}
// // //         </div>
// // //       </div>
// // //     </div>
// // //   )
// // // }

// // "use client"

// // import Link from "next/link"
// // import { Suspense, lazy, useEffect, useState } from "react"
// // import { ChevronDown, X, SlidersHorizontal } from "lucide-react"
// // import { Button } from "@/components/ui/button"
// // import { Checkbox } from "@/components/ui/checkbox"
// // import { Slider } from "@/components/ui/slider"
// // import { Badge } from "@/components/ui/badge"
// // import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
// // import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
// // import EventCardSkeleton from "@/components/skeleton/event-card-skeleton"
// // import { toast } from "sonner"
// // import { useAuthStore } from "@/store/authStore"
// // import { useRouter } from "next/navigation"

// // const EventGrid = lazy(() => import("@/components/skeleton/event-grid"))

// // type Event = {
// //   _id: string
// //   title: string
// //   description: string
// //   startDate: string
// //   endDate: string
// //   location: {
// //     address: string
// //     city: string
// //     country: string
// //   }
// //   category: {
// //     _id: string
// //     name: string
// //     description: string
// //   }
// //   coverImages: string[]
// //   ticketTypes: Array<{
// //     name: string
// //     price: number
// //     quantity: number
// //     endDate?: string // Added for sold out checking
// //   }>
// //   status: string
// //   ageLimit?: string
// //   capacity?: number // Added for sold out checking
// // }

// // const AGE_RESTRICTIONS = ["3+", "13+", "18+", "21+", "25+"]

// // // Function to check if event is sold out
// // const isEventSoldOut = (event: Event) => {
// //   const now = new Date()

// //   // Check if event date has passed
// //   if (new Date(event.startDate) <= now) {
// //     return true
// //   }

// //   // Check if all ticket types are sold out or expired
// //   if (event.ticketTypes && event.ticketTypes.length > 0) {
// //     return event.ticketTypes.every((ticket) => {
// //       // Check if quantity is 0
// //       if (ticket.quantity === 0) {
// //         return true
// //       }
// //       // Check if ticket type has an end date and it has passed
// //       if (ticket.endDate && new Date(ticket.endDate) <= now) {
// //         return true
// //       }
// //       return false
// //     })
// //   }

// //   return false
// // }

// // export default function EventSearchPage() {
// //   const [isClient, setIsClient] = useState(false)
// //   const [events, setEvents] = useState<Event[]>([])
// //   const [filteredEvents, setFilteredEvents] = useState<Event[]>([])
// //   const [isLoading, setIsLoading] = useState(true)
// //   const [selectedCategories, setSelectedCategories] = useState<string[]>([])
// //   const [categoriesFromEvents, setCategoriesFromEvents] = useState<string[]>([])
// //   const [selectedAge, setSelectedAge] = useState<string>("")
// //   const [priceRange, setPriceRange] = useState<[number, number]>([0, 2000])
// //   const [sortBy, setSortBy] = useState<string>("newest")
// //   const [currentPage, setCurrentPage] = useState(1)
// //   const [showSoldOut, setShowSoldOut] = useState<boolean>(true) // New state for showing/hiding sold out events
// //   const [isFilterOpen, setIsFilterOpen] = useState(false) // Mobile filter sheet state
// //   const eventsPerPage = 9
// //   const [wishlist, setWishlist] = useState<string[]>([])
// //   const [isWishlistLoading, setIsWishlistLoading] = useState(false)
// //   const { user } = useAuthStore()
// //   const router = useRouter()

// //   useEffect(() => {
// //     setIsClient(true)
// //     fetchEvents()
// //   }, [])

// //   useEffect(() => {
// //     if (isClient && user?.role === "organizer") {
// //       router.replace("/organizer/events")
// //     }
// //   }, [isClient, user, router])

// //   useEffect(() => {
// //     filterEvents()
// //   }, [events, selectedCategories, selectedAge, priceRange, sortBy, showSoldOut])

// //   useEffect(() => {
// //     const fetchWishlist = async () => {
// //       try {
// //         const storedAuth = localStorage.getItem("auth-storage")
// //         if (!storedAuth) {
// //           const localWishlist = localStorage.getItem("event-wishlist")
// //           if (localWishlist) setWishlist(JSON.parse(localWishlist))
// //           return
// //         }

// //         const parsedAuth = JSON.parse(storedAuth)
// //         const userId = parsedAuth.state?.user?.id || parsedAuth.state?.user?._id

// //         if (!userId) {
// //           const localWishlist = localStorage.getItem("event-wishlist")
// //           if (localWishlist) setWishlist(JSON.parse(localWishlist))
// //           return
// //         }

// //         const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/events/${userId}/wishlist`)
// //         if (!response.ok) throw new Error("Failed to fetch wishlist")

// //         const data = await response.json()
// //         if (data.data && Array.isArray(data.data)) {
// //           const wishlistIds = data.data.map((item: any) => item.eventId || item._id)
// //           setWishlist(wishlistIds)
// //         }
// //       } catch {
// //         const localWishlist = localStorage.getItem("event-wishlist")
// //         if (localWishlist) setWishlist(JSON.parse(localWishlist))
// //       }
// //     }

// //     fetchWishlist()
// //   }, [])

// //   const fetchEvents = async () => {
// //     try {
// //       setIsLoading(true)
// //       const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/events`)
// //       if (!response.ok) throw new Error("Failed to fetch events")

// //       const data = await response.json()
// //       const categories = Array.from(
// //         new Set(data.data.map((event: Event) => event.category?.name || "Uncategorized")),
// //       ) as string[]

// //       setCategoriesFromEvents(categories)
// //       setEvents(data.data)
// //       setFilteredEvents(data.data)
// //     } catch (error) {
// //       console.error("Error fetching events:", error)
// //       toast.error("Failed to fetch events")
// //     } finally {
// //       setIsLoading(false)
// //     }
// //   }

// //   const filterEvents = () => {
// //     let filtered = [...events]

// //     // Filter by categories
// //     if (selectedCategories.length > 0) {
// //       filtered = filtered.filter((event) => selectedCategories.includes(event.category?.name || "Uncategorized"))
// //     }

// //     // Filter by age
// //     if (selectedAge) {
// //       const selected = Number.parseInt(selectedAge)
// //       filtered = filtered.filter((event) => {
// //         const eventAge = Number.parseInt(event.ageLimit || "0")
// //         return eventAge <= selected
// //       })
// //     }

// //     // Filter by price range
// //     filtered = filtered.filter((event) => {
// //       const prices = event.ticketTypes.map((t) => t.price)
// //       const minPrice = prices.length ? Math.min(...prices) : 0
// //       return minPrice >= priceRange[0] && minPrice <= priceRange[1]
// //     })

// //     // Filter by sold out status
// //     if (!showSoldOut) {
// //       filtered = filtered.filter((event) => !isEventSoldOut(event))
// //     }

// //     // Sort events
// //     filtered.sort((a, b) => {
// //       const priceA = Math.min(...a.ticketTypes.map((t) => t.price))
// //       const priceB = Math.min(...b.ticketTypes.map((t) => t.price))

// //       switch (sortBy) {
// //         case "price-low":
// //           return priceA - priceB
// //         case "price-high":
// //           return priceB - priceA
// //         case "newest":
// //           return new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
// //         case "popular":
// //           return 0
// //         case "availability": // New sort option - available events first
// //           const aSoldOut = isEventSoldOut(a)
// //           const bSoldOut = isEventSoldOut(b)
// //           if (aSoldOut && !bSoldOut) return 1
// //           if (!aSoldOut && bSoldOut) return -1
// //           return new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
// //         default:
// //           return 0
// //       }
// //     })

// //     setFilteredEvents(filtered)
// //     setCurrentPage(1)
// //   }

// //   const handleCategoryChange = (category: string) => {
// //     setSelectedCategories((prev) =>
// //       prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category],
// //     )
// //   }

// //   const handleAgeChange = (age: string) => {
// //     setSelectedAge((prev) => (prev === age ? "" : age))
// //   }

// //   const removeCategory = (category: string) => {
// //     setSelectedCategories((prev) => prev.filter((c) => c !== category))
// //   }

// //   const clearAllFilters = () => {
// //     setSelectedCategories([])
// //     setSelectedAge("")
// //     setPriceRange([0, 2000])
// //     setShowSoldOut(true)
// //   }

// //   const indexOfLastEvent = currentPage * eventsPerPage
// //   const indexOfFirstEvent = indexOfLastEvent - eventsPerPage
// //   const currentEvents = filteredEvents.slice(indexOfFirstEvent, indexOfLastEvent)
// //   const totalPages = Math.ceil(filteredEvents.length / eventsPerPage)

// //   // Count sold out events for display
// //   const soldOutCount = filteredEvents.filter((event) => isEventSoldOut(event)).length
// //   const availableCount = filteredEvents.length - soldOutCount

// //   // Count active filters
// //   const activeFiltersCount =
// //     selectedCategories.length +
// //     (selectedAge ? 1 : 0) +
// //     (!showSoldOut ? 1 : 0) +
// //     (priceRange[0] !== 0 || priceRange[1] !== 2000 ? 1 : 0)

// //   const toggleWishlist = async (eventId: string) => {
// //     try {
// //       setIsWishlistLoading(true)
// //       const storedAuth = localStorage.getItem("auth-storage")
// //       let userId

// //       if (storedAuth) {
// //         const parsedAuth = JSON.parse(storedAuth)
// //         userId = parsedAuth.state?.user?.id || parsedAuth.state?.user?._id
// //       }

// //       const isRemoving = wishlist.includes(eventId)
// //       const newWishlist = isRemoving ? wishlist.filter((id) => id !== eventId) : [...wishlist, eventId]

// //       setWishlist(newWishlist)
// //       localStorage.setItem("event-wishlist", JSON.stringify(newWishlist))

// //       if (userId) {
// //         await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/events/${userId}/wishlist`, {
// //           method: "POST",
// //           headers: { "Content-Type": "application/json" },
// //           body: JSON.stringify({ eventId }),
// //         })
// //       }

// //       toast.success(isRemoving ? "Removed from wishlist" : "Added to wishlist")
// //     } catch (error) {
// //       toast.error("Failed to update wishlist")
// //     } finally {
// //       setIsWishlistLoading(false)
// //     }
// //   }

// //   // Filter content component to avoid duplication
// //   const FilterContent = () => (
// //     <div className="space-y-6">
// //       <div>
// //         <h3 className="text-lg font-medium mb-4">Categories</h3>
// //         <div className="space-y-3">
// //           {categoriesFromEvents.map((category) => (
// //             <div key={category} className="flex items-center space-x-2">
// //               <Checkbox
// //                 id={`${category}-mobile`}
// //                 checked={selectedCategories.includes(category)}
// //                 onCheckedChange={() => handleCategoryChange(category)}
// //               />
// //               <label htmlFor={`${category}-mobile`} className="text-sm font-medium leading-none">
// //                 {category}
// //               </label>
// //             </div>
// //           ))}
// //         </div>
// //       </div>

// //       <div className="border-t pt-6">
// //         <h3 className="text-lg font-medium mb-4">Age</h3>
// //         <div className="flex flex-wrap gap-3">
// //           {AGE_RESTRICTIONS.map((age) => (
// //             <Button
// //               key={age}
// //               variant={selectedAge === age ? "default" : "outline"}
// //               size="sm"
// //               className="rounded-full"
// //               onClick={() => handleAgeChange(age)}
// //             >
// //               {age}
// //             </Button>
// //           ))}
// //         </div>
// //       </div>

// //       <div className="border-t pt-6">
// //         <h3 className="text-lg font-medium mb-4">Price</h3>
// //         <Slider
// //           defaultValue={[0, 2000]}
// //           max={2000}
// //           step={100}
// //           value={priceRange}
// //           onValueChange={(value) => setPriceRange(value as [number, number])}
// //           className="my-8"
// //         />
// //         <div className="flex justify-between">
// //           <span className="text-sm">{priceRange[0]} ETB</span>
// //           <span className="text-sm">{priceRange[1]} ETB</span>
// //         </div>
// //       </div>

// //       <div className="border-t pt-6">
// //         <h3 className="text-lg font-medium mb-4">Availability</h3>
// //         <div className="flex items-center space-x-2">
// //           <Checkbox id="show-sold-out-mobile" checked={showSoldOut} onCheckedChange={setShowSoldOut} />
// //           <label htmlFor="show-sold-out-mobile" className="text-sm font-medium leading-none">
// //             Show sold out events
// //           </label>
// //         </div>
// //         <div className="mt-3 text-xs text-gray-500">
// //           <p>
// //             {availableCount} available • {soldOutCount} sold out
// //           </p>
// //         </div>
// //       </div>

// //       {activeFiltersCount > 0 && (
// //         <div className="border-t pt-6">
// //           <Button variant="outline" onClick={clearAllFilters} className="w-full bg-transparent">
// //             Clear All Filters
// //           </Button>
// //         </div>
// //       )}
// //     </div>
// //   )

// //   return (
// //     <div className="container mx-auto px-4 sm:px-6 py-8">
// //       <nav className="flex items-center text-sm text-gray-500 mb-8">
// //         <Link href="/" className="hover:text-[#0D47A1]">
// //           Home
// //         </Link>
// //         <span className="mx-2">/</span>
// //         <Link href="/search" className="hover:text-[#0D47A1]">
// //           Search
// //         </Link>
// //         <span className="mx-2">/</span>
// //         <span className="text-gray-900">Events</span>
// //       </nav>

// //       <div className="flex flex-col lg:flex-row gap-8">
// //         {/* Desktop Sidebar */}
// //         <div className="hidden lg:block w-full lg:w-72 flex-shrink-0">
// //           <div className="mb-8">
// //             <h2 className="text-lg font-medium mb-4">Applied Filters:</h2>
// //             <div className="flex flex-wrap gap-2">
// //               {selectedCategories.map((category) => (
// //                 <Badge key={category} variant="outline" className="flex items-center gap-1 px-3 py-1 rounded-full">
// //                   {category}
// //                   <button className="ml-1" onClick={() => removeCategory(category)}>
// //                     <X className="h-4 w-4" />
// //                   </button>
// //                 </Badge>
// //               ))}
// //               {!showSoldOut && (
// //                 <Badge variant="outline" className="flex items-center gap-1 px-3 py-1 rounded-full">
// //                   Hide Sold Out
// //                   <button className="ml-1" onClick={() => setShowSoldOut(true)}>
// //                     <X className="h-4 w-4" />
// //                   </button>
// //                 </Badge>
// //               )}
// //             </div>
// //           </div>

// //           <div className="border rounded-lg p-6">
// //             <FilterContent />
// //           </div>
// //         </div>

// //         <div className="flex-1">
// //           {/* Mobile Filter Bar */}
// //           <div className="lg:hidden mb-6">
// //             <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
// //               <div className="flex flex-wrap gap-2">
// //                 {selectedCategories.map((category) => (
// //                   <Badge
// //                     key={category}
// //                     variant="outline"
// //                     className="flex items-center gap-1 px-2 py-1 rounded-full text-xs"
// //                   >
// //                     {category}
// //                     <button className="ml-1" onClick={() => removeCategory(category)}>
// //                       <X className="h-3 w-3" />
// //                     </button>
// //                   </Badge>
// //                 ))}
// //                 {!showSoldOut && (
// //                   <Badge variant="outline" className="flex items-center gap-1 px-2 py-1 rounded-full text-xs">
// //                     Hide Sold Out
// //                     <button className="ml-1" onClick={() => setShowSoldOut(true)}>
// //                       <X className="h-3 w-3" />
// //                     </button>
// //                   </Badge>
// //                 )}
// //               </div>

// //               <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
// //                 <SheetTrigger asChild>
// //                   <Button variant="outline" className="flex items-center gap-2 whitespace-nowrap bg-transparent">
// //                     <SlidersHorizontal className="h-4 w-4" />
// //                     Filters
// //                     {activeFiltersCount > 0 && (
// //                       <Badge
// //                         variant="secondary"
// //                         className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
// //                       >
// //                         {activeFiltersCount}
// //                       </Badge>
// //                     )}
// //                   </Button>
// //                 </SheetTrigger>
// //                 <SheetContent side="left" className="w-[300px] sm:w-[400px]">
// //                   <SheetHeader>
// //                     <SheetTitle>Filter Events</SheetTitle>
// //                     <SheetDescription>Refine your search to find the perfect events</SheetDescription>
// //                   </SheetHeader>
// //                   <div className="mt-6">
// //                     <FilterContent />
// //                   </div>
// //                 </SheetContent>
// //               </Sheet>
// //             </div>
// //           </div>

// //           {/* Results Header */}
// //           <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
// //             <p className="text-gray-600 text-sm sm:text-base">
// //               Showing {indexOfFirstEvent + 1}-{Math.min(indexOfLastEvent, filteredEvents.length)} of{" "}
// //               {filteredEvents.length} Results
// //               {soldOutCount > 0 && (
// //                 <span className="text-xs sm:text-sm text-gray-500 block sm:inline sm:ml-2">
// //                   ({availableCount} available, {soldOutCount} sold out)
// //                 </span>
// //               )}
// //             </p>
// //             <div className="flex items-center w-full sm:w-auto">
// //               <Select value={sortBy} onValueChange={setSortBy}>
// //                 <SelectTrigger className="w-full sm:w-[180px]">
// //                   <SelectValue placeholder="Sort by" />
// //                 </SelectTrigger>
// //                 <SelectContent>
// //                   <SelectItem value="availability">Availability</SelectItem>
// //                   <SelectItem value="price-low">Price: Low to High</SelectItem>
// //                   <SelectItem value="price-high">Price: High to Low</SelectItem>
// //                   <SelectItem value="newest">Newest First</SelectItem>
// //                   <SelectItem value="popular">Most Popular</SelectItem>
// //                 </SelectContent>
// //               </Select>
// //             </div>
// //           </div>

// //           {currentEvents.length === 0 && !isLoading && (
// //             <p className="text-center text-gray-500 mt-10">No events match your filters.</p>
// //           )}

// //           {isClient ? (
// //             <Suspense
// //               fallback={
// //                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-8">
// //                   {Array(6)
// //                     .fill(0)
// //                     .map((_, index) => (
// //                       <EventCardSkeleton key={index} />
// //                     ))}
// //                 </div>
// //               }
// //             >
// //               <EventGrid
// //                 events={currentEvents}
// //                 wishlist={wishlist}
// //                 onToggleWishlist={toggleWishlist}
// //                 isWishlistLoading={isWishlistLoading}
// //                 isEventSoldOut={isEventSoldOut} // Pass the sold out function
// //               />
// //             </Suspense>
// //           ) : (
// //             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-8">
// //               {Array(6)
// //                 .fill(0)
// //                 .map((_, index) => (
// //                   <EventCardSkeleton key={index} />
// //                 ))}
// //             </div>
// //           )}

// //           {totalPages > 1 && (
// //             <div className="flex justify-center mt-12">
// //               <nav className="flex items-center gap-2">
// //                 <Button
// //                   variant="outline"
// //                   size="icon"
// //                   className="w-9 h-9 bg-transparent"
// //                   onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
// //                   disabled={currentPage === 1}
// //                 >
// //                   <span className="sr-only">Previous page</span>
// //                   <ChevronDown className="h-4 w-4 rotate-90" />
// //                 </Button>
// //                 {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
// //                   let pageNumber
// //                   if (totalPages <= 5) {
// //                     pageNumber = i + 1
// //                   } else if (currentPage <= 3) {
// //                     pageNumber = i + 1
// //                   } else if (currentPage >= totalPages - 2) {
// //                     pageNumber = totalPages - 4 + i
// //                   } else {
// //                     pageNumber = currentPage - 2 + i
// //                   }

// //                   return (
// //                     <Button
// //                       key={pageNumber}
// //                       variant={currentPage === pageNumber ? "default" : "outline"}
// //                       size="sm"
// //                       className={`w-9 h-9 ${currentPage === pageNumber ? "bg-[#0D47A1] text-white hover:bg-[#0D47A1]/90" : ""}`}
// //                       onClick={() => setCurrentPage(pageNumber)}
// //                     >
// //                       {pageNumber}
// //                     </Button>
// //                   )
// //                 })}
// //                 <Button
// //                   variant="outline"
// //                   size="icon"
// //                   className="w-9 h-9 bg-transparent"
// //                   onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
// //                   disabled={currentPage === totalPages}
// //                 >
// //                   <span className="sr-only">Next page</span>
// //                   <ChevronDown className="h-4 w-4 -rotate-90" />
// //                 </Button>
// //               </nav>
// //             </div>
// //           )}
// //         </div>
// //       </div>
// //     </div>
// //   )
// // }

// "use client"

// import Link from "next/link"
// import { Suspense, lazy, useEffect, useState } from "react"
// import { ChevronDown, X, SlidersHorizontal, Filter, Users, DollarSign, Eye } from "lucide-react"
// import { Button } from "@/components/ui/button"
// import { Checkbox } from "@/components/ui/checkbox"
// import { Slider } from "@/components/ui/slider"
// import { Badge } from "@/components/ui/badge"
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
// import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
// import { Separator } from "@/components/ui/separator"
// import EventCardSkeleton from "@/components/skeleton/event-card-skeleton"
// import { toast } from "sonner"
// import { useAuthStore } from "@/store/authStore"
// import { useRouter, useSearchParams } from "next/navigation"
// import { cn } from "@/lib/utils"

// const EventGrid = lazy(() => import("@/components/skeleton/event-grid"))

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
//   category: {
//     _id: string
//     name: string
//     description: string
//   }
//   coverImages: string[]
//   ticketTypes: Array<{
//     name: string
//     price: number
//     quantity: number
//     endDate?: string // Added for sold out checking
//   }>
//   status: string
//   ageLimit?: string
//   capacity?: number // Added for sold out checking
// }

// const AGE_RESTRICTIONS = ["3+", "13+", "18+", "21+", "25+"]

// // Function to check if event is sold out
// const isEventSoldOut = (event: Event) => {
//   const now = new Date()

//   // Check if event date has passed
//   if (new Date(event.startDate) <= now) {
//     return true
//   }

//   // Check if all ticket types are sold out or expired
//   if (event.ticketTypes && event.ticketTypes.length > 0) {
//     return event.ticketTypes.every((ticket) => {
//       // Check if quantity is 0
//       if (ticket.quantity === 0) {
//         return true
//       }
//       // Check if ticket type has an end date and it has passed
//       if (ticket.endDate && new Date(ticket.endDate) <= now) {
//         return true
//       }
//       return false
//     })
//   }

//   return false
// }

// export default function EventSearchPage() {
//   const [isClient, setIsClient] = useState(false)
//   const [events, setEvents] = useState<Event[]>([])
//   const [filteredEvents, setFilteredEvents] = useState<Event[]>([])
//   const [isLoading, setIsLoading] = useState(true)
//   const [selectedCategories, setSelectedCategories] = useState<string[]>([])
//   const [categoriesFromEvents, setCategoriesFromEvents] = useState<string[]>([])
//   const [selectedAge, setSelectedAge] = useState<string>("")
//   const [priceRange, setPriceRange] = useState<[number, number]>([0, 2000])
//   const [sortBy, setSortBy] = useState<string>("newest")
//   const [currentPage, setCurrentPage] = useState(1)
//   const [showSoldOut, setShowSoldOut] = useState<boolean>(true) // New state for showing/hiding sold out events
//   const [isFilterOpen, setIsFilterOpen] = useState(false) // Mobile filter sheet state
//   const eventsPerPage = 9
//   const [wishlist, setWishlist] = useState<string[]>([])
//   const [isWishlistLoading, setIsWishlistLoading] = useState(false)
//   const { user } = useAuthStore()
//   const router = useRouter()
//   const searchParams = useSearchParams()

//   useEffect(() => {
//     setIsClient(true)
//     fetchEvents()
//   }, [])

//   // Handle URL parameters for category filtering
//   useEffect(() => {
//     const categoryParam = searchParams.get('category')
//     console.log('URL category parameter:', categoryParam) // Debug log
//     if (categoryParam) {
//       // Find the category name from events and set it as selected
//       const eventWithCategory = events.find(event => event.category?._id === categoryParam)
//       if (eventWithCategory?.category?.name) {
//         console.log('Setting selected category from URL:', eventWithCategory.category.name) // Debug log
//         setSelectedCategories([eventWithCategory.category.name])
//       }
//     }
//   }, [searchParams, events]) // Add events dependency to ensure events are loaded

//   useEffect(() => {
//     if (isClient && user?.role === "organizer") {
//       router.replace("/organizer/events")
//     }
//   }, [isClient, user, router])

//   useEffect(() => {
//     filterEvents()
//   }, [events, selectedCategories, selectedAge, priceRange, sortBy, showSoldOut])

//   useEffect(() => {
//     const fetchWishlist = async () => {
//       try {
//         const storedAuth = localStorage.getItem("auth-storage")
//         if (!storedAuth) {
//           const localWishlist = localStorage.getItem("event-wishlist")
//           if (localWishlist) setWishlist(JSON.parse(localWishlist))
//           return
//         }

//         const parsedAuth = JSON.parse(storedAuth)
//         const userId = parsedAuth.state?.user?.id || parsedAuth.state?.user?._id

//         if (!userId) {
//           const localWishlist = localStorage.getItem("event-wishlist")
//           if (localWishlist) setWishlist(JSON.parse(localWishlist))
//           return
//         }

//         const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/events/${userId}/wishlist`)
//         if (!response.ok) throw new Error("Failed to fetch wishlist")

//         const data = await response.json()
//         if (data.data && Array.isArray(data.data)) {
//           const wishlistIds = data.data.map((item: any) => item.eventId || item._id)
//           setWishlist(wishlistIds)
//         }
//       } catch {
//         const localWishlist = localStorage.getItem("event-wishlist")
//         if (localWishlist) setWishlist(JSON.parse(localWishlist))
//       }
//     }

//     fetchWishlist()
//   }, [])

//   const fetchEvents = async () => {
//     try {
//       setIsLoading(true)
//       const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/events`)
//       if (!response.ok) throw new Error("Failed to fetch events")

//       const data = await response.json()
//       const categories = Array.from(
//         new Set(data.data.map((event: Event) => event.category?.name || "Uncategorized")),
//       ) as string[]

//       setCategoriesFromEvents(categories)
//       setEvents(data.data)
//       setFilteredEvents(data.data)
//     } catch (error) {
//       console.error("Error fetching events:", error)
//       toast.error("Failed to fetch events")
//     } finally {
//       setIsLoading(false)
//     }
//   }



//   const filterEvents = () => {
//     let filtered = [...events]

//     // Filter by categories
//     if (selectedCategories.length > 0) {
//       filtered = filtered.filter((event) => selectedCategories.includes(event.category?.name || "Uncategorized"))
//     } else {
//       // If no selected categories but URL has category parameter, filter by category ID
//       const categoryParam = searchParams.get('category')
//       if (categoryParam) {
//         filtered = filtered.filter((event) => event.category?._id === categoryParam)
//       }
//     }

//     // Filter by age
//     if (selectedAge) {
//       const selected = Number.parseInt(selectedAge)
//       filtered = filtered.filter((event) => {
//         const eventAge = Number.parseInt(event.ageLimit || "0")
//         return eventAge <= selected
//       })
//     }

//     // Filter by price range
//     filtered = filtered.filter((event) => {
//       const prices = event.ticketTypes.map((t) => t.price)
//       const minPrice = prices.length ? Math.min(...prices) : 0
//       return minPrice >= priceRange[0] && minPrice <= priceRange[1]
//     })

//     // Filter by sold out status
//     if (!showSoldOut) {
//       filtered = filtered.filter((event) => !isEventSoldOut(event))
//     }

//     // Sort events
//     filtered.sort((a, b) => {
//       const priceA = Math.min(...a.ticketTypes.map((t) => t.price))
//       const priceB = Math.min(...b.ticketTypes.map((t) => t.price))

//       switch (sortBy) {
//         case "price-low":
//           return priceA - priceB
//         case "price-high":
//           return priceB - priceA
//         case "newest":
//           return new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
//         case "popular":
//           return 0
//         case "availability": // New sort option - available events first
//           const aSoldOut = isEventSoldOut(a)
//           const bSoldOut = isEventSoldOut(b)
//           if (aSoldOut && !bSoldOut) return 1
//           if (!aSoldOut && bSoldOut) return -1
//           return new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
//         default:
//           return 0
//       }
//     })

//     setFilteredEvents(filtered)
//     setCurrentPage(1)
//   }

//   const handleCategoryChange = (category: string) => {
//     setSelectedCategories((prev) =>
//       prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category],
//     )
//   }

//   const handleAgeChange = (age: string) => {
//     setSelectedAge((prev) => (prev === age ? "" : age))
//   }

//   const removeCategory = (category: string) => {
//     setSelectedCategories((prev) => prev.filter((c) => c !== category))
//   }

//   const clearAllFilters = () => {
//     setSelectedCategories([])
//     setSelectedAge("")
//     setPriceRange([0, 2000])
//     setShowSoldOut(true)
//   }

//   const indexOfLastEvent = currentPage * eventsPerPage
//   const indexOfFirstEvent = indexOfLastEvent - eventsPerPage
//   const currentEvents = filteredEvents.slice(indexOfFirstEvent, indexOfLastEvent)
//   const totalPages = Math.ceil(filteredEvents.length / eventsPerPage)

//   // Count sold out events for display
//   const soldOutCount = filteredEvents.filter((event) => isEventSoldOut(event)).length
//   const availableCount = filteredEvents.length - soldOutCount

//   // Count active filters
//   const activeFiltersCount =
//     selectedCategories.length +
//     (selectedAge ? 1 : 0) +
//     (!showSoldOut ? 1 : 0) +
//     (priceRange[0] !== 0 || priceRange[1] !== 2000 ? 1 : 0)

//   const toggleWishlist = async (eventId: string) => {
//     try {
//       setIsWishlistLoading(true)
//       const storedAuth = localStorage.getItem("auth-storage")
//       let userId

//       if (storedAuth) {
//         const parsedAuth = JSON.parse(storedAuth)
//         userId = parsedAuth.state?.user?.id || parsedAuth.state?.user?._id
//       }

//       const isRemoving = wishlist.includes(eventId)
//       const newWishlist = isRemoving ? wishlist.filter((id) => id !== eventId) : [...wishlist, eventId]

//       setWishlist(newWishlist)
//       localStorage.setItem("event-wishlist", JSON.stringify(newWishlist))

//       if (userId) {
//         await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/events/${userId}/wishlist`, {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           body: JSON.stringify({ eventId }),
//         })
//       }

//       toast.success(isRemoving ? "Removed from wishlist" : "Added to wishlist")
//     } catch (error) {
//       toast.error("Failed to update wishlist")
//     } finally {
//       setIsWishlistLoading(false)
//     }
//   }

//   // Enhanced Filter content component for mobile with compact design
//   const MobileFilterContent = () => (
//     <div className="flex flex-col h-full p-2">
//       {/* Summary Stats - More Compact */}
//       <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
//         <div className="grid grid-cols-2 gap-4 text-center">
//           <div>
//             <div className="text-xl font-bold text-green-600">{availableCount}</div>
//             <div className="text-sm text-gray-600">Available</div>
//           </div>
//           <div>
//             <div className="text-xl font-bold text-red-600">{soldOutCount}</div>
//             <div className="text-sm text-gray-600">Sold Out</div>
//           </div>
//         </div>
//       </div>

//       {/* Scrollable Content - Reduced Spacing */}
//       <div className="flex-1 overflow-y-auto space-y-6 px-1">
//         {/* Categories Section - Compact */}
//         <div>
//           <div className="flex items-center gap-2 mb-4">
//             <Filter className="h-5 w-5 text-gray-600" />
//             <h3 className="text-lg font-medium">Categories</h3>
//             {selectedCategories.length > 0 && (
//               <Badge variant="secondary" className="text-xs">
//                 {selectedCategories.length}
//               </Badge>
//             )}
//           </div>
//           <div className="space-y-3">
//             {categoriesFromEvents.map((category) => (
//               <div
//                 key={category}
//                 className={cn(
//                   "flex items-center space-x-3 p-4 rounded-lg border transition-colors cursor-pointer",
//                   selectedCategories.includes(category)
//                     ? "bg-blue-50 border-blue-200"
//                     : "bg-white border-gray-200 hover:border-gray-300",
//                 )}
//                 onClick={() => handleCategoryChange(category)}
//               >
//                 <Checkbox
//                   id={`${category}-mobile`}
//                   checked={selectedCategories.includes(category)}
//                   onCheckedChange={() => handleCategoryChange(category)}
//                   className="h-4 w-4"
//                 />
//                 <label
//                   htmlFor={`${category}-mobile`}
//                   className="text-sm font-medium leading-none cursor-pointer flex-1"
//                 >
//                   {category}
//                 </label>
//               </div>
//             ))}
//           </div>
//         </div>

//         <Separator className="my-4" />

//         {/* Age Restrictions - Compact */}
//         <div>
//           <div className="flex items-center gap-2 mb-4">
//             <Users className="h-5 w-5 text-gray-600" />
//             <h3 className="text-lg font-medium">Age Restrictions</h3>
//             {selectedAge && (
//               <Badge variant="secondary" className="text-xs">
//                 {selectedAge}
//               </Badge>
//             )}
//           </div>
//           <div className="flex flex-wrap gap-3">
//             {AGE_RESTRICTIONS.map((age) => (
//               <Button
//                 key={age}
//                 variant={selectedAge === age ? "default" : "outline"}
//                 size="sm"
//                 className="rounded-full px-4 py-2"
//                 onClick={() => handleAgeChange(age)}
//               >
//                 {age}
//               </Button>
//             ))}
//           </div>
//         </div>

//         <Separator className="my-4" />

//         {/* Price Range - Compact */}
//         <div>
//           <div className="flex items-center gap-2 mb-4">
//             <DollarSign className="h-5 w-5 text-gray-600" />
//             <h3 className="text-lg font-medium">Price Range</h3>
//             <Badge variant="outline" className="text-xs">
//               {priceRange[0]} - {priceRange[1]} ETB
//             </Badge>
//           </div>
//           <div className="px-2">
//             <Slider
//               defaultValue={[0, 2000]}
//               max={2000}
//               step={100}
//               value={priceRange}
//               onValueChange={(value) => setPriceRange(value as [number, number])}
//               className="my-6"
//             />
//             <div className="flex justify-between text-sm font-medium">
//               <span className="bg-gray-100 px-3 py-2 rounded">{priceRange[0]} ETB</span>
//               <span className="bg-gray-100 px-3 py-2 rounded">{priceRange[1]} ETB</span>
//             </div>
//           </div>
//         </div>

//         <Separator className="my-4" />

//         {/* Availability - Compact */}
//         <div>
//           <div className="flex items-center gap-2 mb-3">
//             <Eye className="h-4 w-4 text-gray-600" />
//             <h3 className="text-base font-medium">Availability</h3>
//           </div>
//           <div
//             className={cn(
//               "flex items-center justify-between p-4 rounded-lg border transition-colors cursor-pointer",
//               showSoldOut ? "bg-blue-50 border-blue-200" : "bg-white border-gray-200 hover:border-gray-300",
//             )}
//             onClick={() => setShowSoldOut(!showSoldOut)}
//           >
//             <div className="flex items-center space-x-3">
//                               <Checkbox id="show-sold-out-mobile" checked={showSoldOut} onCheckedChange={(checked) => setShowSoldOut(checked === true)} />
//               <label htmlFor="show-sold-out-mobile" className="text-sm font-medium cursor-pointer">
//                 Show sold out events
//               </label>
//             </div>
//           </div>
//           <div className="mt-3 text-xs text-gray-500 px-4">
//             <p>
//               {availableCount} available • {soldOutCount} sold out
//             </p>
//           </div>
//         </div>
//       </div>

//       {/* Footer Actions - Compact */}
//       <div className="mt-6 pt-6 border-t space-y-3 px-2">
//         {activeFiltersCount > 0 && (
//           <Button variant="outline" onClick={clearAllFilters} className="w-full bg-transparent h-10">
//             <X className="h-4 w-4 mr-2" />
//             Clear All Filters ({activeFiltersCount})
//           </Button>
//         )}
//         <Button onClick={() => setIsFilterOpen(false)} className="w-full bg-[#0D47A1] hover:bg-[#0D47A1]/90 h-10">
//           Apply Filters
//         </Button>
//       </div>
//     </div>
//   )

//   // Desktop Filter content component (unchanged)
//   const DesktopFilterContent = () => (
//     <div className="space-y-6">
//       <div>
//         <h3 className="text-lg font-medium mb-4">Categories</h3>
//         <div className="space-y-3">
//           {categoriesFromEvents.map((category) => (
//             <div key={category} className="flex items-center space-x-2">
//               <Checkbox
//                 id={category}
//                 checked={selectedCategories.includes(category)}
//                 onCheckedChange={() => handleCategoryChange(category)}
//               />
//               <label htmlFor={category} className="text-sm font-medium leading-none">
//                 {category}
//               </label>
//             </div>
//           ))}
//         </div>
//       </div>

//       <div className="border-t pt-6">
//         <h3 className="text-lg font-medium mb-4">Age</h3>
//         <div className="flex flex-wrap gap-3">
//           {AGE_RESTRICTIONS.map((age) => (
//             <Button
//               key={age}
//               variant={selectedAge === age ? "default" : "outline"}
//               size="sm"
//               className="rounded-full"
//               onClick={() => handleAgeChange(age)}
//             >
//               {age}
//             </Button>
//           ))}
//         </div>
//       </div>

//       <div className="border-t pt-6">
//         <h3 className="text-lg font-medium mb-4">Price</h3>
//         <Slider
//           defaultValue={[0, 2000]}
//           max={2000}
//           step={100}
//           value={priceRange}
//           onValueChange={(value) => setPriceRange(value as [number, number])}
//           className="my-8"
//         />
//         <div className="flex justify-between">
//           <span className="text-sm">{priceRange[0]} ETB</span>
//           <span className="text-sm">{priceRange[1]} ETB</span>
//         </div>
//       </div>

//       <div className="border-t pt-6">
//         <h3 className="text-lg font-medium mb-4">Availability</h3>
//         <div className="flex items-center space-x-2">
//           <Checkbox id="show-sold-out" checked={showSoldOut} onCheckedChange={(checked) => setShowSoldOut(checked === true)} />
//           <label htmlFor="show-sold-out" className="text-sm font-medium leading-none">
//             Show sold out events
//           </label>
//         </div>
//         <div className="mt-3 text-xs text-gray-500">
//           <p>
//             {availableCount} available • {soldOutCount} sold out
//           </p>
//         </div>
//       </div>

//       {activeFiltersCount > 0 && (
//         <div className="border-t pt-6">
//           <Button variant="outline" onClick={clearAllFilters} className="w-full bg-transparent">
//             Clear All Filters
//           </Button>
//         </div>
//       )}
//     </div>
//   )

//   return (
//     <div className="container mx-auto px-4 sm:px-6 py-8">
//       <nav className="hidden sm:flex items-center text-sm text-gray-500 mb-8">
//         <Link href="/" className="hover:text-[#0D47A1]">
//           Home
//         </Link>
//         <span className="mx-2">/</span>
//         <Link href="/search" className="hover:text-[#0D47A1]">
//           Search
//         </Link>
//         <span className="mx-2">/</span>
//         <span className="text-gray-900">Events</span>
//       </nav>

//       <div className="flex flex-col lg:flex-row gap-8">
//         {/* Desktop Sidebar */}
//         <div className="hidden lg:block w-full lg:w-72 flex-shrink-0">
//           <div className="mb-8">
//             <h2 className="text-lg font-medium mb-4">Applied Filters:</h2>
//             <div className="flex flex-wrap gap-2">
//               {selectedCategories.map((category) => (
//                 <Badge key={category} variant="outline" className="flex items-center gap-1 px-3 py-1 rounded-full">
//                   {category}
//                   <button className="ml-1" onClick={() => removeCategory(category)}>
//                     <X className="h-4 w-4" />
//                   </button>
//                 </Badge>
//               ))}
//               {!showSoldOut && (
//                 <Badge variant="outline" className="flex items-center gap-1 px-3 py-1 rounded-full">
//                   Hide Sold Out
//                   <button className="ml-1" onClick={() => setShowSoldOut(true)}>
//                     <X className="h-4 w-4" />
//                   </button>
//                 </Badge>
//               )}
//             </div>
//           </div>

//           <div className="border rounded-lg p-6">
//             <DesktopFilterContent />
//           </div>
//         </div>

//         <div className="flex-1">
//           {/* Mobile Filter Bar */}
//           <div className="lg:hidden mb-6">
//             <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
//               <div className="flex flex-wrap gap-2">
//                 {selectedCategories.map((category) => (
//                   <Badge
//                     key={category}
//                     variant="outline"
//                     className="flex items-center gap-1 px-2 py-1 rounded-full text-xs"
//                   >
//                     {category}
//                     <button className="ml-1" onClick={() => removeCategory(category)}>
//                       <X className="h-3 w-3" />
//                     </button>
//                   </Badge>
//                 ))}
//                 {!showSoldOut && (
//                   <Badge variant="outline" className="flex items-center gap-1 px-2 py-1 rounded-full text-xs">
//                     Hide Sold Out
//                     <button className="ml-1" onClick={() => setShowSoldOut(true)}>
//                       <X className="h-3 w-3" />
//                     </button>
//                   </Badge>
//                 )}
//               </div>

//               <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
//                 <SheetTrigger asChild>
//                   <Button variant="outline" className="flex items-center gap-2 whitespace-nowrap bg-transparent">
//                     <SlidersHorizontal className="h-4 w-4" />
//                     Filters
//                     {activeFiltersCount > 0 && (
//                       <Badge
//                         variant="secondary"
//                         className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
//                       >
//                         {activeFiltersCount}
//                       </Badge>
//                     )}
//                   </Button>
//                 </SheetTrigger>
//                 <SheetContent side="left" className="w-[350px] sm:w-[400px]">
//                   <SheetHeader className="mb-4">
//                     <SheetTitle className="flex items-center gap-2 text-lg">
//                       <Filter className="h-4 w-4" />
//                       Filter Events
//                     </SheetTitle>
//                     <SheetDescription className="text-sm">
//                       Refine your search to find the perfect events
//                     </SheetDescription>
//                   </SheetHeader>
//                   <MobileFilterContent />
//                 </SheetContent>
//               </Sheet>
//             </div>
//           </div>

//           {/* Results Header */}
//           <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
//             <p className="text-gray-600 text-sm sm:text-base">
//               Showing {indexOfFirstEvent + 1}-{Math.min(indexOfLastEvent, filteredEvents.length)} of{" "}
//               {filteredEvents.length} Results
//               {soldOutCount > 0 && (
//                 <span className="text-xs sm:text-sm text-gray-500 block sm:inline sm:ml-2">
//                   ({availableCount} available, {soldOutCount} sold out)
//                 </span>
//               )}
//             </p>
//             <div className="flex items-center w-full sm:w-auto">
//               <Select value={sortBy} onValueChange={setSortBy}>
//                 <SelectTrigger className="w-full sm:w-[180px]">
//                   <SelectValue placeholder="Sort by" />
//                 </SelectTrigger>
//                 <SelectContent>
//                   <SelectItem value="availability">Availability</SelectItem>
//                   <SelectItem value="price-low">Price: Low to High</SelectItem>
//                   <SelectItem value="price-high">Price: High to Low</SelectItem>
//                   <SelectItem value="newest">Newest First</SelectItem>
//                   <SelectItem value="popular">Most Popular</SelectItem>
//                 </SelectContent>
//               </Select>
//             </div>
//           </div>

//           {currentEvents.length === 0 && !isLoading && (
//             <p className="text-center text-gray-500 mt-10">No events match your filters.</p>
//           )}

//           {isClient ? (
//             <Suspense
//               fallback={
//                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-8">
//                   {Array(6)
//                     .fill(0)
//                     .map((_, index) => (
//                       <EventCardSkeleton key={index} />
//                     ))}
//                 </div>
//               }
//             >
//               <EventGrid
//                 events={currentEvents}
//                 wishlist={wishlist}
//                 onToggleWishlist={toggleWishlist}
//                 isWishlistLoading={isWishlistLoading}
//                 isEventSoldOut={isEventSoldOut} // Pass the sold out function
//               />
//             </Suspense>
//           ) : (
//             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-8">
//               {Array(6)
//                 .fill(0)
//                 .map((_, index) => (
//                   <EventCardSkeleton key={index} />
//                 ))}
//             </div>
//           )}

//           {totalPages > 1 && (
//             <div className="flex justify-center mt-12">
//               <nav className="flex items-center gap-2">
//                 <Button
//                   variant="outline"
//                   size="icon"
//                   className="w-9 h-9 bg-transparent"
//                   onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
//                   disabled={currentPage === 1}
//                 >
//                   <span className="sr-only">Previous page</span>
//                   <ChevronDown className="h-4 w-4 rotate-90" />
//                 </Button>
//                 {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
//                   let pageNumber
//                   if (totalPages <= 5) {
//                     pageNumber = i + 1
//                   } else if (currentPage <= 3) {
//                     pageNumber = i + 1
//                   } else if (currentPage >= totalPages - 2) {
//                     pageNumber = totalPages - 4 + i
//                   } else {
//                     pageNumber = currentPage - 2 + i
//                   }

//                   return (
//                     <Button
//                       key={pageNumber}
//                       variant={currentPage === pageNumber ? "default" : "outline"}
//                       size="sm"
//                       className={`w-9 h-9 ${currentPage === pageNumber ? "bg-[#0D47A1] text-white hover:bg-[#0D47A1]/90" : ""}`}
//                       onClick={() => setCurrentPage(pageNumber)}
//                     >
//                       {pageNumber}
//                     </Button>
//                   )
//                 })}
//                 <Button
//                   variant="outline"
//                   size="icon"
//                   className="w-9 h-9 bg-transparent"
//                   onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
//                   disabled={currentPage === totalPages}
//                 >
//                   <span className="sr-only">Next page</span>
//                   <ChevronDown className="h-4 w-4 -rotate-90" />
//                 </Button>
//               </nav>
//             </div>
//           )}
//         </div>
//       </div>
//     </div>
//   )
// }



// event_explore/page.tsx
import { Suspense } from "react"
import EventSearchPage from "@/components/EventSearchPage"
export default function Page() {
  return (
    <Suspense fallback={<div>Loading event search page...</div>}>
      <EventSearchPage />
    </Suspense>
  )
}
