"use client";

import { motion } from "framer-motion";
import Image from "next/image";

const partners = [
  { name: "Partner 1", logo: "/IMG_9715.PNG" },
  { name: "Partner 2", logo: "/IMG_9716.PNG" },
  { name: "Partner 3", logo: "/IMG_9717.PNG" },
  { name: "Partner 4", logo: "/IMG_9718.PNG" },
  { name: "Partner 5", logo: "/IMG_9719.PNG" },
  { name: "Partner 6", logo: "/IMG_9720.PNG" },
  { name: "Partner 7", logo: "/IMG_9721.PNG" },
  { name: "Partner 8", logo: "/IMG_9722.PNG" },
  { name: "Partner 9", logo: "/IMG_9723.PNG" },
  { name: "Partner 10", logo: "/IMG_9724.PNG" },
  { name: "Partner 11", logo: "/IMG_9725.PNG" },
  { name: "Partner 12", logo: "/IMG_9726.PNG" },
];

// Duplicate partners for seamless looping
const duplicatedPartners = [...partners, ...partners];

const PartnersSection = () => {
  return (
    <section className="relative overflow-hidden border-y border-border bg-[hsl(var(--surface))] py-20">
      <div className="container mx-auto px-4">
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-12 text-center text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground/60"
        >
          Trusted By Industry Leaders
        </motion.p>
      </div>

      <div className="relative flex overflow-hidden">
        {/* Gradients to fade edges */}
        <div className="pointer-events-none absolute left-0 z-10 h-full w-20 bg-gradient-to-r from-[hsl(var(--surface))] to-transparent md:w-40" />
        <div className="pointer-events-none absolute right-0 z-10 h-full w-20 bg-gradient-to-l from-[hsl(var(--surface))] to-transparent md:w-40" />

        <motion.div
          className="flex gap-12 md:gap-24"
          animate={{
            x: ["0%", "-50%"],
          }}
          transition={{
            duration: 30,
            ease: "linear",
            repeat: Infinity,
          }}
        >
          {duplicatedPartners.map((partner, i) => (
            <div
              key={`${partner.name}-${i}`}
              className="flex w-20 items-center justify-center transition-all duration-300 md:w-28"
            >
              <Image
                src={partner.logo}
                alt={partner.name}
                width={120}
                height={60}
                className="h-auto w-full object-contain transition-opacity"
              />
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default PartnersSection;

