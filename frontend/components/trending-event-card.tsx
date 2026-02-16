"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { HeartIcon, ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type TrendingEventCardData = {
  id: string;
  title: string;
  href: string;
  image?: string;
  dateLabel?: string;
  timeLabel?: string;
  locationLabel?: string;
  attendeesLabel?: string;
  priceLabel?: string;
  categoryLabel?: string;
  soldOut?: boolean;
};

interface TrendingEventCardProps {
  data: TrendingEventCardData;
  wishlist?: string[];
  onToggleWishlist?: (eventId: string) => void;
  isWishlistLoading?: boolean;
  layout?: "horizontal" | "vertical";
  className?: string;
  loadingOverlay?: boolean;
  onNavigate?: (eventId: string) => void;
}

export default function TrendingEventCard({
  data,
  wishlist = [],
  onToggleWishlist,
  isWishlistLoading = false,
  layout = "horizontal",
  className,
  loadingOverlay = false,
  onNavigate,
}: TrendingEventCardProps) {
  const [hasImageError, setHasImageError] = useState(false);

  const imageSrc = useMemo(() => {
    if (hasImageError) {
      return "/placeholder.svg?height=600&width=400&text=Event+Poster";
    }
    if (!data.image) {
      return undefined;
    }
    return data.image;
  }, [data.image, hasImageError]);

  const isHorizontal = layout === "horizontal";
  const isWishlisted = wishlist.includes(data.id);

  const CardBody = (
    <div
      className={cn(
        "group relative rounded-2xl overflow-hidden border border-gray-100 bg-white shadow-sm transition-all duration-300 hover:shadow-xl",
        isHorizontal ? "flex flex-col md:flex-row" : "flex flex-col",
        className,
      )}
    >
      <div
        className={cn(
          "relative bg-gray-50",
          isHorizontal ? "md:w-80 shrink-0 h-48 md:h-full" : "aspect-[4/5]",
        )}
      >
        {data.categoryLabel && (
          <div className="absolute top-3 left-3 bg-[#ffc107] text-white text-xs font-bold px-3 py-1.5 rounded-lg z-10 shadow-md">
            {data.categoryLabel}
          </div>
        )}

        {data.soldOut && (
          <div className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg z-20 shadow-md">
            SOLD OUT
          </div>
        )}

        <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
          <ImageIcon className="w-16 h-16 text-gray-300 absolute" />
          {imageSrc ? (
            <Image
              src={imageSrc}
              alt={data.title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes={isHorizontal ? "(max-width: 768px) 100vw, 320px" : "320px"}
              quality={90}
              onError={() => setHasImageError(true)}
            />
          ) : (
            <div className="w-full h-full bg-gray-100" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </div>
      </div>

      <div className="flex-1 p-5 md:p-6 flex flex-col gap-4 bg-white">
        <div className="space-y-2">
          <h3 className="font-display text-lg md:text-xl font-semibold leading-tight text-gray-900 group-hover:text-[#1a2d5a] transition-colors">
            {data.title}
          </h3>
          <div className="flex flex-wrap gap-3 text-sm text-gray-600">
            {data.dateLabel && <span>{data.dateLabel}</span>}
            {data.timeLabel && <span className="px-2 py-0.5 bg-gray-100 rounded-md text-gray-700">{data.timeLabel}</span>}
            {data.locationLabel && <span>{data.locationLabel}</span>}
            {data.attendeesLabel && <span>{data.attendeesLabel}</span>}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 mt-auto">
          <span className="text-lg font-display font-bold text-[#1a2d5a]">
            {data.priceLabel || ""}
          </span>
          <Button className="bg-gradient-to-r from-[#1a2d5a] to-[#2a4d7a] text-white text-sm px-6 hover:opacity-90 transition-opacity">
            Get Tickets
          </Button>
        </div>
      </div>

      {onToggleWishlist && (
        <button
          className={cn(
            "absolute bottom-3 right-3 p-2.5 rounded-full bg-white/90 backdrop-blur-sm transition-all duration-300 shadow-lg hover:shadow-xl z-30",
            isWishlisted ? "text-red-500 bg-red-50" : "text-gray-600 hover:text-red-500",
            isWishlistLoading ? "opacity-50 cursor-not-allowed" : "hover:scale-110",
          )}
          onClick={(e) => {
            e.preventDefault();
            onToggleWishlist(data.id);
          }}
          disabled={isWishlistLoading}
          aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
        >
          <HeartIcon
            className={cn("h-5 w-5", isWishlistLoading ? "animate-pulse" : "")}
            fill={isWishlisted ? "currentColor" : "none"}
          />
        </button>
      )}

      {loadingOverlay && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-[#1a2d5a]" />
            <p className="text-sm text-gray-600">Loading...</p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <Link
      href={data.href}
      className="block"
      onClick={() => onNavigate?.(data.id)}
      aria-label={`View details for ${data.title}`}
    >
      {CardBody}
    </Link>
  );
}
