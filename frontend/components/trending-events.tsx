"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { Calendar, MapPin, Star, Users, Gift, UserCheck, Ticket, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { toast } from "sonner";

export type FeaturedEvent = {
  id: string;
  title: string;
  description: string;
  date: string;
  startTime: string; // 👈 add this
  endTime: string; // 👈 add this
  location: string;
  venue: string;
  image: string;
  price: string;
  rating: number;
  attendees: number;
  categories: string[];
  organization: string;
  originalEvent: any;
};

// Normalize various time formats (e.g., "18:00", "6:00 PM", "6 PM") to 24-hour HH:MM
const normalizeTimeTo24h = (raw?: string): string => {
  if (!raw || typeof raw !== "string") return "23:59";
  const t = raw.trim().toUpperCase();
  // 12h with AM/PM, with or without minutes
  const ampm = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/);
  if (ampm) {
    let hour = parseInt(ampm[1], 10);
    const minute = ampm[2] ? parseInt(ampm[2], 10) : 0;
    const isPM = ampm[3] === "PM";
    if (hour === 12) hour = isPM ? 12 : 0;
    else if (isPM) hour += 12;
    const hh = hour.toString().padStart(2, "0");
    const mm = minute.toString().padStart(2, "0");
    return `${hh}:${mm}`;
  }
  // 24h with minutes
  const hm = t.match(/^(\d{1,2}):(\d{2})$/);
  if (hm) {
    const hh = Math.min(23, Math.max(0, parseInt(hm[1], 10)))
      .toString()
      .padStart(2, "0");
    const mm = Math.min(59, Math.max(0, parseInt(hm[2], 10)))
      .toString()
      .padStart(2, "0");
    return `${hh}:${mm}`;
  }
  // hour only
  const h = t.match(/^(\d{1,2})$/);
  if (h) {
    const hh = Math.min(23, Math.max(0, parseInt(h[1], 10)))
      .toString()
      .padStart(2, "0");
    return `${hh}:00`;
  }
  return "23:59";
};

// Safely build an end Date using endDate and endTime with reasonable fallbacks
const buildEventEndDate = (event: any): Date | null => {
  const dateStr: string | undefined = event?.endDate || event?.startDate;
  if (!dateStr) return null;
  const time24 = normalizeTimeTo24h(event?.endTime);
  const isoCandidate = `${dateStr}T${time24}:00`;
  const d = new Date(isoCandidate);
  if (!isNaN(d.getTime())) return d;
  // Fallback: try just the date, then set end of day
  const d2 = new Date(dateStr);
  if (!isNaN(d2.getTime())) {
    d2.setHours(23, 59, 0, 0);
    return d2;
  }
  return null;
};

// Function to check if a ticket type is currently available
const isTicketTypeAvailable = (ticket: any) => {
  const now = new Date();

  // Check if ticket is marked as available
  if (ticket.available === false) return false;

  // Check if ticket has quantity
  if (ticket.quantity <= 0) return false;

  // Check ticket-specific date range if exists
  if (ticket.startDate && ticket.endDate) {
    const ticketStart = new Date(ticket.startDate);
    const ticketEnd = new Date(ticket.endDate);
    if (now < ticketStart || now > ticketEnd) return false;
  }

  return true;
};

// Function to check if event is sold out
const isEventSoldOut = (event: any) => {
  // Check manual sold out flag
  if (event.isSoldOut) return true;

  // Check if event status is not published
  if (event.status && event.status !== "published") return true;

  const now = new Date();

  // Check if event end date has passed
  const eventEndDate = buildEventEndDate(event);
  if (eventEndDate && eventEndDate.getTime() <= now.getTime()) return true;

  // Check if all tickets are unavailable (sold out, unavailable, or out of date range)
  if (event.ticketTypes && Array.isArray(event.ticketTypes)) {
    return event.ticketTypes.every(
      (ticket: any) => !isTicketTypeAvailable(ticket),
    );
  }

  return false;
};

