import { useAuthStore } from "@/store/authStore";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export const useWishlist = () => {
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { token } = useAuthStore(); // Get token from store

  useEffect(() => {
    fetchWishlist();
  }, [token]);

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
      if (userId && token) {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/events/wishlist`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        if (res.ok) {
          const data = await res.json();
          // Backend returns { status: "success", data: [...] } OR { success: true, data: [...] }
          // We need to handle both just in case, but controller uses status="success" for getWishlist
          const isSuccess = data.success === true || data.status === "success";

          if (isSuccess && Array.isArray(data.data)) {
            // New structure: data.data is array of Event objects (populated)
            // or array of IDs (if not populated, but getWishlist populates)
            const serverIds = data.data
              .map((item: any) => {
                // Check if item is an object (Event) or just an ID string
                if (typeof item === "object" && item !== null) {
                  return item._id; // Event object
                }
                return item; // ID string
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

      if (!userId || !token) {
        toast.error("Please sign in to use wishlist");
        return wishlist.includes(eventId);
      }

      const isRemoving = wishlist.includes(eventId);
      const newWishlist = isRemoving
        ? wishlist.filter((id) => id !== eventId)
        : [...wishlist, eventId];

      setWishlist(newWishlist);
      localStorage.setItem("event-wishlist", JSON.stringify(newWishlist));

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/events/wishlist`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            eventId,
            action: isRemoving ? "remove" : "add",
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update wishlist");
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
