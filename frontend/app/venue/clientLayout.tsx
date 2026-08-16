"use client";

import type React from "react";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Beer, LayoutDashboard, Receipt, Wallet, LogOut, Store } from "lucide-react";

type PersistApi = {
  hasHydrated?: () => boolean;
  onFinishHydration?: (callback: () => void) => (() => void) | void;
};

const NAV = [
  { href: "/venue", label: "Overview", icon: LayoutDashboard },
  { href: "/venue/beverages", label: "Beverages", icon: Beer },
  { href: "/venue/sales", label: "Sales", icon: Receipt },
  { href: "/venue/withdrawals", label: "Money", icon: Wallet },
];

export default function VenueClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, user, logout } = useAuthStore();

  // Wait for persisted auth to rehydrate before deciding anything — redirecting
  // first would bounce a signed-in venue to the login screen on every refresh.
  // Same guard the organizer area uses.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const persist = (useAuthStore as typeof useAuthStore & { persist?: PersistApi })
      .persist;
    if (persist?.hasHydrated) {
      setHydrated(persist.hasHydrated());
      const unsub = persist.onFinishHydration?.(() => setHydrated(true));
      return typeof unsub === "function" ? unsub : undefined;
    }
    setHydrated(true);
  }, []);

  // Admins are allowed through so they can view a venue's surface, matching how
  // the organizer area admits them.
  const userRole = user?.role as string | undefined;
  const canAccess = Boolean(
    isAuthenticated && user && (userRole === "venue" || userRole === "admin")
  );

  useEffect(() => {
    if (!hydrated) return;
    if (!canAccess) router.replace("/sign-in");
  }, [hydrated, canAccess, router]);

  if (!hydrated) {
    return (
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <Skeleton className="mb-6 h-9 w-64" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!canAccess) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="container mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-950/40">
            <Store className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
              {user?.firstName || "Venue"}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Venue account</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              logout();
              router.replace("/sign-in");
            }}
          >
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>

        <nav className="container mx-auto max-w-6xl overflow-x-auto px-4">
          <ul className="flex gap-1">
            {NAV.map(({ href, label, icon: Icon }) => {
              // Exact match for the index, prefix for the rest, so /venue is not
              // highlighted while a child route is open.
              const active = href === "/venue" ? pathname === href : pathname.startsWith(href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors ${
                      active
                        ? "border-amber-500 font-medium text-amber-700 dark:text-amber-400"
                        : "border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      <main>{children}</main>
    </div>
  );
}
