// "use client"

// import { useState, useEffect, useRef } from "react"
// import { Card, CardContent } from "@/components/ui/card"
// import { Badge } from "@/components/ui/badge"
// import { Button } from "@/components/ui/button"
// import { Input } from "@/components/ui/input"
// import { Label } from "@/components/ui/label"
// import { Textarea } from "@/components/ui/textarea"
// import { toast } from "sonner"
// import { DollarSign, Wallet, AlertCircle, Banknote } from "lucide-react"
// import {
//   Dialog,
//   DialogContent,
//   DialogDescription,
//   DialogFooter,
//   DialogHeader,
//   DialogTitle,
// } from "@/components/ui/dialog"
// import {
//   Table,
//   TableBody,
//   TableCell,
//   TableHead,
//   TableHeader,
//   TableRow,
// } from "@/components/ui/table"
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select"
// import { io, Socket } from "socket.io-client"

// interface Withdrawal {
//   _id: string;
//   amount: number;
//   status: 'pending' | 'approved' | 'rejected' | 'completed';
//   createdAt: string;
//   processedAt?: string;
//   notes?: string;
//   bankDetails: {
//     accountName: string;
//     accountNumber: string;
//     bankName: string;
//   };
//   transactionId?: string;
//   processedBy?: {
//     firstName: string;
//     lastName: string;
//     email: string;
//   };
// }

// interface BalanceData {
//   totalRevenue: number;
//   pendingWithdrawals: number;
//   approvedWithdrawals: number;
//   availableBalance: number;
//   revenueBreakdown: Array<{
//     eventId: string;
//     eventTitle: string;
//     totalRevenue: number;
//     ticketTypeBreakdown: Array<{
//       name: string;
//       price: number;
//       quantitySold: number;
//       revenue: number;
//     }>;
//     totalTicketsSold: number;
//   }>;
//   summary: {
//     totalEvents: number;
//     totalTicketsSold: number;
//     averageTicketPrice: number;
//   };
// }

// export default function WithdrawalsPage() {
//   const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
//   const [loading, setLoading] = useState(true)
//   const [balance, setBalance] = useState<BalanceData | null>(null)
//   const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false)
//   const [withdrawAmount, setWithdrawAmount] = useState("")
//   const [withdrawNotes, setWithdrawNotes] = useState("")
//   const [isSubmittingWithdraw, setIsSubmittingWithdraw] = useState(false)
//   const [statusFilter, setStatusFilter] = useState<string>("all")
//   const [currentPage, setCurrentPage] = useState(1)
//   const [itemsPerPage, setItemsPerPage] = useState(5)
//   const [totalPages, setTotalPages] = useState(1)
//   const [bankDetails, setBankDetails] = useState({
//     accountName: "",
//     accountNumber: "",
//     bankName: ""
//   })
//   const socketRef = useRef<Socket | null>(null);

//   useEffect(() => {
//     fetchWithdrawals()
//     fetchBalance()
//     // Socket.IO notification for withdrawal status updates
//     const storedAuth = localStorage.getItem("auth-storage");
//     let token = "";
//     let userId = "";
//     if (storedAuth) {
//       try {
//         const parsedAuth = JSON.parse(storedAuth);
//         token = parsedAuth.state?.token;
//         userId = parsedAuth.state?.user?._id;
//       } catch {}
//     }
//     if (!token || !userId) return;

//     if (!socketRef.current) {
//       socketRef.current = io(process.env.NEXT_PUBLIC_SOCKET_URL as string, {
//         auth: { token },
//         transports: ["websocket"],
//       });
//       socketRef.current.on("connect", () => {
//         console.log("Socket connected (withdrawals page):", socketRef.current?.id);
//       });
//       socketRef.current.on("disconnect", () => {
//         console.log("Socket disconnected (withdrawals page)");
//       });
//     }
//     socketRef.current.emit("joinOrganizerRoom", userId);
//     console.log("Emitted joinOrganizerRoom (withdrawals page):", userId);

//     socketRef.current.on("withdrawalStatusUpdated", (data) => {
//       console.log("Received withdrawalStatusUpdated (withdrawals page):", data);
//       toast.success(
//         `Your withdrawal of ${data.amount} Birr has been ${data.status}.`
//       );
//       // Optionally refresh the withdrawal list
//       fetchWithdrawals();
//     });

//     return () => {
//       if (socketRef.current) {
//         socketRef.current.off("withdrawalStatusUpdated");
//         socketRef.current.disconnect();
//         socketRef.current = null;
//       }
//     };
//   }, [currentPage, itemsPerPage, statusFilter])

