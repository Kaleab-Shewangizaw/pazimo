import type React from "react";
// import { Inter } from "next/font/google"
// import ClientLayout from "./clientLayout"
// import ClientLayout from "./clientLayout"
import ClientLayout from "./clientLayout";
import { ThemeProvider } from "@/components/theme-provider";
// const inter = Inter({ subsets: ["latin"] })

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "var(--font-inter, 'Inter', ui-sans-serif, system-ui, sans-serif)" }}>
        <ThemeProvider attribute="class" defaultTheme="system">
          <ClientLayout>{children}</ClientLayout>
        </ThemeProvider>
        
      </body>
    </html>
  );
}
