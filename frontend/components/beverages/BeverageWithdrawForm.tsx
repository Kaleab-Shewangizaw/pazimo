"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  Info,
  Landmark,
  Loader2,
  Smartphone,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL;

export const TELEBIRR_FEE_RATE = 0.02;

const PAYOUT_METHODS: {
  id: "telebirr" | "mpesa" | "bank";
  label: string;
  icon: typeof Smartphone;
}[] = [
  { id: "telebirr", label: "Telebirr", icon: Smartphone },
  { id: "mpesa", label: "M-Pesa", icon: Smartphone },
  { id: "bank", label: "Bank", icon: Landmark },
];

const BANKS = [
  "Commercial Bank of Ethiopia",
  "Awash International Bank",
  "Bank of Abyssinia",
  "Dashen Bank",
  "Hibret Bank",
  "Zemen Bank",
];

const EMPTY_PAYOUT = {
  accountName: "",
  accountNumber: "",
  bankName: "",
  accountHolderName: "",
};

export const formatEtb = (n: number) =>
  `${(Number.isFinite(n) ? n : 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ETB`;

/**
 * The bar-takings withdrawal request.
 *
 * Posts with `stream: "beverages"`, which is what keeps it out of the ticket
 * pool — the two balances are settled independently, and an outstanding Pazimo
 * Capital advance is repaid from ticket sales only. Payout details are asked
 * for here rather than carried over from the ticket flow: an organizer may well
 * want drink money landing in a different account.
 */
