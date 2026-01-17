'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Sparkles } from 'lucide-react';
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

  return (
    <div className="fixed top-4 left-4 z-40">
      {/* Level Up Animation */}
      <AnimatePresence>
        {showLevelUp && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: -20 }}
            className="absolute -top-2 left-1/2 -translate-x-1/2 bg-adventure-gold text-black px-4 py-2 rounded-lg font-pixel text-sm whitespace-nowrap shadow-lg z-50"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              LEVEL UP!
              <Sparkles className="w-4 h-4" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* XP Header Card */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="bg-black/90 backdrop-blur-md border border-adventure-gold/30 rounded-lg p-3 min-w-[140px] shadow-lg"
      >
        {/* Level Badge */}
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 bg-adventure-gold/20 rounded-full">
            <Star className="w-4 h-4 text-adventure-gold fill-adventure-gold" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider">Level</span>
            <span className="font-pixel text-adventure-gold text-lg leading-none">
              {progress.level}
            </span>
          </div>

          {/* XP Gain Animation */}
          <AnimatePresence>
            {showXPGain && (
              <motion.div
                initial={{ opacity: 0, y: 10, x: 10 }}
                animate={{ opacity: 1, y: -5, x: 20 }}
                exit={{ opacity: 0, y: -20 }}
                className="absolute top-2 right-2 text-adventure-emerald font-pixel text-sm"
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
              animate={{ width: `${isMaxLevel ? 100 : xpInfo.progress}%` }}
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
    </div>
  );
}
