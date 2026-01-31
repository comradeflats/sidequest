'use client';

import { useEffect, useState } from 'react';
import { costEstimator } from '@/lib/cost-estimator';
import { Wrench, X, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function CostIndicator() {
  const [cost, setCost] = useState(0);
  const [breakdown, setBreakdown] = useState<{
    maps: number;
    gemini: number;
    total: number;
    cacheHits?: number;
    cacheMisses?: number;
    cacheSavings?: number;
    cacheHitRate?: number;
  }>({
    maps: 0,
    gemini: 0,
    total: 0,
    cacheHits: 0,
    cacheMisses: 0,
    cacheSavings: 0,
    cacheHitRate: 0
  });
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const unsubscribe = costEstimator.subscribe((newCost, newBreakdown) => {
      setCost(newCost);
      setBreakdown(newBreakdown);
    });
    return unsubscribe;
  }, []);

  const hasCacheData = (breakdown.cacheHits || 0) + (breakdown.cacheMisses || 0) > 0;

  return (
    <div className="fixed bottom-4 right-4 z-50 font-mono text-xs">
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute bottom-12 right-0 bg-black/90 backdrop-blur-md border border-zinc-700 rounded-lg p-3 w-44 text-white shadow-xl"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-zinc-400 uppercase tracking-wider">Dev Costs</span>
                <button
                  onClick={() => setIsExpanded(false)}
                  className="text-zinc-500 hover:text-white"
                >
                  <X size={12} />
                </button>
              </div>

              {/* Gemini 3 Prompt Caching Stats */}
              {hasCacheData && (
                <div className="pb-2 mb-2 border-b border-zinc-800">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-purple-400 uppercase tracking-wider">Cache Stats</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-zinc-500">Hit Rate:</span>
                    <span className="text-purple-400 font-medium">{breakdown.cacheHitRate?.toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-zinc-500">Saved:</span>
                    <span className="text-emerald-400">${breakdown.cacheSavings?.toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-zinc-600 mt-0.5">
                    <span>Hits/Misses:</span>
                    <span>{breakdown.cacheHits}/{breakdown.cacheMisses}</span>
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center text-[11px]">
                <span className="text-zinc-500">Gemini:</span>
                <span className="text-emerald-400">${breakdown.gemini.toFixed(4)}</span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-zinc-500">Maps:</span>
                <span className="text-blue-400">${breakdown.maps.toFixed(4)}</span>
              </div>
              <div className="flex justify-between items-center text-[11px] pt-1 border-t border-zinc-800">
                <span className="text-zinc-400">Total:</span>
                <span className="text-white font-medium">${cost.toFixed(4)}</span>
              </div>
              {hasCacheData && (
                <div className="flex justify-between items-center text-[10px] text-emerald-500/70">
                  <span>Without cache:</span>
                  <span>${(cost + (breakdown.cacheSavings || 0)).toFixed(4)}</span>
                </div>
              )}
              <button
                onClick={() => costEstimator.reset()}
                className="w-full mt-2 text-[10px] text-zinc-500 hover:text-zinc-300 flex items-center justify-center gap-1 py-1 border border-zinc-800 rounded hover:border-zinc-600 transition-colors"
              >
                <RotateCcw size={10} /> Reset
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-2 bg-zinc-900/80 backdrop-blur-sm border border-zinc-800 rounded-full text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition-colors shadow-lg"
        title="Dev tools"
      >
        <Wrench size={14} />
      </button>
    </div>
  );
}
