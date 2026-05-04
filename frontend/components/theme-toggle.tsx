"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { LaptopMinimal, MoonStar, SunMedium } from "lucide-react"

const options = [
  { value: "light", label: "Light", icon: SunMedium },
  { value: "dark", label: "Dark", icon: MoonStar },
  { value: "system", label: "System", icon: LaptopMinimal },
]

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="p-2">
          {theme === "dark" ? <MoonStar className="w-4 h-4" /> : <SunMedium className="w-4 h-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={theme || "system"} onValueChange={(v) => setTheme(v)}>
          {options.map((opt) => (
            <DropdownMenuRadioItem key={opt.value} value={opt.value}>
              <div className="flex items-center gap-2">
                <opt.icon className="w-4 h-4" />
                <span>{opt.label}</span>
              </div>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
