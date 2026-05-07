"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Ticket, Mail, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const HeroSection = () => {
  return (
    <section className="relative overflow-hidden pt-28 pb-20 sm:pt-32 sm:pb-28">
      {/* Minimal background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-background" />
        <div
          className="absolute inset-0 opacity-[0.4]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--navy)/0.05) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--navy)/0.05) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage:
              "radial-gradient(ellipse at 50% 30%, black 30%, transparent 75%)",
          }}
        />
        {/* Soft accent blob */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-[420px] w-[420px] rounded-full bg-accent/15 blur-3xl" />
      </div>

      <div className="container px-5 relative z-10">
        <div className="max-w-3xl mx-auto px-7 text-center">
          {/* Eyebrow pill */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 mb-7 rounded-full border border-border bg-background/80 backdrop-blur px-3.5 py-1.5 shadow-sm"
          >
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            <span className="text-[11px] sm:text-xs font-medium tracking-wide text-foreground/80">
              For organizers, by organizers
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="text-[2.5rem] leading-[1.05] sm:text-6xl md:text-7xl font-display font-bold tracking-tight text-foreground"
          >
            Run events
            <br />
            <span className="relative inline-block">
              <span className="relative z-10 text-gradient-navy">that sell out.</span>
              <span className="absolute left-0 right-0 bottom-1 sm:bottom-2 h-2.5 sm:h-3.5 bg-accent/50 -z-0 rounded-sm" />
            </span>
          </motion.h1>

          {/* Subhead */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="mt-6 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed px-2"
          >
            Ticketing, invitations, and analytics in one clean dashboard — built for everything from rooftop parties to festivals.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="mt-8 flex flex-col sm:flex-row gap-3 justify-center items-stretch sm:items-center"
          >
            <Button asChild size="lg" className="text-base font-semibold px-7 h-12">
              <Link href="/organizer-registration/register">
                Create Your Event
                <ArrowRight className="ml-1.5 h-5 w-5" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="text-base h-12 border-accent bg-accent text-accent-foreground hover:bg-accent/90 shadow-accent-btn transition-shadow"
            >
              <a href="#features">See how it works</a>
            </Button>
          </motion.div>

          {/* Tiny trust row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-10 flex items-center justify-center gap-5 sm:gap-7 text-xs sm:text-sm text-muted-foreground"
          >
            <div className="flex items-center gap-1.5">
              <Ticket className="h-4 w-4 text-primary" />
              <span>Smart ticketing</span>
            </div>
            <span className="h-1 w-1 rounded-full bg-border" />
            <div className="flex items-center gap-1.5">
              <Mail className="h-4 w-4 text-primary" />
              <span>Invitations</span>
            </div>
            <span className="hidden sm:block h-1 w-1 rounded-full bg-border" />
            <div className="hidden sm:flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>3% flat fee</span>
            </div>
          </motion.div>
        </div>

        {/* Unique signature: floating ticket strip */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.45 }}
          className="relative mt-14 sm:mt-20 max-w-2xl mx-auto"
        >
          <div className="relative mx-auto">
            {/* Ticket card */}
            <div className="relative flex items-stretch rounded-2xl bg-primary text-primary-foreground shadow-[0_25px_60px_-20px_hsl(var(--navy)/0.45)] overflow-hidden">
              {/* Left: event */}
              <div className="flex-1 p-4 sm:p-6">
                <div className="text-[10px] sm:text-xs uppercase tracking-[0.18em] text-primary-foreground/60 mb-1.5">
                  Live now
                </div>
                <div className="text-lg sm:text-2xl font-display font-bold leading-tight">
                  Summer Rooftop Festival
                </div>
                <div className="mt-3 sm:mt-4 flex items-center gap-3 sm:gap-5 text-[11px] sm:text-sm text-primary-foreground/80">
                  <span>Sat · 9:00 PM</span>
                  <span className="h-1 w-1 rounded-full bg-primary-foreground/40" />
                  <span>Addis Ababa</span>
                </div>
              </div>

              {/* Perforation */}
              <div className="relative flex items-center">
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 h-4 w-4 rounded-full bg-background" />
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 h-4 w-4 rounded-full bg-background" />
                <div className="h-full border-l border-dashed border-primary-foreground/25" />
              </div>

              {/* Right: stub */}
              <div className="w-28 sm:w-40 p-4 sm:p-6 flex flex-col justify-between bg-primary">
                <div className="text-[10px] sm:text-xs uppercase tracking-[0.18em] text-primary-foreground/60">
                  Sold
                </div>
                <div>
                  <div className="text-2xl sm:text-4xl font-display font-bold text-accent leading-none">
                    1,284
                  </div>
                  <div className="mt-1 text-[10px] sm:text-xs text-primary-foreground/70">
                    +127 today
                  </div>
                </div>
              </div>
            </div>

            {/* Floating badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.9 }}
              className="absolute -top-3 -right-3 sm:-top-4 sm:-right-4 rounded-full bg-accent text-accent-foreground shadow-accent-btn px-3 py-1.5 text-[10px] sm:text-xs font-bold tracking-wide rotate-6"
            >
              SELLING FAST
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
