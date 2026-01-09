import { useState, useEffect } from "react";
import { toast } from "sonner";

export const useWishlist = () => {
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchWishlist();
  }, []);

  const fetchWishlist = async () => {
    try {
      setIsLoading(true);
      const storedAuth = localStorage.getItem("auth-storage");
      let userId;

      if (storedAuth) {
        const parsedAuth = JSON.parse(storedAuth);
        userId = parsedAuth.state?.user?.id || parsedAuth.state?.user?._id;
      }

      // Always load from local storage first
      const saved = localStorage.getItem("event-wishlist");
      if (saved) {
        try {
          setWishlist(JSON.parse(saved));
        } catch {
          setWishlist([]);
        }
      }

      // If logged in, sync with server
      if (userId) {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/events/${userId}/wishlist`
        );
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.data)) {
            // Extract just the event IDs
            const serverIds = data.data
              .map((item: any) => {
                if (
                  item.eventId &&
                  typeof item.eventId === "object" &&
                  item.eventId._id
                ) {
                  return item.eventId._id;
                }
                return item.eventId;
              })
              .filter(Boolean);

            setWishlist(serverIds);
            localStorage.setItem("event-wishlist", JSON.stringify(serverIds));
          }
        }
      }
    } catch (error) {
      console.error("Error fetching wishlist:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleWishlist = async (eventId: string) => {
    try {
      const storedAuth = localStorage.getItem("auth-storage");
      let userId;

      if (storedAuth) {
        const parsedAuth = JSON.parse(storedAuth);
        userId = parsedAuth.state?.user?.id || parsedAuth.state?.user?._id;
      }

      const isRemoving = wishlist.includes(eventId);
      const newWishlist = isRemoving
        ? wishlist.filter((id) => id !== eventId)
        : [...wishlist, eventId];

      setWishlist(newWishlist);
      localStorage.setItem("event-wishlist", JSON.stringify(newWishlist));

      if (userId) {
        await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/events/${userId}/wishlist`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              eventId,
              action: isRemoving ? "remove" : "add",
            }),
          }
        );
      }

      toast.success(isRemoving ? "Removed from wishlist" : "Added to wishlist");
      return !isRemoving;
    } catch (error) {
      console.error("Error updating wishlist:", error);
      toast.error("Failed to update wishlist");
      // Revert in case of error (optional but recommended)
      fetchWishlist();
      return wishlist.includes(eventId);
    }
  };

  const isInWishlist = (eventId: string) => wishlist.includes(eventId);

  return {
    wishlist,
    isLoading,
    toggleWishlist,
    isInWishlist,
    refreshWishlist: fetchWishlist,
  };
};
