"use client"
import React, { useState } from "react"
import Link from "next/link"
import { Menu } from "lucide-react"
import { Drawer, DrawerClose, DrawerContent, DrawerHeader, DrawerTrigger } from "@/components/ui/drawer"

function MobileMenu() {
  const [open, setOpen] = useState(false)

  return (
    <Drawer direction="right" open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <button
          className="md:hidden p-2 rounded-md text-gray-700 hover:text-[#115db1] focus:outline-none focus:ring-2 focus:ring-[#115db1]"
          aria-label="Open menu"
        >
          <Menu className="h-6 w-6" />
        </button>
      </DrawerTrigger>
      <DrawerContent className="w-64 max-w-xs ml-auto rounded-l-xl p-0">
        <DrawerHeader>
          <div className="w-full flex justify-center items-center py-4">
            <img src="/logo.png" alt="Pazimo" className="w-28 mx-auto" />
          </div>
        </DrawerHeader>
        <nav className="flex flex-col gap-4 px-6 py-4">
          <Link
            href="http://pazimo.com/"
            className="text-gray-700 hover:text-[#115db1] px-3 py-2 text-base font-medium transition-colors"
            onClick={() => setOpen(false)}
          >
            Events
          </Link>
          <Link
            href="/#pricing"
            className="text-gray-700 hover:text-[#115db1] px-3 py-2 text-base font-medium transition-colors"
            onClick={() => setOpen(false)}
          >
            Pricing
          </Link>
          <Link
            href="/#support"
            className="text-gray-700 hover:text-[#115db1] px-3 py-2 text-base font-medium transition-colors"
            onClick={() => setOpen(false)}
          >
            Support
          </Link>
        </nav>
        <DrawerClose asChild>
          <button className="mx-6 mt-4 px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100 transition">
            Close
          </button>
        </DrawerClose>
      </DrawerContent>
    </Drawer>
  )
}

export default function Header() {
  return (
    <header className="bg-white/95 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex-shrink-0">
            <Link href="/">
              <img
                src="/logo.png"
                alt="Pazimo Home"
                className="w-24 sm:w-32 md:w-40 lg:w-35 transition-transform duration-200 group-hover:scale-105 cursor-pointer"
              />
            </Link>
          </div>
          {/* Desktop Nav */}
          <nav className="hidden md:flex space-x-8">
            <Link
              href="http://pazimo.com/"
              className="text-gray-700 hover:text-[#115db1] px-3 py-2 text-sm font-medium transition-colors"
            >
              Events
            </Link>
            <Link
              href="/#pricing"
              className="text-gray-700 hover:text-[#115db1] px-3 py-2 text-sm font-medium transition-colors"
            >
              Pricing
            </Link>
            <Link
              href="/#support"
              className="text-gray-700 hover:text-[#115db1] px-3 py-2 text-sm font-medium transition-colors"
            >
              Support
            </Link>
          </nav>
          {/* Mobile Hamburger/Drawer */}
          <div className="md:hidden flex items-center">
            <MobileMenu />
          </div>
        </div>
      </div>
    </header>
  )
} 