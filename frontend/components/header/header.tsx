// "use client"

// import type React from "react"
// import Link from "next/link"
// import { Input } from "@/components/ui/input"
// import { Button } from "@/components/ui/button"
// import { Search, User, Menu } from "lucide-react"
// import { useAuthStore } from "@/store/authStore"
// import { useRouter } from "next/navigation"
// import { useState, useEffect } from "react"
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
// import { Drawer, DrawerClose, DrawerContent, DrawerHeader, DrawerTrigger } from "@/components/ui/drawer"

// const Header = () => {
//   const router = useRouter()
//   const { user, logout } = useAuthStore()
//   const [searchTerm, setSearchTerm] = useState("")
//   const [categories, setCategories] = useState<string[]>([])
//   const [selectedCategory, setSelectedCategory] = useState<string>("")
//   const [isFocused, setIsFocused] = useState(false)
//   const [drawerOpen, setDrawerOpen] = useState(false)

//   useEffect(() => {
//     async function fetchCategories() {
//       try {
//         const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/events`)
//         if (!response.ok) throw new Error("Failed to fetch events")
//         const data = await response.json()
//         const cats = Array.from(
//           new Set(data.data.map((event: any) => event.category?.name || "Uncategorized")),
//         ) as string[]
//         setCategories(cats)
//       } catch (e) {
//         setCategories([])
//       }
//     }
//     fetchCategories()
//   }, [])

//   const handleLogout = () => {
//     logout()
//     router.push("/sign-in")
//   }

//   const handleUserClick = () => {
//     if (user?.role === "organizer") {
//       router.push("/organizer")
//     } 
//     else {
//       router.push("/my-account")
//     }
//   }

//   const handleSearch = (e: React.FormEvent) => {
//     e.preventDefault()
//     const params = []
//     if (searchTerm.trim()) params.push(`search=${encodeURIComponent(searchTerm.trim())}`)
//     if (selectedCategory && selectedCategory !== "all") params.push(`category=${encodeURIComponent(selectedCategory)}`)
//     const query = params.length ? `?${params.join("&")}` : ""
//     router.push(`/event_explore${query}`)
//   }

//   return (
//     <>
//       {/* Fixed header for mobile, normal for desktop */}
//       <header className="md:relative fixed top-0 left-0 right-0 z-50 py-4 px-4 sm:px-8 md:px-16 border-b border-gray-200 bg-white/95 md:bg-white backdrop-blur-sm transition-all duration-300 ease-out">
//         <div className="flex flex-row items-center justify-between md:flex-row md:items-center md:justify-between gap-4 md:gap-6">
//           {/* Logo */}
//           <Link href="/" className="flex items-center group">
//             <img
//               src="/logo.png"
//               alt="Pazimo"
//               className="w-20 md:w-40 lg:w-35 transition-transform duration-200 group-hover:scale-105"
//             />
//           </Link>

//           {/* Hamburger for mobile */}
//           <div className="flex md:hidden items-center">
//             <Drawer direction="right" open={drawerOpen} onOpenChange={setDrawerOpen}>
//               <DrawerTrigger asChild>
//                 <button
//                   className="p-2 rounded-md text-gray-700 hover:text-[#115db1] focus:outline-none focus:ring-2 focus:ring-[#115db1] transition-colors"
//                   aria-label="Open menu"
//                 >
//                   <Menu className="h-5 w-5 sm:h-6 sm:w-6" />
//                 </button>
//               </DrawerTrigger>
//               <DrawerContent className="w-72 max-w-[85vw] ml-auto rounded-l-xl p-0">
//                 <DrawerHeader className="border-b border-gray-100">
//                   <div className="w-full flex justify-center items-center py-4">
//                     <img src="/logo.png" alt="Pazimo" className="w-24 sm:w-28 mx-auto" />
//                   </div>
//                 </DrawerHeader>
//                 <nav className="flex flex-col gap-2 px-4 py-6">
//                   <Link
//                     href="/"
//                     className="text-gray-700 hover:text-[#115db1] hover:bg-blue-50 px-4 py-3 text-base font-medium transition-colors rounded-lg"
//                     onClick={() => setDrawerOpen(false)}
//                   >
//                     Home
//                   </Link>
//                   <Link
//                     href="/event_explore"
//                     className="text-gray-700 hover:text-[#115db1] hover:bg-blue-50 px-4 py-3 text-base font-medium transition-colors rounded-lg"
//                     onClick={() => setDrawerOpen(false)}
//                   >
//                     Explore Events
//                   </Link>
//                   {user ? (
//                     <>
//                       <button
//                         className="text-gray-700 hover:text-[#115db1] hover:bg-blue-50 px-4 py-3 text-base font-medium text-left transition-colors rounded-lg"
//                         onClick={() => {
//                           setDrawerOpen(false)
//                           handleUserClick()
//                         }}
//                       >
//                         My Account
//                       </button>
//                       <button
//                         className="text-gray-700 hover:text-[#115db1] hover:bg-blue-50 px-4 py-3 text-base font-medium text-left transition-colors rounded-lg"
//                         onClick={() => {
//                           setDrawerOpen(false)
//                           handleLogout()
//                         }}
//                       >
//                         Log out
//                       </button>
//                     </>
//                   ) : (
//                     <>
//                       <button
//                         className="text-gray-700 hover:text-[#115db1] hover:bg-blue-50 px-4 py-3 text-base font-medium text-left transition-colors rounded-lg"
//                         onClick={() => {
//                           setDrawerOpen(false)
//                           router.push("/sign-in")
//                         }}
//                       >
//                         Sign In
//                       </button>
//                       <button
//                         className="text-gray-700 hover:text-[#115db1] hover:bg-blue-50 px-4 py-3 text-base font-medium text-left transition-colors rounded-lg"
//                         onClick={() => {
//                           setDrawerOpen(false)
//                           router.push("/sign-up")
//                         }}
//                       >
//                         Sign Up
//                       </button>
//                     </>
//                   )}
//                 </nav>
//                 <div className="px-4 pb-6">
//                   <DrawerClose asChild>
//                     <button className="w-full px-4 py-3 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors font-medium">
//                       Close Menu
//                     </button>
//                   </DrawerClose>
//                 </div>
//               </DrawerContent>
//             </Drawer>
//           </div>

