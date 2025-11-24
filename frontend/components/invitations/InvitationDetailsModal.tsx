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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-gray-200 rounded-xl max-w-md w-full p-6 md:p-8 shadow-xl">
        <h3 className="text-lg md:text-xl font-semibold text-gray-900 mb-6">
          Invitation Details
        </h3>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-600">
                Customer
              </label>
              <p className="text-sm text-gray-900">{invitation.customerName}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Event</label>
              <p className="text-sm text-gray-900">{invitation.eventTitle}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-600">
                Contact Method
              </label>
              <div className="flex items-center gap-1">
                {invitation.contactType === "email" ? (
                  <Mail className="h-4 w-4 text-blue-600" />
                ) : (
                  <Phone className="h-4 w-4 text-blue-600" />
                )}
                <span className="text-sm text-gray-900 capitalize">
                  {invitation.contactType}
                </span>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">
                Guest Type
              </label>
              <span
                className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                  invitation.guestType === "paid"
                    ? "bg-green-100 text-green-800"
                    : "bg-blue-100 text-blue-800"
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
              <label className="text-sm font-medium text-gray-600">
                QR Codes
              </label>
              <p className="text-sm text-gray-900">{invitation.qrCodeCount}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">
                Status
              </label>
              <div className="flex flex-col gap-1">
                <span
                  className={`inline-block px-2 py-1 rounded-full text-xs font-medium w-fit ${
                    invitation.status === "delivered"
                      ? "bg-green-100 text-green-800"
                      : invitation.status === "sent"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-red-100 text-red-800"
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
                        ? "bg-green-100 text-green-800"
                        : invitation.rsvpStatus === "pending"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-red-100 text-red-800"
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
            <label className="text-sm font-medium text-gray-600">Contact</label>
            <p className="text-sm text-gray-900">{invitation.contact}</p>
          </div>

          {invitation.message && (
            <div>
              <label className="text-sm font-medium text-gray-600">
                Message
              </label>
              <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded">
                {invitation.message}
              </p>
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-gray-600">Sent At</label>
            <p className="text-sm text-gray-900">{invitation.sentAt}</p>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 hover:bg-gray-50 transition-all duration-200 font-medium"
          >
            Close
          </button>
          <button
            onClick={onViewQR}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-all duration-200 font-medium flex items-center justify-center gap-2"
          >
            <QrCode className="h-4 w-4" />
            View QR Codes
          </button>
        </div>
      </div>
    </div>
  );
}
