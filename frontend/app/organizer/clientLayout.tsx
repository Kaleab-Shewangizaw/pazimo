"use client";

import type React from "react";
import { useEffect, useState } from "react"; // Import useState
import { useRouter, usePathname } from "next/navigation"; // Import usePathname
import { useAuthStore } from "@/store/authStore";
import { useAdminAuthStore } from "@/store/adminAuthStore";
import Sidebar from "@/components/organizer-sidebar/sidebar";
import OrganizerHeader from "@/components/organizer-header/organizer-header"; // Import the new OrganizerHeader
import { toast } from "sonner";

type PersistApi = {
  hasHydrated?: () => boolean;
  onFinishHydration?: (callback: () => void) => (() => void) | void;
};

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname(); // Get current pathname
  const { isAuthenticated, user } = useAuthStore();
  const admin = useAdminAuthStore((state) => state.admin);
  const adminToken = useAdminAuthStore((state) => state.token);
  // Track hydration to avoid redirecting before zustand rehydrates from storage
  const [authHydrated, setAuthHydrated] = useState(false);
  const [adminHydrated, setAdminHydrated] = useState(false);

  const isOrganizerRoute = pathname.startsWith("/organizer");
  const isSignInOrSignUp =
    pathname === "/organizer/sign-in" || pathname === "/organizer/sign-up";
  const hasAdminAccess = Boolean(admin && adminToken && admin.role === "admin");
  const hasOrganizerAccess = Boolean(
    isAuthenticated &&
      user &&
      (user.role === "organizer" || user.role === "admin")
  );
  const canAccessOrganizerArea = hasOrganizerAccess || hasAdminAccess;

  // State for sidebar open/close
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  // Wait for persisted auth state to rehydrate before making any redirect decisions
  useEffect(() => {
    const persist = (
      useAuthStore as typeof useAuthStore & { persist?: PersistApi }
    ).persist;
    if (persist?.hasHydrated) {
      setAuthHydrated(persist.hasHydrated());
      const unsub = persist.onFinishHydration?.(() => setAuthHydrated(true));
      return () => unsub?.();
    } else {
      // Fallback: assume hydrated after first render if persist helpers are unavailable
      setAuthHydrated(true);
    }
  }, []);

  useEffect(() => {
    const persist = (
      useAdminAuthStore as typeof useAdminAuthStore & { persist?: PersistApi }
    ).persist;
    if (persist?.hasHydrated) {
      setAdminHydrated(persist.hasHydrated());
      const unsub = persist.onFinishHydration?.(() => setAdminHydrated(true));
      return () => unsub?.();
    } else {
      setAdminHydrated(true);
    }
  }, []);

  const hasHydrated = authHydrated && adminHydrated;

  useEffect(() => {
    // isSignInOrSignUp must be exempted here too, not just in the render
    // branch below — without it, this effect redirected every unauthenticated
    // visitor away from /organizer/sign-in (and /sign-up) before they could
    // ever see it, straight to the generic /sign-in page instead. Found
    // 2026-09-03 while wiring up organizer OTP login on this exact page.
    if (!isOrganizerRoute || !hasHydrated || isSignInOrSignUp) return;
    if (!canAccessOrganizerArea) {
      toast.error("Please login to access organizer features");
      router.replace("/sign-in");
      return;
    }
  }, [canAccessOrganizerArea, router, isOrganizerRoute, hasHydrated, isSignInOrSignUp]);

  // If it's not an organizer route or it's sign-in/sign-up, render children directly without layout
  if (!isOrganizerRoute || isSignInOrSignUp) {
    return <>{children}</>;
  }

  // If it's an organizer route but not authenticated or not an organizer, return null (handled by useEffect redirect)
  if (!hasHydrated || !canAccessOrganizerArea) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-black">
      {/* Organizer Sidebar */}
      <Sidebar open={isSidebarOpen} onClose={closeSidebar} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Organizer Header */}
        <OrganizerHeader onMenuClick={toggleSidebar} />
        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-black">
          {children}
        </main>
      </div>
    </div>
  );
}
