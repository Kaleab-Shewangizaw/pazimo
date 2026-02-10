import type React from "react"
import "./globals.css"
// import Header from "@/components/header/header"
// import Footer from "@/components/footer/footer"
import LayoutWrapper from "@/components/layout-wrapper"
import { Toaster } from "sonner"
import AuthProvider from "@/components/auth-provider"
import "@/lib/disableInspect"
import "@/lib/errorLogger" // Initialize error logging
import type { Metadata, Viewport } from "next"
import { Rubik } from "next/font/google"

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-rubik",
  display: "swap",
})

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
}

export const metadata: Metadata = {
  title: "Pazimo",
  description: "Pazimo is your ultimate platform to discover, create, and manage events. Buy tickets, RSVP, and organize unforgettable experiences.",
  keywords: ["events", "tickets", "rsvp", "ethiopia events", "concerts", "festivals", "pazimo"],
  authors: [{ name: "Pazimo Team" }],
  openGraph: {
    title: "Pazimo",
    description: "Your ultimate platform for events. Buy tickets, RSVP, and organize.",
    url: "https://pazimo.com",
    siteName: "Pazimo",
    images: [
      {
        url: "https://pazimo.com/og-image.jpg",
        width: 1200,
        height: 630,
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pazimo ",
    description: "Your ultimate platform for events. Buy tickets, RSVP, and organize.",
    images: ["https://pazimo.com/og-image.jpg"],
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={rubik.variable}>
      <body className="flex flex-col min-h-screen font-sans">
        <AuthProvider>
          <LayoutWrapper>{children}</LayoutWrapper>
          <Toaster position="top-center" />
        </AuthProvider>
      </body>
    </html>
  )
}
