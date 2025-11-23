"use client"

import { useState, useEffect } from "react"
import { useAdminAuthStore } from "@/store/adminAuthStore"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  ChevronLeft,
  ChevronRight,
  Search,
  RefreshCw,
  CreditCard,
} from "lucide-react"
import { Label } from "@/components/ui/label"

interface WithdrawalData {
  _id: string
  organizer: {
    _id: string
    firstName: string
    lastName: string
    email: string
  }
  amount: number
  status: "pending" | "approved" | "rejected" | "completed"
  notes: string
  bankDetails: {
    accountName: string
    accountNumber: string
    bankName: string
  }
  processedBy?: {
    firstName: string
    lastName: string
  }
  processedAt?: string
  createdAt: string
  transactionId?: string
}

export default function WithdrawalsPage() {
  const { token } = useAdminAuthStore()
  const [withdrawals, setWithdrawals] = useState<WithdrawalData[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<WithdrawalData | null>(null)
  const [updateStatus, setUpdateStatus] = useState<"approved" | "rejected" | "completed">("approved")
  const [transactionId, setTransactionId] = useState("")

  useEffect(() => {
    fetchWithdrawals()
  }, [page, itemsPerPage, statusFilter])

  const fetchWithdrawals = async () => {
    try {
      setLoading(true)
      let url = `${process.env.NEXT_PUBLIC_API_URL}/api/withdrawals?page=${page}&limit=${itemsPerPage}`
      if (statusFilter !== "all") {
        url += `&status=${statusFilter}`
      }
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      })

      if (!response.ok) {
        throw new Error("Failed to fetch withdrawals")
      }

      const data = await response.json()
      setWithdrawals(data.data || [])
      setTotalPages(data.pagination.totalPages)
    } catch (error) {
      console.error("Error fetching withdrawals:", error)
      toast.error("Failed to fetch withdrawals")
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateStatus = async () => {
    if (!selectedWithdrawal) return

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/withdrawals/${selectedWithdrawal._id}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: updateStatus,
            transactionId: transactionId,
            notes: `Status updated to ${updateStatus}`,
          }),
        },
      )

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update withdrawal status")
      }

      toast.success("Withdrawal status updated successfully")
      setDialogOpen(false)
      fetchWithdrawals()
    } catch (error: any) {
      console.error("Error updating withdrawal status:", error)
      toast.error(error.message)
    }
  }

  const filteredWithdrawals = withdrawals.filter((withdrawal) => {
    const organizerName = `${withdrawal.organizer.firstName} ${withdrawal.organizer.lastName}`.toLowerCase()
    const searchLower = searchQuery.toLowerCase()
    return organizerName.includes(searchLower)
  })
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-200 border-t-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">Loading withdrawals...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-10 p-10 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Withdrawal Requests</h1>
            <p className="text-gray-600 mt-1">Manage organizer withdrawal requests and payments</p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full lg:w-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search by organizer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-full sm:w-[250px]"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value)
                setPage(1)
              }}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={fetchWithdrawals} className="bg-blue-600 hover:bg-blue-700 text-white">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Withdrawals Table */}
        <Card className="border border-gray-200 shadow-lg hover:shadow-xl border-t-4 border-t-red-600">
          <CardContent className="p-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-200">
                    <TableHead className="font-semibold text-gray-700">Organizer</TableHead>
                    <TableHead className="font-semibold text-gray-700">Amount</TableHead>
                    <TableHead className="font-semibold text-gray-700">Status</TableHead>
                    <TableHead className="font-semibold text-gray-700">Bank Details</TableHead>
                    <TableHead className="font-semibold text-gray-700">Created</TableHead>
                    <TableHead className="font-semibold text-gray-700">Processed</TableHead>
                    <TableHead className="font-semibold text-gray-700 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredWithdrawals.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-gray-500 py-12">
                        <CreditCard className="h-8 w-8 text-red-400 mx-auto mb-3" />
                        <p className="font-medium">No withdrawal requests found</p>
                        <p className="text-sm">Withdrawal requests for the selected filter will appear here</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredWithdrawals.map((withdrawal) => (
                      <TableRow key={withdrawal._id} className="border-gray-100">
                        <TableCell>
                          <div>
                            <p className="font-medium text-gray-900">
                              {withdrawal.organizer.firstName} {withdrawal.organizer.lastName}
                            </p>
                            <p className="text-sm text-gray-600">{withdrawal.organizer.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-semibold text-green-600">{withdrawal.amount.toFixed(2)} Birr</span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              withdrawal.status === "completed"
                                ? "bg-green-100 text-green-800 border-green-200"
                                : withdrawal.status === "approved"
                                  ? "bg-blue-100 text-blue-800 border-blue-200"
                                  : withdrawal.status === "rejected"
                                    ? "bg-red-100 text-red-800 border-red-200"
                                    : "bg-yellow-100 text-yellow-800 border-yellow-200"
                            }
                          >
                            {withdrawal.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="font-medium">{withdrawal.bankDetails.bankName}</div>
                            <div>{withdrawal.bankDetails.accountName}</div>
                            <div className="text-gray-500">{withdrawal.bankDetails.accountNumber}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-gray-600">
                          {new Date(withdrawal.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-gray-600">
                          {withdrawal.processedAt ? new Date(withdrawal.processedAt).toLocaleDateString() : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {withdrawal.status === "pending" && (
                            <Button
                              size="sm"
                              className="bg-blue-600 hover:bg-blue-700 text-white"
                              onClick={() => {
                                setSelectedWithdrawal(withdrawal)
                                setUpdateStatus(withdrawal.status as "approved" | "rejected" | "completed")
                                setTransactionId(withdrawal.transactionId || '')
                                setDialogOpen(true)
                              }}
                            >
                              Process
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm text-gray-600">
                Page {page} of {totalPages}
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                  disabled={page === 1}
                  className="border-gray-300 hover:bg-gray-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={page === totalPages}
                  className="border-gray-300 hover:bg-gray-50"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Update Status Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-gray-900">Update Withdrawal Status</DialogTitle>
              <DialogDescription>
                Update the status for {selectedWithdrawal?.organizer.firstName}{" "}
                {selectedWithdrawal?.organizer.lastName}'s request of {selectedWithdrawal?.amount.toFixed(2)} Birr.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-gray-700">Status</Label>
                <Select
                  value={updateStatus}
                  onValueChange={(value: "approved" | "rejected" | "completed") => setUpdateStatus(value)}
                >
                  <SelectTrigger className="border-gray-300" >
                    <SelectValue placeholder="Select status" />
                  
                  </SelectTrigger>
                  <SelectContent>
                    
                    <SelectItem value="approved">Approve</SelectItem>
                    <SelectItem value="rejected">Reject</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-gray-700">Transaction ID</Label>
                <Input
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  placeholder="Enter transaction ID (if applicable)"
                  className="border-gray-300"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                className="border-gray-300"
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdateStatus}
                className={
                  updateStatus === "rejected"
                    ? "bg-red-600 hover:bg-red-700 text-white"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                }
              >
                Update Status
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
} 