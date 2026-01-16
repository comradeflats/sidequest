'use client';

import { useEffect, useState } from 'react';
import { costEstimator } from '@/lib/cost-estimator';
import { Code, ChevronUp, ChevronDown, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function CostIndicator() {
  const [cost, setCost] = useState(0);
  const [breakdown, setBreakdown] = useState({ maps: 0, gemini: 0, total: 0 });
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const unsubscribe = costEstimator.subscribe((newCost, newBreakdown) => {
      setCost(newCost);
      setBreakdown(newBreakdown);
    });
    return unsubscribe;
  }, []);

  if (cost === 0 && !isExpanded) {
    // Optional: Hide if 0, or show minimal
    // return null; 
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 font-mono text-xs">
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: 10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: 10, height: 0 }}
            className="bg-black/80 backdrop-blur-md border border-purple-500/30 rounded-t-lg p-3 w-48 text-white mb-[-1px]"
          >
            <div className="space-y-2">
              <div className="text-[10px] text-orange-400 font-bold uppercase tracking-wider mb-2">
                API Costs (Dev Only)
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Gemini AI:</span>
                <span className="text-emerald-400">${breakdown.gemini.toFixed(4)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Maps API:</span>
                <span className="text-blue-400">${breakdown.maps.toFixed(4)}</span>
              </div>
              <div className="pt-2 border-t border-purple-500/20 flex justify-between">
                 <button
                   onClick={() => costEstimator.reset()}
                   className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1"
                 >
                   <RotateCcw size={10} /> Reset
                 </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`flex items-center gap-2 px-3 py-2 bg-black/90 backdrop-blur-md border border-purple-500/30 text-white shadow-lg transition-all ${isExpanded ? 'rounded-b-lg rounded-t-none' : 'rounded-full hover:bg-black/70'}`}
        title="API costs (dev only)"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <div className="p-1 bg-purple-500/20 rounded-full">
          <Code size={14} className="text-purple-400" />
        </div>
        <div className="flex flex-col items-start leading-none">
          <span className="text-[10px] text-orange-400 uppercase tracking-wider font-bold">DEV</span>
          <span className="font-bold text-purple-400">${cost.toFixed(4)}</span>
        </div>
        {isExpanded ? <ChevronDown size={14} className="text-gray-500" /> : <ChevronUp size={14} className="text-gray-500" />}
      </motion.button>
    </div>
  );
}
