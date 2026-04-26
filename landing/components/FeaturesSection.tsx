"use client";

import { motion } from "framer-motion";
import { Ticket, Mail, Shield, Zap, BarChart3, Users } from "lucide-react";

const features = [
  {
    icon: Ticket,
    title: "Smart Ticketing",
    description:
      "Flexible ticket types, dynamic pricing, and real-time availability tracking for seamless sales.",
  },
  {
    icon: Mail,
    title: "Invitation Campaigns",
    description:
      "Design and send personalized invitation campaigns with RSVP tracking and automated reminders.",
  },
  {
    icon: Shield,
    title: "Private & Public Events",
    description:
      "Full control over event visibility. Host exclusive private gatherings or open public festivals.",
  },
  {
    icon: Zap,
    title: "Instant Setup",
    description:
      "Launch your event page in minutes with our intuitive builder. No technical skills required.",
  },
  {
    icon: BarChart3,
    title: "Live Analytics",
    description:
      "Track ticket sales, attendee engagement, and campaign performance in real-time dashboards.",
  },
  {
    icon: Users,
    title: "Multi-Event Types",
    description:
      "Corporate conferences, nightlife parties, festivals, and more - one platform fits all.",
  },
];

const FeaturesSection = () => {
  return (
    <section id="features" className="py-24 md:py-32">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16 text-center"
        >
          <span className="text-sm font-medium uppercase tracking-widest text-accent">Features</span>
          <h2 className="mt-3 text-3xl font-display font-bold md:text-5xl">
            Everything You Need to <span className="text-gradient-gold">Succeed</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Pazimo gives organizers the tools to create, manage, and scale events of any size.
          </p>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="group rounded-xl border border-border bg-card p-8 transition-all duration-300 hover:border-accent/30"
            >
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10 transition-colors group-hover:bg-accent/20">
                <feature.icon className="h-6 w-6 text-accent" />
              </div>
              <h3 className="mb-3 text-xl font-display font-semibold">{feature.title}</h3>
              <p className="leading-relaxed text-muted-foreground">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
