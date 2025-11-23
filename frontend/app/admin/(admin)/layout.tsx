// // "use client"

// // import { usePathname, useRouter } from "next/navigation"
// // import AdminHeader from "@/components/admin-header/admin-header"
// // import AdminSidebar from "@/components/admin-sidebar/admin-sidebar"
// // import { useAdminAuthStore } from "@/store/adminAuthStore"
// // import { useAuthStore } from "@/store/authStore"
// // import { useEffect } from "react"

// // export default function AdminLayout({
// //   children,
// // }: {
// //   children: React.ReactNode
// // }) {
// //   const pathname = usePathname()
// //   const router = useRouter()
// //   const { admin, token } = useAdminAuthStore()
// //   const { user } = useAuthStore()
// //   const isAdminRoute = pathname.startsWith("/admin")
// //   const isLoginPage = pathname === "/admin/login"

// //   useEffect(() => {
// //     if (user?.role === "organizer") {
// //       router.push("/organizer")
// //     }
// //   }, [user, router])

// //   useEffect(() => {
// //     if (isAdminRoute && !isLoginPage && (!admin || !token)) {
// //       router.push('/admin/login')
// //     }
// //   }, [isAdminRoute, isLoginPage, admin, token, router])

// //   if (isLoginPage) {
// //     return <>{children}</>
// //   }

// //   if (!admin || !token) {
// //     return null
// //   }

// //   if (user?.role === "organizer") {
// //     return null
// //   }

// //   return (
// //     <>
// //       {isAdminRoute && (
// //         <div className="min-h-screen bg-gray-50">
// //           <div className="flex h-screen overflow-hidden">
// //             {/* Sidebar */}
// //             <div className="hidden md:flex md:flex-shrink-0">
// //               <AdminSidebar />
// //             </div>

// //             {/* Main Content */}
// //             <div className="flex flex-col flex-1 overflow-hidden">
// //               {/* Header */}
// //               <AdminHeader />
              
// //               {/* Main Content Area */}
// //               <main className="flex-1 overflow-y-auto">
// //                 {children}
// //               </main>
// //             </div>
// //           </div>
// //         </div>
// //       )}
// //     </>
// //   )
// // }


// "use client"

// import type React from "react"

// import { useState, useEffect } from "react"
// import { usePathname, useRouter } from "next/navigation"
// import AdminHeader from "@/components/admin-header/admin-header"
// import AdminSidebar from "@/components/admin-sidebar/admin-sidebar"
// import { useAdminAuthStore } from "@/store/adminAuthStore"
// import { useAuthStore } from "@/store/authStore"

// export default function AdminLayout({ children }: { children: React.ReactNode }) {
//   const pathname = usePathname()
//   const router = useRouter()
//   const { admin, token } = useAdminAuthStore()
//   const { user } = useAuthStore()

//   const isAdminRoute = pathname.startsWith("/admin")
//   const isLoginPage = pathname === "/admin/login"

//   const [isSidebarOpen, setIsSidebarOpen] = useState(false)

//   const toggleSidebar = () => {
//     setIsSidebarOpen(!isSidebarOpen)
//   }

//   const closeSidebar = () => {
//     setIsSidebarOpen(false)
//   }

//   useEffect(() => {
//     if (user?.role === "organizer") {
//       router.push("/organizer")
//     }
//   }, [user, router])

//   useEffect(() => {
//     if (isAdminRoute && !isLoginPage && (!admin || !token)) {
//       router.push("/admin/login")
//     }
//   }, [isAdminRoute, isLoginPage, admin, token, router])

//   if (isLoginPage) {
//     return <>{children}</>
//   }

//   if (!admin || !token) {
//     return null
//   }

//   if (user?.role === "organizer") {
//     return null
//   }

//   return (
//     <>
//       {isAdminRoute && (
//         <div className="min-h-screen bg-gray-50">
//           <div className="flex h-screen overflow-hidden">
//             {/* Sidebar */}
//             <div className="hidden md:flex md:flex-shrink-0">
//               <AdminSidebar open={isSidebarOpen} onClose={closeSidebar} />
//             </div>
//             {/* Main Content */}
//             <div className="flex flex-col flex-1 overflow-hidden lg:ml-[280px]">
//               {/* Header */}
//               <AdminHeader onMenuClick={toggleSidebar} />
//               {/* Main Content Area */}
//               <main className="flex-1 overflow-y-auto">{children}</main>
//             </div>
//           </div>
//         </div>
//       )}
//     </>
//   )
// }


"use client"

import type React from "react"

import { usePathname, useRouter } from "next/navigation"
import AdminHeader from "@/components/admin-header/admin-header"
import AdminSidebar from "@/components/admin-sidebar/admin-sidebar"
import { useAdminAuthStore } from "@/store/adminAuthStore"
import { useAuthStore } from "@/store/authStore"
import { useEffect, useState } from "react"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { admin, token } = useAdminAuthStore()
  const { user } = useAuthStore()
  const isAdminRoute = pathname.startsWith("/admin")
  const isLoginPage = pathname === "/admin/login"

  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen)
  }

  const closeSidebar = () => {
    setIsSidebarOpen(false)
  }

  useEffect(() => {
    if (user?.role === "organizer") {
      router.push("/organizer")
    }
  }, [user, router])

  useEffect(() => {
    if (isAdminRoute && !isLoginPage && (!admin || !token)) {
      router.push("/admin/login")
    }
  }, [isAdminRoute, isLoginPage, admin, token, router])

  if (isLoginPage) {
    return <>{children}</>
  }

  if (!admin || !token) {
    return null
  }

  // Allow both admin and partner roles
  if (admin?.role && admin.role !== 'admin' && admin.role !== 'partner') {
    router.push('/admin/login')
    return null
  }

  if (user?.role === "organizer") {
    return null
  }

  return (
    <>
      {isAdminRoute && (
        <div className="min-h-screen bg-gray-50">
          <div className="flex h-screen overflow-hidden">
            {/* Admin Sidebar - Removed the 'hidden md:flex' wrapper */}
            <AdminSidebar open={isSidebarOpen} onClose={closeSidebar} />
            {/* Main Content */}
            <div className="flex flex-col flex-1 overflow-hidden ">
              {/* Header */}
              <AdminHeader onMenuClick={toggleSidebar} />
              {/* Main Content Area */}
              <main className="flex-1 overflow-y-auto">{children}</main>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
