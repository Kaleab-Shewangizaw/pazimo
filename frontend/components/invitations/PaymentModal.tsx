import React, { useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pricing } from "@/types/invitation";
import PaymentMethodSelector from "@/components/payment/PaymentMethodSelector";
import { toast } from "sonner";

interface PaymentModalProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pendingInvitation: any;
  pricing: Pricing;
  isSantimLoading: boolean;
  onPay: (details: {
    phoneNumber: string;
    paymentMethod: string;
  }) => Promise<void>;
  onCancel: () => void;
}

export default function PaymentModal({
  pendingInvitation,
  pricing,
  isSantimLoading,
  onPay,
  onCancel,
}: PaymentModalProps) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedMethod, setSelectedMethod] = useState("Telebirr");

  const amount = (
    (pendingInvitation?.contactType === "email" ? pricing.email : pricing.sms) *
    (pendingInvitation?.qrCodeCount || 1)
  ).toFixed(2);

  const handlePayment = async () => {
    if (!phoneNumber) {
      toast.error("Please enter a phone number");
      return;
    }
    if (!selectedMethod) {
      toast.error("Please select a payment method");
      return;
    }

    // Normalize phone number
    let finalPhone = phoneNumber;
    if (!finalPhone.startsWith("+251")) {
      finalPhone = `+251${finalPhone}`;
    }

    await onPay({ phoneNumber: finalPhone, paymentMethod: selectedMethod });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-gray-200 rounded-xl max-w-md w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Payment Required
        </h3>
        <p className="text-sm text-gray-600 mb-6">
          Complete payment to send invitation for:{" "}
          <strong>{pendingInvitation?.selectedEvent?.title}</strong>
        </p>

        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex justify-between text-sm mb-2">
            <span>Invitation Cost:</span>
            <span>{amount} ETB</span>
          </div>
          <div className="border-t border-gray-300 pt-2 flex justify-between font-semibold">
            <span>Total:</span>
            <span>{amount} ETB</span>
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
                value={phoneNumber}
                onChange={(e) => {
                  let val = e.target.value.replace(/\D/g, "");
                  if (val.startsWith("0")) val = val.substring(1);
                  if (val.startsWith("251")) val = val.substring(3);
                  setPhoneNumber(val);
                }}
                placeholder="911234567"
                className="pl-14 placeholder:text-gray-300"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold uppercase text-gray-500 mb-2 block">
              Payment Method
            </Label>
            <PaymentMethodSelector
              phoneNumber={phoneNumber}
              selectedMethod={selectedMethod}
              onSelect={setSelectedMethod}
            />
          </div>
        </div>

        <Button
          onClick={handlePayment}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 text-lg mb-4"
          disabled={
            isSantimLoading ||
            !phoneNumber ||
            !selectedMethod ||
            phoneNumber?.length < 9
          }
        >
          {isSantimLoading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processing...
            </>
          ) : (
            <>
              <CreditCard className="mr-2 h-5 w-5" /> Pay {amount} ETB
            </>
          )}
        </Button>

        <div className="mt-2">
          <button
            onClick={onCancel}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 hover:bg-gray-50 transition-all duration-200 font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
