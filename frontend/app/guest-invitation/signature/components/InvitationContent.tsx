"use client";

import { motion, Variants } from "framer-motion";
import Image from "next/image";
import { Calendar, Clock, MapPin } from "lucide-react";
import RSVPButtons from "./RSVPButtons";

interface InvitationContentProps {
  ticketId: string | null;
  initialData?: any;
}

export default function InvitationContent({
  ticketId,
  initialData,
}: InvitationContentProps) {
  const containerVariants: Variants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.8,
        ease: [0.22, 1, 0.36, 1],
        staggerChildren: 0.2,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 15 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: "easeOut",
      },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="relative bg-neutral-900/95 backdrop-blur-sm border border-yellow-500/20 rounded-xl 
        p-6 md:p-12 w-[100%] md:w-full max-w-3xl mx-auto shadow-2xl my-8"
    >
      {/* cornors outside that border giving fancy look */}
      <div className="absolute rounded-tl-xl -top-3 -left-3 w-6 h-6 border-t-4 border-l-4 border-yellow-500/30 rounded-br-lg" />
      <div className="absolute rounded-tr-xl -top-3 -right-3 w-6 h-6 border-t-4 border-r-4 border-yellow-500/30 rounded-bl-lg" />
      <div className="absolute rounded-bl-xl -bottom-3 -left-3 w-6 h-6 border-b-4 border-l-4 border-yellow-500/30 rounded-tr-lg" />
      <div className="absolute rounded-br-xl -bottom-3 -right-3 w-6 h-6 border-b-4 border-r-4 border-yellow-500/30 rounded-tl-lg" />

      {/* Company Logo */}
      <motion.div
        variants={itemVariants}
        className="flex justify-center mb-6 md:mb-8"
      >
        <div className="relative w-20 h-20 md:w-28 md:h-28 opacity-90">
          <Image
            src="/signatureLogo.png"
            alt="Company Logo"
            fill
            className="object-contain"
          />
        </div>
      </motion.div>

      {/* Invitation Header */}
      <motion.div variants={itemVariants} className="text-center mb-8 md:mb-12">
        <h1 className="text-2xl md:text-4xl font-serif text-yellow-100/90 mb-3 md:mb-4 tracking-wide">
          Grand Opening of Signature Wellness
        </h1>
        <div className="w-12 md:w-16 h-0.5 bg-yellow-600/40 mx-auto" />
      </motion.div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 mb-8 md:mb-12">
        {/* Left Column: Message */}
        <motion.div
          variants={itemVariants}
          className="text-center md:text-left space-y-4 md:space-y-6 flex flex-col justify-center"
        >
          {initialData?.guestName && (
            <p className="text-yellow-500/90 font-serif text-xl md:text-2xl mb-2">
              Hello {initialData.guestName},
            </p>
          )}
          <p className="text-neutral-300 leading-relaxed font-light text-base md:text-lg">
            We are pleased to extend an exclusive invitation to the Grand
            Opening of Signature Wellness.
          </p>
          <p className="text-neutral-300 leading-relaxed font-light text-base md:text-lg">
            Join us for an evening dedicated to well-being, elegance, and
            exceptional hospitality as we unveil our new wellness space.
          </p>
          <p className="text-neutral-400 italic text-xs md:text-sm mt-2">
            Your presence would be an honor as we celebrate this special
            milestone.
          </p>
        </motion.div>

        {/* Right Column: Event Details */}
        <motion.div
          variants={itemVariants}
          className="flex flex-col justify-center space-y-6 md:space-y-8 border-l-0 md:border-l border-yellow-500/10 md:pl-12"
        >
          <div className="flex items-start gap-3 md:gap-4">
            <Calendar className="w-5 h-5 text-yellow-500/80 mt-1 shrink-0" />
            <div>
              <span className="block text-yellow-500/80 text-[10px] md:text-xs uppercase tracking-widest mb-1">
                Date
              </span>
              <p className="text-neutral-200 text-base md:text-lg">
                {initialData?.event?.startDate
                  ? new Date(initialData.event.startDate).toLocaleDateString(
                      "en-US",
                      {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      }
                    )
                  : "Date TBD"}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 md:gap-4">
            <Clock className="w-5 h-5 text-yellow-500/80 mt-1 shrink-0" />
            <div>
              <span className="block text-yellow-500/80 text-[10px] md:text-xs uppercase tracking-widest mb-1">
                Time
              </span>
              <p className="text-neutral-200 text-base md:text-lg">
                {initialData?.event?.startTime || "Time TBD"}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 md:gap-4">
            <MapPin className="w-5 h-5 text-yellow-500/80 mt-1 shrink-0" />
            <div>
              <span className="block text-yellow-500/80 text-[10px] md:text-xs uppercase tracking-widest mb-1">
                Location
              </span>
              <p className="text-neutral-200 text-base md:text-lg">
                {typeof initialData?.event?.location === "string"
                  ? initialData.event.location
                  : initialData?.event?.location?.address || "Venue TBD"}
              </p>
              {typeof initialData?.event?.location !== "string" &&
                initialData?.event?.location?.city && (
                  <p className="text-neutral-400 text-sm">
                    {initialData.event.location.city}
                  </p>
                )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* RSVP Buttons */}
      <motion.div
        variants={itemVariants}
        className="flex justify-center pt-8 border-t border-yellow-500/10"
      >
        <RSVPButtons ticketId={ticketId} initialData={initialData} />
      </motion.div>
    </motion.div>
  );
}
