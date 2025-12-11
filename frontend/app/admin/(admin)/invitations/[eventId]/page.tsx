"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Mail,
  Phone,
  Calendar,
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
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalExpense, setTotalExpense] = useState(0);
  const [eventName, setEventName] = useState("");

  useEffect(() => {
    if (eventId) {
      fetchInvitations();
    }
  }, [eventId]);

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

    setFilteredInvitations(result);
    setCurrentPage(1); // Reset to first page on search
  }, [searchQuery, invitations]);

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
            {eventName ? `${eventName} - Invitations` : "Event Invitations"}
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
                  <TableHead>Organizer</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>RSVP</TableHead>
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
                  currentItems.map((inv) => (
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
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-400" />
                          {inv.organizerId
                            ? `${inv.organizerId.firstName} ${inv.organizerId.lastName}`
                            : "Unknown"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {inv.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            inv.status === "delivered" || inv.status === "sent"
                              ? "bg-green-100 text-green-700 hover:bg-green-100"
                              : inv.status === "failed"
                              ? "bg-red-100 text-red-700 hover:bg-red-100"
                              : "bg-yellow-100 text-yellow-700 hover:bg-yellow-100"
                          }
                        >
                          {inv.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {inv.guestType === "paid" ? (
                          <Badge
                            variant="secondary"
                            className="bg-gray-100 text-gray-700"
                          >
                            Free
                          </Badge>
                        ) : (
                          <span className="capitalize text-sm">
                            {inv.paymentStatus}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {inv.guestType === "paid" ? (
                          <span className="text-gray-400">-</span>
                        ) : (
                          <Badge
                            variant="outline"
                            className={`capitalize ${
                              inv.rsvpStatus === "confirmed"
                                ? "bg-green-50 text-green-700 border-green-200"
                                : inv.rsvpStatus === "declined"
                                ? "bg-red-50 text-red-700 border-red-200"
                                : "bg-gray-50 text-gray-700 border-gray-200"
                            }`}
                          >
                            {inv.rsvpStatus || "Pending"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {formatCurrency(inv.estimatedCost || 0)}
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
                                  This will permanently delete the invitation
                                  and any associated ticket. This action cannot
                                  be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
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
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
