"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { Calendar, MapPin, Star, Users, Gift, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { toast } from "sonner";

type FeaturedEvent = {
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
  const now = new Date();

  // Check if event end date has passed
  const eventEndDate = buildEventEndDate(event);
  if (eventEndDate && eventEndDate.getTime() <= now.getTime()) return true;

  // Check if all tickets are unavailable (sold out, unavailable, or out of date range)
  if (event.ticketTypes && Array.isArray(event.ticketTypes)) {
    return event.ticketTypes.every(
      (ticket: any) => !isTicketTypeAvailable(ticket)
    );
  }

  return false;
};

export default function LargeEventCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [featuredEvents, setFeaturedEvents] = useState<FeaturedEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Swipe functionality states
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchFeaturedEvents();
  }, []);

  const fetchFeaturedEvents = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/events?status=published&bannerStatus=true&sort=-createdAt&limit=3`,
        {
          headers: {
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch events");
      }

      const data = await response.json();
      console.log("API Response:", data); // Debug log

      // Transform the data to match the expected format
      const transformedEvents = data.data
        .filter(
          (event: any) => event.bannerStatus === true && event.isPublic === true
        )
        .map((event: any) => {
          // Debug log for each event's images
          console.log("Event images:", event.coverImages);

          const imageUrl =
            event.coverImages && event.coverImages.length > 0
              ? event.coverImages[0].startsWith("http")
                ? event.coverImages[0]
                : `${process.env.NEXT_PUBLIC_API_URL}${
                    event.coverImages[0].startsWith("/")
                      ? event.coverImages[0]
                      : `/${event.coverImages[0]}`
                  }`
              : "/placeholder.svg?height=600&width=400&text=Event+Poster";

          console.log("Processed image URL:", imageUrl); // Debug log

          // return {
          //   id: event._id,
          //   title: event.title,
          //   description: event.description,
          //   date: new Date(event.startDate).toLocaleDateString(),
          //   time: new Date(event.startDate).toLocaleTimeString(),
          //   location: event.location.city,
          //   venue: event.location.address,
          //   image: imageUrl,
          //   price:
          //     event.ticketTypes && event.ticketTypes.length > 0
          //       ? `From ${Math.min(...event.ticketTypes.map((t: any) => t.price))} ETB`
          //       : "Free",
          //   rating: 4.5,
          //   attendees: event.capacity,
          //   categories: [event.category?.name || "Uncategorized"],
          //   organization:
          //     event.organizer?.organization ||
          //     event.organizer?.firstName + " " + event.organizer?.lastName ||
          //     "Event Organization",
          //   originalEvent: event, // Keep original event data for sold out check
          // }

          // Compute wave-aware price for featured card
          const now = new Date();
          const hasWave = (t: any) =>
            !!(t?.startDate && t?.endDate) ||
            String(t?.description || "")
              .toLowerCase()
              .includes("wave");
          const anyWave =
            Array.isArray(event.ticketTypes) && event.ticketTypes.some(hasWave);
          let priceLabel = "Free";
          if (anyWave) {
            const activeWaveTickets = (event.ticketTypes || []).filter(
              (t: any) => {
                if (!hasWave(t)) return false;
                if (t?.available === false) return false;
                if (t?.startDate && t?.endDate) {
                  const s = new Date(t.startDate);
                  const e = new Date(t.endDate);
                  return now >= s && now <= e;
                }
                return false;
              }
            );
            if (activeWaveTickets.length > 0) {
              activeWaveTickets.sort(
                (a: any, b: any) =>
                  new Date(b.startDate).getTime() -
                  new Date(a.startDate).getTime()
              );
              priceLabel =
                activeWaveTickets[0].price > 0
                  ? `From ${activeWaveTickets[0].price} ETB`
                  : "Free";
            } else if (event.ticketTypes && event.ticketTypes.length > 0) {
              priceLabel =
                event.ticketTypes[0].price > 0
                  ? `From ${event.ticketTypes[0].price} ETB`
                  : "Free";
            }
          } else if (event.ticketTypes && event.ticketTypes.length > 0) {
            priceLabel = `From ${Math.min(
              ...event.ticketTypes.map((t: any) => t.price)
            )} ETB`;
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
              event.organizer?.organization ||
              `${event.organizer?.firstName || ""} ${
                event.organizer?.lastName || ""
              }`.trim() ||
              "Event Organization",
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
        prevIndex === featuredEvents.length - 1 ? 0 : prevIndex + 1
      );
      setTimeout(() => setIsAnimating(false), 500);
    }
  }, [isAnimating, featuredEvents.length]);

  const prevSlide = useCallback(() => {
    if (!isAnimating) {
      setIsAnimating(true);
      setCurrentIndex((prevIndex) =>
        prevIndex === 0 ? featuredEvents.length - 1 : prevIndex - 1
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

  // Touch event handlers for swipe functionality
  // const handleTouchStart = (e: React.TouchEvent) => {
  //   e.preventDefault()
  //   setTouchStart(e.targetTouches[0].clientX)
  //   setTouchEnd(null)
  //   setIsDragging(true)
  //   setDragOffset(0)
  // }

  // const handleTouchMove = (e: React.TouchEvent) => {
  //   e.preventDefault()
  //   if (!touchStart) return

  //   const currentTouch = e.targetTouches[0].clientX
  //   const distance = touchStart - currentTouch
  //   setDragOffset(-distance * 0.1) // Reduce sensitivity
  // }

  // const handleTouchEnd = (e: React.TouchEvent) => {
  //   e.preventDefault()
  //   if (!touchStart || !touchEnd) return

  //   const distance = touchStart - touchEnd
  //   const minSwipeDistance = 50

  //   if (Math.abs(distance) > minSwipeDistance) {
  //     if (distance < 0) { // Swipe right -> go to previous slide
  //       prevSlide()
  //     } else { // Swipe left -> go to next slide
  //       nextSlide()
  //     }
  //   }

  //   setTouchStart(null)
  //   setTouchEnd(null)
  //   setIsDragging(false)
  //   setDragOffset(0)
  // }

  // Mouse event handlers for desktop swipe
  // const handleMouseDown = (e: React.MouseEvent) => {
  //   e.preventDefault()
  //   setTouchStart(e.clientX)
  //   setTouchEnd(null)
  //   setIsDragging(true)
  //   setDragOffset(0)
  // }

  // const handleMouseMove = (e: React.MouseEvent) => {
  //   e.preventDefault()
  //   if (!touchStart || !isDragging) return

  //   const currentX = e.clientX
  //   const distance = touchStart - currentX
  //   setDragOffset(-distance * 0.1) // Reduce sensitivity
  // }

  // const handleMouseUp = (e: React.MouseEvent) => {
  //   e.preventDefault()
  //   if (!touchStart) return

  //   const distance = touchStart - e.clientX
  //   const minSwipeDistance = 50

  //   if (Math.abs(distance) > minSwipeDistance) {
  //     if (distance < 0) { // Swipe right -> go to previous slide
  //       prevSlide()
  //     } else { // Swipe left -> go to next slide
  //       nextSlide()
  //     }
  //   }

  //   setTouchStart(null)
  //   setTouchEnd(null)
  //   setIsDragging(false)
  //   setDragOffset(0)
  // }

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
      <div className="flex items-center justify-center min-h-[400px] bg-gray-100 mx-4 sm:mx-8 md:mx-12 my-6 rounded-xl">
        <div className="text-center p-8">
          <h3 className="text-xl font-semibold text-gray-700 mb-2">
            No Featured Events
          </h3>
          <p className="text-gray-500">
            To feature events contact{" "}
            <a
              href="mailto:admin@pazimo.com"
              className="text-blue-600 hover:underline"
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
      className="relative overflow-hidden mx-2 sm:mx-4 md:mx-8 my-4 sm:my-6 rounded-xl min-h-[220px] sm:min-h-[500px] md:min-h-[650px] select-none touch-pan-y"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      style={{ cursor: isDragging ? "grabbing" : "grab" }}
    >
      {/* Background Image */}
      <div className="absolute inset-0 transition-opacity duration-1000 ease-in-out">
        <Image
          src={
            currentEvent.image ||
            "/placeholder.svg?height=650&width=1200&text=Featured+Event"
          }
          alt={currentEvent.title}
          fill
          className="object-contain bg-black"
          priority
          sizes="100vw"
          quality={90}
          onError={(e) => {
            console.error("Image failed to load:", currentEvent.image);
            const target = e.target as HTMLImageElement;
            target.src =
              "/placeholder.svg?height=650&width=1200&text=Featured+Event";
          }}
        />
      </div>

      {/* Enhanced Gradient Overlays */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-black/20 to-black/10 sm:from-black/85 sm:via-black/60 sm:to-black/30 z-10" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent sm:from-black/70 sm:via-transparent sm:to-black/20 z-10" />

      {/* Sold Out Badge - Mobile Only */}
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
      )}

      <div className="relative z-20 container mx-auto px-2 sm:px-8 md:px-16 py-3 sm:py-8 md:py-12 h-full">
        <div className="flex flex-col md:flex-row items-center gap-4 md:gap-12 h-full">
          {/* Content Section */}
          <div className="w-full md:w-3/5 text-white">
            {/* Organization/Presenter */}
            <div className="mb-2 sm:mb-4">
              <p className="text-xs sm:text-lg font-semibold text-amber-300 tracking-wide uppercase">
                {currentEvent.organization} PRESENTS
              </p>
            </div>

            {/* Main Event Title */}
            <h1 className="text-lg sm:text-4xl md:text-5xl lg:text-6xl font-black mb-2 sm:mb-6 leading-tight text-white tracking-tight">
              {currentEvent.title.toUpperCase()}
            </h1>
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
              if (
                active.length > 0 &&
                (active[0]?.wave || active[0]?.description)
              ) {
                const label = active[0].wave || active[0].description;
                return (
                  <p className="text-amber-300 text-xs sm:text-sm font-semibold mb-3 sm:mb-4">
                    {label}
                  </p>
                );
              }
              return null;
            })()}

            {/* Event Description */}
            <div className="mb-2 sm:mb-6 hidden sm:block">
              <p className="text-xs sm:text-base leading-relaxed line-clamp-3">
                {currentEvent.description}
              </p>
            </div>

            {/* Event Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 mb-3 sm:mb-6 text-xs sm:text-base">
              <div className="flex items-center gap-2 sm:gap-3 sm:bg-white/10 sm:backdrop-blur-sm rounded-lg p-2 sm:p-3 sm:border sm:border-white/20">
                <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-amber-300 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-white sm:text-base">
                    {currentEvent.date}
                  </p>
                  <p className="text-white/80 text-xs sm:text-sm">
                    {formatTimeRange(
                      currentEvent.startTime,
                      currentEvent.endTime
                    )}
                  </p>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-2 sm:gap-3 bgwhite/10 backdrop-blur-sm rounded-lg p-2 sm:p-3 border border-white/20">
                <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-amber-300 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-white">
                    {currentEvent.venue}
                  </p>
                  <p className="text-white/80 text-xs sm:text-sm">
                    {currentEvent.location}
                  </p>
                </div>
              </div>
            </div>

            {/* Rating, Attendees, and Age Restriction */}
            <div className="flex items-center gap-3 sm:gap-6 mb-4 sm:mb-8">
              <div className="flex items-center gap-1 sm:gap-2">
                <div className="flex">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className="h-3 w-3 sm:h-4 sm:w-4"
                      fill={
                        i < Math.floor(currentEvent.rating) ? "#fbbf24" : "none"
                      }
                      stroke={
                        i < Math.floor(currentEvent.rating)
                          ? "#fbbf24"
                          : "#ffffff"
                      }
                    />
                  ))}
                </div>
                <span className="text-xs sm:text-sm font-medium text-white">
                  {currentEvent.rating.toFixed(1)}
                </span>
              </div>
              <div className="flex items-center gap-1 sm:gap-2">
                <Users className="h-3 w-3 sm:h-4 sm:w-4 text-amber-300" />
                <span className="text-xs sm:text-sm font-medium text-white">
                  {currentEvent.attendees.toLocaleString()}+ attending
                </span>
              </div>
              {/* Age Restriction */}
              {currentEvent.originalEvent.ageRestriction?.hasRestriction && (
                <div className="flex items-center gap-1 sm:gap-2">
                  <UserCheck className="h-3 w-3 sm:h-4 sm:w-4 text-blue-300" />
                  <span className="text-xs sm:text-sm font-medium text-white">
                    {currentEvent.originalEvent.ageRestriction.minAge &&
                      !currentEvent.originalEvent.ageRestriction.maxAge &&
                      `${currentEvent.originalEvent.ageRestriction.minAge}+`}
                    {!currentEvent.originalEvent.ageRestriction.minAge &&
                      currentEvent.originalEvent.ageRestriction.maxAge &&
                      `Up to ${currentEvent.originalEvent.ageRestriction.maxAge}`}
                    {currentEvent.originalEvent.ageRestriction.minAge &&
                      currentEvent.originalEvent.ageRestriction.maxAge &&
                      `${currentEvent.originalEvent.ageRestriction.minAge}-${currentEvent.originalEvent.ageRestriction.maxAge}`}
                    {!currentEvent.originalEvent.ageRestriction.minAge &&
                      !currentEvent.originalEvent.ageRestriction.maxAge &&
                      "Age restricted"}
                  </span>
                </div>
              )}
            </div>

            {/* Action Button */}
            {!isEventSoldOut(currentEvent.originalEvent) && (
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                <Link href={`/event_detail?id=${currentEvent.id}`} passHref>
                  <Button
                    size="sm"
                    className="pt-2 pb-2 mb-4 bg-amber-500 hover:bg-amber-600 text-white font-bold px-4 text-sm rounded-lg shadow-lg"
                  >
                    <Gift className="h-4 w-4 mr-1" />
                    Get Tickets
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {/* Desktop Only: Featured Event Card */}
          <div className="hidden md:block md:w-2/5 flex justify-center md:justify-end">
            <div className="relative w-[220px] lg:w-[320px] h-[300px] lg:h-[450px] rounded-xl overflow-hidden shadow-2xl transform md:-rotate-2 hover:rotate-0 transition-transform duration-500 bg-white">
              {/* Sold Out Badge - Top Left on Card (Desktop Only) */}
              {isEventSoldOut(currentEvent.originalEvent) && (
                <div className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded z-30 shadow-lg animate-pulse">
                  SOLD OUT
                </div>
              )}

              {/* Event Poster Image */}
              <div className="relative h-full w-full">
                <Image
                  src={
                    currentEvent.image ||
                    "/placeholder.svg?height=300&width=220&text=Event+Poster"
                  }
                  alt={currentEvent.title}
                  fill
                  className="object-contain bg-black"
                  sizes="(max-width: 1024px) 220px, 320px"
                  quality={80}
                  priority
                  onError={(e) => {
                    console.error("Image failed to load:", currentEvent.image);
                    const target = e.target as HTMLImageElement;
                    target.src =
                      "/placeholder.svg?height=300&width=220&text=Event+Poster";
                  }}
                />

                {/* Poster Content Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                {/* Bottom Content */}
                <div className="absolute bottom-0 left-0 right-0 p-2 lg:p-6 text-white">
                  <div className="mb-1 lg:mb-3">
                    {/* <p className="text-white/90 text-xs lg:text-sm mb-1 lg:mb-2 line-clamp-2">{currentEvent.description}</p> */}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
