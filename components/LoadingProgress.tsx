'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Compass, Zap, Map, Sparkles } from 'lucide-react';

// Default rotating messages for quest generation
const DEFAULT_ROTATING_MESSAGES = [
  "SCOUTING THE AREA...",
  "PLANNING YOUR ADVENTURE...",
  "DISCOVERING HIDDEN SPOTS...",
  "CHARTING YOUR COURSE...",
  "CONSULTING ANCIENT MAPS...",
  "FINDING LEGENDARY LOCATIONS...",
  "PREPARING YOUR JOURNEY..."
];

interface LoadingProgressProps {
  message: string;
  progress?: number; // 0-100, undefined = indeterminate
  subMessage?: string;
  rotatingMessages?: string[]; // Optional array of messages to rotate through
}

const LOGO_ICONS = [MapPin, Compass, Zap, Map, Sparkles];

export default function LoadingProgress({
  message,
  progress,
  subMessage,
  rotatingMessages
}: LoadingProgressProps) {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [iconIndex, setIconIndex] = useState(0);

  const messages = rotatingMessages || DEFAULT_ROTATING_MESSAGES;
  const displayMessage = rotatingMessages ? messages[currentMessageIndex] : message;

  // Rotate through messages every 2.5 seconds
  useEffect(() => {
    if (!rotatingMessages && !message.includes("GENERATING")) {
      // Don't rotate if not using rotating messages and not generating
      return;
    }

    const messageInterval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % messages.length);
    }, 2500);

    const iconInterval = setInterval(() => {
      setIconIndex((prev) => (prev + 1) % LOGO_ICONS.length);
    }, 1500);

    return () => {
      clearInterval(messageInterval);
      clearInterval(iconInterval);
    };
  }, [rotatingMessages, message, messages.length]);

  const IconComponent = LOGO_ICONS[iconIndex];

  return (
    <div className="flex flex-col items-center justify-center gap-6 p-8">
      {/* Alternating pixel art icon with glow effect */}
      <motion.div
        animate={{
          scale: [1, 1.15, 1],
          rotate: [0, 8, -8, 0]
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="text-adventure-gold drop-shadow-[0_0_15px_rgba(251,191,36,0.5)]"
      >
        <IconComponent className="w-16 h-16" />
      </motion.div>

      {/* Loading message with fade transition */}
      <motion.p
        key={displayMessage}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3 }}
        className="text-lg font-pixel text-adventure-gold text-center min-h-[2rem]"
      >
        {displayMessage}
      </motion.p>

      {/* Progress bar */}
      <div className="w-full max-w-md h-3 bg-zinc-900 rounded-full overflow-hidden border-2 border-adventure-gold/30">
        {progress !== undefined ? (
          // Determinate progress
          <motion.div
            className="h-full bg-gradient-to-r from-adventure-gold via-yellow-400 to-adventure-gold transition-all duration-300"
            style={{ width: `${progress}%` }}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
          />
        ) : (
          // Indeterminate progress
          <motion.div
            className="h-full bg-gradient-to-r from-transparent via-adventure-gold to-transparent"
            animate={{
              x: ['-100%', '200%']
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            style={{ width: '50%' }}
          />
        )}
      </div>

      {/* Sub message */}
      {subMessage && (
        <p className="text-sm text-gray-500 font-sans text-center">
          {subMessage}
        </p>
      )}

      {/* Pixel dots animation */}
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 bg-adventure-emerald rounded-sm"
            animate={{
              opacity: [0.3, 1, 0.3],
              scale: [0.8, 1.2, 0.8]
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              delay: i * 0.2,
              ease: "easeInOut"
            }}
          />
        ))}
      </div>
    </div>
  );
}
