"use client";

import { motion } from "framer-motion";
import { Ticket, Mail, Shield, Zap, BarChart3, Users, Sparkles } from "lucide-react";

const features = [
  {
    icon: Ticket,
    title: "Smart Ticketing",
    description: "Flexible tiers, dynamic pricing, and real-time availability.",
  },
  {
    icon: Mail,
    title: "Invitation Campaigns",
    description: "Personalized invites with RSVP tracking and reminders.",
  },
  {
    icon: Shield,
    title: "Private & Public",
    description: "Host exclusive gatherings or open public festivals.",
  },
  {
    icon: Zap,
    title: "Instant Setup",
    description: "Launch your event page in minutes — no tech skills needed.",
  },
  {
    icon: BarChart3,
    title: "Live Analytics",
    description: "Track sales, engagement, and campaigns in real time.",
  },
  {
    icon: Users,
    title: "Any Event Type",
    description: "Corporate, nightlife, festivals — one platform fits all.",
  },
];

const FeaturesSection = () => {
  return (
    <section id="features" className="relative py-20 mx-auto sm:py-24 md:py-32 overflow-hidden">
      {/* Minimal background — same vibe as hero */}
      <div className="absolute  inset-0 -z-10">
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
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-[420px] w-[420px] rounded-full bg-accent/10 blur-3xl" />
      </div>

      <div className="container mx-auto px-5 sm:px-6 lg:px-8">
        {/* Header — mirrors hero */}
        <div className="max-w-3xl mx-auto text-center mb-12 sm:mb-16 md:mb-20">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 mb-6 rounded-full border border-border bg-background/80 backdrop-blur px-3.5 py-1.5 shadow-sm"
          >
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            <span className="text-[11px] sm:text-xs font-medium tracking-wide text-foreground/80">
              Everything in one place
            </span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="text-[2rem] leading-[1.1] sm:text-5xl md:text-6xl font-display font-bold tracking-tight text-foreground"
          >
            Tools that{" "}
            <span className="relative inline-block">
              <span className="relative z-10 text-gradient-navy">just work.</span>
              <span className="absolute left-0 right-0 bottom-1 sm:bottom-2 h-2.5 sm:h-3.5 bg-accent/50 -z-0 rounded-sm" />
            </span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="mt-5 sm:mt-6 text-base sm:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed px-2"
          >
            A clean, focused toolkit for organizers — fast on desktop, beautiful on mobile.
          </motion.p>
        </div>

        {/* Feature list — minimal cards, mobile-first */}
        <div className="relative max-w-5xl mx-auto">
          {/* Soft glass blobs behind grid */}
          <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute -top-16 left-1/4 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute top-1/2 -right-10 h-80 w-80 rounded-full bg-accent/15 blur-3xl" />
            <div className="absolute -bottom-16 left-10 h-72 w-72 rounded-full bg-primary/5 blur-3xl" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                className="group relative rounded-2xl bg-background border border-border shadow-[0_4px_16px_-6px_hsl(var(--navy)/0.12)] hover:border-primary/30 hover:shadow-[0_18px_40px_-18px_hsl(var(--navy)/0.28)] transition-all duration-300 p-5 sm:p-6"
              >
                <div className="flex items-center gap-3 sm:gap-3.5 mb-3">
                  <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-base sm:text-lg font-display font-semibold text-foreground tracking-tight">
                    {feature.title}
                  </h3>
                </div>
                <p className="text-sm sm:text-[15px] text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>

                {/* Number marker — subtle signature */}
                <span className="absolute top-4 right-4 text-[10px] font-mono text-muted-foreground/40 tracking-wider">
                  0{i + 1}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
