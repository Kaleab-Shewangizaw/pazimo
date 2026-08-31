"use client";

import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import { Download } from "lucide-react";

export interface TicketPassField {
  label: string;
  value: string;
}

export interface TicketPassCardProps {
  title: string;
  watermark?: string;
  badgeText?: string;
  badgeClassName?: string;
  backdropImageUrl?: string;
  fields: TicketPassField[];
  qrSrc?: string;
  qrAlt?: string;
  caption?: string;
  note?: ReactNode;
  deadMessage?: string;
  onDownload?: () => void;
  downloadLabel?: string;
}

/**
 * Shared "fixed" background so a page-level backdrop and this card's notch
 * cutouts read as the exact same image/overlay wherever each one lands on
 * screen — see the two usages in TicketDetailClient and CinemaTicketView.
 */
export const buildPassBackdropStyle = (
  imageUrl?: string
): CSSProperties | undefined =>
  imageUrl
    ? {
        backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.7), rgba(0,0,0,0.35) 50%, rgba(0,0,0,0.8)), linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)), url(${imageUrl})`,
        backgroundSize: "cover, cover, cover",
        backgroundPosition: "center, center, center",
        backgroundAttachment: "fixed, fixed, fixed",
        backgroundRepeat: "no-repeat, no-repeat, no-repeat",
      }
    : undefined;

/**
 * The branded "pass" card shown right after a purchase — gradient header,
 * die-cut perforation, a single QR to scan at the door.
 *
 * Originally built for event tickets; cinema tickets render through this same
 * component now so a ticket looks the same no matter which product sold it.
 */
export default function TicketPassCard({
  title,
  watermark,
  badgeText = "OFFICIAL PASS",
  badgeClassName = "border-white/50 text-white",
  backdropImageUrl,
  fields,
  qrSrc,
  qrAlt = "Ticket QR Code",
  caption = "— SCAN FOR ENTRY —",
  note,
  deadMessage,
  onDownload,
  downloadLabel = "Download QR",
}: TicketPassCardProps) {
  const backdropStyle = buildPassBackdropStyle(backdropImageUrl);

  return (
    <div className="max-w-sm w-full pb-15 bg-gradient-to-br from-[#06283D] to-[#1A5D8C] dark:bg-card rounded-3xl border-0 shadow-2xl ring-1 ring-white/10 overflow-hidden">
      {/* Blue header block */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#06283D] to-[#1A5D8C] px-7 py-10">
        {watermark && (
          <span className="pointer-events-none absolute -bottom-4 right-5 select-none text-6xl font-black tracking-tight text-white/10 whitespace-nowrap">
            {watermark}
          </span>
        )}

        <div className="relative flex items-start justify-between gap-3">
          <h1 className="text-xl font-extrabold leading-tight text-white">{title}</h1>
          <span
            className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-[10px] font-bold tracking-wider ${badgeClassName}`}
          >
            {badgeText}
          </span>
        </div>

        <div className="relative mt-5 grid grid-cols-2 gap-y-4 gap-x-3">
          {fields.map((field, i) => (
            <div key={field.label} className={i % 2 === 1 ? "text-right" : ""}>
              <p className="text-[10px] tracking-wider text-white/65">{field.label}</p>
              <p className="text-sm font-bold text-white">{field.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Perforation with die-cut notches */}
      <div className="relative">
        <div
          className="absolute -top-2.5 -left-2.5 h-5 w-5 rounded-full bg-gray-50 dark:bg-background border-0"
          style={backdropStyle}
        />
        <div
          className="absolute -top-2.5 -right-2.5 h-5 w-5 rounded-full bg-gray-50 dark:bg-background"
          style={backdropStyle}
        />
        <div className="mx-5 border-t-2 border-dashed border-gray-300 dark:border-border" />
      </div>

      {/* QR Code Section */}
      <div className="flex flex-col items-center justify-center gap-3 px-7 pt-15 pb-0">
        {qrSrc ? (
          <>
            <Image
              width={256}
              height={256}
              priority
              src={qrSrc}
              unoptimized
              alt={qrAlt}
              className="w-34 h-34"
            />
            <p className="text-[11px] font-bold tracking-[0.2em] text-gray-400 dark:text-gray-500">
              {caption}
            </p>

            {onDownload && (
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={onDownload}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#06283D] rounded-full hover:bg-[#0a3a57] transition-colors"
                >
                  <Download className="w-4 h-4" />
                  {downloadLabel}
                </button>
              </div>
            )}
          </>
        ) : (
          <p className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">
            {deadMessage}
          </p>
        )}

        {note && (
          <p className="pb-2 text-center text-xs text-gray-400 dark:text-gray-500">{note}</p>
        )}
      </div>
    </div>
  );
}
