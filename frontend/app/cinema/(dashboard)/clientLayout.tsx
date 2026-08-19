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
  // the organizer and venue areas admit them.
  const hasAdminAccess = Boolean(admin && adminToken && admin.role === "admin");
  const hasCinemaAccess = Boolean(
    isAuthenticated && user && (user.role === "cinema" || user.role === "admin")
  );
  const canAccess = hasCinemaAccess || hasAdminAccess;

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
    }
  }, [canAccess, router, isCinemaRoute, hasHydrated]);

  if (!isCinemaRoute) return <>{children}</>;
  if (!hasHydrated || !canAccess) return null;

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
