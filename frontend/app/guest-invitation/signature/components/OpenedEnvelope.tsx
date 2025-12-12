"use client";

import { motion } from "framer-motion";
import Image from "next/image";

export default function OpenedEnvelope() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{
        duration: 0.8,
        ease: "easeOut",
        type: "spring",
        stiffness: 200,
        damping: 25,
      }}
      className="relative mb-16"
    >
      {/* Opened Envelope Image */}
      <div className="relative w-[330px] h-[300px] mx-auto  md:w-[500px] md:h-[375px] ">
        <Image
          src="/opened.png"
          alt="Opened Envelope"
          fill
          className="object-contain drop-shadow-2xl"
          priority
        />

        {/* Opening Animation Glow */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="absolute inset-0 bg-gradient-to-b from-yellow-300/10 to-transparent rounded-2xl"
        />
      </div>

      {/* Seal Breaking Animation */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Breaking Seal Pieces */}
        {[...Array(4)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-6 h-6"
            initial={{
              x: "50%",
              y: "50%",
              scale: 1,
              rotate: 0,
              opacity: 1,
            }}
            animate={{
              x: `${Math.random() * 200 - 100 + 50}%`,
              y: `${Math.random() * 200 - 150}%`,
              scale: 0,
              rotate: 360,
              opacity: 0,
            }}
            transition={{
              duration: 1,
              delay: i * 0.1,
              ease: "easeOut",
            }}
          >
            <div
              className="w-full h-full bg-gradient-to-br from-yellow-400 to-yellow-600 
              rounded-full shadow-lg"
            />
          </motion.div>
        ))}

        {/* Gold Dust Particles */}
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={`dust-${i}`}
            className="absolute w-1 h-1 bg-yellow-400/70 rounded-full"
            initial={{
              x: "50%",
              y: "50%",
              opacity: 1,
              scale: 1,
            }}
            animate={{
              x: `${Math.random() * 300 - 150 + 50}%`,
              y: `${Math.random() * 200 - 100 + 50}%`,
              opacity: 0,
              scale: 0,
            }}
            transition={{
              duration: 1.5,
              delay: 0.3 + i * 0.05,
              ease: "easeOut",
            }}
          />
        ))}
      </div>

      {/* Arrow Indicating Content Below */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1, duration: 0.5 }}
        className="absolute -bottom-12 left-1/2 transform -translate-x-1/2 text-center"
      >
        <motion.div
          animate={{
            y: [0, 8, 0],
            opacity: [0.6, 1, 0.6],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <div className="text-4xl text-yellow-400 mb-2">↓</div>
          <p className="text-yellow-200/70 text-sm font-light tracking-wide">
            Your invitation awaits below
          </p>
        </motion.div>
      </motion.div>

      {/* Glow Effect Around Envelope */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 0.3, scale: 1 }}
        transition={{ delay: 0.5, duration: 0.5 }}
        className="absolute -inset-8 bg-gradient-to-r from-yellow-900/20 via-transparent to-yellow-900/20 
          blur-2xl -z-10"
      />
    </motion.div>
  );
}