// Extract dominant color from image
const extractDominantColor = (imageUrl: string): Promise<{ h: number; s: number; l: number }> => {
  return new Promise((resolve) => {
    try {
      const img = document.createElement("img");
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve({ h: 43, s: 96, l: 58 }); // fallback
          return;
        }

        ctx.drawImage(img, 0, 0, 1, 1);
        const imageData = ctx.getImageData(0, 0, 1, 1);
        const data = imageData.data;

        const r = data[0];
        const g = data[1];
        const b = data[2];

        const hsl = rgbToHsl(r, g, b);
        resolve(hsl);
      };
      img.onerror = () => {
        resolve({ h: 43, s: 96, l: 58 }); // fallback
      };
      img.src = imageUrl;
    } catch (error) {
      console.error("Error extracting dominant color:", error);
      resolve({ h: 43, s: 96, l: 58 }); // fallback
    }
  });
};

// Convert RGB to HSL
const rgbToHsl = (r: number, g: number, b: number): { h: number; s: number; l: number } => {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
};

export default function LargeEventCarousel({
  initialEvents,
  mode = "dark",
}: {
  initialEvents?: FeaturedEvent[];
  mode?: "dark" | "light";
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [featuredEvents, setFeaturedEvents] = useState<FeaturedEvent[]>(
    initialEvents || [],
  );
  const [isLoading, setIsLoading] = useState(!initialEvents);
  const [dominantColor, setDominantColor] = useState<{ h: number; s: number; l: number }>({ h: 43, s: 96, l: 58 }); // fallback to gold

  // Swipe functionality states
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!initialEvents) {
      fetchFeaturedEvents();
    }
  }, [initialEvents]);

  const fetchFeaturedEvents = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/events?status=published&bannerStatus=true&sort=-createdAt&limit=10`,
        {
          headers: {
            Accept: "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to fetch events");
      }

      const data = await response.json();
      console.log("API Response:", data); // Debug log

      // Transform the data to match the expected format
      const transformedEvents = data.data
        .filter(
          (event: any) =>
            event.bannerStatus === true && event.isPublic === true,
        )
        .map((event: any) => {
          // Debug log for each event's images
          console.log("Event images:", event.coverImages);

          const imageUrl =
            event.coverImages && event.coverImages.length > 0
              ? event.coverImages[0].startsWith("http")
                ? event.coverImages[0]
                : `${process.env.NEXT_PUBLIC_API_URL}${event.coverImages[0].startsWith("/")
                  ? event.coverImages[0]
                  : `/${event.coverImages[0]}`
                }`
              : "/placeholder.svg?height=600&width=400&text=Event+Poster";

          console.log("Processed image URL:", imageUrl);

          const now = new Date();

          // Check if a ticket is currently available
          const isTicketTypeAvailable = (ticket: any) => {
            if (ticket.available === false) return false;
            if (ticket.quantity <= 0) return false;
            if (ticket.startDate && ticket.endDate) {
              const ticketStart = new Date(ticket.startDate);
              const ticketEnd = new Date(ticket.endDate);
              if (now < ticketStart || now > ticketEnd) return false;
            }
            return true;
          };

          // Get available tickets
          const availableTickets = (event.ticketTypes || []).filter(isTicketTypeAvailable);

          // Calculate minimum prices for each currency from available tickets
          let minETB = Infinity, minUSD = Infinity;
          let hasETB = false, hasUSD = false;

          availableTickets.forEach((ticket: any) => {
            if (ticket.priceETB && ticket.priceETB > 0) {
              minETB = Math.min(minETB, ticket.priceETB);
              hasETB = true;
            } else if (ticket.price && ticket.price > 0) {
              minETB = Math.min(minETB, ticket.price);
              hasETB = true;
            }
            if (ticket.priceUSD && ticket.priceUSD > 0) {
              minUSD = Math.min(minUSD, ticket.priceUSD);
              hasUSD = true;
            }
          });

          // Fallback to all tickets if no available ones found
          if (!hasETB && !hasUSD && event.ticketTypes && event.ticketTypes.length > 0) {
            event.ticketTypes.forEach((ticket: any) => {
              if (ticket.priceETB && ticket.priceETB > 0) {
                minETB = Math.min(minETB, ticket.priceETB);
                hasETB = true;
              } else if (ticket.price && ticket.price > 0) {
                minETB = Math.min(minETB, ticket.price);
                hasETB = true;
              }
              if (ticket.priceUSD && ticket.priceUSD > 0) {
                minUSD = Math.min(minUSD, ticket.priceUSD);
                hasUSD = true;
              }
            });
          }

          // Format price label based on available currencies
          let priceLabel = "Free";
          if (hasUSD && hasETB) {
            priceLabel = `From ${minUSD}$/${minETB} ETB`;
          } else if (hasUSD) {
            priceLabel = `From ${minUSD}$`;
          } else if (hasETB && minETB !== Infinity && minETB > 0) {
            priceLabel = `From ${minETB} ETB`;
          }

          return {
            id: event._id,
            title: event.title,
            description: event.description,
            date: new Date(event.startDate).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            }),
            startTime:
              event.startTime ||
              new Date(event.startDate).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
            endTime: event.endTime || "",
            location: event.location.city,
            venue: event.location.address,
            image: imageUrl,
            price: priceLabel,
            rating: 4.5,
            attendees: event.capacity,
            categories: [event.category?.name || "Uncategorized"],
            organization:
              event.organizer?.organizerProfile?.organization ||
              event.organizer?.organization ||
              event.title ||
              "Event Organizer",
            originalEvent: event,
          };
        });

      console.log("Transformed events:", transformedEvents); // Debug log
      setFeaturedEvents(transformedEvents);
    } catch (error) {
      console.error("Error fetching featured events:", error);
      toast.error("Failed to fetch featured events");
    } finally {
      setIsLoading(false);
    }
  };

  // Touch event handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
    setTouchEnd(null);
    setIsDragging(true);
    setDragOffset(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStart) return;

    const currentTouch = e.targetTouches[0].clientX;
    const distance = touchStart - currentTouch;

    setTouchEnd(currentTouch); // This was missing — needed for swipe logic in touchEnd
    setDragOffset(-distance * 0.1); // Optional: adjust swipe sensitivity
  };

  const handleTouchEnd = () => {
    if (!touchStart || touchEnd === null) return;

    const distance = touchStart - touchEnd;
    const minSwipeDistance = 50;

    if (Math.abs(distance) > minSwipeDistance) {
      if (distance < 0) {
        prevSlide(); // swipe right
      } else {
        nextSlide(); // swipe left
      }
    }

    setTouchStart(null);
    setTouchEnd(null);
    setIsDragging(false);
    setDragOffset(0);
  };

  // Mouse event handlers for desktop
  const handleMouseDown = (e: React.MouseEvent) => {
    setTouchStart(e.clientX);
    setTouchEnd(null);
    setIsDragging(true);
    setDragOffset(0);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!touchStart || !isDragging) return;

    const currentX = e.clientX;
    const distance = touchStart - currentX;
    setDragOffset(-distance * 0.1);
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!touchStart) return;

    const distance = touchStart - e.clientX;
    const minSwipeDistance = 50;

    if (Math.abs(distance) > minSwipeDistance) {
      if (distance < 0) {
        prevSlide();
      } else {
        nextSlide();
      }
    }

    setTouchStart(null);
    setTouchEnd(null);
    setIsDragging(false);
    setDragOffset(0);
  };

  const nextSlide = useCallback(() => {
    if (!isAnimating) {
      setIsAnimating(true);
      setCurrentIndex((prevIndex) =>
        prevIndex === featuredEvents.length - 1 ? 0 : prevIndex + 1,
      );
      setTimeout(() => setIsAnimating(false), 500);
    }
  }, [isAnimating, featuredEvents.length]);

  const prevSlide = useCallback(() => {
    if (!isAnimating) {
      setIsAnimating(true);
      setCurrentIndex((prevIndex) =>
        prevIndex === 0 ? featuredEvents.length - 1 : prevIndex - 1,
      );
      setTimeout(() => setIsAnimating(false), 500);
    }
  }, [isAnimating, featuredEvents.length]);

  // Auto-advance slides
  useEffect(() => {
    const interval = setInterval(() => {
      nextSlide();
    }, 6000);

    return () => clearInterval(interval);
  }, [nextSlide]);

  // Extract dominant color from current event image
  useEffect(() => {
    if (featuredEvents.length > 0 && featuredEvents[currentIndex]?.image) {
      extractDominantColor(featuredEvents[currentIndex].image).then((color) => {
        setDominantColor(color);
      });
    }
  }, [currentIndex, featuredEvents]);



  const handleMouseLeave = () => {
    setTouchStart(null);
    setTouchEnd(null);
    setIsDragging(false);
    setDragOffset(0);
  };

  const formatTimeWithAmPm = (time24?: string): string => {
    if (!time24) return "";

    const [hourStr, minuteStr] = time24.split(":");
    if (hourStr === undefined || minuteStr === undefined) return time24;

    let hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);
    const ampm = hour >= 12 ? "PM" : "AM";

    hour = hour % 12;
    if (hour === 0) hour = 12;

    const minuteFormatted = minute < 10 ? `0${minute}` : minute;

    return `${hour}:${minuteFormatted} ${ampm}`;
  };

  const formatTimeRange = (startTime?: string, endTime?: string) => {
    const start = formatTimeWithAmPm(startTime);
    const end = formatTimeWithAmPm(endTime);

    if (!start && !end) return "Time TBA";
    if (!start) return end;
    if (!end) return start;

    return `${start} - ${end}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        </div>
      </div>
    );
  }

  if (!featuredEvents.length) {
    return (
      <div className="flex items-center justify-center min-h-[400px] bg-muted mx-4 sm:mx-8 md:mx-12 my-6 rounded-xl">
        <div className="text-center p-8">
          <h3 className="text-xl font-semibold text-foreground mb-2">
            No Featured Events
          </h3>
          <p className="text-muted-foreground">
            To feature events contact{" "}
            <a
              href="mailto:admin@pazimo.com"
              className="text-primary hover:underline"
            >
              admin@pazimo.com
            </a>
          </p>
        </div>
      </div>
    );
  }

  const currentEvent = featuredEvents[currentIndex];

  if (!currentEvent) {
    return null;
  }

  return (
    <section
      ref={carouselRef}
      className="relative overflow-hidden mx-2  sm:mx-4 md:mx-8 my-4 sm:my-6 rounded-3xl min-h-[220px] sm:min-h-[500px] md:min-h-[600px] select-none touch-pan-y md:bg-black  dark:bg-[#1A1D24]"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      style={{ cursor: isDragging ? "grabbing" : "grab" }}
    >
      {/* Background Image (Full Width) - Hidden on Mobile */}
      <div className="absolute inset-0  transition-opacity duration-1000 ease-in-out hidden md:block">
        <Image
          src={
            currentEvent.image ||
            "/placeholder.svg?height=650&width=1200&text=Featured+Event"
          }
          alt={currentEvent.title}
          fill
          className="object-contain bg-black dark:bg-[#1A1D24]"
          priority={true} // Priority for LCP
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 90vw, 85vw"
          quality={85} // Reduced slightly for performance
          onError={(e) => {
            console.error("Image failed to load:", currentEvent.image);
            const target = e.target as HTMLImageElement;
            target.src =
              "/placeholder.svg?height=650&width=1200&text=Featured+Event";
          }}
        />
      </div>

      {/* Mobile background fill */}
      <div className="absolute inset-0 bg-background  md:hidden" />


      {/* Enhanced Gradient Overlays */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-black/20 to-black/10 sm:from-black/85 sm:via-black/60 sm:to-black/30 dark:from-[#1A1D24]/80 dark:via-[#1A1D24]/40 dark:to-transparent z-10 hidden md:block" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent sm:from-black/70 sm:via-transparent sm:to-black/20 dark:from-[#1A1D24]/20 dark:sm:from-[#1A1D24]/70 dark:sm:to-[#1A1D24]/20 z-10 hidden md:block" />

      {/* Sold Out Badge - Mobile Only
      {isEventSoldOut(currentEvent.originalEvent) && (
        <div className="absolute top-4 right-4 md:hidden z-30">
          <div className="bg-red-500 text-white text-sm font-bold px-3 py-2 rounded-lg shadow-lg animate-pulse mb-2">
            SOLD OUT
          </div>
          <div className="bg-amber-500 text-white font-bold px-3 py-2 rounded-lg shadow-lg text-sm">
            {currentEvent.price}
          </div>
          {(() => {
            const ev = currentEvent.originalEvent;
            const now = new Date();
            const hasWave = (t: any) =>
              !!(t?.startDate && t?.endDate) ||
              String(t?.description || "")
                .toLowerCase()
                .includes("wave");
            const active = (ev?.ticketTypes || []).filter((t: any) => {
              if (!hasWave(t)) return false;
              if (t?.available === false) return false;
              const s = new Date(t.startDate);
              const e = new Date(t.endDate);
              return now >= s && now <= e;
            });
            if (active.length > 0 && active[0]?.wave) {
              return (
                <div className="mt-2 bg-white/90 text-amber-700 text-xs font-semibold px-2 py-1 rounded shadow">
                  {active[0].wave}
                </div>
              );
            }
            return null;
          })()}
        </div>
      )} */}

      <div className="relative z-20 container mx-auto   md:px-16 p-0  md:py-16 h-full flex items-center">
        <div className="flex flex-col   md:flex-row items-center gap-8 md:gap-16 w-full h-full">
          {/* Mobile Only: Hero Style Layout */}
          <div className="md:hidden px-0 pt-6 pb-0 w-full max-w-md mx-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 bg-[hsl(43,96%,58%)]" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[hsl(43,96%,58%)]" />
                </span>
                <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-[hsl(40,8%,45%)] dark:text-[hsl(40,8%,60%)]">
                  Spotlight Tonight
                </span>
              </div>
              <span className="text-[11px] font-medium text-[hsl(40,8%,45%)] dark:text-[hsl(40,8%,60%)]">
                {String(currentIndex + 1).padStart(2, "0")} / {String(featuredEvents.length).padStart(2, "0")}
              </span>
            </div>

        <div
  className="relative h-[420px] w-full dark:border border-gray-200/10 rounded-3xl overflow-visible bg-[hsl(40,30%,97%)] dark:bg-[hsl(0,0%,7%)]"
  // style={{
  //   boxShadow:
  //     mode === "dark"
  //       ? `0 0 60px hsla(${dominantColor.h}, ${dominantColor.s}%, ${dominantColor.l}%, 0.4), 0 20px 60px -20px hsla(${dominantColor.h}, ${dominantColor.s}%, ${dominantColor.l}%, 0.3)`
  //       : `0 0 40px hsla(${dominantColor.h}, ${dominantColor.s}%, ${dominantColor.l}%, 0.2), 0 20px 40px -20px hsla(${dominantColor.h}, ${dominantColor.s}%, ${dominantColor.l}%, 0.15)`
  // }}
>
              <div className="absolute inset-0 rounded-3xl overflow-hidden">
                <div className="absolute -top-20 -right-16 h-56 w-56 rounded-full blur-3xl opacity-70"
                //  style={{ backgroundColor: mode === "dark" ? `hsla(${dominantColor.h}, ${dominantColor.s}%, ${dominantColor.l}%, 0.5)` : `hsla(${dominantColor.h}, ${dominantColor.s}%, ${dominantColor.l}%, 0.3)` }} 
                 />
                <div className="absolute -bottom-24 -left-10 h-56 w-56 rounded-full blur-3xl opacity-70" 
                // style={{ backgroundColor: mode === "dark" ? `hsla(${dominantColor.h}, ${dominantColor.s}%, ${dominantColor.l}%, 0.3)` : `hsla(${dominantColor.h}, ${dominantColor.s}%, ${dominantColor.l}%, 0.15)` }} 
                />

                <div className="absolute -top-2 left-0 right-0 px-5 select-none overflow-hidden">
                  <p className="font-[Space_Grotesk] text-[88px] leading-none font-bold tracking-tighter whitespace-nowrap overflow-hidden text-ellipsis text-[#0000003f] dark:text-[hsla(40,20%,96%,0.06)]">
                    {currentEvent.title.toUpperCase()}
                  </p>
                </div>

                <div className="absolute inset-x-0 bottom-0 p-5 pt-24 bg-[linear-gradient(180deg,transparent_0%,hsla(40,30%,95%,0.6)_55%,hsl(40,30%,94%)_100%)] dark:bg-[linear-gradient(180deg,transparent_0%,hsla(0,0%,4%,0.55)_55%,hsl(0,0%,4%)_100%)]">
                  <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,hsl(40,30%,90%)_0%,hsla(40,30%,95%,0.3)_50%,transparent_100%)] dark:bg-[linear-gradient(to_top,hsl(0,0%,0%)_0%,hsla(0,0%,0%,0.4)_50%,transparent_100%)]" />
                  <div className="relative">
                    <p className="text-[11px] font-medium uppercase tracking-[0.22em] mb-2 line-clamp-1 text-[hsl(43,96%,58%)]">
                      {currentEvent.categories.join(" · ")}
                    </p>
                    <h1 className="font-[Space_Grotesk] text-[40px] leading-[0.95] font-bold tracking-tight line-clamp-2 text-[hsl(0,0%,15%)] dark:text-[hsl(40,20%,96%)]">
                      {currentEvent.title.toUpperCase()}
                    </h1>
                    <p className="mt-2 text-[13px] max-w-[15rem] leading-relaxed line-clamp-2 text-[hsl(0,0%,45%)] dark:text-[hsl(40,8%,60%)]">
                      {currentEvent.description || currentEvent.organization}
                    </p>

                    <div className="mt-4 flex items-center gap-4 text-[12px] text-[hsl(0,0%,30%)] dark:text-[hsla(40,20%,96%,0.8)]">
                      <span className="flex items-center gap-1.5 whitespace-nowrap">
                        <Calendar className="h-3.5 w-3.5 text-[hsl(43,96%,58%)]" strokeWidth={2} />
                        {currentEvent.date.split(" ").slice(0, 2).join(" ")} · {formatTimeRange(currentEvent.startTime, currentEvent.endTime)}
                      </span>
                      <span className="h-3 w-px shrink-0 bg-[hsl(40,20%,85%)] dark:bg-[hsl(40,10%,14%)]" />
                      <span className="flex items-center gap-1.5 whitespace-nowrap overflow-hidden text-ellipsis">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-[hsl(43,96%,58%)]" strokeWidth={2} />
                        {currentEvent.venue}
                      </span>
                    </div>

                    {!isEventSoldOut(currentEvent.originalEvent) ? (
                      <Link href={`/event_detail?id=${currentEvent.id}`} passHref>
                        <button className="mt-5 group inline-flex items-center gap-2 rounded-full px-5 py-3 text-[13px] font-semibold active:scale-[0.98] transition-transform bg-[linear-gradient(135deg,hsl(43,96%,58%),hsl(36,80%,48%))] text-white dark:text-[hsl(0,0%,6%)] shadow-[0_20px_60px_-20px_hsla(43,96%,58%,0.45)]">
                          <Ticket className="h-4 w-4" strokeWidth={2.4} />
                          Get Tickets
                          <ArrowUpRight className="h-4 w-4 -mr-1 transition-transform group-hover:translate-x-0.5" strokeWidth={2.4} />
                        </button>
                      </Link>
                    ) : (
                      <button disabled className="mt-5 group inline-flex items-center gap-2 rounded-full px-5 py-3 text-[13px] font-semibold active:scale-[0.98] transition-transform opacity-60 bg-[linear-gradient(135deg,hsl(43,96%,58%),hsl(36,80%,48%))] text-white dark:text-[hsl(0,0%,6%)] shadow-[0_20px_60px_-20px_hsla(43,96%,58%,0.45)]">
                        Sold Out
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="absolute -top-4 right-4 w-[140px]  aspect-[3/4] rounded-2xl overflow-hidden rotate-[4deg]"
              //  style={{ boxShadow: mode === "dark" ? `0 40px 80px -30px hsla(0,0%,0%,0.9), 0 15px 40px -5px hsla(${dominantColor.h}, ${dominantColor.s}%, ${dominantColor.l}%, 0.5)` : `0 40px 80px -30px hsla(0,0%,0%,0.2), 0 15px 40px -5px hsla(${dominantColor.h}, ${dominantColor.s}%, ${dominantColor.l}%, 0.35)` }}
              >
                <Image
                  src={currentEvent.image || "/placeholder.svg?height=650&width=1200&text=Featured+Event"}
                  alt={currentEvent.title}
                  width={420}
                  height={560}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-[linear-gradient(to_top,hsla(0,0%,0%,0.2),transparent,transparent)] dark:bg-[linear-gradient(to_top,hsla(0,0%,0%,0.4),transparent,transparent)]" />
              </div>

              <div className="absolute top-6 left-4 rounded-full backdrop-blur-md px-3 py-1.5 bg-[hsla(40,30%,94%,0.9)] dark:bg-[hsla(0,0%,4%,0.8)] shadow-[0_10px_30px_-10px_hsla(0,0%,0%,0.1)] dark:shadow-[0_10px_30px_-10px_hsla(0,0%,0%,0.6)]">
                <p className="text-[10px] uppercase tracking-wider leading-none text-[hsl(40,8%,45%)] dark:text-[hsl(40,8%,60%)]">From</p>
                <p className="text-[13px] font-semibold leading-tight mt-0.5 text-[hsl(0,0%,15%)] dark:text-[hsl(40,20%,96%)]">
                  {currentEvent.price.replace("From ", "")}
                </p>
              </div>

              {/* <div className="absolute -bottom-10  left-0 right-0 h-24 rounded-b-3xl pointer-events-none" style={{ boxShadow: mode === "dark" ? `inset 0 -40px 60px -20px hsla(${dominantColor.h}, ${dominantColor.s}%, ${dominantColor.l}%, 0.3)` : `inset 0 -30px 40px -20px hsla(${dominantColor.h}, ${dominantColor.s}%, ${dominantColor.l}%, 0.15)` }} /> */}
            </div>
          </div>

          {/* Desktop Content Section */}
          <div className="hidden md:block w-full md:w-3/5 text-white">
            {/* Organization/Presenter */}
            <div className="mb-2 sm:mb-4">
              <p className="text-xs sm:text-base font-bold text-amber-400 tracking-[0.1em] uppercase">
                {currentEvent.organization} PRESENTS
              </p>
            </div>

            {/* Main Event Title */}
            <h1 className="text-2xl sm:text-5xl md:text-6xl font-black mb-4 sm:mb-8 leading-[1.1] text-white tracking-tight">
              {currentEvent.title.toUpperCase()}
            </h1>

            {/* Event Description */}
            <div className="mb-6 sm:mb-10 max-w-xl">
              <p className="text-sm sm:text-base text-white/70 leading-relaxed line-clamp-3">
                {currentEvent.description}
              </p>
            </div>

            {/* Event Details Grid */}
            <div className="flex flex-wrap gap-4 mb-8 sm:mb-10">
              <div className="flex items-center gap-3 bg-white/[0.03] dark:bg-white/[0.05] backdrop-blur-md rounded-2xl p-3 px-5 border border-white/10">
                <div className="bg-amber-400/20 p-2 rounded-xl">
                  <Calendar className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">
                    {currentEvent.date}
                  </p>
                  <p className="text-white/50 text-xs font-medium">
                    {formatTimeRange(
                      currentEvent.startTime,
                      currentEvent.endTime,
                    ).toUpperCase()}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 bg-white/[0.03] dark:bg-white/[0.05] backdrop-blur-md rounded-2xl p-3 px-5 border border-white/10">
                <div className="bg-amber-400/20 p-2 rounded-xl">
                  <MapPin className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">
                    {currentEvent.venue}
                  </p>
                  <p className="text-white/50 text-xs font-medium">
                    {currentEvent.location.toUpperCase()}
                  </p>
                </div>
              </div>
            </div>

            {/* Rating and CTA */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 sm:gap-10">
              {/* Rating */}
              <div className="flex items-center gap-3">
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className="h-4 w-4"
                      fill={i < Math.floor(currentEvent.rating) ? "#fbbf24" : "none"}
                      stroke={i < Math.floor(currentEvent.rating) ? "#fbbf24" : "white"}
                      strokeWidth={1.5}
                    />
                  ))}
                </div>
                <span className="text-sm font-bold text-white/90">
                  {currentEvent.rating.toFixed(1)}
                </span>
              </div>

              {/* Action Button */}
              {!isEventSoldOut(currentEvent.originalEvent) ? (
                <Link href={`/event_detail?id=${currentEvent.id}`} passHref>
                  <Button
                    className="bg-amber-500 hover:bg-amber-600 text-black font-black px-8 h-12 text-sm rounded-xl shadow-lg flex items-center gap-2 group transition-all"
                  >
                    <Gift className="h-4 w-4 transition-transform group-hover:scale-110" />
                    Get Tickets
                  </Button>
                </Link>
              ) : (
                <Button
                  disabled
                  className="bg-white/10 text-white/50 font-bold px-8 h-12 text-sm rounded-xl border border-white/10"
                >
                  Sold Out
                </Button>
              )}
            </div>
          </div>

          {/* Desktop Only: Featured Event Card (Original Layout) */}
          <div className="hidden md:flex md:w-2/5 justify-center md:justify-end">
            <div className="relative w-[220px] lg:w-[320px] h-[300px] lg:h-[450px] rounded-2xl overflow-hidden shadow-2xl transform md:-rotate-2 hover:rotate-0 transition-transform duration-500 border border-white/10">
              <Image
                src={currentEvent.image}
                alt={currentEvent.title}
                fill
                className="object-cover"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              {isEventSoldOut(currentEvent.originalEvent) && (
                <div className="hidden md:block absolute top-4 left-4 bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg z-30 shadow-lg">
                  SOLD OUT
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
