"use client";

import { motion } from "framer-motion";
import { Check, Percent, ShieldCheck, Zap } from "lucide-react";

const benefits = [
  "No monthly subscription fees",
  "No setup or onboarding costs",
  "No hidden processing charges",
  "Unlimited events & ticket types",
  "Full analytics dashboard access",
  "Priority organizer support",
];

const PricingSection = () => {
  return (
    <section id="pricing" className="py-24 md:py-32">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16 text-center"
        >
          <span className="text-sm font-medium uppercase tracking-widest text-accent">Pricing</span>
          <h2 className="mt-3 text-3xl font-display font-bold md:text-5xl">
            Simple, <span className="text-gradient-gold">Transparent</span> Pricing
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            No surprises. No hidden fees. Just one straightforward rate.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="mx-auto max-w-lg"
        >
          <div className="relative overflow-hidden rounded-3xl border border-border bg-card">
            <div className="h-1.5 bg-gradient-to-r from-accent via-accent to-primary" />

            <div className="p-10 text-center md:p-14">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-accent/10 px-4 py-1.5 text-sm font-semibold text-accent">
                <Percent className="h-4 w-4" />
                Pay As You Earn
              </div>

              <div className="mb-2">
                <span className="text-6xl font-display font-bold text-foreground md:text-7xl">3%</span>
              </div>
              <p className="mb-8 text-lg text-muted-foreground">of ticket sales. That&apos;s it.</p>

              <div className="mb-10 flex items-center justify-center gap-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  No hidden fees
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Zap className="h-4 w-4 text-primary" />
                  Free for free events
                </div>
              </div>

              <div className="border-t border-border pt-8">
                <p className="mb-5 text-sm font-semibold uppercase tracking-wider text-foreground">Everything included</p>
                <ul className="mx-auto max-w-xs space-y-3 text-left">
                  {benefits.map((benefit) => (
                    <li key={benefit} className="flex items-start gap-3 text-muted-foreground">
                      <Check className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default PricingSection;
