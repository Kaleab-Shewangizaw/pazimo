// "use client"

// import type React from "react"
// import { Inter } from "next/font/google"
// import { useEffect } from "react"
// import { useRouter } from "next/navigation"
// import { useAuthStore } from "@/store/authStore"
// // import { ThemeProvider } from "@/components/theme-provider"
// // import Sidebar from "@/components/sidebar"
// import Sidebar from "@/components/organizer-sidebar/sidebar"
// import { toast } from "sonner"

// const inter = Inter({ subsets: ["latin"] })

// export default function RootLayout({
//   children,
// }: {
//   children: React.ReactNode
// }) {
//   const router = useRouter()
//   const { isAuthenticated, user } = useAuthStore()

//   useEffect(() => {
//     if (!isAuthenticated || !user) {
//       toast.error('Please login to access organizer features')
//       router.push('/sign-in')
//       return
//     }

//     if (user.role !== 'organizer') {
//       toast.error('Only organizers can access this area')
//       router.push('/')
//       return
//     }
//   }, [isAuthenticated, user, router])

//   if (!isAuthenticated || !user || user.role !== 'organizer') {
//     return null
//   }

//   return (
//     <div className="flex min-h-screen">
//       <Sidebar />
//       <main className="flex-1 bg-gray-50">{children}</main>
//     </div>
//   )
// }

import type React from "react";
// import { Inter } from "next/font/google"
// import ClientLayout from "./clientLayout"
// import ClientLayout from "./clientLayout"
import ClientLayout from "./clientLayout";
// const inter = Inter({ subsets: ["latin"] })

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={"font-sans"}>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