//           {/* Desktop: Search and user menu */}
//           <div className="hidden md:flex flex-1 items-center justify-center gap-6">
//             {/* Enhanced Search Bar - always visible in this header */}
//             <div className="w-full md:w-[500px] lg:w-[550px] xl:w-[600px]">
//               <form
//                 className={`relative flex items-center rounded-xl border overflow-hidden bg-white transition-all duration-300 ease-out ${
//                   isFocused
//                     ? "border-[#FFC107] shadow-lg  transform scale-[1.01]"
//                     : "border-gray-300 hover:border-yellow-400 hover:shadow-md shadow-sm"
//                 }`}
//                 onSubmit={handleSearch}
//               >
//                 <div className="flex items-center pl-4 pr-2 border-r border-gray-200 transition-all duration-300 ease-out">
//                   <Select value={selectedCategory} onValueChange={setSelectedCategory}>
//                     <SelectTrigger className="rounded-none border-0 bg-transparent h-10 min-w-[110px] text-gray-600 font-medium text-sm transition-all duration-200 ease-out hover:text-gray-800">
//                       <SelectValue placeholder="Category" />
//                     </SelectTrigger>
//                     <SelectContent className="rounded-xl border shadow-xl animate-in fade-in-0 zoom-in-95 duration-200">
//                       <SelectItem value="all" className="text-sm transition-colors duration-150 ease-out">
//                         All Categories
//                       </SelectItem>
//                       {categories.map((cat) => (
//                         <SelectItem key={cat} value={cat} className="text-sm transition-colors duration-150 ease-out">
//                           {cat}
//                         </SelectItem>
//                       ))}
//                     </SelectContent>
//                   </Select>
//                 </div>

//                 <div className="relative flex-1 group">
//                   <Input
//                     id="search-input"
//                     type="text"
//                     className="relative border-0 focus:ring-0 focus:outline-none h-10 bg-transparent px-4 text-gray-800 text-base font-medium placeholder:text-gray-400 transition-all duration-200 ease-out placeholder:transition-opacity placeholder:duration-300"
//                     value={searchTerm}
//                     onChange={(e) => setSearchTerm(e.target.value)}
//                     onFocus={() => setIsFocused(true)}
//                     onBlur={() => setIsFocused(false)}
//                     autoComplete="off"
//                     placeholder="Search events..."
//                   />
//                 </div>

//                 <Button
//                   type="submit"
//                   size="icon"
//                   className="h-10 w-10 bg-[#FFC107] hover:bg-[#FFC101] transition-all duration-300 ease-out rounded-l-none rounded-r-xl hover:shadow-lg hover:shadow-[#1a2d5a]/20 active:scale-95 group"
//                 >
//                   <Search className="h-4 w-4 text-white transition-transform duration-200 ease-out group-hover:scale-110 group-active:scale-95" />
//                 </Button>
//               </form>
//             </div>

