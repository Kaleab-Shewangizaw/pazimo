import React from "react";
import { Mail, Phone } from "lucide-react";
import { Event, Pricing } from "@/types/invitation";

interface InviteModalProps {
  selectedEvent: Event | null;
  customerName: string;
  setCustomerName: (name: string) => void;
  contactType: "email" | "phone";
  setContactType: (type: "email" | "phone") => void;
  guestType: "guest" | "paid";
  setGuestType: (type: "guest" | "paid") => void;
  contact: string;
  setContact: (contact: string) => void;
  qrCodeCount: number;
  setQrCodeCount: (count: number) => void;
  message: string;
  setMessage: (message: string) => void;
  pricing: Pricing;
  isSubmitting: boolean;
  onClose: () => void;
  onSend: () => void;
}

export default function InviteModal({
  selectedEvent,
  customerName,
  setCustomerName,
  contactType,
  setContactType,
  guestType,
  setGuestType,
  contact,
  setContact,
  qrCodeCount,
  setQrCodeCount,
  message,
  setMessage,
  pricing,
  isSubmitting,
  onClose,
  onSend,
}: InviteModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-gray-200 rounded-xl max-w-lg w-full p-6 md:p-8 shadow-xl">
        <h3 className="text-lg md:text-xl font-semibold text-gray-900 mb-2">
          Professional Invitation
        </h3>
        <p className="text-sm text-gray-600 mb-6">
          Sending invitation for:{" "}
          <strong className="text-gray-900">{selectedEvent?.title}</strong>
        </p>

        <div className="space-y-4">
          {/* Customer Name */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Customer Name
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Enter customer name"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
              required
            />
          </div>

          {/* Contact Method and Guest Type Row */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-900 mb-3">
                Contact Method
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="contactType"
                    value="email"
                    checked={contactType === "email"}
                    onChange={(e) =>
                      setContactType(e.target.value as "email" | "phone")
                    }
                    className="w-4 h-4"
                  />
                  <Mail className="h-4 w-4 text-blue-600" />
                  <span className="text-sm text-gray-900">
                    Email ({pricing.email} ETB)
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="contactType"
                    value="phone"
                    checked={contactType === "phone"}
                    onChange={(e) =>
                      setContactType(e.target.value as "email" | "phone")
                    }
                    className="w-4 h-4"
                  />
                  <Phone className="h-4 w-4 text-blue-600" />
                  <span className="text-sm text-gray-900">
                    SMS ({pricing.sms} ETB)
                  </span>
                </label>
              </div>
            </div>

            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-900 mb-3">
                Guest Type
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="guestType"
                    value="guest"
                    checked={guestType === "guest"}
                    onChange={(e) =>
                      setGuestType(e.target.value as "guest" | "paid")
                    }
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-gray-900">Guest (Free)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="guestType"
                    value="paid"
                    checked={guestType === "paid"}
                    onChange={(e) =>
                      setGuestType(e.target.value as "guest" | "paid")
                    }
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-gray-900">Paid Attendee</span>
                </label>
              </div>
            </div>
          </div>

          {/* Contact Input and QR Code Count Row */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-900 mb-2">
                {contactType === "email" ? "Email Address" : "Phone Number"}
              </label>
              <input
                type={contactType === "email" ? "email" : "tel"}
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder={
                  contactType === "email"
                    ? "Enter email address"
                    : "Enter phone number (+251911234567)"
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
                required
              />
              {contactType === "phone" && (
                <p className="text-xs text-gray-600 mt-1">
                  Ethiopian format: +251911234567 or 0911234567
                </p>
              )}
            </div>

            <div className="w-32">
              <label className="block text-sm font-medium text-gray-900 mb-2">
                QR Codes
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={qrCodeCount}
                onChange={(e) =>
                  setQrCodeCount(Math.max(1, parseInt(e.target.value) || 1))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
              />
              <p className="text-xs text-gray-600 mt-1">Max 10</p>
            </div>
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Message (Optional)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a personal message to the invitation"
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
            />
          </div>

          {/* Cost Summary */}
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
            {(() => {
              const shouldSkipPayment =
                (selectedEvent?.eventType === "private" ||
                  selectedEvent?.eventType === "public") &&
                guestType === "paid" &&
                selectedEvent?.ticketTypes?.some(
                  (ticket: any) => ticket.price > 0
                );

              if (shouldSkipPayment) {
                return (
                  <div className="text-center">
                    <div className="text-lg font-bold text-green-600 mb-2">
                      FREE INVITATION
                    </div>
                    <div className="text-xs text-gray-500">
                      No charges for paid attendees in events with paid tickets
                    </div>
                  </div>
                );
              }

              return (
                <>
                  <div className="flex justify-between items-center">
                    <span>Invitation Cost:</span>
                    <span className="font-medium text-gray-900">
                      {(
                        (contactType === "email"
                          ? pricing.email
                          : pricing.sms) * qrCodeCount
                      ).toFixed(2)}{" "}
                      ETB
                    </span>
                  </div>
                  <div className="border-t border-gray-300 mt-2 pt-2 flex justify-between items-center">
                    <span className="font-semibold">Total:</span>
                    <span className="font-bold text-gray-900">
                      {(
                        (contactType === "email"
                          ? pricing.email
                          : pricing.sms) * qrCodeCount
                      ).toFixed(2)}{" "}
                      ETB
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {qrCodeCount} QR code{qrCodeCount > 1 ? "s" : ""} via{" "}
                    {contactType === "email" ? "Email" : "SMS"}
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 hover:bg-gray-50 transition-all duration-200 font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onSend}
            disabled={!contact || !customerName || isSubmitting}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium"
          >
            {isSubmitting
              ? "Processing..."
              : (selectedEvent?.eventType === "private" ||
                  selectedEvent?.eventType === "public") &&
                guestType === "paid" &&
                selectedEvent?.ticketTypes?.some(
                  (ticket: any) => ticket.price > 0
                )
              ? "Send Invitation"
              : "Proceed to Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}
