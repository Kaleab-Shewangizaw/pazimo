"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import {
  CalendarDays,
  Ticket,
  Popcorn,
  Wallet,
  ScanLine,
  Mail,
} from "lucide-react";

const SECTIONS = [
  {
    icon: CalendarDays,
    title: "Program",
    href: "/cinema/programme",
    body: "Add halls, then films, then screenings. Ticket prices belong to the screening, not the film — so a Tuesday matinee and a Saturday premiere of the same title can be priced differently. Setting a film's runtime lets us warn you when two screenings would overlap in the same hall.",
  },
  {
    icon: Ticket,
    title: "Tickets",
    href: "/cinema/tickets",
    body: "Sell at the counter and see every sale. Seats are held the moment a ticket is issued, so two people buying the last seat at the same time cannot both get it — the second is told how many are left.",
  },
  {
    icon: ScanLine,
    title: "Admission",
    href: "/cinema/scanner",
    body: "Scan a ticket's QR, or type its code. You can only admit tickets for your own screenings; an event ticket scanned here is rejected as the wrong kind rather than failing silently.",
  },
  {
    icon: Popcorn,
    title: "Concessions",
    href: "/cinema/concessions",
    body: "Products come from Pazimo's catalogue and you set your own price — the same item can cost something different at every cinema. Needs Pazimo's approval, which is separate from selling tickets.",
  },
  {
    icon: Wallet,
    title: "Money",
    href: "/cinema/money",
    body: "Ticket revenue and concession revenue are two separate balances, withdrawn separately. Selling out a screening does not let you draw against popcorn you have not sold. Each sale records the commission rate it was made under, so a later renegotiation never restates money already reported.",
  },
];

export default function CinemaHelpPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
        Help Center
      </h1>
      <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
        How the cinema dashboard works.
      </p>

      <div className="space-y-4">
        {SECTIONS.map(({ icon: Icon, title, href, body }) => (
          <Card
            key={href}
            className="border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950/50"
          >
            <CardContent className="p-5">
              <Link
                href={href}
                className="flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
              >
                <Icon className="h-4 w-4" />
                {title}
              </Link>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                {body}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6 border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950/50">
        <CardContent className="flex items-center gap-3 p-5 text-sm">
          <Mail className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          <span className="text-gray-600 dark:text-gray-400">
            Need something changed — commission rates, concession approval, a new
            hall? Contact Pazimo and we&apos;ll set it up.
          </span>
        </CardContent>
      </Card>
    </div>
  );
}
