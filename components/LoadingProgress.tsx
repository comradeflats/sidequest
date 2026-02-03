'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Compass, Zap, Map, Sparkles, CheckCircle } from 'lucide-react';

// Default rotating messages for quest generation
const DEFAULT_ROTATING_MESSAGES = [
  "SCOUTING THE AREA...",
  "PLANNING YOUR ADVENTURE...",
  "DISCOVERING HIDDEN SPOTS...",
  "CHARTING YOUR COURSE...",
  "CONSULTING ANCIENT MAPS...",
  "FINDING LEGENDARY LOCATIONS...",
  "PREPARING YOUR JOURNEY...",
  "AWAKENING ANCIENT SPIRITS...",
  "DECODING MYSTERIOUS RUNES...",
  "SUMMONING LOCAL LEGENDS...",
  "WEAVING YOUR DESTINY...",
  "UNLOCKING SECRET PATHS..."
];

interface LoadingProgressProps {
  message: string;
  progress?: number; // 0-100, undefined = indeterminate
  subMessage?: string;
  rotatingMessages?: string[]; // Optional array of messages to rotate through
  progressText?: string; // Optional progress text like "Generating images... (2/3)"
  hint?: string; // Optional small hint text below rotating messages (deprecated, use trivia)
  trivia?: string[]; // NEW - array of trivia facts to display with animations
  showGame?: boolean; // Show memory game during loading
  campaignReady?: boolean; // Campaign is ready, show button
  onStartAdventure?: () => void; // Callback when user clicks "Start Adventure"
}

const LOGO_ICONS = [MapPin, Compass, Zap, Map, Sparkles];

export default function LoadingProgress({
  message,
  progress,
  subMessage,
  rotatingMessages,
  progressText,
  hint,
  trivia,
  showGame = false,
  campaignReady = false,
  onStartAdventure
}: LoadingProgressProps) {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [iconIndex, setIconIndex] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentTriviaIndex, setCurrentTriviaIndex] = useState(0);

  const messages = rotatingMessages || DEFAULT_ROTATING_MESSAGES;
  const displayMessage = rotatingMessages ? messages[currentMessageIndex] : message;

  // Debug: Log when trivia updates
  useEffect(() => {
    if (trivia && trivia.length > 0) {
      console.log('[LoadingProgress] Trivia received:', trivia.length, 'facts');
    }
  }, [trivia]);

  // Track elapsed time for duration-adaptive messaging
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Determine current rotation speed tier based on elapsed time
  // Only changes at specific thresholds to avoid constant re-renders
  const getRotationSpeed = () => {
    if (elapsedTime < 30) return 4000; // 0-30s: Standard (4s)
    if (elapsedTime < 60) return 6000; // 30-60s: Slower (6s)
    return 8000; // 60s+: Even slower (8s)
  };

  const rotationSpeed = getRotationSpeed();

  // Rotate through messages with adaptive speed
  useEffect(() => {
    // When rotatingMessages is provided, always rotate
    // When not provided, only rotate if message contains "GENERATING"
    const shouldRotate = rotatingMessages || message.includes("GENERATING");

    if (!shouldRotate) {
      return;
    }

    const messageInterval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % messages.length);
    }, rotationSpeed);

    const iconInterval = setInterval(() => {
      setIconIndex((prev) => (prev + 1) % LOGO_ICONS.length);
    }, 2500);

    return () => {
      clearInterval(messageInterval);
      clearInterval(iconInterval);
    };
  }, [rotatingMessages, message, messages.length, rotationSpeed]);

  // Rotate through trivia facts
  useEffect(() => {
    if (!trivia || trivia.length === 0) return;

    const triviaInterval = setInterval(() => {
      setCurrentTriviaIndex((prev) => (prev + 1) % trivia.length);
    }, 6000); // Change fact every 6 seconds

    return () => clearInterval(triviaInterval);
  }, [trivia]);

  const IconComponent = LOGO_ICONS[iconIndex];

  // Show "Campaign Ready" screen when ready
  if (campaignReady) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 p-8">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
        >
          <CheckCircle className="w-24 h-24 text-emerald-400" />
        </motion.div>

        <div className="text-center space-y-2">
          <h2 className="text-3xl font-bold text-emerald-400 font-pixel">
            YOUR QUEST IS READY!
          </h2>
          <p className="text-gray-400 text-sm font-sans">
            Your adventure awaits
          </p>
        </div>

        <motion.button
          onClick={onStartAdventure}
          className="px-8 py-4 bg-gradient-to-r from-emerald-500 to-gold-500
                     hover:from-emerald-600 hover:to-gold-600
                     rounded-lg font-bold text-xl shadow-lg
                     transition-all font-pixel"
          style={{ fontSize: '1rem' }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          START ADVENTURE →
        </motion.button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-6 p-8">
      {/* Alternating pixel art icon with glow effect */}
      <motion.div
        animate={{
          y: [0, -8, 0]
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

      {/* Loading message and progress */}
      <>
          {/* Loading message with fade transition */}
          <div className="flex flex-col items-center gap-2">
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

            {/* Trivia or hint text below rotating messages */}
            {trivia && trivia.length > 0 ? (
              <div className="min-h-[3rem] flex items-center justify-center w-full max-w-md px-4">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={currentTriviaIndex}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.8, ease: "easeInOut" }}
                    className="text-sm text-gray-300 font-sans text-center italic leading-relaxed"
                  >
                    💡 {trivia[currentTriviaIndex]}
                  </motion.p>
                </AnimatePresence>
              </div>
            ) : hint ? (
              <p className="text-xs text-gray-500 font-sans text-center">
                {hint}
              </p>
            ) : null}
          </div>

          {/* Progress bar */}
          <div className="w-full max-w-md h-3 bg-zinc-900 rounded-full overflow-hidden border-2 border-adventure-gold/30">
            {showGame ? (
              // Time-based progress for campaign generation
              <motion.div
                className="h-full bg-gradient-to-r from-emerald-500 to-gold-500"
                style={{ width: `${Math.min((elapsedTime / 50) * 100, 100)}%` }}
                transition={{
                  duration: 0.3,
                  ease: "easeOut"
                }}
              />
            ) : progress !== undefined ? (
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

          {/* Progress text (priority) or Sub message */}
          {showGame ? (
            <p className="text-xs text-gray-500 text-center font-sans">
              Estimated wait time is 50 seconds or less
            </p>
          ) : progressText ? (
            <p className="text-sm text-adventure-emerald font-sans text-center font-semibold">
              {progressText}
            </p>
          ) : subMessage ? (
            <p className="text-sm text-gray-500 font-sans text-center">
              {subMessage}
            </p>
          ) : null}

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
        </>
    </div>
  );
}
