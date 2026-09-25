"use client";
import { Receipt, Info } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export default function VatBannerPreview() {
  return (
    <div className="p-8 bg-gradient-to-br from-blue-50 to-white dark:from-gray-900 dark:to-black min-h-screen">
      <button
        type="button"
        className="mb-6 rounded border px-3 py-1.5 text-sm"
        onClick={() => document.documentElement.classList.toggle("dark")}
      >
        Toggle dark mode
      </button>

      <div className="max-w-2xl">
        {/* VAT Notice */}
        <div className="flex items-center justify-between gap-3 rounded-xl border border-[#0D47A1]/15 dark:border-blue-400/25 bg-[#0D47A1]/[0.04] dark:bg-blue-400/10 px-3.5 sm:px-4 py-2.5 sm:py-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="flex-shrink-0 rounded-full bg-[#0D47A1]/10 dark:bg-blue-400/20 p-1.5 sm:p-2">
              <Receipt className="h-4 w-4 text-[#0D47A1] dark:text-blue-300" />
            </div>
            <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-200">
              VAT is applied to Pazimo&rsquo;s service fee in accordance with applicable tax
              requirements.
            </p>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex-shrink-0 rounded-full p-1.5 text-[#0D47A1] dark:text-blue-300 hover:bg-[#0D47A1]/10 dark:hover:bg-blue-400/20 transition-colors cursor-pointer"
                aria-label="How is VAT calculated?"
              >
                <Info className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-72 sm:w-80 dark:bg-gray-900 dark:border-gray-700"
            >
              <div className="space-y-3">
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    How VAT is calculated
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Example: a 100 ETB ticket at Pazimo&rsquo;s standard 3% commission
                  </p>
                </div>
                <div className="space-y-1.5 text-xs sm:text-sm">
                  <div className="flex justify-between text-gray-600 dark:text-gray-300">
                    <span>Ticket price</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      100.00 ETB
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-600 dark:text-gray-300">
                    <span>Pazimo commission (3%)</span>
                    <span>-3.00 ETB</span>
                  </div>
                  <div className="flex justify-between text-gray-600 dark:text-gray-300">
                    <span>VAT on commission (15%)</span>
                    <span>-0.45 ETB</span>
                  </div>
                  <div className="flex justify-between pt-1.5 border-t border-gray-200 dark:border-gray-700 font-semibold text-gray-900 dark:text-gray-100">
                    <span>You receive</span>
                    <span>96.55 ETB</span>
                  </div>
                </div>
                <p className="text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
                  VAT is charged on Pazimo&rsquo;s commission only — never on the ticket price
                  your buyers pay.
                </p>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}
