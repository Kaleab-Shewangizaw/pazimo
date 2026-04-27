"use client";

import { motion } from "framer-motion";
import { Building2, Music, PartyPopper } from "lucide-react";

const eventTypes = [
  {
    icon: Building2,
    title: "Corporate Events",
    description:
      "Conferences, summits, product launches, and team-building events with professional-grade tools.",
    tag: "Professional",
  },
  {
    icon: Music,
    title: "Nightlife",
    description:
      "Club nights, DJ sets, exclusive parties - manage guest lists and VIP access effortlessly.",
    tag: "Entertainment",
  },
  {
    icon: PartyPopper,
    title: "Festivals",
    description:
      "Multi-day festivals with complex ticketing tiers, vendor management, and crowd logistics.",
    tag: "Large Scale",
  },
];

const EventTypesSection = () => {
  return (
    <section id="about" className="bg-[hsl(var(--surface))] py-24 md:py-32">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16 text-center"
        >
          <span className="text-sm font-medium uppercase tracking-widest text-accent">Flexibility</span>
          <h2 className="mt-3 text-3xl font-display font-bold md:text-5xl">
            Built for <span className="text-gradient-gold">Every Occasion</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Whether it&apos;s a 50-person boardroom or a 50,000-person arena, Pazimo adapts to your vision.
          </p>
        </motion.div>

        <div className="grid gap-8 md:grid-cols-3">
          {eventTypes.map((type, i) => (
            <motion.div
              key={type.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.15 }}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card p-10 transition-all duration-500 hover:border-accent/40"
            >
              <div className="absolute right-0 top-0 rounded-bl-xl bg-accent/10 px-4 py-2 text-xs font-medium uppercase tracking-wider text-accent">
                {type.tag}
              </div>
              <type.icon className="mb-6 h-10 w-10 text-primary" />
              <h3 className="mb-4 text-2xl font-display font-bold">{type.title}</h3>
              <p className="leading-relaxed text-muted-foreground">{type.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default EventTypesSection;
