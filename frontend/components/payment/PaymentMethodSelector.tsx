import React from "react";
import Image from "next/image";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface PaymentMethodSelectorProps {
  phoneNumber: string;
  selectedMethod: string;
  onSelect: (method: string) => void;
}

const PAYMENT_METHODS = [
  {
    id: "Telebirr",
    name: "Telebirr",
    description: "Telebirr is a mobile money service provider in Ethiopia",
    image: "/Telebirr.png",
  },
  {
    id: "Commercial Bank of Ethiopia",
    name: "CBE",
    image: "/cbe-logo.png", // Assuming this image is appropriate for CBE
  },
  {
    id: "Mpesa",
    name: "M-Pesa",
    image: "/mpesa-logo.png",
  },
  {
    id: "Awash Bank",
    name: "Awash Bank",
    image: "/Awash-Bank.png",
  },
];

export default function PaymentMethodSelector({
  phoneNumber,
  selectedMethod,
  onSelect,
}: PaymentMethodSelectorProps) {
  // Handle both 09/07 and 9/7 formats
  const isTelebirrDisabled =
    phoneNumber.startsWith("07") || phoneNumber.startsWith("7");
  const isMpesaDisabled =
    phoneNumber.startsWith("09") || phoneNumber.startsWith("9");

  const isDisabled = (methodId: string) => {
    if (methodId === "Telebirr" && isTelebirrDisabled) return true;
    if (methodId === "Mpesa" && isMpesaDisabled) return true;
    return false;
  };

  return (
    <RadioGroup
      value={selectedMethod}
      onValueChange={onSelect}
      className="grid grid-cols-4 gap-2"
    >
      {PAYMENT_METHODS.map((method) => {
        const disabled = isDisabled(method.id);
        return (
          <div key={method.id} className="relative">
            <RadioGroupItem
              value={method.id}
              id={`payment-${method.id}`}
              disabled={disabled}
              className="peer sr-only"
            />
            <Label
              htmlFor={`payment-${method.id}`}
              className={cn(
                "flex flex-col items-center justify-start px-1 py-2 gap-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 cursor-pointer transition-all duration-200 h-full",
                "peer-data-[state=checked]:border-orange-600 peer-data-[state=checked]:bg-orange-50",
                disabled &&
                  "opacity-50 cursor-not-allowed hover:bg-white hover:border-gray-200 grayscale",
              )}
            >
              <div className="relative w-8 h-8 shrink-0">
                <Image
                  src={method.image}
                  alt={method.name}
                  fill
                  className="object-contain"
                />
              </div>
              <span className="text-xs font-bold text-gray-700 peer-data-[state=checked]:text-orange-700">
                {method.name}
              </span>
            </Label>
            {disabled && (
              <span className="absolute -bottom-5 left-0 right-0 text-[9px] text-center text-red-500 font-medium">
                Not available
              </span>
            )}
          </div>
        );
      })}
    </RadioGroup>
  );
}
