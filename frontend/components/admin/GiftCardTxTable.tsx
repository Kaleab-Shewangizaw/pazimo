"use client";

import { Fragment, useState } from "react";
import type React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

export interface CardTransactionDetails {
  // top-ups
  type?: string;
  payer_phone?: string | null;
  payment_method?: string | null;
  merchant_reference?: string | null;
  // payouts
  destination?: string;
  bank_slug?: string;
  account_number?: string;
  account_name?: string;
  destination_card_number?: string;
  merchant_id?: string;
}

export interface CardOwnerInfo {
  owner_phone?: string;
  first_name?: string;
  last_name?: string;
  currency?: string;
}

export interface CardTransaction {
  kind: "topup" | "payout";
  direction: "in" | "out";
  card_number?: string;
  reference: string;
  chapa_reference: string | null;
  merchant_reference: string | null;
  status: string;
  amount: number;
  service_fee: number;
  currency: string;
  method: string | null;
  counterparty: string | null;
  mode: string;
  created_at: string;
  completed_at: string | null;
  details: CardTransactionDetails | null;
  initiated_by: string | null;
  owner?: CardOwnerInfo | null;
}

const formatMoney = (value: number, currency: string) =>
  `${(value ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;

// Link API amounts are cents
export const formatLinkCents = (cents: number, currency: string) =>
  formatMoney((Number(cents) || 0) / 100, currency);

const statusBadgeClass = (status: string) =>
  status === "success"
    ? "bg-green-100 text-green-800 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-900"
    : status === "pending"
    ? "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-300 dark:border-yellow-900"
    : "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900";

export default function GiftCardTxTable({
  transactions,
  showCard = false,
}: {
  transactions: CardTransaction[];
  showCard?: boolean;
}) {
  const [expandedTx, setExpandedTx] = useState<string | null>(null);
  const columnCount = showCard ? 7 : 6;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-4" />
          <TableHead>Date</TableHead>
          <TableHead>Type</TableHead>
          {showCard && <TableHead>Card</TableHead>}
          <TableHead>Via</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map((tx) => {
          const txKey = `${tx.kind}-${tx.reference}`;
          const isExpanded = expandedTx === txKey;
          const detailRows: Array<[string, React.ReactNode]> = [];

          // Curate the detail fields per transaction type
          if (tx.kind === "topup") {
            detailRows.push([
              "Paid via",
              tx.details?.payment_method || tx.method || "—",
            ]);
            if (tx.details?.payer_phone)
              detailRows.push([
                "Paid by",
                <span className="font-mono" key="payer">
                  {tx.details.payer_phone}
                </span>,
              ]);
          } else {
            if (tx.details?.destination === "bank") {
              detailRows.push(["Sent to", `${tx.details.bank_slug} account`]);
              detailRows.push([
                "Account number",
                <span className="font-mono" key="acct">
                  {tx.details.account_number}
                </span>,
              ]);
              if (tx.details.account_name)
                detailRows.push(["Account name", tx.details.account_name]);
            } else if (tx.details?.destination_card_number) {
              detailRows.push([
                "Sent to card",
                <span className="font-mono" key="dcard">
                  {tx.details.destination_card_number}
                </span>,
              ]);
            } else if (tx.details?.merchant_id) {
              detailRows.push([
                "Sent to merchant",
                <span className="font-mono" key="merch">
                  {tx.details.merchant_id}
                </span>,
              ]);
            } else {
              detailRows.push(["Payout type", tx.method || "—"]);
              if (tx.counterparty)
                detailRows.push([
                  tx.direction === "out" ? "Sent to" : "Received from",
                  <span className="font-mono" key="cp">
                    {tx.counterparty}
                  </span>,
                ]);
            }
          }
          if (showCard && tx.card_number) {
            detailRows.push([
              "Card",
              <span className="font-mono" key="card">
                {tx.card_number}
              </span>,
            ]);
            if (tx.owner?.owner_phone)
              detailRows.push([
                "Card owner",
                <span key="owner">
                  {[tx.owner.first_name, tx.owner.last_name]
                    .filter(Boolean)
                    .join(" ")}{" "}
                  <span className="font-mono">{tx.owner.owner_phone}</span>
                </span>,
              ]);
          }
          detailRows.push([
            "Chapa reference",
            <span className="font-mono" key="ref">
              {tx.chapa_reference || tx.reference}
            </span>,
          ]);
          if (tx.merchant_reference)
            detailRows.push([
              "Merchant reference",
              <span className="font-mono" key="mref">
                {tx.merchant_reference}
              </span>,
            ]);
          detailRows.push(["Fee", formatLinkCents(tx.service_fee, tx.currency)]);
          detailRows.push([
            "Initiated",
            new Date(tx.created_at).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "medium",
            }),
          ]);
          if (tx.completed_at)
            detailRows.push([
              "Settled",
              new Date(tx.completed_at).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "medium",
              }),
            ]);
          if (tx.initiated_by)
            detailRows.push(["Initiated by", tx.initiated_by]);
          detailRows.push(["Mode", tx.mode || "—"]);

          return (
            <Fragment key={txKey}>
              <TableRow
                className="cursor-pointer"
                onClick={() => setExpandedTx(isExpanded ? null : txKey)}
              >
                <TableCell className="w-4 pr-0">
                  {isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs">
                  {new Date(tx.created_at).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1 text-sm">
                    {tx.direction === "in" ? (
                      <ArrowDownToLine className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                    ) : (
                      <ArrowUpFromLine className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                    )}
                    {tx.kind === "topup"
                      ? "Top-up"
                      : tx.direction === "in"
                      ? "Received"
                      : "Withdrawal"}
                  </span>
                </TableCell>
                {showCard && (
                  <TableCell className="font-mono text-xs">
                    {tx.card_number || "—"}
                  </TableCell>
                )}
                <TableCell className="text-xs">
                  {tx.kind === "topup"
                    ? tx.details?.payment_method || tx.method || "—"
                    : tx.details?.destination === "bank"
                    ? `${tx.details.bank_slug} · ${tx.details.account_number}`
                    : tx.details?.destination_card_number
                    ? `card ${tx.details.destination_card_number}`
                    : tx.details?.merchant_id
                    ? `merchant ${tx.details.merchant_id}`
                    : tx.method || "—"}
                </TableCell>
                <TableCell
                  className={`text-right text-sm tabular-nums ${
                    tx.direction === "in"
                      ? "text-green-700 dark:text-green-400"
                      : "text-red-700 dark:text-red-400"
                  }`}
                >
                  {tx.direction === "in" ? "+" : "−"}
                  {formatLinkCents(tx.amount, tx.currency)}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={statusBadgeClass(tx.status)}>
                    {tx.status}
                  </Badge>
                </TableCell>
              </TableRow>
              {isExpanded && (
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableCell colSpan={columnCount} className="py-3">
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 pl-6 text-xs sm:grid-cols-3">
                      {detailRows.map(([label, value]) => (
                        <div key={label}>
                          <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
                            {label}
                          </span>
                          <span>{value}</span>
                        </div>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}
