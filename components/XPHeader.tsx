'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Sparkles, ChevronDown } from 'lucide-react';
import { PlayerProgress, LEVEL_THRESHOLDS } from '@/types';
import { getPlayerProgress, getXPForNextLevel } from '@/lib/storage';

interface XPHeaderProps {
  onXPGain?: { amount: number; timestamp: number } | null;
}

export default function XPHeader({ onXPGain }: XPHeaderProps) {
  const [progress, setProgress] = useState<PlayerProgress>({ totalXP: 0, level: 1, questsCompleted: 0 });
  const [xpInfo, setXpInfo] = useState({ current: 0, needed: 100, progress: 0 });
  const [showXPGain, setShowXPGain] = useState(false);
  const [gainAmount, setGainAmount] = useState(0);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [previousLevel, setPreviousLevel] = useState(1);
  const [isCollapsed, setIsCollapsed] = useState(true);

  // Load progress on mount
  useEffect(() => {
    const loadProgress = () => {
      const playerProgress = getPlayerProgress();
      setProgress(playerProgress);
      setXpInfo(getXPForNextLevel(playerProgress.totalXP));
      setPreviousLevel(playerProgress.level);
    };
    loadProgress();
  }, []);

  // Handle XP gain animation - responds to prop changes
  useEffect(() => {
    if (onXPGain && onXPGain.amount > 0) {
      setGainAmount(onXPGain.amount);
      setShowXPGain(true);

      // Reload progress after a small delay to get updated values
      setTimeout(() => {
        const newProgress = getPlayerProgress();
        const newXpInfo = getXPForNextLevel(newProgress.totalXP);

        // Check for level up
        if (newProgress.level > previousLevel) {
          setShowLevelUp(true);
          setTimeout(() => setShowLevelUp(false), 2500);
        }

        setProgress(newProgress);
        setXpInfo(newXpInfo);
        setPreviousLevel(newProgress.level);
      }, 100);

      // Hide XP gain animation
      setTimeout(() => setShowXPGain(false), 2000);
    }
  }, [onXPGain, previousLevel]);

  const isMaxLevel = progress.level >= LEVEL_THRESHOLDS.length;
  const progressPercent = isMaxLevel ? 100 : xpInfo.progress;

  // SVG circle parameters
  const circleSize = 56;
  const strokeWidth = 4;
  const radius = (circleSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  return (
    <div className="relative">
      {/* Level Up Animation - Shows below for fixed corner position */}
      <AnimatePresence>
        {showLevelUp && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: -20 }}
            className="absolute top-full left-0 mt-2 bg-adventure-gold text-black px-4 py-2 rounded-lg font-pixel text-sm whitespace-nowrap shadow-lg z-50"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              LEVEL UP!
              <Sparkles className="w-4 h-4" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {isCollapsed ? (
          /* Collapsed Circle View */
          <motion.div
            key="collapsed"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="relative cursor-pointer"
            onClick={() => setIsCollapsed(false)}
          >
            {/* XP Gain Animation - Floats to the right of circle */}
            <AnimatePresence>
              {showXPGain && (
                <motion.div
                  initial={{ opacity: 0, x: 0 }}
                  animate={{ opacity: 1, x: 10 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="absolute top-1/2 -translate-y-1/2 left-full ml-2 text-adventure-emerald font-bold text-sm whitespace-nowrap z-10"
                >
                  +{gainAmount} XP
                </motion.div>
              )}
            </AnimatePresence>

            {/* Circle with SVG Progress Ring */}
            <div className="relative" style={{ width: circleSize, height: circleSize }}>
              <svg
                className="absolute inset-0 -rotate-90"
                width={circleSize}
                height={circleSize}
              >
                {/* Background circle */}
                <circle
                  cx={circleSize / 2}
                  cy={circleSize / 2}
                  r={radius}
                  fill="transparent"
                  stroke="rgba(39, 39, 42, 1)"
                  strokeWidth={strokeWidth}
                />
                {/* Progress circle */}
                <motion.circle
                  cx={circleSize / 2}
                  cy={circleSize / 2}
                  r={radius}
                  fill="transparent"
                  stroke="url(#goldGradient)"
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  initial={{ strokeDashoffset: circumference }}
                  animate={{ strokeDashoffset }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
                <defs>
                  <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#D4AF37" />
                    <stop offset="50%" stopColor="#FACC15" />
                    <stop offset="100%" stopColor="#D4AF37" />
                  </linearGradient>
                </defs>
              </svg>

              {/* Center content - Level number */}
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 rounded-full border border-adventure-gold/30">
                <span className="text-[10px] text-gray-500 uppercase leading-none">LV</span>
                <span className="text-xl font-bold text-adventure-gold leading-none">
                  {progress.level}
                </span>
              </div>
            </div>
          </motion.div>
        ) : (
          /* Expanded Card View */
          <motion.div
            key="expanded"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="bg-black/90 backdrop-blur-md border border-adventure-gold/30 rounded-lg p-3 min-w-[140px] shadow-lg"
          >
            {/* Level Badge */}
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-adventure-gold/20 rounded-full">
                <Star className="w-4 h-4 text-adventure-gold fill-adventure-gold" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">Level</span>
                <span className="text-xl font-bold text-adventure-gold leading-none">
                  {progress.level}
                </span>
              </div>

              {/* Collapse Button */}
              <button
                onClick={() => setIsCollapsed(true)}
                className="ml-auto p-1 hover:bg-zinc-800 rounded transition-colors"
              >
                <ChevronDown className="w-4 h-4 text-gray-500" />
              </button>

              {/* XP Gain Animation */}
              <AnimatePresence>
                {showXPGain && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, x: 10 }}
                    animate={{ opacity: 1, y: -5, x: 20 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="absolute top-2 right-2 text-adventure-emerald font-bold text-sm"
                  >
                    +{gainAmount} XP
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* XP Progress Bar */}
            <div className="space-y-1">
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden border border-adventure-gold/20">
                <motion.div
                  className="h-full bg-gradient-to-r from-adventure-gold via-yellow-400 to-adventure-gold"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              </div>
              <div className="flex justify-between text-[9px] font-mono text-gray-500">
                <span>{progress.totalXP} XP</span>
                {!isMaxLevel && (
                  <span>{xpInfo.current}/{xpInfo.needed}</span>
                )}
                {isMaxLevel && (
                  <span className="text-adventure-gold">MAX</span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
