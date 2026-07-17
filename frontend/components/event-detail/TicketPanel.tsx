"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import TicketCounter from "@/components/ticket-counter";
import { cn } from "@/lib/utils";
import {
  type TicketType,
  type Currency,
  formatTicketPrice,
} from "./types";

type TicketPanelProps = {
  tickets: TicketType[];
  selectedTicketType: string;
  onSelectTicketType: (name: string) => void;
  selectedCurrency: Currency;
  onSelectCurrency: (currency: Currency) => void;
  availableCurrencies: { hasETB: boolean; hasUSD: boolean };
  isSoldOut: boolean;
  quantity: number;
  onQuantityChange: (quantity: number) => void;
  maxQuantity: number;
  isQuantityExceeded: boolean;
  totalPrice: number;
  showBuyButton: boolean;
  isProcessing: boolean;
  onBuy: () => void;
};

export default function TicketPanel({
  tickets,
  selectedTicketType,
  onSelectTicketType,
  selectedCurrency,
  onSelectCurrency,
  availableCurrencies,
  isSoldOut,
  quantity,
  onQuantityChange,
  maxQuantity,
  isQuantityExceeded,
  totalPrice,
  showBuyButton,
  isProcessing,
  onBuy,
}: TicketPanelProps) {
  return (
    <div className="rounded-3xl p-6 bg-white/60 dark:bg-white/[0.06] backdrop-blur-2xl border border-white/60 dark:border-white/10 shadow-[0_8px_32px_rgba(31,38,135,0.14)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.35)] transition-colors">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
        Select Tickets
      </h2>
      <div className="space-y-5">
        {/* Currency selector */}
        {availableCurrencies.hasETB && availableCurrencies.hasUSD && (
          <div className="flex gap-1.5 rounded-2xl bg-white/40 dark:bg-white/[0.04] border border-white/50 dark:border-white/10 p-1.5">
            {(["ETB", "USD"] as const).map((currency) => (
              <button
                key={currency}
                type="button"
                onClick={() => onSelectCurrency(currency)}
                className={cn(
                  "flex-1 rounded-xl py-2 text-sm font-semibold transition-all",
                  selectedCurrency === currency
                    ? "bg-[#0D47A1] text-white dark:bg-yellow-400 dark:text-black shadow-md"
                    : "text-gray-600 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-white/10",
                )}
              >
                {currency === "ETB" ? "Birr (ETB)" : "Dollar (USD)"}
              </button>
            ))}
          </div>
        )}

        {isSoldOut ? (
          <div className="text-center py-8 rounded-2xl bg-white/40 dark:bg-white/[0.04] border border-white/50 dark:border-white/10">
            <p className="text-red-500 font-bold text-lg mb-1">
              Tickets Not Available
            </p>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              This event is sold out or has ended.
            </p>
          </div>
        ) : (
          <>
            <RadioGroup
              value={selectedTicketType}
              onValueChange={onSelectTicketType}
            >
              {tickets.map((ticketType) => (
                <div
                  key={ticketType.name}
                  onClick={() => onSelectTicketType(ticketType.name)}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-2xl border p-4 cursor-pointer transition-all backdrop-blur-md",
                    selectedTicketType === ticketType.name
                      ? "border-[#0D47A1]/50 bg-blue-100/50 dark:border-yellow-400/50 dark:bg-yellow-400/10 shadow-md"
                      : "border-white/50 dark:border-white/10 bg-white/30 dark:bg-white/[0.03] hover:border-[#0D47A1]/30 dark:hover:border-white/25",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <RadioGroupItem
                      value={ticketType.name}
                      id={ticketType.name}
                      className="mt-0.5"
                    />
                    <div>
                      <Label
                        htmlFor={ticketType.name}
                        className="font-semibold text-gray-900 dark:text-white cursor-pointer"
                      >
                        {ticketType.name}
                      </Label>
                      {ticketType.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {ticketType.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="font-bold text-[#0D47A1] dark:text-yellow-400 whitespace-nowrap text-sm">
                    {formatTicketPrice(ticketType, selectedCurrency)}
                  </span>
                </div>
              ))}
            </RadioGroup>

            {tickets.length === 0 && (
              <p className="text-center py-6 text-gray-500 dark:text-gray-400 text-sm">
                No tickets are currently available.
              </p>
            )}

            {tickets.length > 0 && (
              <>
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Number of tickets:
                  </h3>
                  <TicketCounter
                    value={quantity}
                    onChange={onQuantityChange}
                    max={maxQuantity}
                  />
                  {isQuantityExceeded && (
                    <p className="text-xs text-red-500 mt-1">
                      Not enough tickets available
                    </p>
                  )}
                </div>

                {totalPrice > 0 && (
                  <>
                    <Separator className="bg-gray-200/60 dark:bg-white/10" />
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-400 font-medium">
                        Total
                      </span>
                      <span className="text-2xl font-bold text-[#0D47A1] dark:text-yellow-400">
                        {selectedCurrency === "USD"
                          ? `$${totalPrice}`
                          : `${totalPrice} Birr`}
                      </span>
                    </div>
                  </>
                )}

                {showBuyButton && (
                  <Button
                    onClick={onBuy}
                    disabled={
                      isQuantityExceeded || isProcessing || !selectedTicketType
                    }
                    className="w-full h-12 text-base font-semibold bg-[#0D47A1] hover:bg-[#0D47A1]/90 dark:bg-yellow-400 dark:text-black dark:hover:bg-yellow-400/90 text-white disabled:bg-gray-300 dark:disabled:bg-white/10 dark:disabled:text-gray-500 rounded-2xl shadow-lg"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : selectedTicketType ? (
                      `Buy Ticket — ${selectedCurrency === "USD" ? "$" : ""}${totalPrice} ${selectedCurrency === "USD" ? "USD" : "ETB"}`
                    ) : (
                      "Select a Ticket"
                    )}
                  </Button>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
