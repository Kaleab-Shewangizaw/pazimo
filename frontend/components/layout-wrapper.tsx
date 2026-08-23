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
  // The /cinema prefix is shared by two different audiences:
  //   /cinema                    -> the cinema OWNER dashboard
  //   /cinema/programme, ...     -> dashboard sections
  //   /cinema/{slug}-{shortId}   -> a PUBLIC film page
  //   /cinemas                   -> the public browse page
  //
  // So this cannot be a prefix test. The dashboard sections are enumerated, and
  // anything else under /cinema/ is a film page that must keep the site header
  // and footer. Keep this list in step with app/cinema/(dashboard)/.
  const CINEMA_DASHBOARD_SECTIONS = [
    "programme",
    "schedule",
    "tickets",
    "concessions",
    "money",
    "account",
    "help",
    "scanner",
  ];
  const cinemaSegment = pathname?.startsWith("/cinema/")
    ? pathname.split("/")[2]
    : undefined;
  const isCinemaRoute =
    pathname === "/cinema" ||
    (cinemaSegment !== undefined &&
      CINEMA_DASHBOARD_SECTIONS.includes(cinemaSegment));
  // A PUBLIC film page: under /cinema/ but not one of the dashboard sections.
  // It keeps the site header, and drops the footer for the same reason the
  // event detail page does — it carries its own persistent booking button at
  // the bottom of the screen, and the footer's floating pill lands directly on
  // top of it on a phone.
  const isPublicMoviePage =
    cinemaSegment !== undefined &&
    !CINEMA_DASHBOARD_SECTIONS.includes(cinemaSegment);
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
      {!hideGlobalHeaderFooter &&
        !isSignIn &&
        !isEventDetail &&
        !isRsvpForm &&
        !isPublicMoviePage && <Footer />}
    </>
  );
}
