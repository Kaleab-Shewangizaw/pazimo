"use client";
import { useState, useEffect, useCallback } from "react";
import { Button } from "./ui/button";
import base64id from "base64id";
import {
  PlusIcon,
  Loader2,
  CreditCard,
  MessageSquareText,
  Send,
  Trash2,
} from "lucide-react";
import { PaymentInit, Row } from "@/types/bulk-invite";
import { toast } from "sonner";
import { Event } from "@/types/invitation";
import {
  generatePaymentConfig,
  validateAndCorrectRows,
} from "@/utils/bulkInviteValidation";
import { useAuthStore } from "@/store/authStore";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import PaymentMethodSelector from "@/components/payment/PaymentMethodSelector";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface EditableTableProps {
  event: Event;
  data: Row[];
  setData: (rows: Row[]) => void;
  setSelectedFile: (file: File | null) => void;
  setShowBulkModal: (show: boolean) => void | undefined;
  activePaymentProvider: "SANTIM" | "CHAPA";
  ticketType?: string;
}

export default function EditableTable({
  event,
  data,
  setData,
  setSelectedFile,
  setShowBulkModal,
  activePaymentProvider = "SANTIM",
  ticketType,
}: EditableTableProps) {
  console.log("EditableTable activePaymentProvider:", activePaymentProvider);

  const [showDataTrimmed, setShowDataTrimmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [canSend, setCanSend] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [isSantimLoading, setIsSantimLoading] = useState(false);

  // === MISSING STATES ADDED HERE ===
  const [isWaitingForPayment, setIsWaitingForPayment] = useState(false);
  const [currentTransactionId, setCurrentTransactionId] = useState<string | null>(null);
  // ==================================

  const [paymentMethod, setPaymentMethod] = useState(
    activePaymentProvider === "CHAPA" ? "telebirr" : "Telebirr"
  );
  const [paymentPhoneNumber, setPaymentPhoneNumber] = useState("");
  const { user } = useAuthStore();
  const [paymentConfig, setPaymentConfig] = useState<PaymentInit | null>(null);
  const [pendingInvitationIds, setPendingInvitationIds] = useState<string[]>([]);
  const [pricing, setPricing] = useState({ email: 2, sms: 5 });
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [successResult, setSuccessResult] = useState<{
    success: unknown[];
    failed: unknown[];
  } | null>(null);
  const [isMessageDialogOpen, setIsMessageDialogOpen] = useState(false);
  const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(
    null
  );
  const [messageDraft, setMessageDraft] = useState("");

  useEffect(() => {
    setPaymentMethod(
      activePaymentProvider === "CHAPA" ? "telebirr" : "Telebirr"
    );
  }, [activePaymentProvider]);

  const displayData = data.length > 1000 ? data.slice(0, 1000) : data;

  useEffect(() => {
    const fetchPricing = async () => {
      if (!event) return;
      try {
        const eventType = event.eventType || "public";
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/invitation-pricing/${eventType}`
        );
        if (response.ok) {
          const data = await response.json();
          setPricing({
            email: data.data.emailPrice,
            sms: data.data.smsPrice,
          });
        }
      } catch (error) {
        console.error("Failed to fetch pricing:", error);
      }
    };
    fetchPricing();
  }, [event]);

  useEffect(() => {
    return () => {
      if (pollingInterval) clearInterval(pollingInterval);
    };
  }, [pollingInterval]);

  const handleCancelPayment = async () => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
    setIsWaitingForPayment(false);
    setIsSantimLoading(false);
    if (currentTransactionId) {
      try {
        await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/invitations/payment/cancel`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${useAuthStore.getState().token}`,
            },
            body: JSON.stringify({ transactionId: currentTransactionId }),
          }
        );
        toast.info("Payment cancelled");
      } catch (e) {
        console.error("Error cancelling payment:", e);
      }
      setCurrentTransactionId(null);
    }
  };

  useEffect(() => {
    if (data.length > 1000) setShowDataTrimmed(true);
  }, [data.length]);

  useEffect(() => {
    const missing = data.some((row) => !row.eventDetail);
    if (!missing) return;
    setData(
      data.map((row) =>
        !row.eventDetail ? { ...row, eventDetail: event } : row
      )
    );
  }, [data, setData, event]);

  useEffect(() => {
    const missing = data.some((row) => !row.id);
    if (!missing) return;
    setData(
      data.map((row) => (!row.id ? { ...row, id: base64id.generateId() } : row))
    );
  }, [data, setData]);

  const isEmailValid = (email: string): boolean => {
    if (!email) return false;
    const trimmed = email.trim();
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return trimmed.length > 5 && regex.test(trimmed);
  };

  const isPhoneValid = (phone: string): boolean => {
    if (!phone) return false;
    const trimmed = phone.trim();
    const ethiopianRegex = /^(\+2519\d{8}|\+2517\d{8}|09\d{8}|07\d{8})$/;
    return ethiopianRegex.test(trimmed);
  };

  const isRowValid = useCallback((row: Row): boolean => {
    const hasName = row.Name?.trim().length > 0;
    const emailOk =
      (row.Type === "Email" || row.Type === "Both") && isEmailValid(row.Email);
    const phoneOk =
      (row.Type === "Phone" || row.Type === "Both") && isPhoneValid(row.Phone);
    if (row.Type === "Both") return hasName && emailOk && phoneOk;
    return hasName && (emailOk || phoneOk);
  }, []);

  useEffect(() => {
    const allValid =
      data.length > 0 && data.every((row: Row) => isRowValid(row));
    setCanSend(allValid);
  }, [data, isRowValid]);

  const handleChange = (
    index: number,
    key: keyof Row,
    value: string | number
  ) => {
    const updated = [...data];
    updated[index][key] = value as never;
    setData(updated);
  };

  const handleContactTypeChange = (
    index: number,
    value: "Email" | "Phone" | "Both"
  ) => {
    const updated = [...data];
    updated[index].Type = value;
    if (value === "Email") updated[index].Phone = "";
    if (value === "Phone") updated[index].Email = "";
    setData(updated);
  };

  const handleBulkSend = async () => {
    setIsSubmitting(true);
    try {
      handleSend();
    } catch (err) {
      console.error("Error sending:", err);
      toast.error("Failed to send invitations");
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculateCost = (): number => {
    return data.reduce((total, row) => {
      const amount = Number(row.Amount || 1);
      if (row.Type === "Both")
        return total + (pricing.email + pricing.sms) * amount;
      if (row.Type === "Phone") return total + pricing.sms * amount;
      if (row.Type === "Email") return total + pricing.email * amount;
      return total;
    }, 0);
  };

  const totalCost = calculateCost();
  const validCount = data.filter((row) => isRowValid(row)).length;
  const invalidCount = data.length - validCount;

  const addEmptyRow = () => {
    const newRow: Row = {
      id: base64id.generateId(),
      No: data.length + 1,
      Name: "",
      Email: "",
      Phone: "",
      Type: "Email",
      Amount: 1,
      Message: "",
      QR: "",
      eventDetail: event,
    };
    setData([...data, newRow]);
  };

  const handleRemove = (index: number) => {
    const updated = [...data];
    updated.splice(index, 1);
    setData(updated);
  };

  const openMessageDialog = (index: number) => {
    setEditingMessageIndex(index);
    setMessageDraft(data[index]?.Message || "");
    setIsMessageDialogOpen(true);
  };

  const saveMessage = () => {
    if (editingMessageIndex === null) return;
    handleChange(editingMessageIndex, "Message", messageDraft);
    setIsMessageDialogOpen(false);
    setEditingMessageIndex(null);
  };

  const handleSend = async () => {
    const { summary, readyToGenerate } = validateAndCorrectRows(data, pricing);
    console.log("summary is here: ", summary);
    if (!readyToGenerate) {
      toast.error("Please fix errors before sending.");
      return;
    }
    if (!user) {
      toast.error("You must be logged in to send invitations.");
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        rows: data.map((row) => ({
          guestName: row.Name,
          guestEmail: row.Email,
          guestPhone: row.Phone,
          type: row.Type.toLowerCase(),
          ticketType: row.TicketType || ticketType || "Regular",
          amount: row.Amount,
          qrCodecount: row.Amount,
          message: row.Message,
        })),
        eventId: event._id,
      };
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/invitations/bulk-create`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${useAuthStore.getState().token}`,
          },
          body: JSON.stringify(payload),
        }
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Failed to create invitations");
      }
      const { invitationIds, totalCost } = result.data;
      setPendingInvitationIds(invitationIds);

      const costToPay = totalCost !== undefined ? totalCost : summary.totalCost;
      if (costToPay === 0) {
        await processSending(invitationIds);
        return;
      }

      const config = generatePaymentConfig(
        { ...summary, totalCost: costToPay },
        {
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phoneNumber: user.phoneNumber,
        }
      );
      setPaymentConfig(config);
      let initialPhone = user.phoneNumber || "";
      initialPhone = initialPhone.replace(/\D/g, "");
      if (initialPhone.startsWith("0"))
        initialPhone = initialPhone.substring(1);
      if (initialPhone.startsWith("251"))
        initialPhone = initialPhone.substring(3);
      setPaymentPhoneNumber(initialPhone);
      setShowPayment(true);
    } catch (error: unknown) {
      console.error("Send error:", error);
      const message =
        error instanceof Error ? error.message : "Error creating invitations.";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const processSending = useCallback(
    async (invitationIds: string[]) => {
      toast.success("Processing invitations...");
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/invitations/process-paid`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${useAuthStore.getState().token}`,
            },
            body: JSON.stringify({ invitationIds }),
          }
        );
        const result = await response.json();
        if (response.ok && result.success) {
          toast.success(
            `Successfully sent ${result.data.success.length} invitations!`
          );
          setSuccessResult(result.data);
          setSelectedFile(null);
        } else {
          toast.error(result.message || "Failed to send invitations.");
        }
      } catch (error) {
        console.error("Process sending error:", error);
        toast.error("Error sending invitations.");
      }
    },
    [setSelectedFile]
  );

  const pollPaymentStatus = useCallback(
    async (transactionId: string, invitationIds: string[]) => {
      const interval = setInterval(async () => {
        try {
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/invitations/payment/status/${transactionId}`
          );
          const data = await response.json();
          if (
            data.success &&
            (data.status === "COMPLETED" || data.status === "PAID")
          ) {
            clearInterval(interval);
            setPollingInterval(null);
            setShowPayment(false);
            setIsSantimLoading(false);
            setIsWaitingForPayment(false);
            setCurrentTransactionId(null);
            toast.success("Payment successful! Invitations are being sent.");
            setSuccessResult({
              success: invitationIds,
              failed: [],
            });
            setSelectedFile(null);
          } else if (data.status === "FAILED" || data.status === "CANCELLED") {
            clearInterval(interval);
            setPollingInterval(null);
            setIsSantimLoading(false);
            setIsWaitingForPayment(false);
            setCurrentTransactionId(null);
            if (data.status === "CANCELLED") {
              toast.info("Payment cancelled.");
            } else {
              toast.error("Payment failed. Please try again.");
            }
          }
        } catch (error) {
          console.error("Polling error:", error);
        }
      }, 5000);
      setPollingInterval(interval);
    },
    [setSelectedFile]
  );

  const handleMobilePayment = async () => {
    if (!paymentConfig || !user) return;
    if (!paymentPhoneNumber) {
      toast.error("Please enter a phone number");
      return;
    }
    setIsSantimLoading(true);

    let finalPhone = paymentPhoneNumber;
    if (activePaymentProvider === "CHAPA") {
      if (!finalPhone.startsWith("0")) {
        finalPhone = `0${finalPhone}`;
      }
    } else {
      if (finalPhone.startsWith("0")) {
        finalPhone = `+251${finalPhone.substring(1)}`;
      } else if (!finalPhone.startsWith("+251")) {
        finalPhone = `+251${finalPhone}`;
      }
    }

    try {
      const txnId = crypto.randomUUID();
      const endpoint =
        activePaymentProvider === "CHAPA"
          ? "/api/invitations/payment/initiate/chapa"
          : "/api/invitations/payment/initiate";

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}${endpoint}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${useAuthStore.getState().token}`,
          },
          body: JSON.stringify({
            amount: paymentConfig.amount,
            paymentReason: `Bulk Invitation Fee`,
            phoneNumber: finalPhone,
            paymentMethod: paymentMethod,
            invitationData: {
              eventId: event._id,
              userId: user._id || user.id,
              txnId,
              pendingInvitationIds,
              type: "bulk_invitation_fee",
            },
          }),
        }
      );

      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Payment initiation failed");

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }

      if (data.success && data.transactionId) {
        setCurrentTransactionId(data.transactionId);
        setIsSantimLoading(false);
        setIsWaitingForPayment(true);        // Now this works
        setShowPayment(false);
        toast.success(
          "Payment initiated. Please check your phone to complete the payment."
        );
        pollPaymentStatus(data.transactionId, pendingInvitationIds);
      } else {
        throw new Error("Invalid response from server");
      }
    } catch (error: unknown) {
      console.error("Payment error:", error);
      const message =
        error instanceof Error ? error.message : "Failed to initiate payment";
      toast.error(message);
      setIsSantimLoading(false);
    }
  };

  const headers = [
    "No",
    "Name",
    "Email",
    "Phone",
    "Type",
    "Ticket Type",
    "Amount",
    "Message",
    "Actions",
  ];

  const columnWidths: Record<string, string> = {
    No: "3rem",
    Name: "12rem",
    Email: "14rem",
    Phone: "10rem",
    Type: "6.5rem",
    "Ticket Type": "7.5rem",
    Amount: "5rem",
    Message: "9rem",
    Actions: "4.5rem",
  };

  const inputBaseClass =
    "w-full rounded-lg border bg-white dark:bg-black px-2.5 py-1.5 text-sm text-gray-900 dark:text-gray-100 outline-none transition-colors focus:ring-2 focus:ring-blue-500/60 dark:focus:ring-blue-500/40";

  if (successResult) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
          <PlusIcon className="w-8 h-8 text-green-600 dark:text-green-400" />
        </div>
        <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Invitations Sent!
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Successfully processed {successResult.success.length} invitations.
          {successResult.failed.length > 0 && (
            <span className="text-red-500 dark:text-red-400 block mt-1">
              {successResult.failed.length} failed to send.
            </span>
          )}
        </p>
        <Button
          onClick={() => {
            if (setShowBulkModal) setShowBulkModal(false);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          Done
        </Button>
      </div>
    );
  }

  return (
    <>
      {/* Payment Modal */}
      {showPayment && paymentConfig && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-xl max-w-md w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Payment Required
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Complete payment to send bulk invitations for:{" "}
              <strong className="text-gray-900 dark:text-gray-100">{event.title}</strong>
            </p>
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100">
              <div className="flex justify-between text-sm mb-2">
                <span>Total Amount:</span>
                <span>{paymentConfig.amount} ETB</span>
              </div>
              <div className="border-t border-gray-300 dark:border-gray-700 pt-2 flex justify-between font-semibold">
                <span>Total:</span>
                <span>{paymentConfig.amount} ETB</span>
              </div>
            </div>
            <div className="space-y-6 mb-6">
              <div>
                <Label className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-2 block">
                  Phone Number
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 font-medium z-10">
                    +251
                  </span>
                  <Input
                    value={paymentPhoneNumber}
                    onChange={(e) => {
                      let val = e.target.value.replace(/\D/g, "");
                      if (val.startsWith("0")) val = val.substring(1);
                      if (val.startsWith("251")) val = val.substring(3);
                      setPaymentPhoneNumber(val);
                    }}
                    placeholder="911234567"
                    className="pl-14"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-2 block">
                  Payment Method
                </Label>
                <PaymentMethodSelector
                  phoneNumber={paymentPhoneNumber}
                  selectedMethod={paymentMethod}
                  onSelect={setPaymentMethod}
                  provider={activePaymentProvider}
                />
              </div>
            </div>
            <Button
              onClick={handleMobilePayment}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 text-lg mb-4"
              disabled={
                isSantimLoading ||
                !paymentPhoneNumber ||
                !paymentMethod ||
                paymentPhoneNumber.length < 9
              }
            >
              {isSantimLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />{" "}
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-5 w-5" /> Pay{" "}
                  {paymentConfig.amount} ETB
                </>
              )}
            </Button>
            <div className="mt-2">
              <button
                onClick={() => setShowPayment(false)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all duration-200 font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table and rest of UI */}
      <div className="w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-black">
        <div className="flex items-center justify-between gap-4 border-b border-gray-200 px-4 py-3 dark:border-gray-800">
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Guest List
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {validCount} of {data.length} row{data.length === 1 ? "" : "s"} ready to send
              {invalidCount > 0 && (
                <span className="text-red-600 dark:text-red-400">
                  {" "}
                  · {invalidCount} need{invalidCount === 1 ? "s" : ""} attention
                </span>
              )}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={addEmptyRow}
            className="shrink-0 gap-1.5"
          >
            <PlusIcon className="h-4 w-4" />
            Add Row
          </Button>
        </div>

        <div className="max-h-[420px] overflow-x-auto overflow-y-auto">
          <table className="w-full table-fixed text-left text-sm">
            <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900/70">
              <tr>
                {headers.map((h) => (
                  <th
                    key={h}
                    className="border-b border-gray-200 px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:text-gray-400"
                    style={{ width: columnWidths[h] }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayData.map((row: Row, i: number) => {
                const rowValid = isRowValid(row);
                return (
                  <tr
                    key={row.id}
                    className={`border-b border-gray-100 transition-colors last:border-b-0 hover:bg-gray-50 dark:border-gray-900 dark:hover:bg-gray-900/40 ${
                      !rowValid ? "border-l-2 border-l-red-400 dark:border-l-red-500" : ""
                    }`}
                  >
                    {headers.map((key) => (
                      <td key={key} className="px-3 py-2 align-top">
                        {key === "No" && (
                          <div
                            className="flex items-center justify-center gap-1.5 pt-2"
                            title={rowValid ? "Ready to send" : "Missing or invalid contact info"}
                          >
                            <span
                              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                                rowValid ? "bg-green-500" : "bg-red-500"
                              }`}
                            />
                            <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
                              {row.No}
                            </span>
                          </div>
                        )}
                        {key === "Name" && (
                          <input
                            type="text"
                            value={row.Name}
                            placeholder="Guest name"
                            onChange={(e) =>
                              handleChange(i, "Name", e.target.value)
                            }
                            className={`${inputBaseClass} ${
                              row.Name?.trim().length === 0
                                ? "border-red-400 dark:border-red-600"
                                : "border-gray-300 dark:border-gray-700"
                            }`}
                          />
                        )}
                        {key === "Email" && (
                          <input
                            type="email"
                            value={row.Email}
                            disabled={row.Type === "Phone"}
                            placeholder="name@example.com"
                            onChange={(e) =>
                              handleChange(i, "Email", e.target.value)
                            }
                            className={`${inputBaseClass} ${
                              (row.Type === "Email" || row.Type === "Both") &&
                              !isEmailValid(row.Email)
                                ? "border-red-400 dark:border-red-600"
                                : "border-gray-300 dark:border-gray-700"
                            } ${
                              row.Type === "Phone"
                                ? "opacity-50 bg-gray-50 dark:bg-gray-900/50"
                                : ""
                            }`}
                          />
                        )}
                        {key === "Phone" && (
                          <input
                            type="tel"
                            value={row.Phone}
                            disabled={row.Type === "Email"}
                            placeholder="09XXXXXXXX"
                            onChange={(e) =>
                              handleChange(i, "Phone", e.target.value)
                            }
                            className={`${inputBaseClass} ${
                              (row.Type === "Phone" || row.Type === "Both") &&
                              !isPhoneValid(row.Phone)
                                ? "border-red-400 dark:border-red-600"
                                : "border-gray-300 dark:border-gray-700"
                            } ${
                              row.Type === "Email"
                                ? "opacity-50 bg-gray-50 dark:bg-gray-900/50"
                                : ""
                            }`}
                          />
                        )}
                        {key === "Type" && (
                          <select
                            value={row.Type}
                            onChange={(e) =>
                              handleContactTypeChange(
                                i,
                                e.target.value as "Email" | "Phone" | "Both"
                              )
                            }
                            className={`${inputBaseClass} border-gray-300 dark:border-gray-700`}
                          >
                            <option value="Email">Email</option>
                            <option value="Phone">SMS</option>
                            <option value="Both">Both</option>
                          </select>
                        )}
                        {key === "Ticket Type" && (
                          <select
                            value={row.TicketType || ticketType || "Regular"}
                            onChange={(e) =>
                              handleChange(i, "TicketType", e.target.value)
                            }
                            className={`${inputBaseClass} border-gray-300 dark:border-gray-700`}
                          >
                            <option value="Regular">Regular</option>
                            <option value="VIP">VIP</option>
                            <option value="VVIP">VVIP</option>
                          </select>
                        )}
                        {key === "Amount" && (
                          <input
                            type="number"
                            min={1}
                            value={row.Amount}
                            defaultValue={1}
                            onChange={(e) =>
                              handleChange(
                                i,
                                "Amount",
                                Math.max(1, Number(e.target.value))
                              )
                            }
                            className={`${inputBaseClass} border-gray-300 dark:border-gray-700`}
                          />
                        )}
                        {key === "Message" && (
                          <div className="flex flex-col gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              className="h-8 w-full justify-center px-2 text-xs"
                              onClick={() => openMessageDialog(i)}
                            >
                              <MessageSquareText className="mr-1 h-3 w-3" />
                              {row.Message?.trim() ? "Edit Message" : "Add Message"}
                            </Button>
                            {row.Message?.trim() && (
                              <p
                                className="truncate text-[10px] text-gray-500 dark:text-gray-400"
                                title={row.Message}
                              >
                                {row.Message}
                              </p>
                            )}
                          </div>
                        )}
                        {key === "Actions" && (
                          <Button
                            type="button"
                            className="h-8 w-full gap-1 px-2 text-xs text-gray-500 hover:border hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:border-red-800 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                            variant={"ghost"}
                            onClick={() => handleRemove(i)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Remove
                          </Button>
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {showDataTrimmed && (
            <p className="py-6 text-center text-sm text-gray-600 dark:text-gray-400">
              Displaying first 1000 rows only.
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-gray-200 px-4 py-3 dark:border-gray-800">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Total Cost:{" "}
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {totalCost} ETB
            </span>
          </p>
        </div>
      </div>

      <div className="mt-3 w-full">
        <button
          onClick={handleBulkSend}
          disabled={!canSend || isSubmitting}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white transition-all duration-200 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing…
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Send Bulk Invitations
            </>
          )}
        </button>
        {!canSend && !isSubmitting && data.length > 0 && (
          <p className="mt-2 text-center text-xs text-red-600 dark:text-red-400">
            Fix {invalidCount} row{invalidCount === 1 ? "" : "s"} above before sending.
          </p>
        )}
      </div>

      <Dialog
        open={isMessageDialogOpen}
        onOpenChange={(open) => {
          setIsMessageDialogOpen(open);
          if (!open) {
            setEditingMessageIndex(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Invitation Message</DialogTitle>
            <DialogDescription>
              {editingMessageIndex !== null
                ? `Set a custom message for ${data[editingMessageIndex]?.Name || "this contact"}.`
                : "Set a custom message for this contact."}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={messageDraft}
            onChange={(e) => setMessageDraft(e.target.value)}
            className="min-h-36"
            placeholder="Type invitation message..."
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsMessageDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={saveMessage}>
              Save Message
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Waiting for Payment Modal - NOW WORKS */}
      <Dialog
        open={isWaitingForPayment}
        onOpenChange={(open) => {
          if (!open) {
            handleCancelPayment();
          }
        }}
      >
        <DialogContent className="max-w-sm rounded-xl p-6 text-center">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold mb-2">
              Waiting for Payment
            </DialogTitle>
            <DialogDescription>
              Please check your phone and complete the payment.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-6">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0D47A1]"></div>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            We are waiting for confirmation from the payment provider...
          </p>
          <Button
            variant="outline"
            className="w-full text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-800"
            onClick={handleCancelPayment}
          >
            Cancel Payment
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
