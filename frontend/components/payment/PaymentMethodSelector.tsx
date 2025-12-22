import React from "react";
import Image from "next/image";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface PaymentMethodSelectorProps {
  phoneNumber: string;
  selectedMethod: string;
  onSelect: (method: string) => void;
  provider?: "SANTIM" | "CHAPA";
}

const SANTIM_METHODS = [
  {
    id: "Telebirr",
    name: "Telebirr",
    description: "Telebirr is a mobile money service provider in Ethiopia",
    image: "/Telebirr.png",
  },
  {
    id: "CBE Birr", // Keeping existing ID as per "Keep Santim Pay exactly as it is"
    name: "CBE Birr",
    image: "/cbe-logo.png",
  },
  {
    id: "Mpesa",
    name: "M-Pesa",
    image: "/mpesa-logo.png",
  },
  {
    id: "Awash Bank", // Keeping existing ID
    name: "Awash Bank",
    image: "/Awash-Bank.png",
  },
];

const CHAPA_METHODS = [
  {
    id: "telebirr",
    name: "Telebirr",
    image: "/Telebirr.png",
  },
  {
    id: "CBEBirr",
    name: "CBE Birr",
    image: "/cbe-logo.png",
  },
  {
    id: "mpesa",
    name: "M-Pesa",
    image: "/mpesa-logo.png",
  },

  // {
  //   id: "Coopay-Ebirr",
  //   name: "Coopay Ebirr",
  //   image: "/coopay-logo.png",
  // },
  {
    id: "AwashBirr",
    name: "Awash Bank",
    image: "/Awash-Bank.png",
  },
  // {
  //   id: "yaya",
  //   name: "Yaya Wallet",
  //   image: "/yaya-logo.png",
  // },
  // {
  //   id: "Amole",
  //   name: "Amole",
  //   image: "/amole-logo.png",
  // },
];

export default function PaymentMethodSelector({
  phoneNumber,
  selectedMethod,
  onSelect,
  provider = "SANTIM",
}: PaymentMethodSelectorProps) {
  const methods = provider === "CHAPA" ? CHAPA_METHODS : SANTIM_METHODS;

  // Handle both 09/07 and 9/7 formats
  const isTelebirrDisabled =
    phoneNumber.startsWith("07") || phoneNumber.startsWith("7");
  const isMpesaDisabled =
    phoneNumber.startsWith("09") || phoneNumber.startsWith("9");

  const isDisabled = (methodId: string) => {
    // Only apply validation for Telebirr/Mpesa if the ID matches (case-insensitive check for safety or exact match)
    if (methodId.toLowerCase().includes("telebirr") && isTelebirrDisabled)
      return true;
    if (methodId.toLowerCase().includes("mpesa") && isMpesaDisabled)
      return true;
    return false;
  };

  return (
    <RadioGroup
      value={selectedMethod}
      onValueChange={onSelect}
      className="grid grid-cols-4 gap-2"
    >
      {methods.map((method) => {
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
                "peer-data-[state=checked]:border-blue-600 peer-data-[state=checked]:bg-blue-50",
                disabled &&
                  "opacity-50 cursor-not-allowed hover:bg-white hover:border-gray-200 grayscale"
              )}
            >
              <div className=" w-8 h-8 shrink-0 flex items-center justify-center">
                <Image
                  src={method.image}
                  alt={method.name}
                  width={
                    method.name === "CBE Birr" || method.name === "Awash Bank"
                      ? 32
                      : 120
                  }
                  height={
                    method.name === "CBE Birr" || method.name === "Awash Bank"
                      ? 32
                      : 120
                  }
                  className={`${
                    method.name === "CBE Birr" || method.name === "Awash Bank"
                      ? ""
                      : "scale-190"
                  }`}
                />
              </div>
              <span className="text-xs font-bold text-gray-700 peer-data-[state=checked]:text-blue-700">
                {method.name}
              </span>
            </Label>
            {disabled && (
              <span className="absolute -bottom-5 left-0 right-0 text-[9px] text-center text-red-500 font-medium">
                use {method.id} compatible number
              </span>
            )}
          </div>
        );
      })}
    </RadioGroup>
  );
}
