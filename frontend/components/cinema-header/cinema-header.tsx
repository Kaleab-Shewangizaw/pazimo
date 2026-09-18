"use client";

import Link from "next/link";
import Image from "next/image";
import { Menu, User, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import ThemeToggle from "../theme-toggle";

interface CinemaHeaderProps {
  onMenuClick?: () => void;
}

/**
 * The cinema area's top bar — the cinema twin of organizer-header.
 *
 * Same layout contract: a mobile row (logo, theme toggle, hamburger that opens
 * the sidebar) and a desktop row (identity and sign-out on the right).
 *
 * The organizer header also carries a notification bell backed by a socket
 * connection. That is deliberately absent here rather than stubbed: there is no
 * cinema notification stream on the backend yet, and a bell that never lights up
 * is worse than no bell — it teaches the operator to ignore it. Add it here when
 * cinema events start being published.
 */
const CinemaHeader = ({ onMenuClick }: CinemaHeaderProps) => {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    router.push("/sign-in");
  };

  return (
    <header className="md:relative dark:bg-black fixed top-0 left-0 right-0 z-50 py-4 px-4 sm:px-8 md:px-16 border-b dark:border-gray-600 border-gray-200 bg-white/95 md:bg-white backdrop-blur-sm transition-all duration-300 ease-out">
      <div className="flex flex-row items-center justify-between gap-4 md:gap-6">
        {/* Logo for mobile */}
        <Link
          href="/cinema"
          className="flex md:hidden items-center"
          aria-label="Pazimo — cinema dashboard"
        >
          <Image
            src="/logo2.png"
            alt="Pazimo"
            width={120}
            height={80}
            priority
            className="h-8 w-auto object-contain"
          />
        </Link>

        {/* Hamburger for mobile — opens the sidebar owned by the layout */}
        <div className="flex md:hidden items-center gap-1 ml-auto">
          <ThemeToggle />
          <button
            className="p-2 rounded-md text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-600 transition-colors"
            aria-label="Open menu"
            onClick={onMenuClick}
          >
            <Menu className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
        </div>

        {/* Desktop */}
        <div className="hidden md:flex flex-1 items-center justify-end gap-4">
          <ThemeToggle />

          <div className="flex items-center gap-2 rounded-full border border-gray-200 dark:border-gray-700 px-3 py-1.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-r from-indigo-600 to-indigo-400">
              <User className="h-3.5 w-3.5 text-white" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {user?.firstName || "Cinema"}
              </span>
              <span className="text-[11px] text-indigo-500">Cinema account</span>
            </div>
          </div>

          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      </div>
    </header>
  );
};

export default CinemaHeader;
