import type React from "react"
import "./globals.css"
// import Header from "@/components/header/header"
// import Footer from "@/components/footer/footer"
import LayoutWrapper from "@/components/layout-wrapper"
import { Toaster } from "sonner"
import AuthProvider from "@/components/auth-provider"
import "@/lib/disableInspect"

export const metadata = {
  title: "Pazimo",
  description: "Manage and discover events",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="flex flex-col min-h-screen">
        <AuthProvider>
          <LayoutWrapper>{children}</LayoutWrapper>
          <Toaster position="top-center" />
        </AuthProvider>
      </body>
    </html>
  )
}
