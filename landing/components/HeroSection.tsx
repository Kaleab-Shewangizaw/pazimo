"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Ticket, Mail, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";

const HeroSection = () => {
  return (
    <section className="relative flex min-h-screen items-center overflow-hidden bg-primary/90">
      <div className="absolute inset-0">
        <img src="/images/hero-event.jpg" alt="Event atmosphere" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/80 to-primary/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-transparent to-primary/30" />
      </div>

      <div className="container relative z-10 mx-auto px-4 py-32">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-3xl"
        >
          <div className="mb-6 flex items-center gap-2">
            <span className="h-px w-8 bg-accent" />
            <span className="text-sm font-medium uppercase tracking-widest text-accent">
              Event Management Redefined
            </span>
          </div>

          <h1 className="mb-6 text-5xl font-display font-bold leading-[1.05] text-white md:text-7xl">
            Your Events, <span className="text-gradient-gold">Perfected</span>
            <br />
            With Pazimo.
          </h1>

          <p className="mb-10 max-w-xl text-lg leading-relaxed text-white/80 md:text-xl">
            From intimate corporate gatherings to massive festivals - our flexible platform handles ticketing,
            invitations, and everything in between.
          </p>

          <div className="mb-16 flex flex-col gap-4 sm:flex-row">
            <Button asChild size="lg" className="px-8 text-base font-semibold">
              <Link href="/organizer-registration">
                Create Your Event
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="border-accent bg-accent text-base text-accent-foreground shadow-accent-btn transition-shadow hover:bg-accent/90"
            >
              <a href="#features">Explore Features</a>
            </Button>
          </div>

          <div className="flex gap-8 md:gap-12">
            {[
              { icon: Ticket, label: "Smart Ticketing" },
              { icon: Mail, label: "Invitation Campaigns" },
              { icon: Globe, label: "Public & Private" },
            ].map(({ icon: Icon, label }) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="flex items-center gap-2 text-sm text-white/80"
              >
                <Icon className="h-4 w-4 text-accent" />
                <span>{label}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
