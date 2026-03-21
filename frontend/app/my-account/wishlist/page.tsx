"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Heart, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useWishlist } from "@/hooks/useWishlist";
import { useAuthStore } from "@/store/authStore";
import FeaturedEventCard, {
  type FeaturedEventCardData,
} from "@/components/featured-event-card";

type Event = {
  _id: string;
  title: string;
  description?: string;
  startDate: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  location?: {
    address?: string;
    city?: string;
    country?: string;
  };
  category?: string | { name: string };
  coverImages?: string[];
  coverImage?: string;
  ticketTypes?: Array<{
    name: string;
    price: number;
    priceETB?: number;
    priceUSD?: number;
    quantity: number;
  }>;
  status?: string;
  organizer?: {
    name?: string;
    email?: string;
  };
};

const normalizeImage = (imagePath?: string) => {
  if (!imagePath) return undefined;
  if (imagePath.startsWith("http")) return imagePath;
  return `${process.env.NEXT_PUBLIC_API_URL}${
    imagePath.startsWith("/") ? imagePath : `/${imagePath}`
  }`;
};

export default function WishlistPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [wishlistItems, setWishlistItems] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { token } = useAuthStore();

  // Use global wishlist hook
  const {
    wishlist,
    toggleWishlist,
    isLoading: isWishlistLoading,
  } = useWishlist();

  // Helper functions used in cards
  const isTicketTypeAvailable = (ticketType: any) => {
    if (!ticketType) return false;
    // Basic check: quantity > 0 (assuming you have a 'quantity' or 'sold' field logic)
    // Adjust based on your actual Ticket model/Type
    return ticketType.quantity > 0;
  };

  const isEventSoldOut = (event: Event) => {
    if (event.status === "cancelled" || event.status === "postponed")
      return true;
    if (!event.ticketTypes || event.ticketTypes.length === 0) return false;
    return event.ticketTypes.every((ticket) => !isTicketTypeAvailable(ticket));
  };

  const formatTimeWithAmPm = (time24?: string): string => {
    if (!time24) return "";
    const [hourStr, minuteStr] = time24.split(":");
    if (!hourStr || !minuteStr) return time24;
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

  const getPriceLabel = (event: Event) => {
    const tickets = event.ticketTypes || [];
    let minETB = Infinity;
    let minUSD = Infinity;
    let hasETB = false;
    let hasUSD = false;

    tickets.forEach((ticket) => {
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

    if (hasUSD && hasETB) return `from ${minUSD}$/${minETB} ETB`;
    if (hasUSD) return `from ${minUSD}$`;
    if (hasETB && minETB !== Infinity && minETB > 0) return `from ${minETB} ETB`;
    return "Free";
  };

  const buildFeaturedCardData = (event: Event): FeaturedEventCardData => {
    const categoryName =
      typeof event.category === "string"
        ? event.category
        : event.category?.name || "Uncategorized";

    const image = normalizeImage(event.coverImages?.[0] || event.coverImage);

    return {
      id: event._id,
      href: `/event_detail?id=${event._id}`,
      title: event.title,
      tag: categoryName,
      dateLabel: formatDate(event.startDate),
      locationLabel: event.location?.city
        ? `${event.location.city}${event.location.country ? `, ${event.location.country}` : ""}`
        : "Location TBA",
      priceLabel: getPriceLabel(event),
      image,
      soldOut: isEventSoldOut(event),
    };
  };

  useEffect(() => {
    fetchWishlistItems();
  }, []);

  const fetchWishlistItems = async () => {
    try {
      setIsLoading(true);

      const storedAuth = localStorage.getItem("auth-storage");
      let userId;

      if (storedAuth) {
        const parsedAuth = JSON.parse(storedAuth);
        // Handle both id and _id formats which might vary across auth versions
        userId = parsedAuth.state?.user?._id || parsedAuth.state?.user?.id;
      }

      let wishlistEventIds: string[] = [];

      if (userId && token) {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/events/wishlist`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          console.error(
            `Failed to fetch wishlist from API: ${response.status} ${response.statusText}`
          );
          const text = await response.text();
          console.error("Response body:", text);
        } else {
          const data = await response.json();
          if (data.data && Array.isArray(data.data)) {
            // New backend returns populated event objects directly!
            // We can use them directly.

            // Filter out any nulls just in case population failed for deleted events
            const events = data.data.filter((item: any) => item && item._id);
            setWishlistItems(events);
            setIsLoading(false);
            return; // Exit early as we have the data
          }
        }
      }

      // Fallback for non-logged in or if API failed/returned empty but we want to check local logic?
      // Actually strictly speaking, if userId exists we trust the API.
      // If we fall through here, it means we are checking local storage (guest mode).

      if (!userId) {
        const localWishlist = localStorage.getItem("event-wishlist");
        if (localWishlist) {
          try {
            wishlistEventIds = JSON.parse(localWishlist);
          } catch (e) {
            console.error("Error parsing local wishlist", e);
            wishlistEventIds = [];
          }
        }
      }

      if (wishlistEventIds.length > 0) {
        const eventDetails: Event[] = [];
        // We fetch details individually to ensure we get the full Event object structure
        // required by the UI (description, organizer, etc.), which might be missing
        // from the populated wishlist response depending on backend projection.
        const eventPromises = wishlistEventIds.map((eventId) =>
          fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/events/details/${eventId}`
          )
            .then((res) => (res.ok ? res.json() : null))
            .catch((err) => {
              console.error(
                `Error fetching details for event ${eventId}:`,
                err
              );
              return null;
            })
        );

        const results = await Promise.all(eventPromises);

        results.forEach((eventData) => {
          if (eventData && eventData.data) {
            eventDetails.push(eventData.data); // data.data is the convention based on other files
          } else if (eventData && eventData.event) {
            eventDetails.push(eventData.event); // fallback
          }
        });

        setWishlistItems(eventDetails);
      } else {
        setWishlistItems([]);
      }
    } catch (error) {
      console.error("Error fetching wishlist items:", error);
      toast.error("Failed to load wishlist");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredItems = wishlistItems
    .filter((item) => wishlist.includes(item._id)) // Only show items currently in wishlist hook state
    .filter(
      (item) =>
        item.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.location?.city
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        item.location?.country
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase())
    );

  const formatDate = (dateString: string) =>
    dateString
      ? new Date(dateString).toLocaleDateString("en-US", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "N/A";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#1a2d5a]" />
          <p className="mt-2 text-[#1a2d5a]">Loading wishlist...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold">Wishlist</h1>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input
            placeholder="Search events..."
            className="pl-10 h-10 w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {wishlistItems.length === 0 ? (
        <div className="text-center py-12">
          <Heart className="h-12 w-12 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">
            Your wishlist is empty
          </h3>
          <p className="text-gray-500 mt-2 mb-6">
            Explore events and add them to your wishlist!
          </p>
          <Link href="/event_explore">
            <Button>Explore Events</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredItems.map((event, index) => (
            <FeaturedEventCard
              key={event._id}
              data={buildFeaturedCardData(event)}
              wishlist={wishlist}
              onToggleWishlist={toggleWishlist}
              isWishlistLoading={isWishlistLoading}
              index={index}
            />
          ))}
        </div>
      )}
    </div>
  );
}