//   const fetchWithdrawals = async () => {
//     try {
//       setLoading(true)
//       const storedAuth = localStorage.getItem("auth-storage")
//       let token = ""
//       let userId = ""
//       if (storedAuth) {
//         try {
//           const parsedAuth = JSON.parse(storedAuth)
//           token = parsedAuth.state?.token
//           userId = parsedAuth.state?.user?._id
//         } catch {}
//       }
//       if (!token || !userId) {
//         toast.error('Please login to view withdrawals')
//         return
//       }
//       const response = await fetch(
//         `${process.env.NEXT_PUBLIC_API_URL}/api/withdrawals/organizer/${userId}/withdrawals?page=${currentPage}&limit=${itemsPerPage}&status=${statusFilter}`,
//         {
//           method: 'GET',
//           headers: {
//             'Authorization': `Bearer ${token}`,
//             'Content-Type': 'application/json'
//           },
//           credentials: 'include',
//         }
//       )
//       if (!response.ok) {
//         const errorData = await response.json()
//         throw new Error(errorData.message || 'Failed to fetch withdrawals')
//       }
//       const data = await response.json()
//       if (data.success) {
//         setWithdrawals(data.data || [])
//         setTotalPages(data.pagination?.pages || 1)
//       } else {
//         throw new Error(data.message || 'Failed to fetch withdrawals')
//       }
//     } catch (error) {
//       console.error('Error fetching withdrawals:', error)
//       toast.error(error instanceof Error ? error.message : 'Failed to fetch withdrawals')
//     } finally {
//       setLoading(false)
//     }
//   }

//   const fetchBalance = async () => {
//     try {
//       const storedAuth = localStorage.getItem("auth-storage")
//       let token = ""
//       let userId = ""
//       if (storedAuth) {
//         try {
//           const parsedAuth = JSON.parse(storedAuth)
//           token = parsedAuth.state?.token
//           userId = parsedAuth.state?.user?._id
//         } catch {}
//       }
//       if (!token || !userId) {
//         toast.error('Please login to view balance')
//         return
//       }
//       const response = await fetch(
//         `${process.env.NEXT_PUBLIC_API_URL}/api/withdrawals/organizer/${userId}/balance`,
//         {
//           method: 'GET',
//           headers: {
//             'Authorization': `Bearer ${token}`,
//             'Content-Type': 'application/json'
//           },
//           credentials: 'include',
//         }
//       )
//       if (!response.ok) {
//         const errorData = await response.json()
//         throw new Error(errorData.message || 'Failed to fetch balance')
//       }
//       const data = await response.json()
//       if (data.success) {
//         setBalance(data.data)
//       } else {
//         throw new Error(data.message || 'Failed to fetch balance')
//       }
//     } catch (error) {
//       console.error('Error fetching balance:', error)
//       toast.error(error instanceof Error ? error.message : 'Failed to fetch balance')
//     }
//   }

//   const handleWithdraw = async () => {
//     if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
//       toast.error('Please enter a valid amount')
//       return
//     }
//     if (parseFloat(withdrawAmount) > (balance?.availableBalance ?? 0) || !balance) {
//       toast.error('Withdrawal amount cannot exceed available balance')
//       return
//     }
//     if (!bankDetails.bankName) {
//       toast.error('Please select a payment method')
//       return
//     }
//     if ((bankDetails.bankName === 'telebirr' || bankDetails.bankName === 'mpesa') && !bankDetails.accountNumber) {
//       toast.error('Please provide the phone number for the selected payment method')
//       return
//     }
//     if (bankDetails.bankName === 'bank' && (!bankDetails.accountName || !bankDetails.accountNumber)) {
//       toast.error('Please provide all bank account details')
//       return
//     }
//     try {
//       setIsSubmittingWithdraw(true)
//       const storedAuth = localStorage.getItem("auth-storage")
//       let token = ""
//       let userId = ""
//       if (storedAuth) {
//         try {
//           const parsedAuth = JSON.parse(storedAuth)
//           token = parsedAuth.state?.token
//           userId = parsedAuth.state?.user?._id
//         } catch {}
//       }
//       if (!token || !userId) {
//         toast.error('Please login to request withdrawal')
//         return
//       }
//       const response = await fetch(
//         `${process.env.NEXT_PUBLIC_API_URL}/api/withdrawals`,
//         {
//           method: 'POST',
//           headers: {
//             'Authorization': `Bearer ${token}`,
//             'Content-Type': 'application/json',
//           },
//           credentials: 'include',
//           body: JSON.stringify({
//             amount: parseFloat(withdrawAmount),
//             notes: withdrawNotes,
//             bankDetails
//           }),
//         }
//       )
//       if (!response.ok) {
//         const errorData = await response.json()
//         throw new Error(errorData.message || 'Failed to request withdrawal')
//       }
//       const data = await response.json()
//       if (data.success) {
//         toast.success('Withdrawal request submitted successfully')
//         setWithdrawDialogOpen(false)
//         setWithdrawAmount("")
//         setWithdrawNotes("")
//         setBankDetails({
//           accountName: "",
//           accountNumber: "",
//           bankName: ""
//         })
//         fetchWithdrawals()
//         fetchBalance()
//       } else {
//         throw new Error(data.message || 'Failed to request withdrawal')
//       }
//     } catch (error) {
//       console.error('Error requesting withdrawal:', error)
//       toast.error(error instanceof Error ? error.message : 'Failed to request withdrawal')
//     } finally {
//       setIsSubmittingWithdraw(false)
//     }
//   }

