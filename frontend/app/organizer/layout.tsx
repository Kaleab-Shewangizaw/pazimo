import type React from "react";
import ClientLayout from "./clientLayout";

export default function OrganizerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="brand-scope"
      style={{ fontFamily: "var(--font-inter, 'Inter', ui-sans-serif, system-ui, sans-serif)" }}
    >
      <ClientLayout>{children}</ClientLayout>
    </div>
  );
}
