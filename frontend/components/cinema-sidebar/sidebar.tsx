"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  CalendarDays,
  CalendarRange,
  Ticket,
  Popcorn,
  Wallet,
  ScanLine,
  User,
  HelpCircle,
  LogOut,
  X,
  Film,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { Button } from "../ui/button";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

/**
 * The cinema area's sidebar — the cinema twin of the organizer's.
 *
 * Structure, spacing and active-state styling are copied from
 * organizer-sidebar deliberately, so a cinema operator who has seen the
 * organizer dashboard is looking at the same product. Only the accent colour
 * differs (indigo rather than blue), the way the venue area uses amber: it says
 * which business you are signed into without changing how anything works.
 */
export default function CinemaSidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, token, logout } = useAuthStore();

  // Concessions are hidden until an admin approves the cinema, mirroring how
  // the organizer sidebar hides beverages and Pazimo Capital.
  //
  // This is a UX nicety on top of the real gate, which is the backend's
  // requireCinemaBeverageEligible middleware on every concession endpoint —
  // hiding a link has never been an authorization control.
  const [beverageEligible, setBeverageEligible] = useState(false);

  useEffect(() => {
    if (!token || user?.role !== "cinema") return;
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cinemas/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) =>
        setBeverageEligible(data?.data?.beverageEligibility === "eligible")
      )
      .catch(() => setBeverageEligible(false));
  }, [token, user?.role]);

  const isActive = (path: string) => pathname === path;

  const handleLogout = () => {
    logout();
    router.push("/sign-in");
    onClose();
  };

  const linkClass = (path: string) =>
    `flex items-center gap-3 p-3 rounded-md transition-all duration-200 ${
      isActive(path)
        ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 shadow-sm border border-indigo-100 dark:border-indigo-300/10"
        : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-100"
    }`;

  const NavLink = ({
    href,
    icon: Icon,
    label,
    badge,
  }: {
    href: string;
    icon: typeof Home;
    label: string;
    badge?: string;
  }) => (
    <Link href={href} onClick={onClose} className={linkClass(href)}>
      <Icon className="h-5 w-5 flex-shrink-0" />
      <span className="font-medium text-sm sm:text-base flex-1">{label}</span>
      {badge && (
        <span className="rounded-full bg-indigo-200 border border-indigo-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide dark:bg-indigo-500/60 dark:text-white dark:border-indigo-500 shadow-sm">
          {badge}
        </span>
      )}
    </Link>
  );

  return (
    <>
      <aside
        className={`bg-white dark:bg-black w-full max-w-[280px] fixed inset-y-0 left-0 z-40 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        } h-screen overflow-hidden lg:relative lg:top-0 lg:h-screen shadow-lg lg:shadow-md border-r border-gray-200 dark:border-gray-800 flex-shrink-0`}
      >
        <div className="flex flex-col h-full">
          {/* Brand header */}
          <div className="relative overflow-hidden bg-white dark:bg-black">
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
              onClick={() => router.push("/cinema")}
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-r from-indigo-600 to-indigo-400 rounded-full flex items-center justify-center">
                  <Film className="h-4 w-4 text-white" />
                </div>
                <div className="flex flex-col items-start">
                  <span className="text-sm dark:text-gray-300">
                    {user?.firstName || "Cinema"}
                  </span>
                  <span className="text-xs text-indigo-500 font-medium">
                    Cinema
                  </span>
                </div>
              </div>
            </Button>

            <div className="h-px w-full bg-gradient-to-r from-transparent via-indigo-300/70 dark:via-indigo-300/50 to-transparent" />
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 space-y-1">
            <NavLink href="/cinema" icon={Home} label="Dashboard" />
            <NavLink
              href="/cinema/programme"
              icon={CalendarDays}
              label="Program"
            />
            <NavLink
              href="/cinema/schedule"
              icon={CalendarRange}
              label="Schedule"
            />
            <NavLink href="/cinema/tickets" icon={Ticket} label="Tickets" />
            <NavLink
              href="/cinema/scanner"
              icon={ScanLine}
              label="Scan Ticket"
            />
            {beverageEligible && (
              <NavLink
                href="/cinema/concessions"
                icon={Popcorn}
                label="Concessions"
                badge="New"
              />
            )}
            <NavLink href="/cinema/money" icon={Wallet} label="Money" />
            <NavLink href="/cinema/account" icon={User} label="Account" />

            <div className="pt-4 mt-4 border-t border-gray-200 dark:border-gray-800">
              <div className="text-xs sm:text-sm font-semibold mb-3 text-gray-500 dark:text-gray-400 uppercase tracking-wider px-3">
                Other
              </div>
              <NavLink
                href="/cinema/help"
                icon={HelpCircle}
                label="Help Center"
              />
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
