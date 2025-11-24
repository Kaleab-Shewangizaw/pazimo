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
    id: "telebirr",
    name: "Telebirr",
    description: "Telebirr is a mobile money service provider in Ethiopia",
    image: "/Telebirr.png",
  },

  { id: "cbebirr", name: "CBE Birr", image: "/cbe_birr.png" },
  { id: "mpesa", name: "M-Pesa", image: "/M-PESA_LOGO.png" },
  { id: "awashbirr", name: "Awash Birr", image: "/Awash birr.jpeg" },
  { id: "abyssinia", name: "Bank of Abyssinia", image: "/abissinia.png" },
  {
    id: "coop",
    name: "Cooperative Bank of Oromia",
    image: "/Cooperative_Bank_of_Oromia.png",
  },
];

export default function PaymentMethodSelector({
  phoneNumber,
  selectedMethod,
  onSelect,
}: PaymentMethodSelectorProps) {
  const isTelebirrDisabled = phoneNumber.startsWith("07");
  const isMpesaDisabled = phoneNumber.startsWith("09");

  const isDisabled = (methodId: string) => {
    if (methodId === "telebirr" && isTelebirrDisabled) return true;
    if (methodId === "mpesa" && isMpesaDisabled) return true;
    return false;
  };

  return (
    <RadioGroup
      value={selectedMethod}
      onValueChange={onSelect}
      className="grid grid-cols-2 sm:grid-cols-3 gap-4"
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
                "flex flex-col items-center justify-center p-4 rounded-xl border-2 border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 cursor-pointer transition-all duration-200 h-full",
                "peer-data-[state=checked]:border-orange-600 peer-data-[state=checked]:bg-orange-50",
                disabled &&
                  "opacity-50 cursor-not-allowed hover:bg-white hover:border-gray-200 grayscale"
              )}
            >
              <div className="relative w-12 h-12 mb-3">
                <Image
                  src={method.image}
                  alt={method.name}
                  fill
                  className="object-contain"
                />
              </div>
              <span className="text-xs font-medium text-center text-gray-700 peer-data-[state=checked]:text-orange-700">
                {method.name}
              </span>
            </Label>
            {disabled && (
              <span className="absolute -bottom-6 left-0 right-0 text-[10px] text-center text-red-500 font-medium">
                Not available for this number
              </span>
            )}
          </div>
        );
      })}
    </RadioGroup>
  );
}
