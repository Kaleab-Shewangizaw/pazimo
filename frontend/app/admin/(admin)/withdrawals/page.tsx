"use client"

import AdminWithdrawalQueue from "@/components/withdrawals/AdminWithdrawalQueue"

// Ticket revenue payouts. Bar takings live at /admin/withdrawals/beverages.
export default function WithdrawalsPage() {
  return <AdminWithdrawalQueue stream="tickets" />
}