//   if (loading) {
//     return (
//       <div className="flex items-center justify-center min-h-screen">
//         <div className="text-center">
//           <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1a2d5a] mx-auto"></div>
//           <p className="mt-2 text-muted-foreground">Loading withdrawals...</p>
//         </div>
//       </div>
//     )
//   }

//   return (
//     <div className="container mx-auto py-10 p-10">
//       {/* Header */}
//       <div className="mb-8">
//         <h1 className="text-3xl font-bold">Withdrawals</h1>
//         <p className="text-muted-foreground mt-1">Manage your earnings and withdrawal requests</p>
//       </div>

//       {/* Balance Cards */}
//       <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
//         <Card>
//           <CardContent className="p-6">
//             <div className="flex items-center gap-4">
//               <div className="p-3 rounded-full bg-[#1a2d5a]/10">
//                 <Wallet className="h-6 w-6 text-[#1a2d5a]" />
//               </div>
//               <div>
//                 <div className="text-sm font-medium text-muted-foreground">Available Balance</div>
//                 <div className="text-2xl font-bold mt-1">{balance?.availableBalance.toFixed(2) || '0.00'} birr</div>
//               </div>
//             </div>
//           </CardContent>
//         </Card>

//         <Card>
//           <CardContent className="p-6">
//             <div className="flex items-center gap-4">
//               <div className="p-3 rounded-full bg-green-500/10">
//                 <DollarSign className="h-6 w-6 text-green-500" />
//               </div>
//               <div>
//                 <div className="text-sm font-medium text-muted-foreground">Approved Withdrawals</div>
//                 <div className="text-2xl font-bold mt-1">{balance?.approvedWithdrawals.toFixed(2) || '0.00'} birr</div>
//               </div>
//             </div>
//           </CardContent>
//         </Card>

//         <Card>
//           <CardContent className="p-6">
//             <div className="flex items-center gap-4">
//               <div className="p-3 rounded-full bg-yellow-500/10">
//                 <AlertCircle className="h-6 w-6 text-yellow-500" />
//               </div>
//               <div>
//                 <div className="text-sm font-medium text-muted-foreground">Pending Withdrawals</div>
//                 <div className="text-2xl font-bold mt-1">{balance?.pendingWithdrawals.toFixed(2) || '0.00'} birr</div>
//               </div>
//             </div>
//           </CardContent>
//         </Card>
//       </div>

//       {/* Withdrawal Request Button */}
//       <div className="mb-8">
//         <Button
//           onClick={() => setWithdrawDialogOpen(true)}
//           disabled={!balance || balance.availableBalance <= 0}
//           className="bg-[#1a2d5a] hover:bg-[#1a2d5a]/90"
//         >
//           <DollarSign className="h-4 w-4 mr-2" />
//           Request Withdrawal
//         </Button>
//       </div>

//       {/* Withdrawals Table */}
//       <Card>
//         <CardContent className="p-6">
//           <div className="flex justify-between items-center mb-6">
//             <h2 className="text-xl font-semibold">Withdrawal History</h2>
//             <Select value={statusFilter} onValueChange={setStatusFilter}>
//               <SelectTrigger className="w-[180px]">
//                 <SelectValue placeholder="Filter by status" />
//               </SelectTrigger>
//               <SelectContent>
//                 <SelectItem value="all">All Status</SelectItem>
//                 <SelectItem value="pending">Pending</SelectItem>
//                 <SelectItem value="completed">Completed</SelectItem>
//                 <SelectItem value="rejected">Rejected</SelectItem>
//               </SelectContent>
//             </Select>
//           </div>

//           <Table>
//             <TableHeader>
//               <TableRow>
//                 <TableHead>Date</TableHead>
//                 <TableHead>Amount</TableHead>
//                 <TableHead>Status</TableHead>
//                 <TableHead>Notes</TableHead>
//                 <TableHead>Processed By</TableHead>
//               </TableRow>
//             </TableHeader>
//             <TableBody>
//               {withdrawals.length === 0 ? (
//                 <TableRow>
//                   <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
//                     No withdrawal requests found
//                   </TableCell>
//                 </TableRow>
//               ) : (
//                 withdrawals.map((withdrawal) => (
//                   <TableRow key={withdrawal._id}>
//                     <TableCell>
//                       {new Date(withdrawal.createdAt).toLocaleDateString()}
//                     </TableCell>
//                     <TableCell className="font-medium">{withdrawal.amount.toFixed(2)} birr</TableCell>
//                     <TableCell>
//                       <Badge 
//                         variant={withdrawal.status === 'completed' ? 'default' : 'secondary'}
//                         className={`px-3 py-1 ${
//                           withdrawal.status === 'completed' 
//                             ? 'bg-green-500 text-white' 
//                             : withdrawal.status === 'pending'
//                             ? 'bg-yellow-500 text-white'
//                             : 'bg-red-500 text-white'
//                         }`}
//                       >
//                         {withdrawal.status}
//                       </Badge>
//                     </TableCell>
//                     <TableCell className="max-w-[200px] truncate">{withdrawal.notes}</TableCell>
//                     <TableCell>{withdrawal.processedBy?.firstName || '-'}</TableCell>
//                   </TableRow>
//                 ))
//               )}
//             </TableBody>
//           </Table>
//         </CardContent>
//       </Card>