//             {/* Enhanced User Menu - positioned absolutely to the right */}
//             <div className="absolute right-4 sm:right-8 md:right-16">
//               {user ? (
//                 <div className="flex items-center gap-3">
//                   <Button
//                     variant="ghost"
//                     className="text-[#1a2d5a] font-semibold hover:bg-gradient-to-r hover:from-[#ffc107]/10 hover:to-[#ffc107]/20 transition-all duration-200 rounded-xl px-4 py-2 h-auto"
//                     onClick={handleUserClick}
//                   >
//                     <div className="flex items-center gap-2">
//                       <div className="w-8 h-8 bg-gradient-to-r from-[#1a2d5a] to-[#2a4d7a] rounded-full flex items-center justify-center">
//                         <User className="h-4 w-4 text-white" />
//                       </div>
//                       <div className="flex flex-col items-start">
//                         <span className="text-sm">{user.firstName}</span>
//                         {/* Removed organizer specific badge */}
//                       </div>
//                     </div>
//                   </Button>
//                   <Button
//                     variant="outline"
//                     className="text-[#1a2d5a] border-2 border-[#1a2d5a] hover:bg-gradient-to-r hover:from-[#ffc107]/10 hover:to-[#ffc107]/20 hover:border-[#ffc107] transition-all duration-200 rounded-xl font-medium bg-transparent"
//                     onClick={handleLogout}
//                   >
//                     Log out
//                   </Button>
//                 </div>
//               ) : (
//                 <div className="flex items-center gap-3">
//                   <Button
//                     variant="ghost"
//                     className="text-[#1a2d5a] font-semibold hover:bg-gradient-to-r hover:from-[#ffc107]/10 hover:to-[#ffc107]/20 transition-all duration-200 rounded-xl"
//                     onClick={() => router.push("/sign-in")}
//                   >
//                     Sign In
//                   </Button>
//                   <Button
//                     className="bg-gradient-to-r from-[#1a2d5a] to-[#2a4d7a] hover:from-[#2a4d7a] hover:to-[#1a2d5a] text-white border-0 transition-all duration-200 rounded-xl font-medium shadow-lg hover:shadow-xl"
//                     onClick={() => router.push("/sign-up")}
//                   >
//                     Sign Up
//                   </Button>
//                 </div>
//               )}
//             </div>
//           </div>
//         </div>
//       </header>

//       {/* Spacer div to prevent content from being hidden behind fixed header on mobile */}
//       <div className="md:hidden h-20" />
//     </>
//   )
// }

// export default Header
"use client"

import type React from "react"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, User, Menu, X } from "lucide-react"
import { useAuthStore } from "@/store/authStore"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Drawer, DrawerClose, DrawerContent, DrawerHeader, DrawerTrigger } from "@/components/ui/drawer"

