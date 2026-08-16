import type React from "react";
import CinemaClientLayout from "./clientLayout";

// Mirrors the venue and organizer areas: a server component that sets the brand
// scope and font, wrapping a client layout that owns the auth guard.
export default function CinemaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="brand-scope"
      style={{
        fontFamily:
          "var(--font-inter, 'Inter', ui-sans-serif, system-ui, sans-serif)",
      }}
    >
      <CinemaClientLayout>{children}</CinemaClientLayout>
    </div>
  );
}
