"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Home,
  CalendarDays,
  User,
  Bell,
  HelpCircle,
  LogOut,
  Wallet,
  X,
  Mail,
  UsersIcon,
  Megaphone,
  ScanLine,
  ClipboardList,
  Banknote,
  Beer,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Button } from "../ui/button";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, token, logout } = useAuthStore();
  const router = useRouter();
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Matches the main site header's convention: blue wordmark on light
  // backgrounds, gold on dark — the brand block below now actually switches
  // background between the two, so the logo needs to switch with it.
  const logoSrc =
    mounted && (theme === "dark" || resolvedTheme === "dark")
      ? "/logo4.png"
      : "/logo3.png";
  // Non-eligible organizers must not see Pazimo Capital at all — this check
  // is a UX nicety on top of the real gate, which is the backend's
  // requireCapitalEligible middleware on every capital endpoint.
  const [capitalEligible, setCapitalEligible] = useState(false);
  // Same reasoning as capital above: hidden unless approved, on top of the
  // backend's requireBeverageEligible gate.
  const [beverageEligible, setBeverageEligible] = useState(false);

   const handleUserClick = () => {
    router.push("/organizer")
  }

  useEffect(() => {
    if (!token || user?.role !== "organizer") return;
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/capital/organizer/eligibility`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setCapitalEligible(data?.data?.eligibility === "eligible"))
      .catch(() => setCapitalEligible(false));

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/beverages/organizer/eligibility`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setBeverageEligible(data?.data?.eligibility === "eligible"))
      .catch(() => setBeverageEligible(false));
  }, [token, user?.role]);

  const isActive = (path: string) => {
    return pathname === path;
  };

  const handleLogout = () => {
    logout();
    router.push("/sign-in");
    onClose(); // Close sidebar on logout
  };

  const handleLinkClick = () => {
    onClose(); // Close sidebar when a link is clicked
  };

  return (
    <>
      {/* Sidebar */}
      <aside
        className={`bg-white dark:bg-black w-full max-w-[280px] fixed inset-y-0 left-0 z-40 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        } h-screen overflow-hidden lg:relative lg:top-0 lg:h-screen shadow-lg lg:shadow-md border-r border-gray-200 dark:border-gray-800 flex-shrink-0`}
      >
        <div className="flex flex-col h-full">
          {/* Brand Header */}
          <div className="relative overflow-hidden bg-white dark:bg-black">
            
            
            

            {/* Close button for mobile — absolute so it doesn't disturb centering */}
            <button
              onClick={onClose}
              className="lg:hidden absolute top-3 right-3 z-10 p-1.5 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-white/70 dark:hover:text-white dark:hover:bg-white/10 transition-colors"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>

             <Button
                variant="ghost"
                className="text-[#1a2d5a] font-semibold hover:bg-gradient-to-r h-auto pt-6 pb-3"
                onClick={handleUserClick}
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-r from-[#1a2d5a] to-[#2a4d7a] rounded-full flex items-center justify-center">
                    <User className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-sm dark:text-gray-300">{user?.firstName || "Organizer"}</span>
                    <span className="text-xs text-[#ffc107] font-medium">Organizer</span>
                  </div>
                </div>
              </Button>

            {/* Full-width divider */}
            <div className="h-px w-full bg-gradient-to-r from-transparent via-blue-300/70 dark:via-amber-300/50 to-transparent" />
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 space-y-1">
            <Link
              href="/organizer"
              onClick={handleLinkClick}
              className={`flex items-center gap-3 p-3 rounded-md transition-all duration-200 ${
                isActive("/organizer")
                  ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shadow-sm border border-blue-100 dark:border-blue-300/10"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-100"
              }`}
            >
              <Home className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium text-sm sm:text-base">
                Dashboard
              </span>
            </Link>
            <Link
              href="/organizer/events"
              onClick={handleLinkClick}
              className={`flex items-center gap-3 p-3 rounded-md transition-all duration-200 ${
                isActive("/organizer/events")
                  ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shadow-sm border border-blue-100 dark:border-blue-300/10"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-100"
              }`}
            >
              <CalendarDays className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium text-sm sm:text-base">Events</span>
            </Link>
            <Link
              href="/organizer/rsvp-builder"
              onClick={handleLinkClick}
              className={`flex items-center gap-3 p-3 rounded-md transition-all duration-200 ${
                isActive("/organizer/rsvp-builder")
                  ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shadow-sm border border-blue-100 dark:border-blue-300/10"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-100"
              }`}
            >
              <ClipboardList className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium text-sm sm:text-base">RSVP</span>
            </Link>
            <Link
              href="/organizer/invitations"
              onClick={handleLinkClick}
              className={`flex items-center gap-3 p-3 rounded-md transition-all duration-200 ${
                isActive("/organizer/invitations")
                  ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shadow-sm border border-blue-100 dark:border-blue-300/10"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-100"
              }`}
            >
              <Mail className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium text-sm sm:text-base">
                Invitations
              </span>
            </Link>
            <Link
              href="/organizer/customers"
              onClick={handleLinkClick}
              className={`flex items-center gap-3 p-3 rounded-md transition-all duration-200 ${
                isActive("/organizer/customers")
                  ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shadow-sm border border-blue-100 dark:border-blue-300/10"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-100"
              }`}
            >
              <UsersIcon className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium text-sm sm:text-base">
                Customers
              </span>
            </Link>
            {capitalEligible && (
              <Link
                href="/organizer/capital"
                onClick={handleLinkClick}
                className={`flex items-center gap-3 p-3 rounded-md transition-all duration-200 ${
                isActive("/organizer/capital")
                  ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shadow-sm border border-blue-100 dark:border-blue-300/10"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-100"
              }`}
              >
                
                  <Banknote className="h-5 w-5  dark:text-white" />
                
                <span className="font-medium text-sm sm:text-base flex-1">
                  Pazimo Capital
                </span>
                <span className="rounded-full bg-blue-200 border border-blue-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide  dark:bg-yellow-500/60 dark:text-white dark:border-yellow-500 shadow-sm">
                  New
                </span>
              </Link>
            )}
            {beverageEligible && (
              <Link
                href="/organizer/beverages"
                onClick={handleLinkClick}
                className={`flex items-center gap-3 p-3 rounded-md transition-all duration-200 ${
                  isActive("/organizer/beverages")
                    ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shadow-sm border border-blue-100 dark:border-blue-300/10"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-100"
                }`}
              >
                <Beer className="h-5 w-5 flex-shrink-0" />
                <span className="font-medium text-sm sm:text-base flex-1">
                  Beverage sales
                </span>
                <span className="rounded-full bg-blue-200 border border-blue-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide dark:bg-yellow-500/60 dark:text-white dark:border-yellow-500 shadow-sm">
                  New
                </span>
              </Link>
            )}
            <Link
              href="/organizer/campaign"
              onClick={handleLinkClick}
              className={`flex items-center gap-3 p-3 rounded-md transition-all duration-200 ${
                isActive("/organizer/campaign")
                  ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shadow-sm border border-blue-100 dark:border-blue-300/10"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-100"
              }`}
            >
              <Megaphone className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium text-sm sm:text-base">Campaign</span>
            </Link>
            <Link
              href="/organizer/qr-scanner"
              onClick={handleLinkClick}
              className={`flex items-center gap-3 p-3 rounded-md transition-all duration-200 ${
                isActive("/organizer/qr-scanner")
                  ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shadow-sm border border-blue-100 dark:border-blue-300/10"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-100"
              }`}
            >
              <ScanLine className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium text-sm sm:text-base">Scan Ticket</span>
            </Link>
            <Link
              href="/organizer/withdrawals"
              onClick={handleLinkClick}
              className={`flex items-center gap-3 p-3 rounded-md transition-all duration-200 ${
                isActive("/organizer/withdrawals")
                  ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shadow-sm border border-blue-100 dark:border-blue-300/10"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-100"
              }`}
            >
              <Wallet className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium text-sm sm:text-base">
                Withdrawals
              </span>
            </Link>
            <Link
              href="/organizer/account"
              onClick={handleLinkClick}
              className={`flex items-center gap-3 p-3 rounded-md transition-all duration-200 ${
                isActive("/organizer/account")
                  ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shadow-sm border border-blue-100 dark:border-blue-300/10"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-100"
              }`}
            >
              <User className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium text-sm sm:text-base">Account</span>
            </Link>

            <div className="pt-4 mt-4 border-t border-gray-200 dark:border-gray-800">
              <div className="text-xs sm:text-sm font-semibold mb-3 text-gray-500 dark:text-gray-400 uppercase tracking-wider px-3">
                Other
              </div>
              <Link
                href="/organizer/notifications"
                onClick={handleLinkClick}
                className={`flex items-center gap-3 p-3 rounded-md transition-all duration-200 ${
                  isActive("/organizer/notifications")
                    ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shadow-sm border border-blue-100 dark:border-blue-300/10"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-100"
                }`}
              >
                <Bell className="h-5 w-5 flex-shrink-0" />
                <span className="font-medium text-sm sm:text-base">
                  Notifications
                </span>
              </Link>
              <Link
                href="/organizer/help"
                onClick={handleLinkClick}
                className={`flex items-center gap-3 p-3 rounded-md transition-all duration-200 ${
                  isActive("/organizer/help")
                    ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shadow-sm border border-blue-100 dark:border-blue-300/10"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-100"
                }`}
              >
                <HelpCircle className="h-5 w-5 flex-shrink-0" />
                <span className="font-medium text-sm sm:text-base">
                  Help Center
                </span>
              </Link>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 p-3 rounded-md text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-700 dark:hover:text-red-300 transition-all duration-200 group"
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
          className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm z-30 lg:hidden transition-opacity duration-300"
          onClick={onClose}
        />
      )}
    </>
  );
}