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
  currency?: "ETB" | "USD";
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
    id: "Awash Bank",
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
  {
    id: "boa_ussd",
    name: "Bank of Abyssinia",
    image: "/abissinia.png",
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

const INTERNATIONAL_CARD_METHODS = [
  {
    id: "visa",
    name: "Visa",
    description: "Visa cards",
    image: "/visa.png",
  },
  {
    id: "mastercard",
    name: "Mastercard",
    description: "Mastercard",
    image: "/mastercard.png",
  },
];

export default function PaymentMethodSelector({
  phoneNumber,
  selectedMethod,
  onSelect,
  provider = "SANTIM",
  currency = "ETB",
}: PaymentMethodSelectorProps) {
  // If USD currency is selected, show international card payment option
  // Otherwise, show local Ethiopian payment methods
  const methods = currency === "USD"
    ? INTERNATIONAL_CARD_METHODS
    : (provider === "CHAPA" ? CHAPA_METHODS : SANTIM_METHODS);

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
      className="w-full"
    >
      <div className="relative overflow-x-auto pb-2 pr-6 scrollbar-hide [scrollbar-width:none] [-ms-overflow-style:none]">
        <div className="pointer-events-none absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-white via-white/85 to-transparent dark:from-[#0f1115] dark:via-[#0f1115]/85" />
        <div className="flex w-max flex-nowrap gap-2.5 snap-x snap-mandatory">
          {methods.map((method) => {
            const disabled = isDisabled(method.id);
            return (
              <div key={method.id} className="relative w-[6.4rem] flex-none snap-start">
                <RadioGroupItem
                  value={method.id}
                  id={`payment-${method.id}`}
                  disabled={disabled}
                  className="peer sr-only"
                />
                <Label
                  htmlFor={`payment-${method.id}`}
                  className={cn(
                    "flex h-full flex-col items-center justify-start gap-2 rounded-lg border border-gray-200 bg-white px-0.5 py-2 text-center hover:border-gray-300 hover:bg-gray-50 cursor-pointer transition-all duration-200",
                    "dark:bg-[#1A1D24] dark:border-white/10 dark:hover:bg-[#252932] dark:hover:border-white/20",
                    "peer-data-[state=checked]:border-blue-600 peer-data-[state=checked]:bg-blue-50",
                    "dark:peer-data-[state=checked]:border-yellow-500 dark:peer-data-[state=checked]:bg-yellow-500/10",
                    disabled &&
                    "opacity-50 cursor-not-allowed hover:bg-white hover:border-gray-200 grayscale dark:hover:bg-[#1A1D24] dark:hover:border-white/10"
                  )}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center">
                    <Image
                      src={method.image}
                      alt={method.name}
                      width={96}
                      height={96}
                      className="max-h-full max-w-full object-contain dark:brightness-110"
                    />
                  </div>
                  <span className="text-[9px] leading-tight font-bold text-gray-700 dark:text-gray-300 peer-data-[state=checked]:text-blue-700 dark:peer-data-[state=checked]:text-blue-400">
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
        </div>
      </div>
    </RadioGroup>
  );
}
