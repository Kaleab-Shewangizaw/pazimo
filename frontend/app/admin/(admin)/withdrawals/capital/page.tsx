"use client"

import AdminWithdrawalQueue from "@/components/withdrawals/AdminWithdrawalQueue"

// Pazimo Capital advance payouts. Ticket revenue lives at /admin/withdrawals,
// bar takings at /admin/withdrawals/beverages — approving a request here
// never touches either of those balances.
export default function CapitalWithdrawalsPage() {
  return <AdminWithdrawalQueue stream="capital" />
}
