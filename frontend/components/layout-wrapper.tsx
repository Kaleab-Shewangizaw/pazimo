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
  const isVenueRoute = pathname?.startsWith("/venue");
  const isCinemaRoute = pathname?.startsWith("/cinema");
  const isEventDetail = pathname?.startsWith("/event_detail") || pathname?.startsWith("/events/");
  const isRsvpForm = pathname?.startsWith("/rsvp-form/");
  const isTicketPage = pathname?.startsWith("/ticket/");

  // Hide Header and Footer for admin, organizer, venue and cinema routes, as
  // they have their own layouts/headers/footers
  const hideGlobalHeaderFooter =
    isAdminRoute || isOrganizerRoute || isVenueRoute || isCinemaRoute;

  // Show a minimal layout during SSR to prevent hydration issues
  if (!mounted) {
    return <main className="flex-1">{children}</main>;
  }

  // The ticket view is a single-screen card and must never grow the document's
  // scroll height — Header stays in flow, main is capped to the leftover space.
  // No Footer here: its floating button would sit on top of the ticket.
  if (isTicketPage) {
    return (
      <div className="flex h-screen flex-col overflow-hidden">
        {!hideGlobalHeaderFooter && !isSignIn && <Header />}
        <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
      </div>
    );
  }

  return (
    <>
      {!hideGlobalHeaderFooter && !isSignIn && <Header />}
      <main className="flex-1">{children}</main>
      {!hideGlobalHeaderFooter && !isSignIn && !isEventDetail && !isRsvpForm && (
        <Footer />
      )}
    </>
  );
}
