"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "./ui/button";
import QrModal from "./qrModel";
import base64id from "base64id";
import { PlusIcon, Loader2, CreditCard } from "lucide-react";
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
  const [paymentMethod, setPaymentMethod] = useState("Telebirr");
  const [paymentPhoneNumber, setPaymentPhoneNumber] = useState("");
  const { user } = useAuthStore();
  const [paymentConfig, setPaymentConfig] = useState<PaymentInit | null>(null);
  const [pendingInvitationIds, setPendingInvitationIds] = useState<string[]>(
    []
  );
  const [pricing, setPricing] = useState({ email: 2, sms: 5 });
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(
    null
  );
  const [successResult, setSuccessResult] = useState<{
    success: unknown[];
    failed: unknown[];
  } | null>(null);

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
      if (row.Type === "Both")
        return total + (pricing.email + pricing.sms) * amount;
      if (row.Type === "Phone") return total + pricing.sms * amount;
      if (row.Type === "Email") return total + pricing.email * amount;
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
            if (interval) clearInterval(interval);
            setPollingInterval(null);
            setShowPayment(false);
            setIsSantimLoading(false);
            toast.success("Payment successful! Invitations are being sent.");

            // Since backend handles sending on payment success, we just show success UI
            setSuccessResult({
              success: invitationIds,
              failed: [],
            });
            setSelectedFile(null);
          } else if (data.status === "FAILED" || data.status === "CANCELLED") {
            if (interval) clearInterval(interval);
            setPollingInterval(null);
            setIsSantimLoading(false);
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
    [processSending]
  );

  const handleMobilePayment = async () => {
    if (!paymentConfig || !user) return;

    if (!paymentPhoneNumber) {
      toast.error("Please enter a phone number");
      return;
    }

    setIsSantimLoading(true);

    // Normalize phone number
    let finalPhone = paymentPhoneNumber;
    if (!finalPhone.startsWith("+251")) {
      finalPhone = `+251${finalPhone}`;
    }

    try {
      const txnId = crypto.randomUUID();

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/invitations/payment/initiate`,
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

      if (data.success && data.transactionId) {
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
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white border border-gray-200 rounded-xl max-w-md w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Payment Required
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                Complete payment to send bulk invitations for:{" "}
                <strong>{event.title}</strong>
              </p>

              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="flex justify-between text-sm mb-2">
                  <span>Total Amount:</span>
                  <span>{paymentConfig.amount} ETB</span>
                </div>
                <div className="border-t border-gray-300 pt-2 flex justify-between font-semibold">
                  <span>Total:</span>
                  <span>{paymentConfig.amount} ETB</span>
                </div>
              </div>

              <div className="space-y-6 mb-6">
                <div>
                  <Label className="text-xs font-semibold uppercase text-gray-500 mb-2 block">
                    Phone Number
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium z-10">
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
                  <Label className="text-xs font-semibold uppercase text-gray-500 mb-2 block">
                    Payment Method
                  </Label>
                  <PaymentMethodSelector
                    phoneNumber={paymentPhoneNumber}
                    selectedMethod={paymentMethod}
                    onSelect={setPaymentMethod}
                  />
                </div>
              </div>

              <Button
                onClick={handleMobilePayment}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white h-12 text-lg mb-4"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 hover:bg-gray-50 transition-all duration-200 font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800"></div>
        <div className="max-h-[400px] overflow-y-auto overflow-x-auto">
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
                          defaultValue={1}
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
