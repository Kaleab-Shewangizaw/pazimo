"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { useAdminAuthStore } from "@/store/adminAuthStore"
import { EventCashierManager } from "@/components/events/event-cashier-manager"

// Event cashiers: role="cashier" User docs with neither `cinema` nor `venue`
// set (see backend User.js's relaxed pre-validate hook), created here or by
// an organizer inline from an event's "Cashier Access" dialog
// (POST /api/event-cashiers). They don't own an event — an organizer or
// admin separately generates a per-event code (that same dialog) that the
// cashier redeems in the Pazimo Organizer mobile app to unlock beverage
// redemption for that one event. Cinema and venue cashiers are managed on
// their own dashboards, not here.
//
// Shares components/events/event-cashier-manager.tsx with the organizer's
// own "/organizer/cashiers" page — an admin sees every event cashier, an
// organizer sees only the ones it created (enforced server-side).
export default function EventCashiersPage() {
  const router = useRouter()
  const { token } = useAdminAuthStore()

  return (
    <div className="container mx-auto py-10 p-4 sm:p-10">
      <Button variant="ghost" size="sm" onClick={() => router.push("/admin/users")} className="mb-2 -ml-2">
        <ArrowLeft className="h-4 w-4 mr-2" />
        All Users
      </Button>
      <h1 className="text-3xl font-bold mb-6">Event Cashiers</h1>
      <EventCashierManager token={token || ""} />
    </div>
  )
}
