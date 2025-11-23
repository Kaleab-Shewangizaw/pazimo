

"use client"

import type React from "react"
import { usePathname } from "next/navigation"
import Header from "@/components/header/header"
import Footer from "@/components/footer/footer"

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const isAdminRoute = pathname?.startsWith('/admin')
  const isOrganizerRoute = pathname?.startsWith('/organizer')

  // Hide Header and Footer for admin and organizer routes, as they have their own layouts/headers/footers
  const hideGlobalHeaderFooter = isAdminRoute || isOrganizerRoute

  return (
    <>
      {!hideGlobalHeaderFooter && <Header />}
      <main className="flex-1">{children}</main>
      {!hideGlobalHeaderFooter && <Footer />}
    </>
  )
}
