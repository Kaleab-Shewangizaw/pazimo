"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "./ui/button";
import QrModal from "./qrModel";
import base64id from "base64id";
import { PlusIcon, X, Loader2 } from "lucide-react";
import { PaymentInit, Row } from "@/types/bulk-invite";
import { toast } from "sonner";
import { Event } from "@/types/invitation";
import {
  generatePaymentConfig,
  validateAndCorrectRows,
} from "@/utils/bulkInviteValidation";
import { useAuthStore } from "@/store/authStore";
import { useSearchParams } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import PaymentMethodSelector from "@/components/payment/PaymentMethodSelector";

interface EditableTableProps {
  event: Event;
  data: Row[];
  setData: (rows: Row[]) => void;
  setSelectedFile: (file: File | null) => void;
  setShowBulkModal: (show: boolean) => void | undefined;
}

export default function EditableTable({
  event,
  data,
  setData,
  setSelectedFile,
  setShowBulkModal,
}: EditableTableProps) {
  const searchParams = useSearchParams();
  const [showDataTrimmed, setShowDataTrimmed] = useState(false);
  const [qrRow, setQrRow] = useState<Row | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [canSend, setCanSend] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [isSantimLoading, setIsSantimLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("telebirr");
  const [paymentPhoneNumber, setPaymentPhoneNumber] = useState("");
  const { user } = useAuthStore();
  const [paymentConfig, setPaymentConfig] = useState<PaymentInit | null>(null);
  const [pendingInvitationIds, setPendingInvitationIds] = useState<string[]>(
    []
  );
  const [successResult, setSuccessResult] = useState<{
    success: unknown[];
    failed: unknown[];
  } | null>(null);

  const displayData = data.length > 1000 ? data.slice(0, 1000) : data;

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

  // Assign IDs if missing
  useEffect(() => {
    const missing = data.some((row) => !row.id);
    if (!missing) return;
    setData(
      data.map((row) => (!row.id ? { ...row, id: base64id.generateId() } : row))
    );
  }, [data, setData]);

  // Validation helpers
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

  // Set "canSend"
  useEffect(() => {
    const allValid =
      data.length > 0 && data.every((row: Row) => isRowValid(row));
    setCanSend(allValid);
  }, [data, isRowValid]);

  // Handle row changes
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

  // ===============================
  // BULK SEND FIXED
  // ===============================
  const handleBulkSend = async () => {
    setIsSubmitting(true);
    try {
      // await onSend();

      handleSend();
    } catch (err) {
      console.error("Error sending:", err);
      toast.error("Failed to send invitations");
    } finally {
      setIsSubmitting(false);
      // setSelectedFile(null);
      // setShowBulkModal(false);
    }
  };

  // Cost calculation
  const calculateCost = (): number => {
    return data.reduce((total, row) => {
      const amount = Number(row.Amount || 1);
      if (row.Type === "Both") return total + 7 * amount;
      if (row.Type === "Phone") return total + 5 * amount;
      if (row.Type === "Email") return total + 2 * amount;
      return total;
    }, 0);
  };

  const totalCost = calculateCost();

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

  const handleSend = async () => {
    const { summary, readyToGenerate } = validateAndCorrectRows(data);

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
      // 1. Create Pending Invitations
      const payload = {
        rows: data.map((row) => ({
          guestName: row.Name,
          guestEmail: row.Email,
          guestPhone: row.Phone,
          type: row.Type.toLowerCase(),
          amount: row.Amount,
          qrCodecount: row.Amount,
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

      // 2. Check Cost
      // Use server-calculated cost if available, otherwise fallback to client calc
      const costToPay = totalCost !== undefined ? totalCost : summary.totalCost;

      if (costToPay === 0) {
        await processSending(invitationIds);
        return;
      }

      // 3. Init Payment
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
      setPaymentPhoneNumber(user.phoneNumber || "");
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

  const handleMobilePayment = async () => {
    if (!paymentConfig || !user) return;
    setIsSantimLoading(true);

    try {
      const txnId = crypto.randomUUID();

      // Save pending invitation IDs to localStorage
      localStorage.setItem(
        `bulk_invitations_${txnId}`,
        JSON.stringify(pendingInvitationIds)
      );

      const response = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: paymentConfig.amount,
          paymentReason: `Bulk Invitation Fee`,
          phoneNumber: paymentPhoneNumber,
          invitationData: {
            eventId: event._id,
            userId: user._id || user.id,
            txnId,
            pendingInvitationIds,
            type: "bulk_invitation_fee",
          },
          orderId: txnId,
          successUrl: `${window.location.origin}/organizer/invitations?action=process_bulk_payment&orderId=${txnId}`,
        }),
      });

      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Payment initiation failed");

      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        throw new Error("No payment URL returned");
      }
    } catch (error: unknown) {
      console.error("Payment error:", error);
      const message =
        error instanceof Error ? error.message : "Failed to initiate payment";
      toast.error(message);
      setIsSantimLoading(false);
    }
  };

  useEffect(() => {
    const txRef = searchParams.get("tx_ref");
    const status = searchParams.get("status");

    if (txRef && status === "success") {
      let foundKey = null;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("bulk_invitations_")) {
          foundKey = key;
          break;
        }
      }

      if (foundKey) {
        const storedIds = localStorage.getItem(foundKey);
        if (storedIds) {
          const ids = JSON.parse(storedIds);
          setPendingInvitationIds(ids);
          localStorage.removeItem(foundKey);

          // Process sending
          processSending(ids);
        }
      }
    }
  }, [searchParams, processSending]);

  const headers = [
    "No",
    "Name",
    "Email",
    "Phone",
    "Type",
    "Amount",
    "Message",
    "QR",
  ];

  if (successResult) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <PlusIcon className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">
          Invitations Sent!
        </h3>
        <p className="text-gray-600 mb-6">
          Successfully processed {successResult.success.length} invitations.
          {successResult.failed.length > 0 && (
            <span className="text-red-500 block mt-1">
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
      <div className="w-full border border-gray-300 rounded-lg overflow-auto">
        {showPayment && paymentConfig && (
          <div className="absolute inset-0 bg-white/90 z-50 flex flex-col items-center justify-start pt-4 md:justify-center md:pt-0 rounded-xl p-4 md:p-8">
            <div className="w-full max-w-md bg-white shadow-2xl rounded-xl p-6 border border-gray-200 max-h-[85vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-900">Checkout</h3>
                <button
                  onClick={() => setShowPayment(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 mb-6">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Total Amount</span>
                  <span className="font-bold text-gray-900">
                    {paymentConfig.amount} ETB
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Transaction Ref</span>
                  <span className="font-mono text-xs text-gray-500">
                    {paymentConfig.tx_ref}
                  </span>
                </div>
              </div>

              <div className="mb-6">
                <Label className="text-xs font-semibold uppercase text-gray-500 mb-2 block">
                  Phone Number
                </Label>
                <Input
                  value={paymentPhoneNumber}
                  onChange={(e) => setPaymentPhoneNumber(e.target.value)}
                  placeholder="09|07..."
                  className="mt-1"
                />
              </div>

              <div className="mb-6">
                <Label className="text-xs font-semibold uppercase text-gray-500 mb-2 block">
                  Payment Method
                </Label>
                <PaymentMethodSelector
                  phoneNumber={paymentPhoneNumber}
                  selectedMethod={paymentMethod}
                  onSelect={setPaymentMethod}
                />
              </div>

              <Button
                onClick={handleMobilePayment}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white h-12 text-lg mb-4"
                disabled={
                  isSantimLoading || !paymentPhoneNumber || !paymentMethod
                }
              >
                {isSantimLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />{" "}
                    Processing...
                  </>
                ) : (
                  `Pay ${paymentConfig.amount} ETB`
                )}
              </Button>
            </div>
          </div>
        )}
        <div className="max-h-[500px] overflow-y-auto overflow-x-auto">
          <table className="w-full text-xs text-left table-fixed">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                {headers.map((h) => (
                  <th
                    key={h}
                    className="px-2 py-2 font-semibold text-gray-700 border-b"
                    style={{
                      width:
                        h === "No"
                          ? "2.5rem"
                          : h === "Type"
                          ? "6rem"
                          : h === "Amount"
                          ? "5rem"
                          : undefined,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {displayData.map((row: Row, i: number) => (
                <tr
                  key={row.id}
                  className={`border-b hover:bg-gray-100 ${
                    !isRowValid(row) ? "bg-red-50" : ""
                  }`}
                >
                  {headers.map((key) => (
                    <td key={key} className="px-3 py-2">
                      {key === "No" && (
                        <div className="text-center">{row.No}</div>
                      )}

                      {key === "Name" && (
                        <input
                          type="text"
                          value={row.Name}
                          onChange={(e) =>
                            handleChange(i, "Name", e.target.value)
                          }
                          className={`border px-2 py-1 rounded w-full text-xs ${
                            row.Name?.trim().length === 0
                              ? "border-red-500 bg-red-100"
                              : "border-gray-300"
                          }`}
                        />
                      )}

                      {key === "Email" && (
                        <input
                          type="email"
                          value={row.Email}
                          disabled={row.Type === "Phone"}
                          onChange={(e) =>
                            handleChange(i, "Email", e.target.value)
                          }
                          className={`border px-2 py-1 rounded w-full text-xs ${
                            (row.Type === "Email" || row.Type === "Both") &&
                            !isEmailValid(row.Email)
                              ? "border-red-500 bg-red-100"
                              : "border-gray-300"
                          } ${
                            row.Type === "Phone" ? "opacity-50 bg-gray-100" : ""
                          }`}
                        />
                      )}

                      {key === "Phone" && (
                        <input
                          type="tel"
                          value={row.Phone}
                          disabled={row.Type === "Email"}
                          onChange={(e) =>
                            handleChange(i, "Phone", e.target.value)
                          }
                          className={`border px-2 py-1 rounded w-full text-xs ${
                            (row.Type === "Phone" || row.Type === "Both") &&
                            !isPhoneValid(row.Phone)
                              ? "border-red-500 bg-red-100"
                              : "border-gray-300"
                          } ${
                            row.Type === "Email" ? "opacity-50 bg-gray-100" : ""
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
                          className="border px-2 py-1 rounded w-full text-xs"
                        >
                          <option value="Email">Email</option>
                          <option value="Phone">Phone</option>
                          <option value="Both">Both</option>
                        </select>
                      )}

                      {key === "Amount" && (
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={row.Amount}
                          onChange={(e) =>
                            handleChange(
                              i,
                              "Amount",
                              Math.max(1, Math.min(10, Number(e.target.value)))
                            )
                          }
                          className="border border-gray-300 px-2 py-1 rounded w-full"
                        />
                      )}

                      {key === "Message" && (
                        <input
                          type="text"
                          value={row.Message}
                          onChange={(e) =>
                            handleChange(i, "Message", e.target.value)
                          }
                          className="border border-gray-300 px-2 py-1 rounded w-full text-xs"
                        />
                      )}

                      {key === "QR" && (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            disabled={!isRowValid(row)}
                            className="text-xs py-1 px-2"
                            onClick={() => setQrRow(row)}
                          >
                            Generate
                          </Button>

                          <Button
                            className="text-xs py-1 px-2 hover:border hover:border-red-500 hover:text-red-500"
                            variant={"ghost"}
                            onClick={() => handleRemove(i)}
                          >
                            Remove
                          </Button>
                        </div>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {showDataTrimmed && (
            <p className="text-center py-6 text-sm text-gray-600">
              Displaying first 1000 rows only.
            </p>
          )}
        </div>

        <div className="p-3 flex justify-between items-center">
          <p className="text-sm">
            <strong>Total Cost:</strong> {totalCost} birr
          </p>

          <Button onClick={addEmptyRow} variant={"outline"}>
            <PlusIcon className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="w-full mt-3">
        <button
          onClick={handleBulkSend}
          disabled={!canSend || isSubmitting}
          className="flex-1 bg-blue-600 w-full hover:bg-blue-700 text-white px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium"
        >
          {isSubmitting ? "Processing..." : "Send Bulk Invitations"}
        </button>
      </div>

      {qrRow && <QrModal row={qrRow} onClose={() => setQrRow(null)} />}
    </>
  );
}
