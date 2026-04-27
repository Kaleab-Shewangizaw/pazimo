"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const CTASection = () => {
  return (
    <section className="py-24 md:py-32">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="relative overflow-hidden rounded-3xl bg-primary p-12 text-center md:p-20"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-accent/5" />
          <div className="relative z-10">
            <h2 className="mb-5 text-3xl font-display font-bold text-primary-foreground md:text-5xl">
              Ready to Create Your <span className="text-gradient-gold">Next Event</span>?
            </h2>
            <p className="mx-auto mb-10 max-w-xl text-lg text-primary-foreground/70">
              Join thousands of organizers who trust Pazimo to deliver unforgettable experiences. Get started in
              minutes.
            </p>
            <Button
              asChild
              size="lg"
              className="bg-accent px-10 text-base font-semibold text-accent-foreground shadow-accent-btn transition-shadow hover:bg-accent/90"
            >
              <Link href="/organizer-registration">
                Create Your Event Now
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CTASection;
