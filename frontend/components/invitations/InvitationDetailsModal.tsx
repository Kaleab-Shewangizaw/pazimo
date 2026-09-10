import React from "react";
import { Mail, Phone, QrCode } from "lucide-react";
import { Invitation } from "@/types/invitation";

interface InvitationDetailsModalProps {
  invitation: Invitation;
  onClose: () => void;
  onViewQR: () => void;
}

export default function InvitationDetailsModal({
  invitation,
  onClose,
  onViewQR,
}: InvitationDetailsModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl max-w-md w-full p-6 md:p-8 shadow-xl">
        <h3 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">
          Invitation Details
        </h3>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Customer
              </label>
              <p className="text-sm text-gray-900 dark:text-gray-100">{invitation.customerName}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Event</label>
              <p className="text-sm text-gray-900 dark:text-gray-100">{invitation.eventTitle}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Contact Method
              </label>
              <div className="flex items-center gap-1">
                {invitation.contactType === "email" ? (
                  <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                ) : (
                  <Phone className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                )}
                <span className="text-sm text-gray-900 dark:text-gray-100 capitalize">
                  {invitation.contactType}
                </span>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Guest Type
              </label>
              <span
                className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                  invitation.guestType === "paid"
                    ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400"
                    : "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400"
                }`}
              >
                {invitation.guestType === "paid"
                  ? "Paid Attendee"
                  : "Guest (Free)"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                QR Codes
              </label>
              <p className="text-sm text-gray-900 dark:text-gray-100">{invitation.qrCodeCount}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Ticket Type
              </label>
              <span className="inline-block px-2 py-1 rounded-full text-xs font-medium w-fit bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400">
                {invitation.ticket?.ticketType || invitation.ticketType || "Regular"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Status
              </label>
              <div className="flex flex-col gap-1">
                <span
                  className={`inline-block px-2 py-1 rounded-full text-xs font-medium w-fit ${
                    invitation.status === "delivered"
                      ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400"
                      : invitation.status === "sent"
                      ? "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400"
                      : "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400"
                  }`}
                >
                  Delivery:{" "}
                  {invitation.status.charAt(0).toUpperCase() +
                    invitation.status.slice(1)}
                </span>
                {invitation.rsvpStatus && (
                  <span
                    className={`inline-block px-2 py-1 rounded-full text-xs font-medium w-fit ${
                      invitation.rsvpStatus === "confirmed"
                        ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400"
                        : invitation.rsvpStatus === "pending"
                        ? "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400"
                        : "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400"
                    }`}
                  >
                    RSVP:{" "}
                    {invitation.rsvpStatus.charAt(0).toUpperCase() +
                      invitation.rsvpStatus.slice(1)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Contact</label>
            <p className="text-sm text-gray-900 dark:text-gray-100">{invitation.contact}</p>
          </div>

          {invitation.message && (
            <div>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Message
              </label>
              <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-900/50 p-2 rounded border border-gray-200 dark:border-gray-700">
                {invitation.message}
              </p>
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Sent At</label>
            <p className="text-sm text-gray-900 dark:text-gray-100">{invitation.sentAt}</p>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all duration-200 font-medium"
          >
            Close
          </button>
          <button
            onClick={onViewQR}
            className="flex-1 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-all duration-200 font-medium flex items-center justify-center gap-2"
          >
            <QrCode className="h-4 w-4" />
            View QR Codes
          </button>
        </div>
      </div>
    </div>
  );
}