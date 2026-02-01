'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Sparkles, Image, Map, BookOpen, Lightbulb, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

interface TokenBreakdown {
  total: number;
  baseText: number;
  images: number;
  journey: number;
  research: number;
  reasoning: number;
}

interface ContextWindowIndicatorProps {
  tokenCount: number;
  questCount: number;
  breakdown?: TokenBreakdown;
}

const MAX_TOKENS = 1000000; // Gemini 3's 1M token context window
const MILESTONE_50K = 50000;
const MILESTONE_100K = 100000;

export default function ContextWindowIndicator({
  tokenCount,
  questCount,
  breakdown
}: ContextWindowIndicatorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const percentage = (tokenCount / MAX_TOKENS) * 100;
  const formattedTokens = tokenCount >= 1000
    ? `${(tokenCount / 1000).toFixed(1)}K`
    : tokenCount.toString();

  // Check for milestone achievements
  const hit50K = tokenCount >= MILESTONE_50K;
  const hit100K = tokenCount >= MILESTONE_100K;
  const showMilestone = hit50K;

  if (questCount === 0) {
    return null;
  }

  // Calculate richness score (0-100 based on context diversity)
  const richnessScore = breakdown ? Math.min(100, Math.round(
    (breakdown.images > 0 ? 25 : 0) +
    (breakdown.journey > 0 ? 25 : 0) +
    (breakdown.research > 0 ? 25 : 0) +
    (breakdown.reasoning > 0 ? 25 : 0)
  )) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative"
    >
      {/* Main indicator bar */}
      <motion.div
        className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-purple-900/20 to-blue-900/20 border border-purple-500/30 rounded-full cursor-pointer hover:bg-purple-900/30 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <div className="flex items-center gap-1.5">
          <motion.div
            animate={{
              rotate: [0, 10, -10, 0],
              scale: [1, 1.1, 1.1, 1]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            <Brain className="w-3.5 h-3.5 text-purple-400" />
          </motion.div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-pixel text-purple-300 leading-none">
                CONTEXT
              </span>
              <Sparkles className="w-2.5 h-2.5 text-purple-400" />
            </div>
            <span className="text-[9px] font-mono text-purple-400/70 leading-none mt-0.5">
              {formattedTokens} / 1M
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-16 h-1 bg-purple-900/30 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(percentage, 100)}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full"
          />
        </div>

        {/* Quest count badge */}
        <div className="px-1.5 py-0.5 bg-purple-500/20 border border-purple-500/30 rounded">
          <span className="text-[9px] font-mono text-purple-300">
            {questCount}Q
          </span>
        </div>

        {/* Milestone badge */}
        {showMilestone && (
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            className="px-1.5 py-0.5 bg-yellow-500/20 border border-yellow-500/50 rounded"
          >
            <span className="text-[9px] font-mono text-yellow-300">
              {hit100K ? '100K!' : '50K!'}
            </span>
          </motion.div>
        )}

        {/* Expand/collapse icon */}
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-3 h-3 text-purple-400" />
        </motion.div>
      </motion.div>

      {/* Breakdown panel - Glass morphism dropdown */}
      <AnimatePresence>
        {isExpanded && breakdown && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full left-0 mt-2 min-w-[280px] z-50 px-4 py-3 bg-black/95 backdrop-blur-md border border-purple-500/20 rounded-xl shadow-2xl"
          >
            <div className="flex flex-col gap-2">
              <div className="text-[10px] font-pixel text-purple-300 mb-0.5 uppercase tracking-wider">
                CONTEXT BREAKDOWN
              </div>

              {/* Images */}
              {breakdown.images > 0 && (
                <div className="flex items-center justify-between py-1 px-2 rounded bg-pink-500/5 hover:bg-pink-500/10 transition-colors">
                  <div className="flex items-center gap-2">
                    <Image className="w-3.5 h-3.5 text-pink-400" />
                    <span className="text-[10px] text-pink-200 font-sans">Quest Images</span>
                  </div>
                  <span className="text-[10px] font-mono text-pink-400 font-semibold">
                    {(breakdown.images / 1000).toFixed(1)}K
                  </span>
                </div>
              )}

              {/* Journey */}
              {breakdown.journey > 0 && (
                <div className="flex items-center justify-between py-1 px-2 rounded bg-green-500/5 hover:bg-green-500/10 transition-colors">
                  <div className="flex items-center gap-2">
                    <Map className="w-3.5 h-3.5 text-green-400" />
                    <span className="text-[10px] text-green-200 font-sans">Journey Analytics</span>
                  </div>
                  <span className="text-[10px] font-mono text-green-400 font-semibold">
                    {(breakdown.journey / 1000).toFixed(1)}K
                  </span>
                </div>
              )}

              {/* Research */}
              {breakdown.research > 0 && (
                <div className="flex items-center justify-between py-1 px-2 rounded bg-orange-500/5 hover:bg-orange-500/10 transition-colors">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-3.5 h-3.5 text-orange-400" />
                    <span className="text-[10px] text-orange-200 font-sans">Location Research</span>
                  </div>
                  <span className="text-[10px] font-mono text-orange-400 font-semibold">
                    {(breakdown.research / 1000).toFixed(1)}K
                  </span>
                </div>
              )}

              {/* Reasoning */}
              {breakdown.reasoning > 0 && (
                <div className="flex items-center justify-between py-1 px-2 rounded bg-yellow-500/5 hover:bg-yellow-500/10 transition-colors">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="w-3.5 h-3.5 text-yellow-400" />
                    <span className="text-[10px] text-yellow-200 font-sans">Campaign Reasoning</span>
                  </div>
                  <span className="text-[10px] font-mono text-yellow-400 font-semibold">
                    {(breakdown.reasoning / 1000).toFixed(1)}K
                  </span>
                </div>
              )}

              {/* Richness score */}
              <div className="mt-2 pt-2 border-t border-purple-500/30">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-purple-200 font-sans">Context Richness</span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-purple-900/40 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${richnessScore}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                        className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 rounded-full"
                      />
                    </div>
                    <span className="text-[10px] font-mono text-purple-300 font-semibold min-w-[32px] text-right">
                      {richnessScore}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
