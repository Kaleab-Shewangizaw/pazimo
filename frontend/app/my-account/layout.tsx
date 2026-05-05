import type React from "react"
import Link from "next/link"
import { Ticket, Heart, Gift, LogOut, User } from "lucide-react"

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="container mx-auto py-8 px-4">
      {/* Breadcrumb */}
      <div className="text-gray-600 dark:text-gray-400 mb-8 transition-colors">
        <Link href="/" className="hover:underline">
          Home
        </Link>
        <span className="mx-2">/</span>
        <span>My account</span>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar */}
        <div className="w-full md:w-64 shrink-0">
          <div className="bg-gray-50 dark:bg-[#1A1D24] rounded-lg overflow-hidden transition-colors">
            <Link href="/my-account" className="flex items-center gap-3 p-4 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
              <User className="h-5 w-5" />
              <span className="font-medium">Account Detail</span>
            </Link>

            <Link href="/my-account/tickets" className="flex items-center gap-3 p-4 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
              <Ticket className="h-5 w-5" />
              <span className="font-medium">My Tickets</span>
            </Link>

            <Link href="/my-account/wishlist" className="flex items-center gap-3 p-4 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
              <Heart className="h-5 w-5" />
              <span className="font-medium">Wishlist</span>
            </Link>

         
            {/* <Link href="/logout" className="flex items-center gap-3 p-4 text-red-600 hover:bg-gray-100">
              <LogOut className="h-5 w-5" />
              <span className="font-medium">Logout</span>
            </Link> */}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1">{children}</div>
      </div>
    </div>
  )
}
