"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AlertCircle, Landmark, Loader2, Smartphone } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL;
const TELEBIRR_FEE_RATE = 0.02;

const PAYOUT_METHODS: {
  id: "telebirr" | "mpesa" | "bank";
  label: string;
  icon: typeof Smartphone;
}[] = [
  { id: "telebirr", label: "Telebirr", icon: Smartphone },
  { id: "mpesa", label: "M-Pesa", icon: Smartphone },
  { id: "bank", label: "Bank", icon: Landmark },
];

const formatAmount = (value: number) =>
  value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const EMPTY_PAYOUT = {
  bankName: "",
  accountName: "",
  accountNumber: "",
  accountHolderName: "",
};

export function VenueWithdrawalForm({
  token,
  available,
  onSuccess,
}: {
  token: string | null;
  available: number;
  onSuccess?: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [payout, setPayout] = useState(EMPTY_PAYOUT);
  const [submitting, setSubmitting] = useState(false);

  const parsedAmount = Number(amount);
  const netAfterFee =
    parsedAmount > 0 && payout.bankName === "telebirr"
      ? parsedAmount * (1 - TELEBIRR_FEE_RATE)
      : parsedAmount;

  const submit = async () => {
    if (!token) {
      toast.error("Please sign in again to request a withdrawal");
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error("Enter an amount greater than zero");
      return;
    }
    if (parsedAmount > available) {
      toast.error(`That is more than your available balance of ${formatAmount(available)} ETB`);
      return;
    }
    if (!payout.bankName) {
      toast.error("Choose a payout method");
      return;
    }
    if (!payout.accountHolderName.trim()) {
      toast.error("Enter the account holder's full name");
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
    if (payout.bankName === "bank" && !payout.accountName.trim()) {
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
          stream: "venue_beverages",
          notes: notes.trim() || undefined,
          bankDetails: payout,
        }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) throw new Error(payload.message || "Could not request the withdrawal");

      toast.success("Withdrawal requested", {
        description: `You will receive ${formatAmount(netAfterFee)} ETB after fees are applied.`,
      });
      setAmount("");
      setNotes("");
      setPayout(EMPTY_PAYOUT);
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not request the withdrawal");
    } finally {
      setSubmitting(false);
    }
  };

  if (available <= 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white/70 px-6 py-12 text-center dark:border-gray-700 dark:bg-gray-950/30">
        <p className="font-semibold text-gray-900 dark:text-gray-100">Nothing to withdraw yet</p>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Your venue balance grows as drinks sell and payouts settle independently from ticket revenue.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-950/40">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Available to withdraw
        </span>
        <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">
          {formatAmount(available)} ETB
        </span>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="venue-withdraw-amount" className="text-sm">
            Amount to withdraw
          </Label>
          <button
            type="button"
            className="text-xs font-medium text-amber-700 hover:underline dark:text-amber-400"
            onClick={() => setAmount(available.toFixed(2))}
          >
            Withdraw everything
          </button>
        </div>
        <div className="relative">
          <Input
            id="venue-withdraw-amount"
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
            Amount exceeds your venue balance
          </p>
        )}
      </div>

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
                <RadioGroupItem value={method.id} id={`venue-payout-${method.id}`} className="peer sr-only" />
                <Label
                  htmlFor={`venue-payout-${method.id}`}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 rounded-xl border px-2 py-3 text-center cursor-pointer transition-colors",
                    checked
                      ? "border-amber-500 bg-amber-50 ring-1 ring-amber-500 dark:border-amber-400 dark:bg-amber-950/30 dark:ring-amber-400"
                      : "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:bg-gray-900/40"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-5 w-5",
                      checked ? "text-amber-700 dark:text-amber-400" : "text-gray-500 dark:text-gray-400"
                    )}
                  />
                  <span className="text-xs font-medium">{method.label}</span>
                </Label>
              </div>
            );
          })}
        </RadioGroup>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="venue-account-holder">Account holder name</Label>
          <Input
            id="venue-account-holder"
            value={payout.accountHolderName}
            onChange={(e) => setPayout((prev) => ({ ...prev, accountHolderName: e.target.value }))}
            placeholder="Full name"
          />
        </div>
        {payout.bankName === "bank" && (
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="venue-bank-name">Bank</Label>
            <Input
              id="venue-bank-name"
              value={payout.accountName}
              onChange={(e) => setPayout((prev) => ({ ...prev, accountName: e.target.value }))}
              placeholder="Commercial Bank of Ethiopia"
            />
          </div>
        )}
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="venue-account-number">
            {payout.bankName === "bank" ? "Bank account number" : "Phone number"}
          </Label>
          <Input
            id="venue-account-number"
            value={payout.accountNumber}
            onChange={(e) => setPayout((prev) => ({ ...prev, accountNumber: e.target.value }))}
            placeholder={payout.bankName === "bank" ? "Account number" : "Phone number"}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="venue-withdraw-notes">Notes</Label>
          <Textarea
            id="venue-withdraw-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional note for the finance team"
            rows={3}
          />
        </div>
      </div>

      <Alert className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-sm">
          Venue withdrawals are settled in ETB only. Telebirr requests carry a 2% payout fee.
        </AlertDescription>
      </Alert>

      <Button
        type="button"
        onClick={submit}
        disabled={submitting}
        className="h-12 w-full bg-amber-600 text-white hover:bg-amber-700"
      >
        {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Request withdrawal
      </Button>
    </div>
  );
}