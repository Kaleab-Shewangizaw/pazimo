import type React from "react"
import "./globals.css"
import LayoutWrapper from "@/components/layout-wrapper"
import { Toaster } from "sonner"
import AuthProvider from "@/components/auth-provider"
import "@/lib/disableInspect"
import "@/lib/errorLogger" // Initialize error logging
import type { Metadata, Viewport } from "next"
import { Space_Grotesk, Inter } from "next/font/google"

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
})

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
})

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
}

export const metadata: Metadata = {
  title: {
    default: "Pazimo",
    template: "%s | Pazimo",
  },
  description: "Pazimo helps you discover events, sell tickets, RSVP, and manage unforgettable experiences.",
  keywords: ["events", "tickets", "rsvp", "ethiopia events", "concerts", "festivals", "pazimo"],
  authors: [{ name: "Pazimo Team" }],
  openGraph: {
    title: "Pazimo",
    description: "Pazimo helps you discover events, sell tickets, RSVP, and organize unforgettable experiences.",
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
    description: "Pazimo helps you discover events, sell tickets, RSVP, and organize unforgettable experiences.",
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
    <html lang="en" className={`${spaceGrotesk.variable} ${inter.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="flex flex-col min-h-screen">
        <AuthProvider>
          <LayoutWrapper>{children}</LayoutWrapper>
          <Toaster position="top-center" />
        </AuthProvider>
      </body>
    </html>
  )
}
