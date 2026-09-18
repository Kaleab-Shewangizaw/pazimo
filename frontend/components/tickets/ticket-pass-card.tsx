"use client";

import type { CSSProperties, ReactNode } from "react";
import { useRef, useState } from "react";
import Image from "next/image";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

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
  /** Rendered under the fields grid — e.g. a "View seats" button for a
   * multi-seat ticket. Absent for the common single-seat/general-admission
   * card, which looks exactly as it always has. */
  extra?: ReactNode;
  qrSrc?: string;
  qrAlt?: string;
  caption?: string;
  /** Rendered below the download/done row — e.g. cinema snacks pre-bought
   * with the ticket ("Collect at the counter"). Keeps this card the ONLY
   * thing shown once a cinema order settles, rather than a second box
   * floating below it for what is really just more of the same receipt. */
  belowQr?: ReactNode;
  note?: ReactNode;
  deadMessage?: string;
  /**
   * Overlaid on the poster band, bottom-aligned — e.g. "You're going to the
   * movies! / Your ticket is ready", the way the event post-purchase modal
   * greets a fresh purchase. Omit on a persistent /ticket/{id} page, where
   * "you're going" no longer fits days later — the plain poster is enough.
   */
  bannerHeading?: string;
  bannerSubheading?: string;
  /**
   * Filename stem (no extension) for the downloaded PNG. Providing this is
   * what turns on the download button — it captures the whole rendered card
   * (backdrop, fields, QR) exactly the way an event ticket already downloads
   * from the post-purchase modal, rather than saving just the bare QR.
   */
  downloadFileName?: string;
  /** Passed to navigator.share as the share sheet's title. Defaults to `title`. */
  shareTitle?: string;
  /**
   * Last resort, only called if the whole-card capture itself fails (e.g. a
   * blocked cross-origin image tainting the canvas) — typically wired to
   * fetch just the raw QR PNG so the customer still gets something scannable.
   */
  onCaptureFailed?: () => void | Promise<void>;
  downloadLabel?: string;
  /**
   * A second, non-capturing action next to Download — "Done" to close the
   * sheet after seeing the ticket, the same pair the event post-purchase
   * modal offers. Omitted wherever there is nothing to close (a persistent
   * ticket page), which keeps just the one Download button as before.
   */
  onDone?: () => void;
  doneLabel?: string;
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
  extra,
  qrSrc,
  qrAlt = "Ticket QR Code",
  caption = "— SCAN FOR ENTRY —",
  belowQr,
  note,
  deadMessage,
  bannerHeading,
  bannerSubheading,
  downloadFileName,
  shareTitle,
  onCaptureFailed,
  downloadLabel = "Download",
  onDone,
  doneLabel = "Done",
}: TicketPassCardProps) {
  const backdropStyle = buildPassBackdropStyle(backdropImageUrl);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    const node = cardRef.current;
    if (!node || !downloadFileName || downloading) return;
    setDownloading(true);
    try {
      const { toBlob } = await import("html-to-image");
      const blob = await toBlob(node, {
        pixelRatio: 2,
        // The card has its own solid gradient background, so this is only a
        // fallback for any edge pixel a browser fails to rasterize.
        backgroundColor: "#06283D",
        // The download button itself lives inside this same card (there's
        // nowhere else to put it) — exclude it from the exported image.
        filter: (el) =>
          !(el instanceof HTMLElement && el.dataset.captureIgnore === "true"),
      });
      if (!blob) throw new Error("Ticket render failed");

      const filename = `${downloadFileName}.png`;
      const file = new File([blob], filename, { type: "image/png" });

      // On phones, a plain <a download> often just opens the image in a tab
      // instead of saving it. Where the native share sheet is available, it's
      // the reliable way to let someone save straight to Photos.
      if (
        typeof navigator !== "undefined" &&
        navigator.canShare?.({ files: [file] })
      ) {
        await navigator.share({ files: [file], title: shareTitle || title });
        toast.success("Ticket ready to save!");
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Ticket downloaded!");
    } catch (err) {
      // A user cancelling the share sheet also lands here — don't treat that as a failure.
      if (err instanceof Error && err.name === "AbortError") return;
      if (onCaptureFailed) {
        await onCaptureFailed();
        toast.success("Ticket QR downloaded!");
      } else {
        toast.error("Could not download the ticket");
      }
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      ref={cardRef}
      className="max-w-sm w-full pb-15 bg-gradient-to-br from-[#06283D] to-[#1A5D8C] dark:bg-card rounded-3xl border-0 shadow-2xl ring-1 ring-white/10 overflow-hidden"
    >
      {/* Poster band — the same "image up top, fading into the card's own
          color" treatment the event post-purchase ticket uses. Absent
          entirely when there's no poster/cover to show. */}
      {backdropImageUrl && (
        <div className="relative h-36 w-full">
          <Image src={backdropImageUrl} alt={title} fill unoptimized className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#06283D]/70 via-[#06283D]/25 to-[#06283D]" />
          {(bannerHeading || bannerSubheading) && (
            <div className="absolute inset-x-0 bottom-3 px-6 text-center">
              {bannerHeading && (
                <h2 className="text-2xl font-extrabold text-white drop-shadow-md">
                  {bannerHeading}
                </h2>
              )}
              {bannerSubheading && (
                <p className="text-sm text-white/80">{bannerSubheading}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Blue header block */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#06283D] to-[#1A5D8C] px-7 pb-8 pt-6">
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

        {extra && <div className="relative mt-4">{extra}</div>}
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

            {(downloadFileName || onDone) && (
              <div
                className="flex w-full items-center gap-3 px-2 pt-1"
                data-capture-ignore="true"
              >
                {downloadFileName && (
                  <button
                    onClick={handleDownload}
                    disabled={downloading}
                    className={
                      onDone
                        ? "flex flex-1 items-center justify-center gap-2 rounded-full border border-white/25 bg-white/10 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20 disabled:opacity-60"
                        : "flex items-center gap-2 rounded-full bg-[#06283D] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0a3a57] disabled:opacity-60"
                    }
                  >
                    {downloading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    {downloadLabel}
                  </button>
                )}
                {onDone && (
                  <button
                    onClick={onDone}
                    className="flex-1 rounded-full bg-white py-2 text-sm font-semibold text-[#06283D] transition-colors hover:bg-white/90"
                  >
                    {doneLabel}
                  </button>
                )}
              </div>
            )}

            {belowQr && <div className="w-full border-t border-white/10 pt-3">{belowQr}</div>}
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