//       {/* Withdrawal Request Dialog */}
//       <Dialog open={withdrawDialogOpen} onOpenChange={setWithdrawDialogOpen}>
//         <DialogContent>
//           <DialogHeader>
//             <DialogTitle>Request Withdrawal</DialogTitle>
//             <DialogDescription>
//               Enter the amount you wish to withdraw from your available balance.
//             </DialogDescription>
//           </DialogHeader>
//           <div className="space-y-4 py-4">
//             <div className="space-y-2">
//               <Label>Amount (birr)</Label>
//               <Input
//                 type="number"
//                 value={withdrawAmount}
//                 onChange={(e) => setWithdrawAmount(e.target.value)}
//                 placeholder="Enter amount"
//                 min="0"
//                 step="0.01"
//               />
//             </div>
//             <div className="space-y-2">
//               <Label>Payment Method</Label>
//               <Select
//                 value={bankDetails.bankName}
//                 onValueChange={(value) => setBankDetails((prev) => ({ ...prev, bankName: value, accountName: "", accountNumber: "" }))}
//               >
//                 <SelectTrigger>
//                   <SelectValue placeholder="Select payment method" />
//                 </SelectTrigger>
//                 <SelectContent>
//                   <SelectItem value="telebirr">Telebirr</SelectItem>
//                   <SelectItem value="mpesa">M-Pesa</SelectItem>
//                   <SelectItem value="bank">Bank Transfer</SelectItem>
//                 </SelectContent>
//               </Select>
//             </div>
//             {bankDetails.bankName === 'telebirr' && (
//               <div className="space-y-2">
//                 <Label>Telebirr Phone Number</Label>
//                 <Input
//                   value={bankDetails.accountNumber}
//                   onChange={(e) => setBankDetails((prev) => ({ ...prev, accountNumber: e.target.value }))}
//                   placeholder="Enter Telebirr phone number"
//                 />
//               </div>
//             )}
//             {bankDetails.bankName === 'mpesa' && (
//               <div className="space-y-2">
//                 <Label>M-Pesa Phone Number</Label>
//                 <Input
//                   value={bankDetails.accountNumber}
//                   onChange={(e) => setBankDetails((prev) => ({ ...prev, accountNumber: e.target.value }))}
//                   placeholder="Enter M-Pesa phone number"
//                 />
//               </div>
//             )}
//             {bankDetails.bankName === 'bank' && (
//               <>
//                 <div className="space-y-2">
//                   <Label>Bank Account Name</Label>
//                   <Input
//                     value={bankDetails.accountName}
//                     onChange={(e) => setBankDetails((prev) => ({ ...prev, accountName: e.target.value }))}
//                     placeholder="Enter account name"
//                   />
//                 </div>
//                 <div className="space-y-2">
//                   <Label>Bank Account Number</Label>
//                   <Input
//                     value={bankDetails.accountNumber}
//                     onChange={(e) => setBankDetails((prev) => ({ ...prev, accountNumber: e.target.value }))}
//                     placeholder="Enter account number"
//                   />
//                 </div>
//               </>
//             )}
//             <div className="space-y-2">
//               <Label>Notes (optional)</Label>
//               <Textarea
//                 value={withdrawNotes}
//                 onChange={(e) => setWithdrawNotes(e.target.value)}
//                 placeholder="Add any notes about this withdrawal request"
//                 rows={3}
//               />
//             </div>
//             <div className="p-4 bg-muted/50 rounded-lg">
//               <div className="flex items-center gap-2 text-sm text-muted-foreground">
//                 <AlertCircle className="h-4 w-4" />
//                 <span>Available Balance: {(balance?.availableBalance ?? 0).toFixed(2)} birr</span>
//               </div>
//             </div>
//           </div>
//           <DialogFooter>
//             <Button
//               variant="outline"
//               onClick={() => setWithdrawDialogOpen(false)}
//             >
//               Cancel
//             </Button>
//             <Button
//               onClick={handleWithdraw}
//               disabled={!withdrawAmount || isSubmittingWithdraw || parseFloat(withdrawAmount) <= 0 || parseFloat(withdrawAmount) > balance?.availableBalance || !bankDetails.bankName || ((bankDetails.bankName === 'telebirr' || bankDetails.bankName === 'mpesa') && !bankDetails.accountNumber) || (bankDetails.bankName === 'bank' && (!bankDetails.accountName || !bankDetails.accountNumber))}
//               className="bg-[#1a2d5a] hover:bg-[#1a2d5a]/90"
//             >
//               {isSubmittingWithdraw ? 'Processing...' : 'Request Withdrawal'}
//             </Button>
//           </DialogFooter>
//         </DialogContent>
//       </Dialog>
//     </div>
//   )
// } 



