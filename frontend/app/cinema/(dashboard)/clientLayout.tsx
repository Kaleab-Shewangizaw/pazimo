"use client";

import type React from "react";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useAdminAuthStore } from "@/store/adminAuthStore";
import CinemaSidebar from "@/components/cinema-sidebar/sidebar";
import CinemaHeader from "@/components/cinema-header/cinema-header";
import { toast } from "sonner";

type PersistApi = {
  hasHydrated?: () => boolean;
  onFinishHydration?: (callback: () => void) => (() => void) | void;
};

/**
 * The cinema area's shell — sidebar + header, the same composition the
 * organizer area uses, so the two dashboards are the same product.
 *
 * The auth guard waits for BOTH stores to rehydrate before deciding anything.
 * Redirecting first would bounce a signed-in cinema to the login screen on every
 * refresh, which is the bug the organizer layout documents at length.
 */
export default function CinemaClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, user } = useAuthStore();
  const admin = useAdminAuthStore((state) => state.admin);
  const adminToken = useAdminAuthStore((state) => state.token);

  const [authHydrated, setAuthHydrated] = useState(false);
  const [adminHydrated, setAdminHydrated] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const isCinemaRoute = pathname.startsWith("/cinema");

  // Admins are allowed through so they can view a cinema's surface, matching how
  // the organizer and venue areas admit them. A cashier is admitted too, but
  // only to the counter-operations pages listed in CASHIER_ALLOWED_PATHS below
  // — everything else (halls/movies/showtimes, money, account, cashier
  // management) stays owner(+admin)-only, matching the backend's cinemaSelf
  // vs cinemaStaff route split.
  const hasAdminAccess = Boolean(admin && adminToken && admin.role === "admin");
  const hasCinemaAccess = Boolean(
    isAuthenticated &&
      user &&
      (user.role === "cinema" || user.role === "admin" || user.role === "cashier")
  );
  const canAccess = hasCinemaAccess || hasAdminAccess;
  const isCashier = user?.role === "cashier";

  // A cashier gets counter operations only — never sales/revenue figures.
  // The scanner already admits tickets AND redeems concessions in one
  // no-money screen (see components/cinema/cinema-scanner.tsx), so it is the
  // cashier's entire surface; /cinema/tickets (per-screening revenue, buyer
  // amounts) and /cinema/concessions (a Sales tab with gross revenue and
  // Pazimo's fee) are owner(+admin)-only, matching the backend split.
  const CASHIER_ALLOWED_PATHS = ["/cinema/scanner"];
  const CASHIER_DEFAULT_PATH = "/cinema/scanner";

  useEffect(() => {
    const persist = (
      useAuthStore as typeof useAuthStore & { persist?: PersistApi }
    ).persist;
    if (persist?.hasHydrated) {
      setAuthHydrated(persist.hasHydrated());
      const unsub = persist.onFinishHydration?.(() => setAuthHydrated(true));
      return () => unsub?.();
    }
    setAuthHydrated(true);
  }, []);

  useEffect(() => {
    const persist = (
      useAdminAuthStore as typeof useAdminAuthStore & { persist?: PersistApi }
    ).persist;
    if (persist?.hasHydrated) {
      setAdminHydrated(persist.hasHydrated());
      const unsub = persist.onFinishHydration?.(() => setAdminHydrated(true));
      return () => unsub?.();
    }
    setAdminHydrated(true);
  }, []);

  const hasHydrated = authHydrated && adminHydrated;

  useEffect(() => {
    if (!isCinemaRoute || !hasHydrated) return;
    if (!canAccess) {
      toast.error("Please login to access cinema features");
      router.replace("/sign-in");
      return;
    }
    // A cashier straying onto an owner-only page (typed URL, stale bookmark,
    // a link meant for the owner) is bounced to its default landing page
    // rather than shown a page that will just 403 on every request it makes.
    if (
      isCashier &&
      !CASHIER_ALLOWED_PATHS.some(
        (path) => pathname === path || pathname.startsWith(`${path}/`)
      )
    ) {
      router.replace(CASHIER_DEFAULT_PATH);
    }
  }, [canAccess, router, isCinemaRoute, hasHydrated, isCashier, pathname]);

  const cashierOnDisallowedPath =
    isCashier &&
    !CASHIER_ALLOWED_PATHS.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`)
    );

  if (!isCinemaRoute) return <>{children}</>;
  if (!hasHydrated || !canAccess || cashierOnDisallowedPath) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-black">
      <CinemaSidebar
        open={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <CinemaHeader onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} />
        {/* The header is `fixed` below md (so it stays put while the page
            scrolls) and `relative` from md up. Fixed elements leave no gap
            behind them, so the mobile breakpoint needs the header's height
            added back or the first card sits underneath it. */}
        <main className="flex-1 overflow-y-auto bg-gray-50 pt-[68px] dark:bg-black md:pt-0">
          {children}
        </main>
      </div>
    </div>
  );
}
