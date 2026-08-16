"use client"

import AdminWithdrawalQueue from "@/components/withdrawals/AdminWithdrawalQueue"

// Bar takings payouts. Ticket revenue lives at /admin/withdrawals.
export default function BeverageWithdrawalsPage() {
  return <AdminWithdrawalQueue stream="beverages" />
}
