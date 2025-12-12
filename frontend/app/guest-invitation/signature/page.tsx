"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import SealedEnvelope from "./components/SealedEnvelope";
import OpenedEnvelope from "./components/OpenedEnvelope";
import InvitationContent from "./components/InvitationContent";

export default function InvitationPage() {
  const [isOpened, setIsOpened] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [ticketData, setTicketData] = useState<any>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const ticketId = searchParams.get("inv");

  useEffect(() => {
    if (!ticketId) {
      router.push("/");
      return;
    }

    const checkEventAndRedirect = async () => {
      try {
        // Fetch ticket details to check event title
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/tickets/invitation/${ticketId}`
        );
        const result = await response.json();

        if (response.ok && result.success) {
          setTicketData(result.data);
          const eventTitle = result.data.event?.title || "";
          // If event title does NOT contain "signature" (case-insensitive), redirect
          if (!eventTitle.toLowerCase().includes("signature")) {
            router.push(`/guest-invitation?inv=${ticketId}`);
            return;
          }
        }
      } catch (error) {
        console.error("Error checking event type:", error);
      }
    };

    checkEventAndRedirect();

    // Preload images for smooth experience
    const imageUrls = [
      "/background.jpg",
      "/signatureLogo.png",
      "/sealed.png",
      "/opened.png",
    ];

    const preloadImages = async () => {
      const promises = imageUrls.map((src) => {
        return new Promise((resolve, reject) => {
          const img = new window.Image();
          img.src = src;
          img.onload = resolve;
          img.onerror = reject;
        });
      });

      await Promise.all(promises);
      //wait 3 seconds
      await new Promise((resolve) => setTimeout(resolve, 3000));
      setIsLoading(false);
    };

    preloadImages();
  }, [ticketId, router]);

  const handleOpenEnvelope = () => {
    if (!isOpened) {
      setIsOpened(true);
      // Play sound effect (optional)

      // Delay content reveal for envelope opening animation
      setTimeout(() => setShowContent(true), 1000);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="relative w-32 h-32"
        >
          <Image
            src="/signatureLogo.png"
            alt="Company Logo"
            fill
            className="object-contain"
            priority
          />
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 border-4 border-yellow-600/30 border-t-yellow-600 rounded-full"
          />
        </motion.div>
      </div>
    );
  }

  return (
    <>
      {/* Background Image */}
      <div className=" fixed inset-0 -z-2 ">
        <Image
          src="/background.jpg"
          alt="Background"
          fill
          priority
          className="object-cover"
          quality={100}
        />
        {/* Overlay for better text readability */}
        <div className="absolute inset-0 bg-black/40" />
      </div>

      {/* Main Content */}
      <div className="relative z-0 min-h-screen px-4 md:px-10">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          className="absolute top-4 left-4 md:top-8 md:left-8 z-20"
        >
          <div className="relative hidden md:block w-24 h-24 md:w-48 md:h-48">
            <Image
              src="/signatureLogo.png"
              alt="Company Logo"
              fill
              className="object-contain drop-shadow-2xl"
            />
          </div>
        </motion.div>

        {/* Envelope and Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={isOpened ? "opened" : "sealed"}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center min-h-screen   md:p-4 pt-16 md:pt-16"
          >
            {!isOpened ? (
              <SealedEnvelope
                onClick={handleOpenEnvelope}
                ticketId={ticketId}
              />
            ) : (
              <>
                <OpenedEnvelope />
                {showContent && (
                  <InvitationContent
                    ticketId={ticketId}
                    initialData={ticketData}
                  />
                )}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  );
}
