'use client';

import { motion } from 'framer-motion';
import { MapPin, Compass, Zap } from 'lucide-react';

interface LoadingProgressProps {
  message: string;
  progress?: number; // 0-100, undefined = indeterminate
  subMessage?: string;
}

const LOGO_ICONS = [MapPin, Compass, Zap];

export default function LoadingProgress({
  message,
  progress,
  subMessage
}: LoadingProgressProps) {
  // Cycle through icons for animation
  const IconComponent = LOGO_ICONS[Math.floor(Date.now() / 1000) % LOGO_ICONS.length];

  return (
    <div className="flex flex-col items-center justify-center gap-6 p-8">
      {/* Alternating pixel art icon */}
      <motion.div
        animate={{
          scale: [1, 1.1, 1],
          rotate: [0, 5, -5, 0]
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="text-adventure-gold"
      >
        <IconComponent className="w-12 h-12" />
      </motion.div>

      {/* Loading message */}
      <p className="text-lg font-pixel text-adventure-gold text-center">
        {message}
      </p>

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