"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { DollarSign, Wallet, AlertCircle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { io, type Socket } from "socket.io-client"

interface Withdrawal {
  _id: string
  amount: number
  status: "pending" | "approved" | "rejected" | "completed"
  createdAt: string
  processedAt?: string
  notes?: string
  bankDetails: {
    accountName: string
    accountNumber: string
    bankName: string
  }
  transactionId?: string
  processedBy?: {
    firstName: string
    lastName: string
    email: string
  }
}

interface BalanceData {
  totalRevenue: number
  pendingWithdrawals: number
  approvedWithdrawals: number
  availableBalance: number
  revenueBreakdown: Array<{
    eventId: string
    eventTitle: string
    totalRevenue: number
    ticketTypeBreakdown: Array<{
      name: string
      price: number
      quantitySold: number
      revenue: number
    }>
    totalTicketsSold: number
  }>
  summary: {
    totalEvents: number
    totalTicketsSold: number
    averageTicketPrice: number
  }
}

export default function WithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [loading, setLoading] = useState(true)
  const [balance, setBalance] = useState<BalanceData | null>(null)
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState("")
  const [withdrawNotes, setWithdrawNotes] = useState("")
  const [isSubmittingWithdraw, setIsSubmittingWithdraw] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(5)
  const [totalPages, setTotalPages] = useState(1)
  const [bankDetails, setBankDetails] = useState({
    accountName: "",
    accountNumber: "",
    bankName: "",
  })
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    fetchWithdrawals()
    fetchBalance()

    // Socket.IO notification for withdrawal status updates
    const storedAuth = localStorage.getItem("auth-storage")
    let token = ""
    let userId = ""
    if (storedAuth) {
      try {
        const parsedAuth = JSON.parse(storedAuth)
        token = parsedAuth.state?.token
        userId = parsedAuth.state?.user?._id
      } catch {}
    }

    if (!token || !userId) return

    if (!socketRef.current) {
      socketRef.current = io(process.env.NEXT_PUBLIC_SOCKET_URL as string, {
        auth: { token },
        transports: ["websocket"],
      })

      socketRef.current.on("connect", () => {
        // console.log("Socket connected (withdrawals page):", socketRef.current?.id)
      })

      socketRef.current.on("disconnect", () => {
        // console.log("Socket disconnected (withdrawals page)")
      })
    }

    socketRef.current.emit("joinOrganizerRoom", userId)
    // console.log("Emitted joinOrganizerRoom (withdrawals page):", userId)

    socketRef.current.on("withdrawalStatusUpdated", (data) => {
      // console.log("Received withdrawalStatusUpdated (withdrawals page):", data)
      toast.success(`Your withdrawal of ${data.amount} Birr has been ${data.status}.`)
      // Optionally refresh the withdrawal list
      fetchWithdrawals()
    })

    return () => {
      if (socketRef.current) {
        socketRef.current.off("withdrawalStatusUpdated")
        socketRef.current.disconnect()
        socketRef.current = null
      }
    }
  }, [currentPage, itemsPerPage, statusFilter])

  const fetchWithdrawals = async () => {
    try {
      setLoading(true)
      const storedAuth = localStorage.getItem("auth-storage")
      let token = ""
      let userId = ""
      if (storedAuth) {
        try {
          const parsedAuth = JSON.parse(storedAuth)
          token = parsedAuth.state?.token
          userId = parsedAuth.state?.user?._id
        } catch {}
      }

      if (!token || !userId) {
        toast.error("Please login to view withdrawals")
        return
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/withdrawals/organizer/${userId}/withdrawals?page=${currentPage}&limit=${itemsPerPage}&status=${statusFilter}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          credentials: "include",
        },
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to fetch withdrawals")
      }

      const data = await response.json()

      console.log('Withdrawal fetch response:', data)
      if (data.success) {
        setWithdrawals(data.data || [])
        setTotalPages(data.pagination?.pages || 1)
      } else {
        throw new Error(data.message || "Failed to fetch withdrawals")
      }
    } catch (error) {
      console.error("Error fetching withdrawals:", error)
      toast.error(error instanceof Error ? error.message : "Failed to fetch withdrawals")
    } finally {
      setLoading(false)
    }
  }

  const fetchBalance = async () => {
    try {
      const storedAuth = localStorage.getItem("auth-storage")
      let token = ""
      let userId = ""
      if (storedAuth) {
        try {
          const parsedAuth = JSON.parse(storedAuth)
          token = parsedAuth.state?.token
          userId = parsedAuth.state?.user?._id
        } catch {}
      }

      if (!token || !userId) {
        toast.error("Please login to view balance")
        return
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/withdrawals/organizer/${userId}/balance`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to fetch balance")
      }

      const data = await response.json()
      if (data.success) {
        setBalance(data.data)
      } else {
        throw new Error(data.message || "Failed to fetch balance")
      }
    } catch (error) {
      console.error("Error fetching balance:", error)
      toast.error(error instanceof Error ? error.message : "Failed to fetch balance")
    }
  }

  const handleWithdraw = async () => {
    if (!withdrawAmount || Number.parseFloat(withdrawAmount) <= 0) {
      toast.error("Please enter a valid amount")
      return
    }
    if (Number.parseFloat(withdrawAmount) > (balance?.availableBalance ?? 0) || !balance) {
      toast.error("Withdrawal amount cannot exceed available balance")
      return
    }
    if (!bankDetails.bankName) {
      toast.error("Please select a payment method")
      return
    }
    if ((bankDetails.bankName === "telebirr" || bankDetails.bankName === "mpesa") && !bankDetails.accountNumber) {
      toast.error("Please provide the phone number for the selected payment method")
      return
    }
    if (bankDetails.bankName === "bank" && (!bankDetails.accountName || !bankDetails.accountNumber)) {
      toast.error("Please provide all bank account details")
      return
    }

    try {
      setIsSubmittingWithdraw(true)
      const storedAuth = localStorage.getItem("auth-storage")
      let token = ""
      let userId = ""
      if (storedAuth) {
        try {
          const parsedAuth = JSON.parse(storedAuth)
          token = parsedAuth.state?.token
          userId = parsedAuth.state?.user?._id
        } catch {}
      }

      if (!token || !userId) {
        toast.error("Please login to request withdrawal")
        return
      }

      const requestBody = {
        amount: Number.parseFloat(withdrawAmount),
        notes: withdrawNotes,
        bankDetails,
      }
      
      console.log('Sending withdrawal request:', requestBody)
      console.log('API URL:', `${process.env.NEXT_PUBLIC_API_URL}/api/withdrawals`)
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/withdrawals`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to request withdrawal")
      }

      const data = await response.json()
      console.log('Withdrawal request response:', data)
      if (data.success) {
        toast.success("Withdrawal request submitted successfully")
        setWithdrawDialogOpen(false)
        setWithdrawAmount("")
        setWithdrawNotes("")
        setBankDetails({
          accountName: "",
          accountNumber: "",
          bankName: "",
        })
        fetchWithdrawals()
        fetchBalance()
      } else {
        throw new Error(data.message || "Failed to request withdrawal")
      }
    } catch (error) {
      console.error("Error requesting withdrawal:", error)
      if (error instanceof Error) {
        console.error('Error details:', error.message)
        toast.error(error.message)
      } else {
        console.error('Unknown error:', error)
        toast.error("Failed to request withdrawal")
      }
    } finally {
      setIsSubmittingWithdraw(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1a2d5a] mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading withdrawals...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold">Withdrawals</h1>
        <p className="text-muted-foreground text-sm sm:text-base mt-1">Manage your earnings and withdrawal requests</p>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-2 sm:p-3 rounded-full bg-[#1a2d5a]/10">
                <Wallet className="h-5 w-5 sm:h-6 sm:w-6 text-[#1a2d5a]" />
              </div>
              <div>
                <div className="text-xs sm:text-sm font-medium text-muted-foreground">Available Balance (97%)</div>
                <div className="text-xl sm:text-2xl font-bold mt-1">
                  {balance?.availableBalance.toFixed(2) || "0.00"} birr
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  After 3% commission
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-2 sm:p-3 rounded-full bg-red-500/10">
                <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-red-500" />
              </div>
              <div>
                <div className="text-xs sm:text-sm font-medium text-muted-foreground">Pazimo Commission (3%)</div>
                <div className="text-xl sm:text-2xl font-bold mt-1">
                  {((balance?.totalRevenue ?? 0) * 0.03).toFixed(2)} birr
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Platform fee
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-2 sm:p-3 rounded-full bg-green-500/10">
                <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-green-500" />
              </div>
              <div>
                <div className="text-xs sm:text-sm font-medium text-muted-foreground">Approved Withdrawals</div>
                <div className="text-xl sm:text-2xl font-bold mt-1">
                  {balance?.approvedWithdrawals.toFixed(2) || "0.00"} birr
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="p-2 sm:p-3 rounded-full bg-yellow-500/10">
                <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-500" />
              </div>
              <div>
                <div className="text-xs sm:text-sm font-medium text-muted-foreground">Pending Withdrawals</div>
                <div className="text-xl sm:text-2xl font-bold mt-1">
                  {balance?.pendingWithdrawals.toFixed(2) || "0.00"} birr
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Withdrawal Request Button */}
      <div className="mb-6 sm:mb-8">
        <Button
          onClick={() => setWithdrawDialogOpen(true)}
          disabled={!balance || balance.availableBalance <= 0}
          className="w-full sm:w-auto bg-[#1a2d5a] hover:bg-[#1a2d5a]/90 text-sm sm:text-base py-2 sm:py-2.5 px-4 sm:px-5"
        >
          <DollarSign className="h-4 w-4 mr-2" />
          Request Withdrawal
        </Button>
      </div>

      {/* Withdrawals Table */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-3 sm:gap-0">
            <h2 className="text-lg sm:text-xl font-semibold">Withdrawal History</h2>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px] h-9 text-sm sm:text-base">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs sm:text-sm">Date</TableHead>
                  <TableHead className="text-xs sm:text-sm">Amount</TableHead>
                  <TableHead className="text-xs sm:text-sm">Status</TableHead>
                  <TableHead className="text-xs sm:text-sm">Transaction ID</TableHead>
                  <TableHead className="text-xs sm:text-sm">Notes</TableHead>
                  <TableHead className="text-xs sm:text-sm">Processed By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {withdrawals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground text-sm py-8">
                      No withdrawal requests found
                    </TableCell>
                  </TableRow>
                ) : (
                  withdrawals.map((withdrawal) => (
                    <TableRow key={withdrawal._id}>
                      <TableCell className="text-xs sm:text-sm">
                        {new Date(withdrawal.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="font-medium text-xs sm:text-sm">
                        {withdrawal.amount.toFixed(2)} birr
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm">
                        <Badge
                          variant="outline"
                          className={`px-2 py-0.5 sm:px-3 sm:py-1 text-xs ${
                            withdrawal.status === "completed"
                              ? "bg-green-500 text-white"
                              : withdrawal.status === "pending"
                                ? "bg-yellow-500 text-white"
                                : "bg-red-500 text-white"
                          }`}
                        >
                          {withdrawal.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm">{withdrawal.transactionId || "-"}</TableCell>
                      <TableCell className="max-w-[150px] sm:max-w-[200px] truncate text-xs sm:text-sm">
                        {withdrawal.notes}
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm">{withdrawal.processedBy?.firstName || "-"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-0">
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm text-gray-600">Rows per page:</span>
                <Select
                  value={itemsPerPage.toString()}
                  onValueChange={(value) => {
                    setItemsPerPage(Number(value))
                    setCurrentPage(1)
                  }}
                >
                  <SelectTrigger className="w-[70px] h-8 sm:w-20 sm:h-9 border-gray-200 text-xs sm:text-sm">
                    <SelectValue placeholder="5" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 sm:h-9 sm:w-9 border-gray-200 hover:bg-gray-50 bg-transparent"
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-3 w-3 sm:h-4 sm:w-4"
                  >
                    <path d="m15 18-6-6 6-6" />
                  </svg>
                </Button>
                <span className="text-xs sm:text-sm font-medium">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 sm:h-9 sm:w-9 border-gray-200 hover:bg-gray-50 bg-transparent"
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-3 w-3 sm:h-4 sm:w-4"
                  >
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Withdrawal Request Dialog */}
      <Dialog open={withdrawDialogOpen} onOpenChange={setWithdrawDialogOpen}>
        <DialogContent className="sm:max-w-[425px] p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">Request Withdrawal</DialogTitle>
            <DialogDescription className="text-sm sm:text-base">
              Enter the amount you wish to withdraw from your available balance.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="withdraw-amount" className="text-sm">
                Amount (birr)
              </Label>
              <Input
                id="withdraw-amount"
                type="number"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="Enter amount"
                min="0"
                step="0.01"
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-method" className="text-sm">
                Payment Method
              </Label>
              <Select
                value={bankDetails.bankName}
                onValueChange={(value) =>
                  setBankDetails((prev) => ({ ...prev, bankName: value, accountName: "", accountNumber: "" }))
                }
              >
                <SelectTrigger id="payment-method" className="text-sm">
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="telebirr">Telebirr</SelectItem>
                  <SelectItem value="mpesa">M-Pesa</SelectItem>
                  <SelectItem value="bank">Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {bankDetails.bankName === "telebirr" && (
              <div className="space-y-2">
                <Label htmlFor="telebirr-phone" className="text-sm">
                  Telebirr Phone Number
                </Label>
                <Input
                  id="telebirr-phone"
                  value={bankDetails.accountNumber}
                  onChange={(e) => setBankDetails((prev) => ({ ...prev, accountNumber: e.target.value }))}
                  placeholder="Enter Telebirr phone number"
                  className="text-sm"
                />
              </div>
            )}
            {bankDetails.bankName === "mpesa" && (
              <div className="space-y-2">
                <Label htmlFor="mpesa-phone" className="text-sm">
                  M-Pesa Phone Number
                </Label>
                <Input
                  id="mpesa-phone"
                  value={bankDetails.accountNumber}
                  onChange={(e) => setBankDetails((prev) => ({ ...prev, accountNumber: e.target.value }))}
                  placeholder="Enter M-Pesa phone number"
                  className="text-sm"
                />
              </div>
            )}
          
{bankDetails.bankName === 'bank' && (
  <>
    <div className="space-y-2">
      <Label className="text-gray-700">Bank Name</Label>
      <Select
        value={bankDetails.accountName}
        onValueChange={(value) => setBankDetails((prev) => ({ ...prev, accountName: value }))}
      >
        <SelectTrigger className="border-gray-300">
          <SelectValue placeholder="Select bank" />
        </SelectTrigger>
       <SelectContent>
  <SelectItem value="Commercial Bank of Ethiopia">Commercial Bank of Ethiopia</SelectItem>
  <SelectItem value="Awash International Bank">Awash International Bank</SelectItem>
  <SelectItem value="Bank of Abyssinia">Bank of Abyssinia</SelectItem>
  <SelectItem value="Dashen Bank">Dashen Bank</SelectItem>
  <SelectItem value="Hibret Bank">Hibret Bank</SelectItem>
  <SelectItem value="Nib International Bank">Nib International Bank</SelectItem>
  <SelectItem value="Cooperative Bank of Oromia">Cooperative Bank of Oromia</SelectItem>
  <SelectItem value="Lion International Bank">Lion International Bank</SelectItem>
  <SelectItem value="Wegagen Bank">Wegagen Bank</SelectItem>
  <SelectItem value="Zemen Bank">Zemen Bank</SelectItem>
  <SelectItem value="Oromia International Bank">Oromia International Bank</SelectItem>
  <SelectItem value="Global Bank Ethiopia">Global Bank Ethiopia</SelectItem>
  <SelectItem value="Enat Bank">Enat Bank</SelectItem>
  <SelectItem value="Addis International Bank">Addis International Bank</SelectItem>
  <SelectItem value="Abay Bank">Abay Bank</SelectItem>
  <SelectItem value="Berhan International Bank">Berhan International Bank</SelectItem>
  <SelectItem value="Bunna International Bank">Bunna International Bank</SelectItem>
  <SelectItem value="ZamZam Bank">ZamZam Bank</SelectItem>
  <SelectItem value="Shabelle Bank">Shabelle Bank</SelectItem>
  <SelectItem value="Hijra Bank">Hijra Bank</SelectItem>
  <SelectItem value="Siinqee Bank">Siinqee Bank</SelectItem>
  <SelectItem value="Ahadu Bank">Ahadu Bank</SelectItem>
  <SelectItem value="Goh Betoch Bank">Goh Betoch Bank</SelectItem>
  <SelectItem value="Tsedey Bank">Tsedey Bank</SelectItem>
  <SelectItem value="Tsehay Bank">Tsehay Bank</SelectItem>
  <SelectItem value="Gadaa Bank">Gadaa Bank</SelectItem>
  <SelectItem value="Amhara Bank">Amhara Bank</SelectItem>
  <SelectItem value="Rammis Bank">Rammis Bank</SelectItem>
</SelectContent>

      </Select>
    </div>
    <div className="space-y-2">
      <Label className="text-gray-700">Bank Account Number</Label>
      <Input
        value={bankDetails.accountNumber}
        onChange={(e) => setBankDetails((prev) => ({ ...prev, accountNumber: e.target.value }))}
        placeholder="Enter account number"
        className="border-gray-300"
      />
    </div>
  </>
)}

            <div className="space-y-2">
              <Label htmlFor="notes" className="text-sm">
                Notes (optional)
              </Label>
              <Textarea
                id="notes"
                value={withdrawNotes}
                onChange={(e) => setWithdrawNotes(e.target.value)}
                placeholder="Add any notes about this withdrawal request"
                rows={3}
                className="text-sm"
              />
            </div>
            <div className="p-3 bg-muted/50 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4" />
                 <span>Available Balance (After 3% Commission): {(balance?.availableBalance ?? 0).toFixed(2)} birr</span>
              </div>
             
            </div>
          </div>
          <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setWithdrawDialogOpen(false)} className="w-full sm:w-auto text-sm">
              Cancel
            </Button>
            <Button
              onClick={handleWithdraw}
              disabled={
                !withdrawAmount ||
                isSubmittingWithdraw ||
                Number.parseFloat(withdrawAmount) <= 0 ||
                Number.parseFloat(withdrawAmount) > (balance?.availableBalance ?? 0) ||
                !bankDetails.bankName ||
                ((bankDetails.bankName === "telebirr" || bankDetails.bankName === "mpesa") &&
                  !bankDetails.accountNumber) ||
                (bankDetails.bankName === "bank" && (!bankDetails.accountName || !bankDetails.accountNumber))
              }
              className="w-full sm:w-auto bg-[#1a2d5a] hover:bg-[#1a2d5a]/90 text-white text-sm"
            >
              {isSubmittingWithdraw ? "Processing..." : "Request Withdrawal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
