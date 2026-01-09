"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, Heart, Calendar, MapPin, Ticket, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

type Event = {
  _id: string;
  title: string;
  description?: string;
  startDate: string;
  endDate?: string;
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
    quantity: number;
  }>;
  status?: string;
  organizer?: {
    name?: string;
    email?: string;
  };
};

export default function WishlistPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [wishlistItems, setWishlistItems] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRemoving, setIsRemoving] = useState<Record<string, boolean>>({});

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

      if (userId) {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/events/${userId}/wishlist`
        );

        if (!response.ok) {
          console.error("Failed to fetch wishlist from API");
        } else {
          const data = await response.json();
          if (data.data && Array.isArray(data.data)) {
            // Map item.eventId.
            // Based on backend controller, eventId is populated with the Event object.
            // However, we need to extract the ID string safely.
            wishlistEventIds = data.data
              .map((item: { eventId: string | { _id: string } }) => {
                if (
                  item.eventId &&
                  typeof item.eventId === "object" &&
                  "_id" in item.eventId
                ) {
                  return item.eventId._id;
                }
                return item.eventId as string;
              })
              .filter(Boolean);
          }
        }
      } else {
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

  const removeFromWishlist = async (eventId: string) => {
    try {
      setIsRemoving((prev) => ({ ...prev, [eventId]: true }));

      const storedAuth = localStorage.getItem("auth-storage");
      let userId;

      if (storedAuth) {
        const parsedAuth = JSON.parse(storedAuth);
        userId = parsedAuth.state?.user?._id || parsedAuth.state?.user?.id;
      }

      // Optimistic UI update
      setWishlistItems((prev) => prev.filter((item) => item._id !== eventId));

      if (userId) {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/events/${userId}/wishlist`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ eventId, action: "remove" }),
          }
        );

        if (!response.ok)
          throw new Error("Failed to remove event from wishlist");
      }

      // Always update local storage too, to keep in sync if user logs out
      const localWishlist = localStorage.getItem("event-wishlist");
      if (localWishlist) {
        const wishlistIds = JSON.parse(localWishlist);
        const updatedWishlist = wishlistIds.filter(
          (id: string) => id !== eventId
        );
        localStorage.setItem("event-wishlist", JSON.stringify(updatedWishlist));
      }

      toast.success("Removed from wishlist");
    } catch (error) {
      console.error("Error removing from wishlist:", error);
      toast.error("Failed to remove from wishlist");
      // Re-fetch to sync if failed
      fetchWishlistItems();
    } finally {
      setIsRemoving((prev) => ({ ...prev, [eventId]: false }));
    }
  };

  const filteredItems = wishlistItems.filter(
    (item) =>
      item.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.location?.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.location?.country?.toLowerCase().includes(searchQuery.toLowerCase())
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item) => (
            <Card
              key={item._id}
              className="overflow-hidden hover:shadow-lg transition-shadow"
            >
              <CardContent className="p-0">
                <div className="flex flex-col h-full">
                  <div className="relative h-48 w-full">
                    <Image
                      src={
                        item.coverImages && item.coverImages.length > 0
                          ? item.coverImages[0].startsWith("http")
                            ? item.coverImages[0]
                            : `${process.env.NEXT_PUBLIC_API_URL}${
                                item.coverImages[0].startsWith("/")
                                  ? item.coverImages[0]
                                  : `/${item.coverImages[0]}`
                              }`
                          : item.coverImage
                          ? item.coverImage.startsWith("http")
                            ? item.coverImage
                            : `${process.env.NEXT_PUBLIC_API_URL}${
                                item.coverImage.startsWith("/")
                                  ? item.coverImage
                                  : `/${item.coverImage}`
                              }`
                          : "/events/eventimg.png"
                      }
                      alt={item.title}
                      fill
                      className="object-cover"
                    />
                  </div>

                  <div className="p-4 flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-lg line-clamp-2">
                        {item.title}
                      </h3>
                      <div className="text-[#1a2d5a] font-bold">
                        {item.ticketTypes && item.ticketTypes[0]?.price
                          ? `${item.ticketTypes[0].price} ETB`
                          : "Free"}
                      </div>
                    </div>

                    <div className="space-y-2 mb-4 flex-1">
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Calendar className="h-4 w-4 shrink-0" />
                        <span>{formatDate(item.startDate)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <MapPin className="h-4 w-4 shrink-0" />
                        <span className="line-clamp-1">
                          {item.location?.city || "TBA"},{" "}
                          {item.location?.country || ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Ticket className="h-4 w-4 shrink-0" />
                        <span>
                          {typeof item.category === "object" &&
                          item.category !== null &&
                          "name" in item.category
                            ? item.category.name
                            : item.category || "General"}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-auto">
                      <Link
                        href={`/event_detail?id=${item._id}`}
                        className="w-full"
                      >
                        <Button variant="outline" className="w-full">
                          Details
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        className="w-full text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => removeFromWishlist(item._id)}
                        disabled={isRemoving[item._id]}
                      >
                        {isRemoving[item._id] ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Heart className="h-4 w-4 mr-2 fill-current" />
                        )}
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
