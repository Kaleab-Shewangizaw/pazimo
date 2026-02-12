"use client";

import type React from "react";
import { usePathname } from "next/navigation";
import Header from "@/components/header/header";
import Footer from "@/components/footer/footer";
import { useEffect, useState } from "react";

export default function LayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch by only rendering after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  const isAdminRoute = pathname?.startsWith("/admin");
  const isSignIn = pathname?.startsWith("/sign-in");
  const isOrganizerRoute = pathname?.startsWith("/organizer");
  const isEventDetail = pathname?.startsWith("/event_detail");
 

  // Hide Header and Footer for admin and organizer routes, as they have their own layouts/headers/footers
  const hideGlobalHeaderFooter = isAdminRoute || isOrganizerRoute;

  // Show a minimal layout during SSR to prevent hydration issues
  if (!mounted) {
    return <main className="flex-1">{children}</main>;
  }

  return (
    <>
      {!hideGlobalHeaderFooter && !isSignIn && (
        <Header />
      )}
      <main className="flex-1">{children}</main>
      {!hideGlobalHeaderFooter && !isSignIn && !isEventDetail && (
        <Footer />
      )}
    </>
  );
}
