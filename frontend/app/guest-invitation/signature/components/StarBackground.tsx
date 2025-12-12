"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";

interface Star {
  id: number;
  x: number;
  y: number;
  size: number;
  brightness: number;
  twinkleSpeed: number;
}

interface ShootingStar {
  id: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  size: number;
  duration: number;
  delay: number;
}

export default function StarBackground() {
  const [stars, setStars] = useState<Star[]>([]);
  const [shootingStars, setShootingStars] = useState<ShootingStar[]>([]);
  const [constellations, setConstellations] = useState<
    Array<{ points: Array<{ x: number; y: number }> }>
  >([]);

  // Generate realistic stars
  const generateStars = useCallback(() => {
    const starCount = 150; // More stars for better effect
    const newStars: Star[] = [];

    for (let i = 0; i < starCount; i++) {
      // Create stars with different characteristics
      const size = Math.random() * 2 + 0.5; // Smaller base size
      const brightness = Math.random() * 0.7 + 0.3; // Varied brightness

      newStars.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size,
        brightness,
        twinkleSpeed: Math.random() * 3 + 2,
      });
    }

    setStars(newStars);
  }, []);

  // Generate shooting stars
  const generateShootingStar = useCallback(() => {
    // Start from random point near top/right
    const startX = Math.random() * 100 + 100;
    const startY = Math.random() * 30;
    const angle = Math.random() * 30 + 45; // Diagonal angle

    // Calculate end point
    const length = Math.random() * 60 + 40;
    const endX = startX - length * Math.cos((angle * Math.PI) / 180);
    const endY = startY + length * Math.sin((angle * Math.PI) / 180);

    const shootingStar: ShootingStar = {
      id: Date.now(),
      startX,
      startY,
      endX,
      endY,
      size: Math.random() * 1.5 + 1,
      duration: Math.random() * 1.5 + 0.8,
      delay: Math.random() * 3,
    };

    setShootingStars((prev) => [...prev, shootingStar]);

    // Remove shooting star after animation
    setTimeout(() => {
      setShootingStars((prev) =>
        prev.filter((star) => star.id !== shootingStar.id)
      );
    }, (shootingStar.duration + shootingStar.delay) * 1000);
  }, []);

  // Generate some constellation patterns
  const generateConstellations = useCallback(() => {
    const newConstellations = [
      {
        points: [
          { x: 20, y: 30 },
          { x: 25, y: 35 },
          { x: 30, y: 30 },
          { x: 35, y: 35 },
          { x: 40, y: 30 },
        ],
      },
      {
        points: [
          { x: 70, y: 20 },
          { x: 75, y: 25 },
          { x: 80, y: 20 },
          { x: 85, y: 25 },
          { x: 90, y: 20 },
        ],
      },
    ];
    setConstellations(newConstellations);
  }, []);

  useEffect(() => {
    generateStars();
    generateConstellations();

    // Generate shooting stars at intervals
    const shootingStarInterval = setInterval(() => {
      if (Math.random() > 0.7) {
        // 30% chance each interval
        generateShootingStar();
      }
    }, 3000);

    // Add initial shooting stars
    const initialTimer = setTimeout(() => {
      generateShootingStar();
      setTimeout(generateShootingStar, 1000);
    }, 1500);

    return () => {
      clearInterval(shootingStarInterval);
      clearTimeout(initialTimer);
    };
  }, [generateStars, generateShootingStar, generateConstellations]);

  return (
    <div className="fixed inset-0 overflow-hidden bg-gradient-to-b from-gray-950 via-black to-gray-950">
      {/* Stars */}
      {stars.map((star) => (
        <motion.div
          key={`star-${star.id}`}
          className="absolute rounded-full bg-yellow-200"
          style={{
            left: `${star.x}vw`,
            top: `${star.y}vh`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            opacity: star.brightness,
            boxShadow: `0 0 ${star.size * 2}px ${
              star.size
            }px rgba(255, 255, 200, 0.3)`,
          }}
          animate={{
            opacity: [
              star.brightness * 0.7,
              star.brightness,
              star.brightness * 0.7,
            ],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: star.twinkleSpeed,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}

      {/* Shooting Stars */}
      {shootingStars.map((shootingStar) => (
        <motion.div
          key={`shooting-${shootingStar.id}`}
          className="absolute"
          initial={{
            x: `${shootingStar.startX}vw`,
            y: `${shootingStar.startY}vh`,
            opacity: 0,
          }}
          animate={{
            x: `${shootingStar.endX}vw`,
            y: `${shootingStar.endY}vh`,
            opacity: [0, 1, 0],
          }}
          transition={{
            duration: shootingStar.duration,
            delay: shootingStar.delay,
            ease: "easeOut",
          }}
        >
          {/* Shooting star body */}
          <div
            className="relative"
            style={{
              width: `${shootingStar.size * 50}px`,
              height: `${shootingStar.size}px`,
              background:
                "linear-gradient(90deg, transparent, rgba(255, 255, 200, 0.9), transparent)",
              transform: "rotate(-45deg)",
            }}
          >
            {/* Glow effect */}
            <div
              className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                width: `${shootingStar.size * 8}px`,
                height: `${shootingStar.size * 8}px`,
                background:
                  "radial-gradient(circle, rgba(255, 255, 200, 0.6) 0%, transparent 70%)",
                filter: "blur(2px)",
              }}
            />
          </div>
        </motion.div>
      ))}

      {/* Constellation Lines */}
      {constellations.map((constellation, constIndex) => (
        <svg
          key={`const-${constIndex}`}
          className="absolute inset-0 w-full h-full pointer-events-none"
        >
          <polyline
            points={constellation.points.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke="rgba(255, 255, 200, 0.1)"
            strokeWidth="0.5"
            strokeDasharray="2,2"
          />
        </svg>
      ))}

      {/* Subtle galaxy/nebula effect */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-gradient-to-r from-purple-900/10 to-transparent blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-gradient-to-l from-blue-900/10 to-transparent blur-3xl" />
      </div>
    </div>
  );
}
