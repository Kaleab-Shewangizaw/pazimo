"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { Calendar, MapPin, Star, Users, Gift, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { toast } from "sonner";
import { Space_Grotesk } from 'next/font/google';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'], // Choose needed weights
  variable: '--font-space-grotesk', // Define a CSS variable for Tailwind
});

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

export default function LargeEventCarousel({
  initialEvents,
}: {
  initialEvents?: FeaturedEvent[];
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [featuredEvents, setFeaturedEvents] = useState<FeaturedEvent[]>(
    initialEvents || [],
  );
  const [isLoading, setIsLoading] = useState(!initialEvents);

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
                : `${process.env.NEXT_PUBLIC_API_URL}${
                    event.coverImages[0].startsWith("/")
                      ? event.coverImages[0]
                      : `/${event.coverImages[0]}`
                  }`
              : "/placeholder.svg?height=600&width=400&text=Event+Poster";

          console.log("Processed image URL:", imageUrl); 

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
              },
            );
            if (activeWaveTickets.length > 0) {
              activeWaveTickets.sort(
                (a: any, b: any) =>
                  new Date(b.startDate).getTime() -
                  new Date(a.startDate).getTime(),
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
              ...event.ticketTypes.map((t: any) => t.price),
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1a2d5a] mx-auto"></div>
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
      className="relative overflow-hidden min-h-[100vh] sm:min-h-[100vh] md:min-h-[100vh] select-none touch-pan-y"
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
          className="object-cover bg-black"
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

      {/* Modern Gradient Overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-white  via-white/60 md:via-white/80 to-white/40 sm:from-gray-900 sm:via-gray-900/80 sm:to-gray-900/40 z-10" />
      <div className="absolute inset-0 bg-gradient-to-r from-white/60 to-transparent sm:from-gray-900/90 sm:via-gray-900/60 sm:to-transparent z-10" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white z-20" />

      {/* Sold Out Badge - Mobile Only */}
      {isEventSoldOut(currentEvent.originalEvent) && (
        <div className="absolute top-4 right-4 md:hidden z-30">
          <div className="bg-red-500 text-white text-sm font-bold px-3 py-2 rounded-lg shadow-lg animate-pulse mb-2">
            SOLD OUT
          </div>
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold px-3 py-2 rounded-lg shadow-lg text-sm">
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
                <div className="mt-2 bg-white/95 backdrop-blur-sm text-amber-700 text-xs font-semibold px-2 py-1 rounded-lg shadow">
                  {active[0].wave}
                </div>
              );
            }
            return null;
          })()}
        </div>
      )}

      <div className="relative z-20 container ml-0 lg:ml-30 sm:mt-[30%] mt-[70%]  md:mt-[15%] mx- md:px-16 w-full 2 sm:px-8  py-3 sm:py-8 md:py-12 h-full">
        <div className="flex flex-col  md:flex-row items-center justify-between gap-4 md:gap-12 h-full">
          {/* Content Section */}
          <div className="max-w-3xl w-full px-10   sm:px-0   text-gray-900 sm:text-white">
            {/* Organization/Presenter */}
            <div className="mb-2 sm:mb-4 animate-fade-in">
              <p className={`${spaceGrotesk.className} text-md sm:text-2xl font-semibold text-blue-600 sm:text-blue-600 tracking-wide`}>
                {currentEvent.organization} PRESENTS
              </p>
            </div>

            {/* Main Event Title */}
            <h1 className={`${spaceGrotesk.className} text-5xl sm:text-5xl md:text-6xl lg:text-7xl font-black mb-2 sm:mb-6 leading-tight text-gray-900 sm:text-white tracking-tight animate-slide-up`}>
              {currentEvent.title}
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
                  <p className="text-amber-600 sm:text-amber-400 text-xs sm:text-sm font-semibold mb-3 sm:mb-4 animate-fade-in">
                    {label}
                  </p>
                );
              }
              return null;
            })()}

            {/* Event Description */}
            <div className="mb-2 sm:mb-6  sm:block animate-fade-in max-w-xl">
              <p className={`${spaceGrotesk.className} text-xl sm:text-2xl  leading-relaxed line-clamp-3 text-black sm:text-white max-w-xl`}>
                {currentEvent.description}
              </p>
            </div>

            {/* Event Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 mb-3 sm:mb-6 text-xs sm:text-base animate-fade-in">
              <div className="flex items-center gap-2 sm:gap-3 bg-white/10 sm:bg-white/10 backdrop-blur-md rounded-xl p-2 sm:p-4 border border-white/20 hover:bg-white/20 transition-all duration-300">
                <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600 sm:text-amber-400 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-gray-900 sm:text-white sm:text-base">
                    {currentEvent.date}
                  </p>
                  <p className="text-gray-700 sm:text-white/80 text-xs sm:text-sm">
                    {formatTimeRange(
                      currentEvent.startTime,
                      currentEvent.endTime,
                    )}
                  </p>
                </div>
              </div>
              <div className=" flex items-center gap-2 sm:gap-3 bg-white/10 backdrop-blur-md rounded-xl p-2 sm:p-4 border border-white/20 hover:bg-white/20 transition-all duration-300">
                <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-amber-400 flex-shrink-0" />
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
            <div className="flex items-center gap-3 sm:gap-6 mb-4 sm:mb-8 animate-fade-in">
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
                          : "#9ca3af"
                      }
                    />
                  ))}
                </div>
                <span className="text-xs sm:text-sm font-medium text-gray-900 sm:text-white">
                  {currentEvent.rating.toFixed(1)}
                </span>
              </div>
        {/* <div className="flex items-center gap-1 sm:gap-2">
                <Users className="h-3 w-3 sm:h-4 sm:w-4 text-amber-300" />
                <span className="text-xs sm:text-sm font-medium text-white">
                  {currentEvent.attendees.toLocaleString()}+ attending
                </span>
              </div> */}
              {/* Age Restriction */}
              {currentEvent.originalEvent.ageRestriction?.hasRestriction && (
                <div className="flex items-center gap-1 sm:gap-2">
                  <UserCheck className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500 sm:text-blue-400" />
                  <span className="text-xs sm:text-sm font-medium text-gray-900 sm:text-white">
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
            {!isEventSoldOut(currentEvent.originalEvent) ? (
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 animate-fade-in">
                <Link href={`/event_detail?id=${currentEvent.id}`} passHref>
                  <Button
                    size="lg"
                    className="pt-3 pb-3 mb-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold px-8 text-sm rounded-xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105"
                  >
                    <Gift className="h-4 w-4 mr-2" />
                    Get Tickets
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 animate-fade-in">
                <Link href={`/event_detail?id=${currentEvent.id}`} passHref>
                  <Button
                    size="lg"
                    variant="outline"
                    className="pt-3 pb-3 mb-4 border-1 bg-white/70 border-red-500 text-red-500 hover:bg-red-50 font-bold px-8 text-sm rounded-xl shadow-xl"
                  >
                    Sold Out
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {/* Desktop Only: Featured Event Card */}
          
        </div>
      </div>
    </section>
  );
}
