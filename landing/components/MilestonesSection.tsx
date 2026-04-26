"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

const milestones = [
  { value: 25000, suffix: "+", label: "Tickets Sold" },
  { value: 40, suffix: "+", label: "Event Organizers" },
  { value: 100, suffix: "+", label: "Events Managed" },
  { value: 100, suffix: "%", label: "Satisfaction Rate" },
];

function useCountUp(target: number, inView: boolean) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView) return;

    const duration = 2000;
    const steps = 60;
    const increment = target / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [target, inView]);

  return count;
}

function formatNumber(n: number) {
  if (n >= 1000) return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + "K";
  return n.toString();
}

const StatCard = ({
  value,
  suffix,
  label,
  delay,
}: {
  value: number;
  suffix: string;
  label: string;
  delay: number;
}) => {
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const count = useCountUp(value, inView);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setInView(true);
      },
      { threshold: 0.5 }
    );

    if (ref.current) observer.observe(ref.current);

    return () => observer.disconnect();
  }, []);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      className="p-8 text-center"
    >
      <div className="text-4xl font-display font-bold text-gradient-gold md:text-5xl">
        {formatNumber(count)}
        {suffix}
      </div>
      <p className="mt-2 text-lg text-muted-foreground">{label}</p>
    </motion.div>
  );
};

const MilestonesSection = () => {
  return (
    <section className="py-24 md:py-32">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-12 text-center"
        >
          <span className="text-sm font-medium uppercase tracking-widest text-primary">Milestones</span>
          <h2 className="mt-3 text-3xl font-display font-bold md:text-5xl">
            Numbers That <span className="text-gradient-gold">Speak</span>
          </h2>
        </motion.div>

        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-4 lg:grid-cols-4">
          {milestones.map((m, i) => (
            <StatCard key={m.label} {...m} delay={i * 0.1} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default MilestonesSection;
