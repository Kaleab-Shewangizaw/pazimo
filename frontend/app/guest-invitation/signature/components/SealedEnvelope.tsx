"use client";

import { motion } from "framer-motion";
import Image from "next/image";

interface SealedEnvelopeProps {
  onClick: () => void;
  ticketId: string | null;
}

export default function SealedEnvelope({ onClick }: SealedEnvelopeProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 1, ease: "easeOut" }}
      className="flex flex-col items-center mx-10"
    >
      {/* Sealed Envelope Image with Interactive Seal */}
      <div className="relative cursor-pointer group" onClick={onClick}>
        {/* Envelope Image */}
        <motion.div
          animate={{
            y: [0, -5, 0],
            rotate: [0, -0.5, 0.5, 0],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="relative w-[300px] h-[300px] md:w-[500px] md:h-[375px]"
        >
          <Image
            src="/sealed.png"
            alt="Sealed Envelope"
            fill
            className="object-contain drop-shadow-2xl"
            priority
          />

          {/* Interactive Glow Effect */}
          <motion.div
            animate={{
              boxShadow: [
                "0 0 5px rgba(212, 175, 55, 0.3)",
                "0 0 10px rgba(212, 175, 55, 0.6)",
                "0 0 5px rgba(212, 175, 55, 0.3)",
              ],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute inset-0  rounded-2xl pointer-events-none"
          />
        </motion.div>

        {/* Interactive Seal Glow */}
        <motion.div
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 
            w-24 h-24 md:w-32 md:h-32 cursor-pointer group"
        >
          {/* Pulsing Glow Ring */}
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.5, 0.8, 0.5],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute bottom-0 rounded-full border-1 border-yellow-500/30 blur-md"
          />

          {/* Click Instruction */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
            className="absolute -bottom-20 left-2 
              whitespace-nowrap text-center"
          >
            <p
              className="text-yellow-400/20 font-serif text-sm md:text-sm tracking-wider 
              "
            >
              Click to Open
            </p>
            <motion.div
              animate={{
                scaleX: [0.5, 1, 0.5],
                opacity: [0.3, 0.7, 0.3],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="h-px bg-gradient-to-r from-transparent via-green-500 to-transparent 
                mt-2 mx-4"
            />
          </motion.div>
        </motion.div>

        {/* Floating Particles */}
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 bg-yellow-400/50 rounded-full"
              initial={{
                x: "50%",
                y: "50%",
                opacity: 0,
              }}
              animate={{
                x: `${Math.random() * 100 - 50 + 50}%`,
                y: `${Math.random() * 100 - 50 + 50}%`,
                opacity: [0, 0.8, 0],
                scale: [0, 1, 0],
              }}
              transition={{
                duration: 2 + Math.random(),
                delay: i * 0.3,
                repeat: Infinity,
                repeatDelay: Math.random() * 3,
              }}
            />
          ))}
        </div>
      </div>

      {/* Instruction Text */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="mt-12 text-center max-w-md"
      >
        <p className="text-yellow-200/90 font-light text-sm md:text-base tracking-wide">
          Your exclusive invitation awaits inside the envelope
        </p>
      </motion.div>

      {/* Scroll Hint (for mobile) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-8 text-yellow-200/50 text-sm hidden md:block"
      >
        <p>↓ Scroll down after opening ↓</p>
      </motion.div>
    </motion.div>
  );
}
