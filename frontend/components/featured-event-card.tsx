"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Calendar, MapPin, ImageIcon, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import { buildEventUrl } from "@/lib/event-url";

export type FeaturedEventCardData = {
  id: string;
  href?: string;
  title: string;
  tag?: string;
  dateLabel: string;
  locationLabel: string;
  priceLabel: string;
  image?: string;
  soldOut?: boolean;
  ctaLabel?: string;
};

interface FeaturedEventCardProps {
  data: FeaturedEventCardData;
  className?: string;
  wishlist?: string[];
  onToggleWishlist?: (eventId: string) => void;
  isWishlistLoading?: boolean;
  showCTA?: boolean;
  index?: number;
}

export default function FeaturedEventCard({
  data,
  className,
  wishlist = [],
  onToggleWishlist,
  isWishlistLoading,
  showCTA = true,
  index = 0,
}: FeaturedEventCardProps) {
  const href = data.href || buildEventUrl(data);
  const isWishlisted = wishlist.includes(data.id);
  const ref = useRef<HTMLDivElement>(null);
  const [animClass, setAnimClass] = useState("card-hidden");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const delay = (index % 4) * 80; // stagger up to ~320ms

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          const isMobile = window.matchMedia("(max-width: 639px)").matches;
          const cls = isMobile
            ? index % 2 === 0 ? "card-animate-left" : "card-animate-right"
            : "card-animate-up";
          setTimeout(() => setAnimClass(cls), delay);
          observer.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [index]);

  return (
    <div ref={ref} className={cn(animClass, className)} style={{ animationDelay: "0ms" }}>
      <Link href={href} className="block group cursor-pointer h-full">
        <div className="relative overflow-hidden rounded-2xl mb-4 dark:border-white/10 bg-card dark:bg-white/[0.02] transition-all duration-300 group-hover:bg-white/[0.05] group-hover:border-primary/30">
          {data.image ? (
            <Image
              src={data.image}
              alt={data.title}
              width={400}
              height={520}
              className="w-full aspect-[3/4] object-cover transition-transform duration-500 group-hover:scale-110"
            />
          ) : (
            <div className="w-full aspect-[3/4] flex items-center justify-center bg-muted text-muted-foreground">
              <ImageIcon className="h-12 w-12" />
            </div>
          )}
          {/* Darker bottom gradient so text is always legible */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
          {data.tag && (
            <span className="absolute top-4 left-4 bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-full shadow-md">
              {data.tag}
            </span>
          )}
          {data.soldOut && (
            <span className="absolute top-4 right-4 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">
              Sold Out
            </span>
          )}
          {onToggleWishlist && (
            <button
              className={cn(
                "absolute bottom-4 right-4 p-2.5 rounded-full bg-background/90 backdrop-blur-sm transition-all duration-300 shadow-lg hover:shadow-xl",
                isWishlisted ? "text-red-500 bg-red-500/10" : "text-muted-foreground hover:text-red-500",
                isWishlistLoading ? "opacity-60 cursor-not-allowed" : "hover:scale-110",
              )}
              onClick={(e) => {
                e.preventDefault();
                onToggleWishlist(data.id);
              }}
              disabled={isWishlistLoading}
              aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
            >
              <Heart
                className={cn("h-5 w-5", isWishlistLoading ? "animate-pulse" : "")}
                fill={isWishlisted ? "currentColor" : "none"}
              />
            </button>
          )}
          <div className="absolute bottom-4 left-4 right-12">
            <p className="text-base font-semibold mb-1 text-white leading-snug line-clamp-2">
              {data.title}
            </p>
            <div className="flex flex-wrap items-center gap-3 text-xs text-white/80">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" /> {data.dateLabel}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {data.locationLabel}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between px-1">
          <span className="text-sm font-semibold text-blue-700 dark:text-yellow-400">{data.priceLabel}</span>
          {showCTA && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground hover:text-foreground p-0"
            >
              {data.ctaLabel || "Get Tickets"} <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          )}
        </div>
      </Link>
    </div>
  );
}
