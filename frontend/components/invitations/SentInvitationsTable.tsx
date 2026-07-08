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
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 border border-green-500 dark:border-green-700">
            <CheckCircle className="w-3 h-3" /> Delivered
          </span>
        );
      case "delivered":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 border border-green-200 dark:border-green-800">
            <CheckIcon className="w-3 h-3" /> Delivered
          </span>
        );
      case "sent":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
            <Mail className="w-3 h-3" /> Sent
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400 border border-red-200 dark:border-red-800">
            <AlertCircle className="w-3 h-3" /> Failed
          </span>
        );
      case "declined":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400 border border-red-200 dark:border-red-800">
            <XCircle className="w-3 h-3" /> Declined
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800/50 text-gray-800 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
            {status}
          </span>
        );
    }
  };

  const getRsvpStatusBadge = (status?: string) => {
    switch (status) {
      case "confirmed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 border border-green-500 dark:border-green-700">
            <CheckCircle className="w-3 h-3" /> Confirmed
          </span>
        );
      case "declined":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400 border border-red-200 dark:border-red-800">
            <XCircle className="w-3 h-3" /> Declined
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800">
            <Clock className="w-3 h-3" /> Pending
          </span>
        );
    }
  };

  return (
    <div className="mt-8 md:mt-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h2 className="text-2xl md:text-md font-bold text-gray-900 dark:text-gray-100">
          Sent Invitations
        </h2>
        <div className="flex items-center gap-4 text-sm flex-wrap">
          <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg border border-green-200 dark:border-green-800">
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
            <span className="text-gray-900 dark:text-gray-100 font-medium">
              {deliveredInvitations} Delivered
            </span>
          </div>
          <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900/20 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800">
            <XCircle className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            <span className="text-gray-900 dark:text-gray-100 font-medium">
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
          className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-black text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
        />
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(
              e.target.value as "all" | "sent" | "delivered" | "failed"
            )
          }
          className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-black text-gray-900 dark:text-gray-100"
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
          className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-black text-gray-900 dark:text-gray-100"
        >
          <option value="all">All Methods</option>
          <option value="email">Email</option>
          <option value="phone">SMS</option>
        </select>
      </div>

      <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="px-4 md:px-6 py-4 text-left text-xs md:text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Event
                </th>
                <th className="px-4 md:px-6 py-4 text-left text-xs md:text-sm font-semibold text-gray-900 dark:text-gray-100 hidden sm:table-cell">
                  Customer
                </th>
                <th className="px-4 md:px-6 py-4 text-left text-xs md:text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Contact
                </th>
                <th className="px-4 md:px-6 py-4 text-left text-xs md:text-sm font-semibold text-gray-900 dark:text-gray-100 hidden md:table-cell">
                  Method
                </th>
                <th className="px-4 md:px-6 py-4 text-left text-xs md:text-sm font-semibold text-gray-900 dark:text-gray-100 hidden lg:table-cell">
                  Guests / Tickets
                </th>
                <th className="px-4 md:px-6 py-4 text-left text-xs md:text-sm font-semibold text-gray-900 dark:text-gray-100 hidden lg:table-cell">
                  Usage
                </th>
                <th className="px-4 md:px-6 py-4 text-left text-xs md:text-sm font-semibold text-gray-900 dark:text-gray-100 hidden lg:table-cell">
                  Ticket Type
                </th>
                <th className="px-4 md:px-6 py-4 text-left text-xs md:text-sm font-semibold text-gray-900 dark:text-gray-100 hidden lg:table-cell">
                  Sent At
                </th>
                <th className="px-4 md:px-6 py-4 text-left text-xs md:text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 md:px-6 py-12 text-center text-gray-500 dark:text-gray-400"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
                      <p>Loading invitations...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredInvitations.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 md:px-6 py-8 text-center text-gray-500 dark:text-gray-400"
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

                    const isGuestPending = !ticket;
                    const guestQuantity = invitation.qrCodeCount || 1;
                    
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
                        className="border-t border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors duration-200 cursor-pointer"
                      >
                        <td className="px-4 md:px-6 py-4">
                          <div className="font-medium text-gray-900 dark:text-gray-100 text-sm md:text-base">
                            {invitation.eventTitle}
                          </div>
                        </td>
                        <td className="px-4 md:px-6 py-4 text-sm text-gray-900 dark:text-gray-100 hidden sm:table-cell">
                          {invitation.customerName}
                        </td>
                        <td className="px-4 md:px-6 py-4">
                          <div className="text-sm text-gray-900 dark:text-gray-100">
                            {invitation.contact}
                          </div>
                          {invitation.message && (
                            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 truncate max-w-[150px]">
                              &quot;{invitation.message}&quot;
                            </div>
                          )}
                        </td>
                        <td className="px-4 md:px-6 py-4 hidden md:table-cell">
                          <div className="flex items-center gap-1 text-sm text-gray-900 dark:text-gray-100">
                            {invitation.contactType === "email" ? (
                              <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            ) : (
                              <Phone className="h-4 w-4 text-green-600 dark:text-green-400" />
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
                                ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 border border-green-200 dark:border-green-800"
                                : "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 border border-blue-200 dark:border-blue-800"
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
                            <span className="text-gray-400 dark:text-gray-500">-</span>
                          ) : (
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                displayUsage.startsWith("0/")
                                  ? "bg-gray-100 dark:bg-gray-800/50 text-gray-800 dark:text-gray-400"
                                  : "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400"
                              }`}
                            >
                              {displayUsage}
                            </span>
                          )}
                        </td>
                        <td className="px-4 md:px-6 py-4 hidden lg:table-cell">
                          {displayTicketType === "-" ? (
                            <span className="text-gray-400 dark:text-gray-500">-</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400 border border-purple-200 dark:border-purple-800">
                              {displayTicketType}
                            </span>
                          )}
                        </td>
                        <td className="px-4 md:px-6 py-4 text-xs md:text-sm text-gray-600 dark:text-gray-400 hidden lg:table-cell">
                          {invitation.sentAt}
                        </td>
                        <td className="px-4 md:px-6 py-4">
                          {displayStatus === "-" ? (
                            <span className="text-gray-400 dark:text-gray-500">-</span>
                          ) : (
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                                displayStatus === "confirmed" ||
                                displayStatus === "used"
                                  ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400"
                                  : displayStatus === "declined"
                                  ? "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400"
                                  : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400"
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