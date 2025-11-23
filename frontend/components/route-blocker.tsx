// "use client"
// import { useEffect } from "react"
// import { usePathname, useRouter } from "next/navigation"
// import { useAuthStore } from "@/store/authStore"

// export default function RouteBlocker() {
//   const router = useRouter()
//   const pathname = usePathname()
//   const { user } = useAuthStore()

//   useEffect(() => {
//     if (!user?.role) return
//     if (pathname === "/" || pathname.startsWith("/event_explore")) {
//       if (user.role === "organizer") {
//         router.replace("/organizer")
//       }
//     }
//   }, [user, pathname, router])

//   return null
// } 


"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useAuthStore } from "@/store/authStore"

export default function RouteBlocker() {
  const router = useRouter()
  const pathname = usePathname()
  const { user } = useAuthStore()

  useEffect(() => {
    // If no user role, or if the user is not logged in, do nothing.
    if (!user?.role) return

    // If the user is an 'organizer' and the current path does NOT start with '/organizer',
    // redirect them to the organizer dashboard.
    if (user.role === "organizer" && !pathname.startsWith("/organizer")) {
      router.replace("/organizer") // Redirect to the organizer dashboard
    }
    // Add similar logic for other roles if needed, e.g., 'admin'
    // if (user.role === "admin" && !pathname.startsWith("/admin")) {
    //   router.replace("/admin/dashboard")
    // }
  }, [user, pathname, router])

  return null
}
