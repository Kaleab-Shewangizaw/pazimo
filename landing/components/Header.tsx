"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";

const navItems = [
  { label: "About", href: "/#about" },
  { label: "Events", href: "/#events" },
  { label: "Pricing", href: "/#pricing" },
  { label: "Support", href: "/#support" },
];

function MobileMenu() {
  const [open, setOpen] = useState(false);

  return (
    <Drawer direction="right" open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-700 shadow-sm transition hover:border-[#115db1]/30 hover:text-[#115db1]"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </DrawerTrigger>
      <DrawerContent className="ml-auto w-80 max-w-[calc(100vw-1rem)] rounded-l-3xl border-slate-200 p-0">
        <DrawerHeader className="border-b border-slate-100 px-6 py-5">
          <Link href="/" className="inline-flex items-center" onClick={() => setOpen(false)}>
            <Image
              src="/images/paz/logo.png"
              alt="Pazimo"
              width={160}
              height={48}
              className="h-9 w-auto"
              priority
            />
          </Link>
        </DrawerHeader>
        <nav className="flex flex-col gap-1 px-4 py-4">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-2xl px-4 py-3 text-base font-medium text-slate-700 transition hover:bg-slate-50 hover:text-[#115db1]"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="px-4 pb-4">
          <Button asChild className="h-12 w-full rounded-2xl bg-[#115db1] text-white hover:bg-[#0d4f96]">
            <Link href="/organizer-registration" onClick={() => setOpen(false)}>
              Get Started
            </Link>
          </Button>
          <DrawerClose asChild>
            <button
              type="button"
              className="mt-3 inline-flex h-12 w-full items-center justify-center rounded-2xl border border-slate-200 text-slate-700 transition hover:bg-slate-50"
            >
              <X className="mr-2 h-4 w-4" />
              Close
            </button>
          </DrawerClose>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="inline-flex items-center">
          <Image
            src="/images/paz/logo.png"
            alt="Pazimo"
            width={180}
            height={54}
            className="h-10 w-auto sm:h-11"
            priority
          />
        </Link>

        <div className="hidden items-center gap-2 md:flex">
          <nav className="mr-4 flex items-center gap-1 rounded-full border border-slate-200/80 bg-white/70 p-1 shadow-sm backdrop-blur">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <Button asChild className="h-11 rounded-full bg-[#115db1] px-5 font-semibold text-white hover:bg-[#0d4f96]">
            <Link href="/organizer-registration">Get Started</Link>
          </Button>
        </div>

        <div className="md:hidden">
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}