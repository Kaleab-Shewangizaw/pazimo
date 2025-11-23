"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, CalendarDays, User, Bell, HelpCircle, LogOut, Wallet, X, QrCode, Mail } from "lucide-react"
import { useAuthStore } from "@/store/authStore"
import { useRouter } from "next/navigation"

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname()
  const { user, logout } = useAuthStore()
  const router = useRouter()

  const isActive = (path: string) => {
    return pathname === path
  }

  const handleLogout = () => {
    logout()
    router.push("/sign-in")
    onClose() // Close sidebar on logout
  }

  const handleLinkClick = () => {
    onClose() // Close sidebar when a link is clicked
  }

  return (
    <>
      {/* Sidebar */}
      <aside
        className={`bg-white w-full max-w-[280px] fixed inset-y-0 left-0 z-40 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        } lg:relative shadow-lg lg:shadow-md border-r border-gray-200`}
      >
        <div className="flex flex-col h-full">
          {/* Profile / Header Section */}
          <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center shadow-sm">
                  <User className="h-6 w-6 text-gray-500" />
                </div>
                <div>
                  <h2 className="font-bold text-lg">
                    {user?.firstName} {user?.lastName}
                  </h2>
                  {/* <p className="text-sm text-gray-500">{user?.email}</p> */}
                </div>

             
         
              </div>
              {/* Close button for mobile */}
              <button
                onClick={onClose}
                className="lg:hidden p-1.5 rounded-md hover:bg-white/50 transition-colors"
                aria-label="Close menu"
              >
                <X className="h-5 w-5 text-gray-600" />
              </button>
            </div>
            <div className="mt-4 text-sm font-medium text-gray-700">Menu</div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-3 sm:p-4 space-y-1 overflow-y-auto">
            <Link
              href="/organizer"
              onClick={handleLinkClick}
              className={`flex items-center gap-3 p-3 rounded-md transition-all duration-200 ${
                isActive("/organizer")
                  ? "bg-blue-50 text-blue-600 shadow-sm border border-blue-100"
                  : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <Home className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium text-sm sm:text-base">Dashboard</span>
            </Link>
            <Link
              href="/organizer/events"
              onClick={handleLinkClick}
              className={`flex items-center gap-3 p-3 rounded-md transition-all duration-200 ${
                isActive("/organizer/events")
                  ? "bg-blue-50 text-blue-600 shadow-sm border border-blue-100"
                  : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <CalendarDays className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium text-sm sm:text-base">Events</span>
            </Link>
            <Link
              href="/organizer/invitations"
              onClick={handleLinkClick}
              className={`flex items-center gap-3 p-3 rounded-md transition-all duration-200 ${
                isActive("/organizer/invitations")
                  ? "bg-blue-50 text-blue-600 shadow-sm border border-blue-100"
                  : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <Mail className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium text-sm sm:text-base">Invitations</span>
            </Link>
            {/* <Link
              href="/organizer/qr-scanner"
              onClick={handleLinkClick}
              className={`flex items-center gap-3 p-3 rounded-md transition-all duration-200 ${
                isActive("/organizer/qr-scanner")
                  ? "bg-blue-50 text-blue-600 shadow-sm border border-blue-100"
                  : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <QrCode className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium text-sm sm:text-base">QR Scanner</span>
            </Link> */}
            <Link
              href="/organizer/withdrawals"
              onClick={handleLinkClick}
              className={`flex items-center gap-3 p-3 rounded-md transition-all duration-200 ${
                isActive("/organizer/withdrawals")
                  ? "bg-blue-50 text-blue-600 shadow-sm border border-blue-100"
                  : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <Wallet className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium text-sm sm:text-base">Withdrawals</span>
            </Link>
            <Link
              href="/organizer/account"
              onClick={handleLinkClick}
              className={`flex items-center gap-3 p-3 rounded-md transition-all duration-200 ${
                isActive("/organizer/account")
                  ? "bg-blue-50 text-blue-600 shadow-sm border border-blue-100"
                  : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <User className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium text-sm sm:text-base">Account</span>
            </Link>

            <div className="pt-4 mt-4 border-t border-gray-200">
              <div className="text-xs sm:text-sm font-semibold mb-3 text-gray-500 uppercase tracking-wider px-3">
                Other
              </div>
              <Link
                href="/organizer/notifications"
                onClick={handleLinkClick}
                className={`flex items-center gap-3 p-3 rounded-md transition-all duration-200 ${
                  isActive("/organizer/notifications")
                    ? "bg-blue-50 text-blue-600 shadow-sm border border-blue-100"
                    : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <Bell className="h-5 w-5 flex-shrink-0" />
                <span className="font-medium text-sm sm:text-base">Notifications</span>
              </Link>
              <Link
                href="/organizer/help"
                onClick={handleLinkClick}
                className={`flex items-center gap-3 p-3 rounded-md transition-all duration-200 ${
                  isActive("/organizer/help")
                    ? "bg-blue-50 text-blue-600 shadow-sm border border-blue-100"
                    : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <HelpCircle className="h-5 w-5 flex-shrink-0" />
                <span className="font-medium text-sm sm:text-base">Help Center</span>
              </Link>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 p-3 rounded-md text-red-600 hover:bg-red-50 hover:text-red-700 transition-all duration-200 group"
              >
                <LogOut className="h-5 w-5 flex-shrink-0 group-hover:scale-110 transition-transform duration-200" />
                <span className="font-medium text-sm sm:text-base">Logout</span>
              </button>
            </div>
          </nav>
        </div>
      </aside>
      {/* Overlay for mobile */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 lg:hidden transition-opacity duration-300"
          onClick={onClose}
        />
      )}
    </>
  )
}
