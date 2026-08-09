"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Calendar,
  LogOut,
  ChevronDown,
  ChevronRight,
  Shield,
  Ticket,
  Building2,
  CreditCard,
  Wallet,
  X,
  ClipboardList,
  Banknote,
  Beer,
} from "lucide-react";
import { useAdminAuthStore } from "@/store/adminAuthStore";

export default function AdminSidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
  const { admin } = useAdminAuthStore();
  const isPartner = admin?.role === "partner";

  // Close mobile menu when route changes
  useEffect(() => {
    if (open) {
      onClose();
    }
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close mobile menu on window resize to desktop
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleResize = () => {
      if (window.innerWidth >= 1024 && open) {
        onClose();
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [open, onClose]);

  const isActive = (path: string) => {
    return pathname === path;
  };

  const toggleSubmenu = (menu: string) => {
    setOpenSubmenu(openSubmenu === menu ? null : menu);
  };

  return (
    <>
      {/* Sidebar */}
      <aside
        className={`bg-white dark:bg-zinc-950 w-full max-w-[280px] sm:max-w-[320px] fixed inset-y-0 left-0 z-40 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        } lg:relative shadow-lg lg:shadow-md border-r border-gray-200 dark:border-zinc-800`}
      >
        <div className="flex flex-col h-full">
          {/* Admin Header */}
          <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-zinc-800 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-zinc-900 dark:to-zinc-950">
            <div className="flex items-center justify-between lg:justify-start gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-blue-100 dark:bg-zinc-800 flex items-center justify-center shadow-sm">
                  <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-500" />
                </div>
                <div>
                  <h2 className="font-bold text-lg sm:text-xl text-gray-900 dark:text-white">
                    Pazimo Admin
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-zinc-400">
                    Management Panel
                  </p>
                </div>
              </div>

              {/* Close button for mobile */}
              <button
                onClick={onClose}
                className="lg:hidden p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                aria-label="Close menu"
              >
                <X className="h-5 w-5 text-gray-600 dark:text-zinc-400" />
              </button>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-3 sm:p-4 space-y-1 overflow-y-auto bg-white dark:bg-zinc-950">
            {!isPartner && (
              <Link
                href="/admin"
                onClick={onClose}
                className={`flex items-center gap-3 p-3 sm:p-3.5 rounded-xl transition-all duration-200 group ${
                  isActive("/admin")
                    ? "bg-blue-50 text-blue-600 dark:bg-zinc-900 dark:text-blue-400 shadow-sm border border-blue-100 dark:border-blue-900/50"
                    : "text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-900 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                <LayoutDashboard className="h-5 w-5 flex-shrink-0" />
                <span className="font-medium text-sm sm:text-base">Dashboard</span>
              </Link>
            )}
           {/* Chapa Finance Section */}
            {!isPartner && (
              <Link
                href="/admin/finance"
                onClick={onClose}
                className={`flex items-center gap-3 p-3 sm:p-3.5 rounded-xl transition-all duration-200 group ${
                  pathname.startsWith("/admin/finance")
                    ? "bg-blue-50 text-blue-600 dark:bg-zinc-900 dark:text-blue-400 shadow-sm border border-blue-100 dark:border-blue-900/50"
                    : "text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-900 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                <Wallet className="h-5 w-5 flex-shrink-0" />
                <span className="font-medium text-sm sm:text-base">Chapa Dashboard</span>
              </Link>
            )}
            {/* Users Section */}
            {!isPartner && (
              <div>
                <button
                  onClick={() => toggleSubmenu("users")}
                  className={`w-full flex items-center justify-between gap-3 p-3 sm:p-3.5 rounded-xl transition-all duration-200 group ${
                    pathname.startsWith("/admin/users")
                      ? "bg-blue-50 text-blue-600 dark:bg-zinc-900 dark:text-blue-400 shadow-sm border border-blue-100 dark:border-blue-900/50"
                      : "text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-900 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 flex-shrink-0" />
                    <span className="font-medium text-sm sm:text-base">Users</span>
                  </div>
                  {openSubmenu === "users" ? (
                    <ChevronDown className="h-4 w-4 flex-shrink-0 transition-transform duration-200" />
                  ) : (
                    <ChevronRight className="h-4 w-4 flex-shrink-0 transition-transform duration-200" />
                  )}
                </button>
                {openSubmenu === "users" && (
                  <div className="ml-8 sm:ml-12 mt-1 space-y-1 animate-in slide-in-from-top-2 duration-200">
                    <Link
                      href="/admin/users"
                      onClick={onClose}
                      className={`block p-2.5 rounded-xl text-sm transition-colors ${
                        isActive("/admin/users")
                          ? "bg-blue-50 text-blue-600 dark:bg-zinc-900 dark:text-blue-400"
                          : "text-gray-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-zinc-900"
                      }`}
                    >
                      All Users
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Organizers Section */}
            <div>
              <button
                onClick={() => toggleSubmenu("organizers")}
                className={`w-full flex items-center justify-between gap-3 p-3 sm:p-3.5 rounded-xl transition-all duration-200 group ${
                  pathname.startsWith("/admin/organizers")
                    ? "bg-blue-50 text-blue-600 dark:bg-zinc-900 dark:text-blue-400 shadow-sm border border-blue-100 dark:border-blue-900/50"
                    : "text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-900 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 flex-shrink-0" />
                  <span className="font-medium text-sm sm:text-base">Organizers</span>
                </div>
                {openSubmenu === "organizers" ? (
                  <ChevronDown className="h-4 w-4 flex-shrink-0 transition-transform duration-200" />
                ) : (
                  <ChevronRight className="h-4 w-4 flex-shrink-0 transition-transform duration-200" />
                )}
              </button>
              {openSubmenu === "organizers" && (
                <div className="ml-8 sm:ml-12 mt-1 space-y-1 animate-in slide-in-from-top-2 duration-200">
                  <Link
                    href="/admin/organizers"
                    onClick={onClose}
                    className={`block p-2.5 rounded-xl text-sm transition-colors ${
                      isActive("/admin/organizers")
                        ? "bg-blue-50 text-blue-600 dark:bg-zinc-900 dark:text-blue-400"
                        : "text-gray-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-zinc-900"
                    }`}
                  >
                    All Organizers
                  </Link>
                  {!isPartner && (
                    <Link
                      href="/admin/organizer-registrations"
                      onClick={onClose}
                      className={`block p-2.5 rounded-xl text-sm transition-colors ${
                        isActive("/admin/organizer-registrations")
                          ? "bg-blue-50 text-blue-600 dark:bg-zinc-900 dark:text-blue-400"
                          : "text-gray-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-zinc-900"
                      }`}
                    >
                      Registration Requests
                    </Link>
                  )}
                </div>
              )}
            </div>

            {/* Events Section */}
            <div>
              <button
                onClick={() => toggleSubmenu("events")}
                className={`w-full flex items-center justify-between gap-3 p-3 sm:p-3.5 rounded-xl transition-all duration-200 group ${
                  pathname.startsWith("/admin/events")
                    ? "bg-blue-50 text-blue-600 dark:bg-zinc-900 dark:text-blue-400 shadow-sm border border-blue-100 dark:border-blue-900/50"
                    : "text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-900 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 flex-shrink-0" />
                  <span className="font-medium text-sm sm:text-base">Events</span>
                </div>
                {openSubmenu === "events" ? (
                  <ChevronDown className="h-4 w-4 flex-shrink-0 transition-transform duration-200" />
                ) : (
                  <ChevronRight className="h-4 w-4 flex-shrink-0 transition-transform duration-200" />
                )}
              </button>
              {openSubmenu === "events" && (
                <div className="ml-8 sm:ml-12 mt-1 space-y-1 animate-in slide-in-from-top-2 duration-200">
                  <Link
                    href="/admin/events"
                    onClick={onClose}
                    className={`block p-2.5 rounded-xl text-sm transition-colors ${
                      isActive("/admin/events")
                        ? "bg-blue-50 text-blue-600 dark:bg-zinc-900 dark:text-blue-400"
                        : "text-gray-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-zinc-900"
                    }`}
                  >
                    All Events
                  </Link>
                  {!isPartner && (
                    <Link
                      href="/admin/events/categories"
                      onClick={onClose}
                      className={`block p-2.5 rounded-xl text-sm transition-colors ${
                        isActive("/admin/events/categories")
                          ? "bg-blue-50 text-blue-600 dark:bg-zinc-900 dark:text-blue-400"
                          : "text-gray-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-zinc-900"
                      }`}
                    >
                      Categories
                    </Link>
                  )}
                  {!isPartner && (
                    <Link
                      href="/admin/events/invitation-pricing"
                      onClick={onClose}
                      className={`block p-2.5 rounded-xl text-sm transition-colors ${
                        isActive("/admin/events/invitation-pricing")
                          ? "bg-blue-50 text-blue-600 dark:bg-zinc-900 dark:text-blue-400"
                          : "text-gray-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-zinc-900"
                      }`}
                    >
                      Invitation Pricing
                    </Link>
                  )}
                  {!isPartner && (
                    <Link
                      href="/admin/events/campaign-pricing"
                      onClick={onClose}
                      className={`block p-2.5 rounded-xl text-sm transition-colors ${
                        isActive("/admin/events/campaign-pricing")
                          ? "bg-blue-50 text-blue-600 dark:bg-zinc-900 dark:text-blue-400"
                          : "text-gray-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-zinc-900"
                      }`}
                    >
                      Campaign Pricing
                    </Link>
                  )}
                </div>
              )}
            </div>

            <Link
              href="/admin/rsvps"
              onClick={onClose}
              className={`flex items-center gap-3 p-3 sm:p-3.5 rounded-xl transition-all duration-200 group ${
                pathname.startsWith("/admin/rsvps")
                  ? "bg-blue-50 text-blue-600 dark:bg-zinc-900 dark:text-blue-400 shadow-sm border border-blue-100 dark:border-blue-900/50"
                  : "text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-900 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              <ClipboardList className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium text-sm sm:text-base">RSVP Forms</span>
            </Link>

            {/* Invitations Section */}
            {!isPartner && (
              <Link
                href="/admin/invitations"
                onClick={onClose}
                className={`flex items-center gap-3 p-3 sm:p-3.5 rounded-xl transition-all duration-200 group ${
                  isActive("/admin/invitations")
                    ? "bg-blue-50 text-blue-600 dark:bg-zinc-900 dark:text-blue-400 shadow-sm border border-blue-100 dark:border-blue-900/50"
                    : "text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-900 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                <Users className="h-5 w-5 flex-shrink-0" />
                <span className="font-medium text-sm sm:text-base">Invitations</span>
              </Link>
            )}

            {/* Tickets Section */}
            {!isPartner && (
              <Link
                href="/admin/tickets"
                onClick={onClose}
                className={`flex items-center gap-3 p-3 sm:p-3.5 rounded-xl transition-all duration-200 group ${
                  pathname.startsWith("/admin/tickets")
                    ? "bg-blue-50 text-blue-600 dark:bg-zinc-900 dark:text-blue-400 shadow-sm border border-blue-100 dark:border-blue-900/50"
                    : "text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-900 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                <Ticket className="h-5 w-5 flex-shrink-0" />
                <span className="font-medium text-sm sm:text-base">Tickets</span>
              </Link>
            )}

            {/* Withdrawals Section */}
            {!isPartner && (
              <div>
                <button
                  onClick={() => toggleSubmenu("withdrawals")}
                  className={`w-full flex items-center justify-between gap-3 p-3 sm:p-3.5 rounded-xl transition-all duration-200 group ${
                    pathname.startsWith("/admin/withdrawals")
                      ? "bg-blue-50 text-blue-600 dark:bg-zinc-900 dark:text-blue-400 shadow-sm border border-blue-100 dark:border-blue-900/50"
                      : "text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-900 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-5 w-5 flex-shrink-0" />
                    <span className="font-medium text-sm sm:text-base">Withdrawals</span>
                  </div>
                  {openSubmenu === "withdrawals" ? (
                    <ChevronDown className="h-4 w-4 flex-shrink-0 transition-transform duration-200" />
                  ) : (
                    <ChevronRight className="h-4 w-4 flex-shrink-0 transition-transform duration-200" />
                  )}
                </button>
                {openSubmenu === "withdrawals" && (
                  <div className="ml-8 sm:ml-12 mt-1 space-y-1 animate-in slide-in-from-top-2 duration-200">
                    <Link
                      href="/admin/withdrawals"
                      onClick={onClose}
                      className={`block p-2.5 rounded-xl text-sm transition-colors ${
                        isActive("/admin/withdrawals")
                          ? "bg-blue-50 text-blue-600 dark:bg-zinc-900 dark:text-blue-400"
                          : "text-gray-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-zinc-900"
                      }`}
                    >
                      Withdrawal Requests
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Pazimo Capital Section */}
            {!isPartner && (
              <Link
                href="/admin/capital"
                onClick={onClose}
                className={`flex items-center gap-3 p-3 sm:p-3.5 rounded-xl transition-all duration-200 group ${
                  pathname.startsWith("/admin/capital")
                    ? "bg-blue-50 text-blue-600 dark:bg-zinc-900 dark:text-blue-400 shadow-sm border border-blue-100 dark:border-blue-900/50"
                    : "text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-900 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                <Banknote className="h-5 w-5 flex-shrink-0" />
                <span className="font-medium text-sm sm:text-base">Pazimo Capital</span>
              </Link>
            )}

            {/* Beverages Section */}
            {!isPartner && (
              <Link
                href="/admin/beverages"
                onClick={onClose}
                className={`flex items-center gap-3 p-3 sm:p-3.5 rounded-xl transition-all duration-200 group ${
                  pathname.startsWith("/admin/beverages")
                    ? "bg-blue-50 text-blue-600 dark:bg-zinc-900 dark:text-blue-400 shadow-sm border border-blue-100 dark:border-blue-900/50"
                    : "text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-900 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                <Beer className="h-5 w-5 flex-shrink-0" />
                <span className="font-medium text-sm sm:text-base">Beverages</span>
              </Link>
            )}

            {/* System Section */}
            <div className="pt-4 mt-4 border-t border-gray-200 dark:border-zinc-800">
              <div className="text-xs sm:text-sm font-semibold mb-3 text-gray-500 dark:text-zinc-500 uppercase tracking-wider px-3">
                System
              </div>

              <Link
                href="/"
                onClick={onClose}
                className="flex items-center gap-3 p-3 sm:p-3.5 rounded-xl text-red-600 dark:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 hover:text-red-700 dark:hover:text-red-400 transition-all duration-200 group"
              >
                <LogOut className="h-5 w-5 flex-shrink-0 group-hover:scale-110 transition-transform duration-200" />
                <span className="font-medium text-sm sm:text-base">Logout</span>
              </Link>
            </div>
          </nav>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {open && (
        <div
          className="fixed inset-0 bg-black/60 dark:bg-black/70 backdrop-blur-sm z-30 lg:hidden transition-opacity duration-300"
          onClick={onClose}
        />
      )}
    </>
  );
}