"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Mail,
  Phone,
  User,
  DollarSign,
  ArrowLeft,
  Trash2,
} from "lucide-react";
import { useAdminAuthStore } from "@/store/adminAuthStore";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface InvitationData {
  _id: string;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  eventId: {
    _id: string;
    title: string;
  };
  organizerId: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  type: "email" | "sms" | "both";
  guestType: "guest" | "paid";
  ticketType?: string;
  amount: number;
  status: string;
  paymentStatus: string;
  estimatedCost: number;
  createdAt: string;
  rsvpStatus?: string;
}

export default function EventInvitationsPage() {
  const { token } = useAdminAuthStore();
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;

  const [invitations, setInvitations] = useState<InvitationData[]>([]);
  const [filteredInvitations, setFilteredInvitations] = useState<
    InvitationData[]
  >([]);
  interface TicketData {
    _id?: string;
    guestEmail?: string;
    guestPhone?: string;
    purchaseQuantity?: number;
    ticketCount?: number;
    ticketType?: string;
    isInvitation?: boolean;
    user?: {
      email?: string;
      phoneNumber?: string;
    };
  }
  const [eventTickets, setEventTickets] = useState<TicketData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalExpense, setTotalExpense] = useState(0);
  const [eventName, setEventName] = useState("");

  useEffect(() => {
    if (eventId) {
      fetchInvitations();
      fetchTickets();
    }
    // eslint-disable-next-line
  }, [eventId]);

  const fetchTickets = async () => {
    try {
      let allTickets: any[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/tickets/event/${eventId}?page=${page}&limit=500`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (response.ok) {
          const data = await response.json();
          allTickets = [...allTickets, ...(data.tickets || [])];
          hasMore = data.hasMore || false;
          page++;
        } else {
          hasMore = false;
        }
      }

      setEventTickets(allTickets);
    } catch {
      setEventTickets([]);
    }
  };

  useEffect(() => {
    // Filter and paginate locally
    let result = invitations;

    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(
        (inv) =>
          inv.guestName.toLowerCase().includes(lowerQuery) ||
          (inv.guestEmail &&
            inv.guestEmail.toLowerCase().includes(lowerQuery)) ||
          (inv.guestPhone && inv.guestPhone.includes(lowerQuery))
      );
    }
    // const router = useRouter();
    setFilteredInvitations(result);
    setCurrentPage(1); // Reset to first page on search
  }, [searchQuery, invitations]);

  // Duplicate TicketData interface and eventTickets state removed.
  const fetchInvitations = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        eventId: eventId,
      });

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/invitations/admin/all?${queryParams}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch invitations");
      }

      const data = await response.json();
      setInvitations(data.data);
      setFilteredInvitations(data.data);
      setTotalExpense(data.totalExpense || 0);

      if (data.data.length > 0 && data.data[0].eventId) {
        setEventName(data.data[0].eventId.title);
      }
    } catch (error) {
      console.error("Error fetching invitations:", error);
      toast.error("Failed to fetch invitations");
    } finally {
      setLoading(false);
    }
  };

  // Get current page items
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredInvitations.slice(
    indexOfFirstItem,
    indexOfLastItem
  );
  const totalPages = Math.ceil(filteredInvitations.length / itemsPerPage);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-ET", {
      style: "currency",
      currency: "ETB",
    }).format(amount);
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/invitations/${id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) throw new Error("Failed to delete");

      toast.success("Invitation deleted");
      fetchInvitations(); // Refresh list
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete invitation");
    }
  };

  // Helper to get ticket for invitation
  const getTicketForInvitation = (
    inv: InvitationData,
    claimedIds: Set<string>
  ) => {
    // Match by guestEmail or guestPhone
    return eventTickets.find((t) => {
      // Only match invitation tickets that belong to this invitation
      if (!t.isInvitation) return false;

      // Skip if already claimed by another invitation in this view
      if (t._id && claimedIds.has(t._id)) return false;

      // 1. Normalize invitation contacts
      const invEmail = (inv.guestEmail || "").toLowerCase().trim();
      const invPhone = (inv.guestPhone || "").trim();

      // 2. Normalize ticket contacts (check both guest fields and user fields)
      const tEmail = (t.guestEmail || t.user?.email || "").toLowerCase().trim();
      const tPhone = (t.guestPhone || t.user?.phoneNumber || "").trim();

      // 3. Compare
      const emailMatch = invEmail && tEmail && invEmail === tEmail;
      const phoneMatch = invPhone && tPhone && invPhone === tPhone;

      return emailMatch || phoneMatch;
    });
  };

  // Organizer name for header
  const organizerName = invitations[0]?.organizerId
    ? `${invitations[0].organizerId.firstName} ${invitations[0].organizerId.lastName}`
    : "";

  // const totalPages = Math.ceil(filteredInvitations.length / itemsPerPage);
  return (
    <div className="space-y-6 px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-center gap-4">
        <Link
          href="/admin/invitations"
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {eventName
              ? `${eventName} - Invitations${
                  organizerName ? ` (${organizerName})` : ""
                }`
              : "Event Invitations"}
          </h1>
          <p className="text-gray-500">Manage invitations for this event</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
          <Input
            placeholder="Search guest..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <Card className="w-full sm:w-auto bg-blue-50 border-blue-100">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 bg-blue-100 rounded-full">
              <DollarSign className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-blue-600">Total Expense</p>
              <p className="text-2xl font-bold text-blue-700">
                {formatCurrency(totalExpense)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Guest</TableHead>
                  <TableHead>Ticket Type</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : invitations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      No invitations found for this event
                    </TableCell>
                  </TableRow>
                ) : (
                  (() => {
                    const claimedTicketIds = new Set<string>();
                    return currentItems.map((inv) => {
                      const ticket = getTicketForInvitation(
                        inv,
                        claimedTicketIds
                      );
                      if (ticket && ticket._id)
                        claimedTicketIds.add(ticket._id);

                      // Calculate estimated cost if not provided by backend
                      let cost = inv.estimatedCost;
                      if (cost === undefined || cost === null) {
                        const emailPrice = 2.5;
                        const smsPrice = 7.5;
                        const baseAmount = inv.amount || 1;
                        if (inv.type === "email")
                          cost = emailPrice * baseAmount;
                        else if (inv.type === "sms")
                          cost = smsPrice * baseAmount;
                        else if (inv.type === "both")
                          cost = (emailPrice + smsPrice) * baseAmount;
                        else cost = 0;

                        // Add 3% service fee and round
                        cost = Math.round(cost * 1.03 * 100) / 100;
                      }

                      let usage = "0/1";
                      if (ticket) {
                        // For invitations created before Jan 2, 2026, derive purchaseQuantity from cost
                        const isOldInvitation =
                          new Date(inv.createdAt) < new Date("2026-01-02");

                        let total =
                          ticket.purchaseQuantity || ticket.ticketCount || 1;

                        if (isOldInvitation && cost > 0) {
                          // Derive original quantity: cost / 1.03 (since each invitation unit is 1.03 ETB)
                          const derivedQty = Math.round(cost / 1.03);
                          total = Math.max(total, derivedQty);
                        }

                        const remaining =
                          typeof ticket.ticketCount === "number"
                            ? ticket.ticketCount
                            : 0;
                        usage = `${Math.max(0, total - remaining)}/${total}`;
                      } else {
                        usage = `0/${inv.amount || 1}`;
                      }

                      // Unified Status Logic
                      let unifiedStatus = "pending";
                      if (
                        ticket &&
                        ticket.ticketCount === 0 &&
                        (ticket.purchaseQuantity || 0) > 0
                      ) {
                        unifiedStatus = "used";
                      } else if (inv.rsvpStatus === "confirmed") {
                        unifiedStatus = "confirmed";
                      } else if (inv.rsvpStatus === "declined") {
                        unifiedStatus = "declined";
                      } else {
                        unifiedStatus = "pending";
                      }

                      // If no ticket exists yet, or cost is 0, it's a pending invitation without a ticket
                      const isGuestPending = !ticket || cost === 0;

                      const displayTicketType = isGuestPending
                        ? "-"
                        : ticket?.ticketType || inv.ticketType || "Regular";
                      const displayUsage = isGuestPending ? "-" : usage;
                      const displayStatus =
                        isGuestPending && inv.rsvpStatus !== "declined"
                          ? "-"
                          : unifiedStatus;

                      return (
                        <TableRow key={inv._id}>
                          <TableCell>
                            <div className="font-medium">{inv.guestName}</div>
                            <div className="text-sm text-gray-500 flex items-center gap-1">
                              {inv.type === "email" || inv.type === "both" ? (
                                <Mail className="h-3 w-3" />
                              ) : (
                                <Phone className="h-3 w-3" />
                              )}
                              {inv.guestEmail || inv.guestPhone}
                            </div>
                          </TableCell>
                          <TableCell>
                            {displayTicketType === "-" ? (
                              <span className="text-gray-400">-</span>
                            ) : (
                              <Badge
                                variant="outline"
                                className="bg-purple-50 text-purple-700 border-purple-200"
                              >
                                {displayTicketType}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {displayUsage === "-" ? (
                              <span className="text-gray-400">-</span>
                            ) : (
                              <Badge
                                variant="outline"
                                className={`capitalize ${
                                  displayUsage.startsWith("0/")
                                    ? "bg-gray-50 text-gray-700 border-gray-200"
                                    : "bg-green-50 text-green-700 border-green-200"
                                }`}
                              >
                                {displayUsage}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {inv.type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`capitalize ${
                                ticket
                                  ? "bg-green-50 text-green-700 border-green-200"
                                  : "bg-blue-50 text-blue-700 border-blue-200"
                              }`}
                            >
                              {ticket ? "Paid" : "Guest"}
                              {ticket && (
                                <span className="ml-1 font-bold">
                                  ×
                                  {ticket.purchaseQuantity ||
                                    ticket.ticketCount ||
                                    1}
                                </span>
                              )}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {displayStatus === "-" ? (
                              <span className="text-gray-400">-</span>
                            ) : (
                              <Badge
                                className={`capitalize ${
                                  displayStatus === "confirmed" ||
                                  displayStatus === "used"
                                    ? "bg-green-100 text-green-700 hover:bg-green-100"
                                    : displayStatus === "declined"
                                    ? "bg-red-100 text-red-700 hover:bg-red-100"
                                    : "bg-yellow-100 text-yellow-700 hover:bg-yellow-100"
                                }`}
                              >
                                {displayStatus}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">
                              {formatCurrency(cost)}
                            </div>
                          </TableCell>
                          <TableCell>
                            {new Date(inv.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    title="Delete Invitation"
                                  >
                                    <Trash2 className="h-4 w-4 text-red-600" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>
                                      Delete Invitation?
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will permanently delete the
                                      invitation and any associated ticket. This
                                      action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>
                                      Cancel
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDelete(inv._id)}
                                      className="bg-red-600 hover:bg-red-700"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    });
                  })()
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination Controls */}
      <div className="flex justify-end gap-5 items-center mt-4">
        <button
          className="px-3 py-1 rounded bg-gray-300 text-gray-700 disabled:opacity-30"
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          disabled={currentPage === 1}
        >
          Previous
        </button>
        <span className="text-sm text-gray-600">
          Page {currentPage} of{" "}
          {Math.max(1, Math.ceil(filteredInvitations.length / itemsPerPage))}
        </span>
        <button
          className="px-3 py-1 rounded bg-gray-300 text-gray-700 disabled:opacity-50"
          onClick={() =>
            setCurrentPage((p) =>
              Math.min(
                Math.ceil(filteredInvitations.length / itemsPerPage),
                p + 1
              )
            )
          }
          disabled={
            currentPage >= Math.ceil(filteredInvitations.length / itemsPerPage)
          }
        >
          Next
        </button>
      </div>
    </div>
  );
}
