"use client"

import type React from "react"

import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"
import { useDeveloperAuthStore } from "@/store/developerAuthStore"

export default function DeveloperLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { developer, token } = useDeveloperAuthStore()
  const isDeveloperRoute = pathname.startsWith("/developer")
  const isLoginPage = pathname === "/developer/login"

  useEffect(() => {
    if (isDeveloperRoute && !isLoginPage && (!developer || !token)) {
      router.push("/developer/login")
    }
  }, [isDeveloperRoute, isLoginPage, developer, token, router])

  if (isLoginPage) {
    return <>{children}</>
  }

  if (!developer || !token) {
    return null
  }

  if (developer.role !== "developer") {
    router.push("/developer/login")
    return null
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <main>{children}</main>
    </div>
  )
}