const Header = () => {
  const router = useRouter()
  const { user, logout } = useAuthStore()
  const [searchTerm, setSearchTerm] = useState("")
  const [categories, setCategories] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>("")
  const [isFocused, setIsFocused] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [showMobileSearch, setShowMobileSearch] = useState(false)

  useEffect(() => {
    async function fetchCategories() {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/events`)
        if (!response.ok) throw new Error("Failed to fetch events")
        const data = await response.json()
        const cats = Array.from(
          new Set(data.data.map((event: any) => event.category?.name || "Uncategorized")),
        ) as string[]
        setCategories(cats)
      } catch (e) {
        setCategories([])
      }
    }
    fetchCategories()
  }, [])

  const handleLogout = () => {
    logout()
    router.push("/sign-in")
  }

  const handleUserClick = () => {
    if (user?.role === "organizer") {
      router.push("/organizer")
    } 
    else {
      router.push("/my-account")
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const params = []
    if (searchTerm.trim()) params.push(`search=${encodeURIComponent(searchTerm.trim())}`)
    if (selectedCategory && selectedCategory !== "all") params.push(`category=${encodeURIComponent(selectedCategory)}`)
    const query = params.length ? `?${params.join("&")}` : ""
    router.push(`/event_explore${query}`)
    setShowMobileSearch(false)
  }

  return (
    <>
      {/* Fixed header for mobile, normal for desktop */}
      <header className="md:relative fixed top-0 left-0 right-0 z-50 py-3 px-4 sm:px-8 md:px-16 border-b border-gray-300 md:border-gray-200 bg-white/95 md:bg-white backdrop-blur-sm shadow-sm md:shadow-none transition-all duration-300 ease-out">
        <div className="flex items-center justify-between gap-3 md:gap-6">
          {/* Mobile: Logo, Search Icon/Bar, Hamburger */}
          {/* Mobile: Logo, Search Icon/Bar, Hamburger */}
<div className="flex md:hidden items-center justify-between w-full gap-3">
  {/* Logo - hide when search is active */}
  <Link href="/" className={`flex items-center group flex-shrink-0 transition-all duration-300 ${showMobileSearch ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
    <img
      src="/logo.png"
      alt="Pazimo"
      className="w-16 transition-transform duration-200 group-hover:scale-105"
    />
  </Link>

  {/* Mobile Search - show when active */}
  {showMobileSearch && (
    <div className="flex-1 animate-in slide-in-from-right-5 duration-300">
      <form
        className={`relative flex items-center rounded-lg border overflow-hidden bg-white transition-all duration-300 ease-out ${
          isFocused
            ? "border-[#FFC107] shadow-lg"
            : "border-gray-300 hover:border-yellow-400 shadow-sm"
        }`}
        onSubmit={handleSearch}
      >
        <div className="flex items-center pl-2 pr-1 border-r border-gray-200">
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="rounded-none border-0 bg-transparent h-8 min-w-[80px] text-gray-600 font-medium text-xs">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="relative flex-1 group">
          <Input
            id="search-input-mobile"
            type="text"
            className="relative border-0 focus:ring-0 focus:outline-none h-8 bg-transparent px-2 text-gray-800 text-sm font-medium placeholder:text-gray-400"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            autoComplete="off"
            placeholder="Search events..."
            autoFocus
          />
        </div>
        <Button
          type="submit"
          size="icon"
          className="h-8 w-8 bg-[#FFC107] hover:bg-[#FFC101] rounded-l-none rounded-r-lg"
        >
          <Search className="h-3 w-3 text-white" />
        </Button>
      </form>
    </div>
  )}

  {/* Right side: Search Icon and Hamburger/Close */}
  <div className="flex items-center gap-1 flex-shrink-0">
    {!showMobileSearch && (
      <Button
        variant="ghost"
        size="icon"
        className="p-2 text-gray-700 hover:text-[#115db1]"
        onClick={() => setShowMobileSearch(true)}
      >
        <Search className="h-5 w-5" />
      </Button>
    )}

    {showMobileSearch ? (
      <Button
        variant="ghost"
        size="icon"
        className="p-2 text-gray-700 hover:text-[#115db1]"
        onClick={() => setShowMobileSearch(false)}
      >
        <X className="h-5 w-5" />
      </Button>
    ) : (
      <Drawer direction="right" open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerTrigger asChild>
          <button
            className="p-2 rounded-md text-gray-700 hover:text-[#115db1] focus:outline-none focus:ring-2 focus:ring-[#115db1] transition-colors"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </DrawerTrigger>
        {/* Rest of drawer content remains the same */}

                  <DrawerContent className="w-72 max-w-[85vw] ml-auto rounded-l-xl p-0">
                    <DrawerHeader className="border-b border-gray-100">
                      <div className="w-full flex justify-center items-center py-4">
                        <img src="/logo.png" alt="Pazimo" className="w-24 sm:w-28 mx-auto" />
                      </div>
                    </DrawerHeader>
                    <nav className="flex flex-col gap-2 px-4 py-6">
                      <Link
                        href="/"
                        className="text-gray-700 hover:text-[#115db1] hover:bg-blue-50 px-4 py-3 text-base font-medium transition-colors rounded-lg"
                        onClick={() => setDrawerOpen(false)}
                      >
                        Home
                      </Link>
                      <Link
                        href="/event_explore"
                        className="text-gray-700 hover:text-[#115db1] hover:bg-blue-50 px-4 py-3 text-base font-medium transition-colors rounded-lg"
                        onClick={() => setDrawerOpen(false)}
                      >
                        Explore Events
                      </Link>
                      {user ? (
                        <>
                          <button
                            className="text-gray-700 hover:text-[#115db1] hover:bg-blue-50 px-4 py-3 text-base font-medium text-left transition-colors rounded-lg"
                            onClick={() => {
                              setDrawerOpen(false)
                              handleUserClick()
                            }}
                          >
                            My Account
                          </button>
                          <button
                            className="text-gray-700 hover:text-[#115db1] hover:bg-blue-50 px-4 py-3 text-base font-medium text-left transition-colors rounded-lg"
                            onClick={() => {
                              setDrawerOpen(false)
                              handleLogout()
                            }}
                          >
                            Log out
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="text-gray-700 hover:text-[#115db1] hover:bg-blue-50 px-4 py-3 text-base font-medium text-left transition-colors rounded-lg"
                            onClick={() => {
                              setDrawerOpen(false)
                              router.push("/sign-in")
                            }}
                          >
                            Sign In
                          </button>
                          {/* <button
                            className="text-gray-700 hover:text-[#115db1] hover:bg-blue-50 px-4 py-3 text-base font-medium text-left transition-colors rounded-lg"
                            onClick={() => {
                              setDrawerOpen(false)
                              router.push("/sign-in")
                            }}
                          >
                            Sign Up
                          </button> */}
                        </>
                      )}
                    </nav>
                    <div className="px-4 pb-6">
                      <DrawerClose asChild>
                        <button className="w-full px-4 py-3 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors font-medium">
                          Close Menu
                        </button>
                      </DrawerClose>
                    </div>
                  </DrawerContent>
                </Drawer>
              )}
            </div>
          </div>

          {/* Desktop: Logo */}
          <Link href="/" className="hidden md:flex items-center group flex-shrink-0">
            <img
              src="/logo.png"
              alt="Pazimo"
              className="w-40 lg:w-35 transition-transform duration-200 group-hover:scale-105"
            />
          </Link>

          {/* Desktop: Search and user menu */}
          <div className="hidden md:flex flex-1 items-center justify-center gap-6">
            <div className="w-full md:w-[500px] lg:w-[550px] xl:w-[600px]">
              <form
                className={`relative flex items-center rounded-xl border overflow-hidden bg-white transition-all duration-300 ease-out ${
                  isFocused
                    ? "border-[#FFC107] shadow-lg transform scale-[1.01]"
                    : "border-gray-300 hover:border-yellow-400 hover:shadow-md shadow-sm"
                }`}
                onSubmit={handleSearch}
              >
                <div className="flex items-center pl-3 pr-2 border-r border-gray-200 transition-all duration-300 ease-out">
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="rounded-none border-0 bg-transparent h-9 min-w-[110px] text-gray-600 font-medium text-sm transition-all duration-200 ease-out hover:text-gray-800">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border shadow-xl animate-in fade-in-0 zoom-in-95 duration-200">
                      <SelectItem value="all" className="text-sm transition-colors duration-150 ease-out">
                        All Categories
                      </SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat} className="text-sm transition-colors duration-150 ease-out">
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="relative flex-1 group">
                  <Input
                    id="search-input"
                    type="text"
                    className="relative border-0 focus:ring-0 focus:outline-none h-9 bg-transparent px-3 text-gray-800 text-base font-medium placeholder:text-gray-400 transition-all duration-200 ease-out placeholder:transition-opacity placeholder:duration-300"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    autoComplete="off"
                    placeholder="Search events..."
                  />
                </div>

                <Button
                  type="submit"
                  size="icon"
                  className="h-9 w-9 bg-[#FFC107] hover:bg-[#FFC101] transition-all duration-300 ease-out rounded-l-none rounded-r-xl hover:shadow-lg hover:shadow-[#1a2d5a]/20 active:scale-95 group"
                >
                  <Search className="h-4 w-4 text-white transition-transform duration-200 ease-out group-hover:scale-110 group-active:scale-95" />
                </Button>
              </form>
            </div>

            {/* Desktop User Menu */}
            <div className="absolute right-4 sm:right-8 md:right-16">
              {user ? (
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    className="text-[#1a2d5a] font-semibold hover:bg-gradient-to-r hover:from-[#ffc107]/10 hover:to-[#ffc107]/20 transition-all duration-200 rounded-xl px-4 py-2 h-auto"
                    onClick={handleUserClick}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-gradient-to-r from-[#1a2d5a] to-[#2a4d7a] rounded-full flex items-center justify-center">
                        <User className="h-4 w-4 text-white" />
                      </div>
                      <span className="text-sm">{user.firstName}</span>
                    </div>
                  </Button>
                  <Button
                    variant="outline"
                    className="text-[#1a2d5a] border-2 border-[#1a2d5a] hover:bg-gradient-to-r hover:from-[#ffc107]/10 hover:to-[#ffc107]/20 hover:border-[#ffc107] transition-all duration-200 rounded-xl font-medium bg-transparent"
                    onClick={handleLogout}
                  >
                    Log out
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  
                  <Button
                    className="bg-gradient-to-r from-[#1a2d5a] to-[#2a4d7a] hover:from-[#2a4d7a] hover:to-[#1a2d5a] text-white border-0 transition-all duration-200 rounded-xl font-medium shadow-lg hover:shadow-xl"
                    onClick={() => router.push("/sign-in")}

                  >
                     Sign In
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Spacer div to prevent content from being hidden behind fixed header on mobile */}
      <div className="md:hidden h-16" />
    </>
  )
}

export default Header
