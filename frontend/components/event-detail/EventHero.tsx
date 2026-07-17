"use client";

import Image from "next/image";
import { useState } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  UserCheck,
  Heart,
  Share2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

type EventHeroProps = {
  title: string;
  coverImageUrl: string;
  description: string;
  categoryName?: string;
  dateLabel: string;
  timeLabel: string;
  locationLabel: string;
  ageLabel?: string | null;
  organizerName?: string;
  isWishlisted: boolean;
  isWishlistLoading: boolean;
  onToggleWishlist: () => void;
  onShare: () => void;
  /** Rendered inside the right rail, below the event meta (about, tickets, …) */
  children?: React.ReactNode;
};

function GlassChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/25 px-3 py-1.5 text-xs text-white shadow-[0_4px_16px_rgba(0,0,0,0.15)]">
      {children}
    </span>
  );
}

/**
 * Desktop-only full-viewport hero: big uncropped poster on the left,
 * scrollable glass rail (meta + children) on the right. The page itself
 * never scrolls on desktop — the rail scrolls internally.
 */
export default function EventHero({
  title,
  coverImageUrl,
  description,
  categoryName,
  dateLabel,
  timeLabel,
  locationLabel,
  ageLabel,
  organizerName,
  isWishlisted,
  isWishlistLoading,
  onToggleWishlist,
  onShare,
  children,
}: EventHeroProps) {
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const aboutNeedsToggle =
    description.length > 160 || description.includes("\n");

  return (
    <section className="hidden md:block relative h-dvh -mt-12 overflow-hidden">
      {/* Ambient blurred backdrop built from the cover itself */}
      <div className="absolute inset-0">
        <Image
          src={coverImageUrl}
          alt=""
          fill
          aria-hidden
          className="object-cover blur-3xl scale-125 opacity-70 dark:opacity-50"
          priority
          sizes="100vw"
          quality={30}
        />
        <div className="absolute inset-0 bg-black/50 dark:bg-black/60" />
      </div>

      <div className="relative z-10 h-full max-w-[1700px] mx-auto px-6 lg:px-10 pt-16 lg:pt-[4.25rem] pb-5 lg:pb-7 flex gap-8 lg:gap-12">
        {/* Poster — the star of the page: as large as the viewport allows, uncropped, no frame */}
        <div className="flex-1 min-w-0 flex items-center justify-center">
          <div className="relative h-full max-w-full w-fit mx-auto">
            <Image
              src={coverImageUrl}
              alt={`${title} — event poster`}
              width={1100}
              height={1375}
              className="h-full w-auto max-w-full object-contain rounded-xl shadow-[0_24px_80px_rgba(0,0,0,0.5)]"
              priority
              quality={95}
            />

            {/* About — dispersed scrim that melts into the poster, no hard edge */}
            <div
              className={cn(
                "absolute inset-x-0 bottom-0 rounded-b-xl bg-gradient-to-t px-5 pb-4 pt-16",
                aboutExpanded
                  ? "from-black/90 via-black/75 to-transparent"
                  : "from-black/85 via-black/45 to-transparent",
              )}
            >
              <div className="flex items-center justify-between gap-3 mb-1">
                <h3 className="text-sm font-semibold text-white tracking-wide [text-shadow:0_1px_8px_rgba(0,0,0,0.7)]">
                  About This Event
                </h3>
                {aboutNeedsToggle && (
                  <button
                    onClick={() => setAboutExpanded(!aboutExpanded)}
                    className="flex items-center gap-1 text-xs font-medium text-white/80 hover:text-white transition-colors shrink-0"
                  >
                    {aboutExpanded ? "Show less" : "Read more"}
                    {aboutExpanded ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </button>
                )}
              </div>
              <p
                className={cn(
                  "text-sm text-white/85 leading-relaxed whitespace-pre-line [text-shadow:0_1px_6px_rgba(0,0,0,0.7)]",
                  aboutExpanded
                    ? "max-h-[45vh] overflow-y-auto scrollbar-hide"
                    : "line-clamp-2",
                )}
              >
                {description}
              </p>
            </div>
          </div>
        </div>

        {/* Right rail — scrolls internally so the page never does */}
        <div className="w-[380px] lg:w-[430px] xl:w-[470px] shrink-0 h-full min-h-0">
          <div className="h-full overflow-y-auto scrollbar-hide flex flex-col gap-4 pr-1">
            <div className="pt-1">
              <div className="flex items-start justify-between gap-3 mb-3">
                {categoryName ? (
                  <span className="inline-block rounded-full bg-white/15 backdrop-blur-md border border-white/25 px-4 py-1 text-[11px] font-semibold tracking-[0.18em] uppercase text-white/90">
                    {categoryName}
                  </span>
                ) : (
                  <span />
                )}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={onToggleWishlist}
                    disabled={isWishlistLoading}
                    className="h-9 w-9 rounded-full bg-white/15 backdrop-blur-xl border border-white/25 flex items-center justify-center hover:bg-white/25 transition-colors"
                    aria-label={
                      isWishlisted ? "Remove from wishlist" : "Add to wishlist"
                    }
                  >
                    <Heart
                      className={cn(
                        "h-4 w-4 transition-colors",
                        isWishlisted
                          ? "fill-red-500 text-red-500"
                          : "text-white",
                      )}
                    />
                  </button>
                  <button
                    onClick={onShare}
                    className="h-9 w-9 rounded-full bg-white/15 backdrop-blur-xl border border-white/25 flex items-center justify-center hover:bg-white/25 transition-colors"
                    aria-label="Share event"
                  >
                    <Share2 className="h-4 w-4 text-white" />
                  </button>
                </div>
              </div>

              <h1 className="text-3xl lg:text-4xl font-bold text-white leading-tight mb-4 drop-shadow-[0_2px_12px_rgba(0,0,0,0.4)]">
                {title}
              </h1>

              <div className="flex flex-wrap items-center gap-2 mb-3">
                <GlassChip>
                  <Calendar className="h-3.5 w-3.5 text-blue-300 dark:text-yellow-300 shrink-0" />
                  {dateLabel}
                </GlassChip>
                <GlassChip>
                  <Clock className="h-3.5 w-3.5 text-blue-300 dark:text-yellow-300 shrink-0" />
                  {timeLabel}
                </GlassChip>
                <GlassChip>
                  <MapPin className="h-3.5 w-3.5 text-blue-300 dark:text-yellow-300 shrink-0" />
                  {locationLabel}
                </GlassChip>
                {ageLabel && (
                  <GlassChip>
                    <UserCheck className="h-3.5 w-3.5 text-blue-300 dark:text-yellow-300 shrink-0" />
                    {ageLabel}
                  </GlassChip>
                )}
              </div>

              {organizerName && (
                <p className="text-sm text-white/70">
                  Organized by{" "}
                  <span className="font-semibold text-white/95">
                    {organizerName}
                  </span>
                </p>
              )}
            </div>

            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
