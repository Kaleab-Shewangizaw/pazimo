"use client"

import { Minus, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"

interface TicketCounterProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
}

export default function TicketCounter({ value, onChange, min = 1, max = 10 }: TicketCounterProps) {
  const increment = () => {
    if (value < max) {
      onChange(value + 1)
    }
  }

  const decrement = () => {
    if (value > min) {
      onChange(value - 1)
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Button
        variant="outline"
        size="icon"
        onClick={decrement}
        disabled={value <= min}
        className="h-8 w-8"
      >
        <Minus className="h-4 w-4" />
      </Button>
      <span className="text-lg font-medium w-8 text-center">{value}</span>
      <Button
        variant="outline"
        size="icon"
        onClick={increment}
        disabled={value >= max}
        className="h-8 w-8"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  )
}
