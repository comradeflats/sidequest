'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { PlayerProgress, LEVEL_THRESHOLDS } from '@/types';
import { getPlayerProgress, getXPForNextLevel } from '@/lib/storage';

interface XPHeaderProps {
  onXPGain?: { amount: number; timestamp: number } | null;
}

// Format XP value for compact display
const formatXP = (xp: number): string => {
  if (xp >= 10000) {
    return `${(xp / 1000).toFixed(0)}K`;
  }
  if (xp >= 1000) {
    return `${(xp / 1000).toFixed(1)}K`;
  }
  return xp.toString();
};

export default function XPHeader({ onXPGain }: XPHeaderProps) {
  const [progress, setProgress] = useState<PlayerProgress>({ totalXP: 0, level: 1, questsCompleted: 0 });
  const [xpInfo, setXpInfo] = useState({ current: 0, needed: 100, progress: 0 });
  const [showXPGain, setShowXPGain] = useState(false);
  const [gainAmount, setGainAmount] = useState(0);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [previousLevel, setPreviousLevel] = useState(1);

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

  // SVG circle parameters - 40px with 5px stroke
  const circleSize = 40;
  const strokeWidth = 5;
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
            className="absolute top-full left-0 mt-2 bg-adventure-emerald text-black px-4 py-2 rounded-lg font-pixel text-sm whitespace-nowrap shadow-lg z-50"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              LEVEL {progress.level}!
              <Sparkles className="w-4 h-4" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* XP Circle */}
      <div className="relative">
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
            {/* Progress circle - Green gradient */}
            <motion.circle
              cx={circleSize / 2}
              cy={circleSize / 2}
              r={radius}
              fill="transparent"
              stroke="url(#greenGradient)"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
            <defs>
              <linearGradient id="greenGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#22c55e" />
                <stop offset="50%" stopColor="#4ade80" />
                <stop offset="100%" stopColor="#22c55e" />
              </linearGradient>
            </defs>
          </svg>

          {/* Center content - XP value */}
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 rounded-full border border-adventure-emerald/30">
            <span className="text-xs font-bold text-adventure-emerald leading-none">
              {formatXP(progress.totalXP)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
