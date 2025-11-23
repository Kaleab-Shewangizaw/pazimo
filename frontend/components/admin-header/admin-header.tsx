// "use client"

// import type React from "react"

// import { Button } from "@/components/ui/button"
// import { Input } from "@/components/ui/input"
// import { Users, Calendar, DollarSign, BarChart3, Search, Shield, Menu } from "lucide-react"
// import { useAdminAuthStore } from "@/store/adminAuthStore"
// import { useRouter } from "next/navigation"
// import { useState } from "react"

// export default function AdminHeader({ onMenuClick }: { onMenuClick?: () => void }) {
//   const { admin, logout } = useAdminAuthStore()
//   const router = useRouter()
//   const [searchTerm, setSearchTerm] = useState("")

//   const handleLogout = () => {
//     logout()
//     router.push("/admin/login")
//   }

//   const handleSearch = (e: React.FormEvent) => {
//     e.preventDefault()
//     // Add search functionality here
//     console.log("Searching for:", searchTerm)
//   }

//   return (
//     <>
//       {/* Fixed header for mobile, normal for desktop */}
//       <header className="md:relative fixed top-0 left-0 right-0 z-50 bg-white/95 md:bg-white backdrop-blur-sm border-b border-gray-200 px-4 sm:px-6 py-4 transition-all duration-300 ease-out">
//         <div className="flex items-center justify-between">
//           {/* Desktop Search Bar */}
//           <div className="hidden md:flex items-center gap-3">
//             {/* <div className="relative w-64 lg:w-80">
//               <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
//               <form onSubmit={handleSearch}>
//                 <Input
//                   placeholder="Search..."
//                   className="pl-10 h-10 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-lg transition-all duration-200"
//                   value={searchTerm}
//                   onChange={(e) => setSearchTerm(e.target.value)}
//                 />
//               </form>
//             </div> */}
//           </div>

//           {/* Mobile: Logo/Title */}
//           <div className="flex md:hidden items-center">
//             <h1 className="text-lg font-semibold text-gray-900">Admin Panel</h1>
//           </div>

//           {/* Mobile Hamburger Menu */}
//           <div className="flex md:hidden items-center">
//             <button
//               className="p-2 rounded-md text-gray-700 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
//               aria-label="Open menu"
//               onClick={onMenuClick}
//             >
//               <Menu className="h-5 w-5 sm:h-6 sm:w-6" />
//             </button>
//           </div>

//           {/* Desktop: Admin Info */}
//           <div className="hidden md:flex items-center gap-4">
//             <div className="flex items-center gap-3 bg-gray-50 rounded-lg px-4 py-2 hover:bg-gray-100 transition-colors">
//               <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
//                 <Shield className="h-5 w-5 text-blue-600" />
//               </div>
//               <div>
//                 <p className="text-sm font-medium text-gray-900">
//                   {admin ? `${admin.firstName} ${admin.lastName}` : "Admin User"}
//                 </p>
//                 <p className="text-xs text-gray-500">{admin?.email || "admin@example.com"}</p>
//               </div>
//               <Button
//                 variant="ghost"
//                 size="sm"
//                 onClick={handleLogout}
//                 className="text-gray-600 hover:text-red-600 hover:bg-red-50 transition-colors ml-2"
//               >
//                 Logout
//               </Button>
//             </div>
//           </div>
//         </div>
//       </header>
//       {/* Spacer div to prevent content from being hidden behind fixed header on mobile */}
//       <div className="md:hidden h-20" />
//     </>
//   )
// }



"use client"

import type React from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Shield, Menu } from "lucide-react"
import { useAdminAuthStore } from "@/store/adminAuthStore"
import { useRouter } from "next/navigation"
import { useState } from "react"

export default function AdminHeader({ onMenuClick }: { onMenuClick?: () => void }) {
  const { admin, logout } = useAdminAuthStore()
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState("")

  const handleLogout = () => {
    logout()
    router.push("/admin/login")
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    // Add search functionality here
    // console.log("Searching for:", searchTerm)
  }

  return (
    <>
      {/* Fixed header for mobile, normal for desktop */}
      <header className="md:relative fixed top-0 left-0 right-0 z-50 bg-white/95 md:bg-white backdrop-blur-sm border-b border-gray-200 px-4 sm:px-6 py-4 transition-all duration-300 ease-out">
        <div className="flex items-center justify-between">
          {/* Desktop Search Bar */}
          <div className="hidden md:flex items-center gap-3">
            <div className="relative w-64 lg:w-80">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <form onSubmit={handleSearch}>
                <Input
                  placeholder="Search..."
                  className="pl-10 h-10 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-lg transition-all duration-200"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </form>
            </div>
          </div>

          {/* Mobile: Logo/Title */}
          <div className="flex md:hidden items-center">
            <h1 className="text-lg font-semibold text-gray-900">Admin Panel</h1>
          </div>

          {/* Mobile Hamburger Menu */}
          <div className="flex md:hidden items-center">
            <button
              className="p-2 rounded-md text-gray-700 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              aria-label="Open menu"
              onClick={onMenuClick} // This will now trigger the parent's toggle function
            >
              <Menu className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          </div>

          {/* Desktop: Admin Info */}
          <div className="hidden md:flex items-center gap-4">
            <div className="flex items-center gap-3 bg-gray-50 rounded-lg px-4 py-2 hover:bg-gray-100 transition-colors">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Shield className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {admin ? `${admin.firstName} ${admin.lastName}` : "Admin User"}
                </p>
                <p className="text-xs text-gray-500">{admin?.email || "admin@example.com"}</p>
              </div>
             
            </div>
          </div>
        </div>
      </header>

      {/* Spacer div to prevent content from being hidden behind fixed header on mobile */}
      <div className="md:hidden h-20" />
    </>
  )
}