export default function BeverageWithdrawForm({
  token,
  available,
  onSuccess,
}: {
  token: string | null;
  available: number;
  onSuccess?: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [payout, setPayout] = useState(EMPTY_PAYOUT);
  const [submitting, setSubmitting] = useState(false);

  const parsedAmount = Number(amount);
  const isTelebirr = payout.bankName === "telebirr";
  const netAfterFee =
    parsedAmount > 0 && isTelebirr
      ? parsedAmount * (1 - TELEBIRR_FEE_RATE)
      : parsedAmount;

  const payoutIncomplete =
    !payout.bankName ||
    !payout.accountHolderName.trim() ||
    !payout.accountNumber.trim() ||
    (payout.bankName === "bank" && !payout.accountName);

  const submit = async () => {
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error("Enter an amount greater than zero");
      return;
    }
    if (parsedAmount > available) {
      toast.error(`That is more than your bar balance of ${formatEtb(available)}`);
      return;
    }
    if (!payout.bankName) {
      toast.error("Choose a payout method");
      return;
    }
    if (!payout.accountHolderName.trim()) {
      toast.error("Enter the full name of the account holder");
      return;
    }
    if (!payout.accountNumber.trim()) {
      toast.error(
        payout.bankName === "bank"
          ? "Enter the bank account number"
          : "Enter the phone number for the selected method"
      );
      return;
    }
    if (payout.bankName === "bank" && !payout.accountName) {
      toast.error("Select the bank");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`${API}/api/withdrawals`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: parsedAmount,
          currency: "ETB",
          stream: "beverages",
          bankDetails: payout,
        }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) throw new Error(payload.message);
      toast.success("Withdrawal requested", {
        description: "Track it under History — you'll be notified when it's processed.",
      });
      setAmount("");
      setPayout(EMPTY_PAYOUT);
      onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not request the withdrawal"
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (available <= 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 px-6 py-12 text-center">
        <p className="font-medium text-gray-900 dark:text-gray-100">
          Nothing to withdraw yet
        </p>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Your bar balance is {formatEtb(available)}. It grows as drinks sell at your
          events, less Pazimo&apos;s commission.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-5">
      <div className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40 px-3.5 py-2.5">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Available to withdraw
        </span>
        <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">
          {formatEtb(available)}
        </span>
      </div>

      {/* Amount */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="bar-withdraw-amount" className="text-sm">
            Amount to withdraw
          </Label>
          <button
            type="button"
            className="text-xs font-medium text-[#1a2d5a] dark:text-blue-400 hover:underline"
            onClick={() => setAmount(available.toFixed(2))}
          >
            Withdraw everything
          </button>
        </div>
        <div className="relative">
          <Input
            id="bar-withdraw-amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            inputMode="decimal"
            className="h-12 pr-14 text-xl font-semibold tabular-nums"
          />
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-400 dark:text-gray-500">
            ETB
          </span>
        </div>
        {parsedAmount > available && (
          <p className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            Amount exceeds your bar balance
          </p>
        )}
      </div>

      {/* Payout method — the admin needs this to actually pay it out. */}
      <div className="space-y-2">
        <Label className="text-sm">Payout method</Label>
        <RadioGroup
          value={payout.bankName}
          onValueChange={(value) =>
            setPayout((prev) => ({
              ...prev,
              bankName: value,
              accountName: "",
              accountNumber: "",
            }))
          }
          className="grid grid-cols-3 gap-2"
        >
          {PAYOUT_METHODS.map((method) => {
            const checked = payout.bankName === method.id;
            const Icon = method.icon;
            return (
              <div key={method.id} className="relative">
                <RadioGroupItem
                  value={method.id}
                  id={`bar-payout-${method.id}`}
                  className="peer sr-only"
                />
                <Label
                  htmlFor={`bar-payout-${method.id}`}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 rounded-lg border px-2 py-3 text-center cursor-pointer transition-colors",
                    checked
                      ? "border-[#1a2d5a] bg-[#1a2d5a]/5 ring-1 ring-[#1a2d5a] dark:border-blue-500 dark:bg-blue-500/10 dark:ring-blue-500"
                      : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:bg-gray-900/40"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-5 w-5",
                      checked
                        ? "text-[#1a2d5a] dark:text-blue-400"
                        : "text-gray-500 dark:text-gray-400"
                    )}
                  />
                  <span
                    className={cn(
                      "text-xs font-medium",
                      checked
                        ? "text-[#1a2d5a] dark:text-blue-300"
                        : "text-gray-700 dark:text-gray-300"
                    )}
                  >
                    {method.label}
                  </span>
                </Label>
              </div>
            );
          })}
        </RadioGroup>

        {isTelebirr && (
          <Alert className="rounded-lg border-amber-200 dark:border-amber-900/60 bg-amber-50/80 dark:bg-amber-950/30 px-3.5 py-3">
            <Info className="h-4 w-4 text-amber-700 dark:text-amber-400" />
            <AlertDescription className="text-amber-900 dark:text-amber-200 text-xs leading-relaxed">
              Telebirr charges a 2% fee on withdrawals, which will be deducted from
              this request.
              {parsedAmount > 0 && (
                <>
                  {" "}
                  You&apos;ll receive{" "}
                  <span className="font-semibold">{formatEtb(netAfterFee)}</span> after
                  the fee.
                </>
              )}{" "}
              Choose <span className="font-medium">Bank</span> to avoid this deduction
              and receive the full amount.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Method-specific account details */}
      {payout.bankName && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/30 p-4 space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Payout details
          </p>
          <div className="space-y-2">
            <Label htmlFor="bar-holder-name" className="text-sm">
              Full name of the account holder
            </Label>
            <Input
              id="bar-holder-name"
              value={payout.accountHolderName}
              onChange={(e) =>
                setPayout((prev) => ({
                  ...prev,
                  accountHolderName: e.target.value,
                }))
              }
              placeholder="Enter the full name as it appears on the account"
              className="text-sm bg-white dark:bg-black"
            />
          </div>

          {payout.bankName === "bank" && (
            <div className="space-y-2">
              <Label className="text-sm">Bank name</Label>
              <Select
                value={payout.accountName}
                onValueChange={(value) =>
                  setPayout((prev) => ({ ...prev, accountName: value }))
                }
              >
                <SelectTrigger className="text-sm bg-white dark:bg-black">
                  <SelectValue placeholder="Select bank" />
                </SelectTrigger>
                <SelectContent>
                  {BANKS.map((bank) => (
                    <SelectItem key={bank} value={bank}>
                      {bank}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="bar-account-number" className="text-sm">
              {payout.bankName === "bank"
                ? "Bank account number"
                : payout.bankName === "mpesa"
                  ? "M-Pesa phone number"
                  : "Telebirr phone number"}
            </Label>
            <Input
              id="bar-account-number"
              value={payout.accountNumber}
              onChange={(e) =>
                setPayout((prev) => ({ ...prev, accountNumber: e.target.value }))
              }
              placeholder={
                payout.bankName === "bank"
                  ? "Enter account number"
                  : "Enter phone number"
              }
              className="text-sm bg-white dark:bg-black"
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button
          onClick={submit}
          disabled={
            submitting ||
            !amount ||
            parsedAmount <= 0 ||
            parsedAmount > available ||
            payoutIncomplete
          }
          className="bg-[#1a2d5a] hover:bg-[#1a2d5a]/90 text-white"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Request withdrawal
        </Button>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Reviewed by Pazimo before payout.
        </p>
      </div>
    </div>
  );
}
