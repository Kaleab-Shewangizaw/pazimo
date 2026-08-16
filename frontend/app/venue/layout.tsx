import type React from "react";
import VenueClientLayout from "./clientLayout";

// Mirrors the organizer area's layout: a server component that sets the brand
// scope and font, wrapping a client layout that owns the auth guard.
export default function VenueLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="brand-scope"
      style={{
        fontFamily: "var(--font-inter, 'Inter', ui-sans-serif, system-ui, sans-serif)",
      }}
    >
      <VenueClientLayout>{children}</VenueClientLayout>
    </div>
  );
}
