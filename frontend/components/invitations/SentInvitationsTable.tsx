import React, { useState } from "react";
import {
  Mail,
  Phone,
  CheckCircle,
  XCircle,
  Ticket,
  Clock,
  AlertCircle,
  CheckIcon,
  Loader2,
} from "lucide-react";
import { Invitation } from "@/types/invitation";

interface SentInvitationsTableProps {
  invitations: Invitation[];
  tickets?: any[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onViewDetails: (invitation: Invitation) => void;
  isLoading?: boolean;
  currentPage?: number;
  itemsPerPage?: number;
}

export default function SentInvitationsTable({
  invitations,
  tickets = [],
  searchQuery,
  setSearchQuery,
  onViewDetails,
  isLoading = false,
  currentPage = 1,
  itemsPerPage = 5,
}: SentInvitationsTableProps) {
  const safeInvitations = Array.isArray(invitations) ? invitations : [];

  const [statusFilter, setStatusFilter] = useState<
    "all" | "sent" | "delivered" | "failed"
  >("all");
  const [contactTypeFilter, setContactTypeFilter] = useState<
    "all" | "email" | "phone"
  >("all");

  const filteredInvitations = safeInvitations.filter((inv) => {
    const matchesStatus = statusFilter === "all" || inv.status === statusFilter;
    const matchesContactType =
      contactTypeFilter === "all" ||
      inv.contactType === contactTypeFilter ||
      inv.contactType === "both";
    return matchesStatus && matchesContactType;
  });

  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedInvitations = filteredInvitations.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  const deliveredInvitations = safeInvitations.filter(
    (inv) => inv.status === "delivered"
  ).length;
  const totalInvitations = safeInvitations.length;

  const getDeliveryStatusBadge = (status: string) => {
    switch (status) {
      case "confirmed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-500">
            <CheckCircle className="w-3 h-3" /> Delivered
          </span>
        );
      case "delivered":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
            <CheckIcon className="w-3 h-3" /> Delivered
          </span>
        );
      case "sent":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
            <Mail className="w-3 h-3" /> Sent
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
            <AlertCircle className="w-3 h-3" /> Failed
          </span>
        );
      case "declined":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
            <XCircle className="w-3 h-3" /> Declined
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
            {status}
          </span>
        );
    }
  };

  const getRsvpStatusBadge = (status?: string) => {
    switch (status) {
      case "confirmed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-500">
            <CheckCircle className="w-3 h-3" /> Confirmed
          </span>
        );
      case "declined":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
            <XCircle className="w-3 h-3" /> Declined
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
            <Clock className="w-3 h-3" /> Pending
          </span>
        );
    }
  };

  return (
    <div className="mt-8 md:mt-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h2 className="text-2xl md:text-md font-bold text-gray-900">
          Sent Invitations
        </h2>
        <div className="flex items-center gap-4 text-sm flex-wrap">
          <div className="flex items-center gap-2 bg-green-50 px-3 py-2 rounded-lg border border-green-200">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-gray-900 font-medium">
              {deliveredInvitations} Delivered
            </span>
          </div>
          <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
            <XCircle className="h-4 w-4 text-gray-600" />
            <span className="text-gray-900 font-medium">
              {totalInvitations - deliveredInvitations} Pending
            </span>
          </div>
        </div>
      </div>

      {/* Invitations Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <input
          type="text"
          placeholder="Search by event, customer, or contact..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(
              e.target.value as "all" | "sent" | "delivered" | "failed"
            )
          }
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">All Status</option>
          <option value="sent">Sent</option>
          <option value="delivered">Delivered</option>
          <option value="failed">Failed</option>
        </select>
        <select
          value={contactTypeFilter}
          onChange={(e) =>
            setContactTypeFilter(e.target.value as "all" | "email" | "phone")
          }
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">All Methods</option>
          <option value="email">Email</option>
          <option value="phone">SMS</option>
        </select>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 md:px-6 py-4 text-left text-xs md:text-sm font-semibold text-gray-900">
                  Event
                </th>
                <th className="px-4 md:px-6 py-4 text-left text-xs md:text-sm font-semibold text-gray-900 hidden sm:table-cell">
                  Customer
                </th>
                <th className="px-4 md:px-6 py-4 text-left text-xs md:text-sm font-semibold text-gray-900">
                  Contact
                </th>
                <th className="px-4 md:px-6 py-4 text-left text-xs md:text-sm font-semibold text-gray-900 hidden md:table-cell">
                  Method
                </th>
                <th className="px-4 md:px-6 py-4 text-left text-xs md:text-sm font-semibold text-gray-900 hidden lg:table-cell">
                  Guests / Tickets
                </th>
                <th className="px-4 md:px-6 py-4 text-left text-xs md:text-sm font-semibold text-gray-900 hidden lg:table-cell">
                  Usage
                </th>
                <th className="px-4 md:px-6 py-4 text-left text-xs md:text-sm font-semibold text-gray-900 hidden lg:table-cell">
                  Ticket Type
                </th>
                <th className="px-4 md:px-6 py-4 text-left text-xs md:text-sm font-semibold text-gray-900 hidden lg:table-cell">
                  Sent At
                </th>
                <th className="px-4 md:px-6 py-4 text-left text-xs md:text-sm font-semibold text-gray-900">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 md:px-6 py-12 text-center text-gray-500"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                      <p>Loading invitations...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredInvitations.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 md:px-6 py-8 text-center text-gray-500"
                  >
                    {safeInvitations.length === 0
                      ? "No invitations sent yet"
                      : "No invitations match your filters"}
                  </td>
                </tr>
              ) : (
                (() => {
                  const claimedTicketIds = new Set<string>();
                  return paginatedInvitations.map((invitation) => {
                    const directTicket = invitation.ticket || null;
                    const ticket =
                      directTicket ||
                      tickets.find((t) => {
                        if (!t?.isInvitation) return false;
                        if (t._id && claimedTicketIds.has(t._id)) return false;

                        const invEventId = invitation.eventId?.toString();
                        const tEventId = (t.event?._id || t.event)?.toString();
                        if (invEventId && tEventId && invEventId !== tEventId) {
                          return false;
                        }

                        const invEmail = (
                          invitation.guestEmail ||
                          (invitation.contactType === "email"
                            ? invitation.contact
                            : "") ||
                          ""
                        )
                          .toLowerCase()
                          .trim();
                        const invPhone = (
                          invitation.guestPhone ||
                          (invitation.contactType === "phone"
                            ? invitation.contact
                            : "") ||
                          ""
                        ).trim();
                        const tEmail = (t.guestEmail || t.user?.email || "")
                          .toLowerCase()
                          .trim();
                        const tPhone = (
                          t.guestPhone ||
                          t.user?.phoneNumber ||
                          ""
                        ).trim();

                        return (
                          (invEmail && tEmail && invEmail === tEmail) ||
                          (invPhone && tPhone && invPhone === tPhone)
                        );
                      });

                    if (ticket && ticket._id) {
                      claimedTicketIds.add(ticket._id);
                    }

                    let usage = "0/1";
                    if (ticket) {
                      // For invitations created before Jan 2, 2026, derive purchaseQuantity from cost
                      const isOldInvitation =
                        new Date(invitation.createdAt || invitation.sentAt) <
                        new Date("2026-01-02");

                      let total =
                        ticket.purchaseQuantity || ticket.ticketCount || 1;

                      if (
                        isOldInvitation &&
                        invitation.estimatedCost &&
                        invitation.estimatedCost > 0
                      ) {
                        // Derive original quantity: cost / 1.03 (since each invitation unit is 1.03 ETB)
                        const derivedQty = Math.round(
                          invitation.estimatedCost / 1.03
                        );
                        total = Math.max(total, derivedQty);
                      }

                      const remaining =
                        typeof ticket.ticketCount === "number"
                          ? ticket.ticketCount
                          : 0;
                      usage = `${Math.max(0, total - remaining)}/${total}`;
                    } else {
                      usage = `0/${invitation.qrCodeCount || 1}`;
                    }

                    // Unified Status Logic
                    let unifiedStatus = "pending";
                    if (
                      ticket &&
                      ticket.ticketCount === 0 &&
                      (ticket.purchaseQuantity || 0) > 0
                    ) {
                      unifiedStatus = "used";
                    } else if (invitation.rsvpStatus === "confirmed") {
                      unifiedStatus = "confirmed";
                    } else if (invitation.rsvpStatus === "declined") {
                      unifiedStatus = "declined";
                    } else {
                      unifiedStatus = "pending";
                    }

                    // If no ticket exists yet, it's a pending invitation without a ticket
                    const isGuestPending = !ticket;

                    const guestQuantity = invitation.qrCodeCount || 1;
                    
                    // Ticket count for display (use guest quantity when no ticket exists)
                    const displayTicketCount = ticket
                      ? ticket.purchaseQuantity || ticket.ticketCount || 1
                      : guestQuantity;

                    const displayTicketType =
                      ticket?.ticketType || invitation.ticketType || "Regular";
                    const displayUsage = isGuestPending
                      ? `0/${guestQuantity}`
                      : usage;
                    const displayStatus = unifiedStatus;
                    const showMultiplier = displayTicketCount > 1;

                    return (
                      <tr
                        key={invitation.id}
                        onClick={() => onViewDetails(invitation)}
                        className="border-t border-gray-200 hover:bg-gray-50 transition-colors duration-200 cursor-pointer"
                      >
                        <td className="px-4 md:px-6 py-4">
                          <div className="font-medium text-gray-900 text-sm md:text-base">
                            {invitation.eventTitle}
                          </div>
                        </td>
                        <td className="px-4 md:px-6 py-4 text-sm text-gray-900 hidden sm:table-cell">
                          {invitation.customerName}
                        </td>
                        <td className="px-4 md:px-6 py-4">
                          <div className="text-sm text-gray-900">
                            {invitation.contact}
                          </div>
                          {invitation.message && (
                            <div className="text-xs text-gray-600 mt-1 truncate max-w-[150px]">
                              &quot;{invitation.message}&quot;
                            </div>
                          )}
                        </td>
                        <td className="px-4 md:px-6 py-4 hidden md:table-cell">
                          <div className="flex items-center gap-1 text-sm text-gray-900">
                            {invitation.contactType === "email" ? (
                              <Mail className="h-4 w-4 text-blue-600" />
                            ) : (
                              <Phone className="h-4 w-4 text-green-600" />
                            )}
                            <span className="capitalize">
                              {invitation.contactType}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 md:px-6 py-4 hidden lg:table-cell">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                              ticket
                                ? "bg-green-100 text-green-800 border border-green-200"
                                : "bg-blue-100 text-blue-800 border border-blue-200"
                            }`}
                          >
                            <Ticket className="w-3 h-3" />
                            {ticket ? "Paid" : "Guest"}
                            {showMultiplier && (
                              <span className="ml-1 font-bold">
                                ×{displayTicketCount}
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="px-4 md:px-6 py-4 hidden lg:table-cell">
                          {displayUsage === "-" ? (
                            <span className="text-gray-400">-</span>
                          ) : (
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                displayUsage.startsWith("0/")
                                  ? "bg-gray-100 text-gray-800"
                                  : "bg-green-100 text-green-800"
                              }`}
                            >
                              {displayUsage}
                            </span>
                          )}
                        </td>
                        <td className="px-4 md:px-6 py-4 hidden lg:table-cell">
                          {displayTicketType === "-" ? (
                            <span className="text-gray-400">-</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
                              {displayTicketType}
                            </span>
                          )}
                        </td>
                        <td className="px-4 md:px-6 py-4 text-xs md:text-sm text-gray-600 hidden lg:table-cell">
                          {invitation.sentAt}
                        </td>
                        <td className="px-4 md:px-6 py-4">
                          {displayStatus === "-" ? (
                            <span className="text-gray-400">-</span>
                          ) : (
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                                displayStatus === "confirmed" ||
                                displayStatus === "used"
                                  ? "bg-green-100 text-green-800"
                                  : displayStatus === "declined"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-yellow-100 text-yellow-800"
                              }`}
                            >
                              {displayStatus}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  });
                })()
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
