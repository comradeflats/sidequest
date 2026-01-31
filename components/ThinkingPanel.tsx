'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, CheckCircle, XCircle, Brain, MapPin } from 'lucide-react';
import { ThinkingStep } from '@/types';

interface ThinkingPanelProps {
  thinking: ThinkingStep[];
  overallConfidence: number;
  distanceFromTarget?: number;
  success: boolean;
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 80) return 'text-adventure-emerald';
  if (confidence >= 60) return 'text-yellow-400';
  if (confidence >= 40) return 'text-orange-400';
  return 'text-red-400';
}

function getConfidenceBarColor(confidence: number): string {
  if (confidence >= 80) return 'bg-adventure-emerald';
  if (confidence >= 60) return 'bg-yellow-400';
  if (confidence >= 40) return 'bg-orange-400';
  return 'bg-red-400';
}

function getGpsLabel(distance: number): { text: string; color: string } {
  if (distance <= 15) return { text: 'Excellent', color: 'text-adventure-emerald' };
  if (distance <= 30) return { text: 'Good', color: 'text-adventure-emerald' };
  if (distance <= 50) return { text: 'Fair', color: 'text-yellow-400' };
  if (distance <= 100) return { text: 'Distant', color: 'text-orange-400' };
  return { text: 'Far', color: 'text-red-400' };
}

export default function ThinkingPanel({
  thinking,
  overallConfidence,
  distanceFromTarget,
  success
}: ThinkingPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!thinking || thinking.length === 0) return null;

  const passedCount = thinking.filter(t => t.passed).length;
  const gpsInfo = distanceFromTarget !== undefined ? getGpsLabel(distanceFromTarget) : null;

  return (
    <div className="mt-4 text-left">
      {/* Toggle Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-lg hover:bg-zinc-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-adventure-sky" />
          <span className="text-sm font-sans text-gray-300">
            How I verified this
          </span>
          <span className="text-xs text-gray-500">
            ({passedCount}/{thinking.length} criteria)
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-mono ${getConfidenceColor(overallConfidence)}`}>
            {overallConfidence}%
          </span>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded Panel */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-2 bg-zinc-900 border border-zinc-700 rounded-lg overflow-hidden">
              {/* Header */}
              <div className="px-4 py-3 bg-zinc-800/50 border-b border-zinc-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Brain className="w-4 h-4 text-adventure-sky" />
                    <span className="text-xs font-pixel text-adventure-sky">AI REASONING</span>
                  </div>
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.3, delay: 0.2 }}
                    className="flex items-center gap-1.5 px-2 py-1 bg-adventure-emerald/10 border border-adventure-emerald/30 rounded"
                  >
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                      className="w-2 h-2 rounded-full bg-adventure-emerald"
                    />
                    <span className="text-[10px] font-sans text-adventure-emerald font-medium">
                      Extended Reasoning
                    </span>
                  </motion.div>
                </div>
              </div>

              {/* Thinking Steps */}
              <div className="divide-y divide-zinc-800">
                {thinking.map((step, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="px-4 py-3"
                  >
                    {/* Criterion Header */}
                    <div className="flex items-start gap-2 mb-2">
                      {step.passed ? (
                        <CheckCircle className="w-4 h-4 text-adventure-emerald flex-shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                      )}
                      <span className="text-sm font-sans text-white">
                        {step.criterion}
                      </span>
                    </div>

                    {/* Observation */}
                    <p className="text-xs text-gray-400 font-sans italic ml-6 mb-2 break-words">
                      &ldquo;{step.observation}&rdquo;
                    </p>

                    {/* Confidence Bar */}
                    <div className="ml-6 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${step.confidence}%` }}
                          transition={{ duration: 0.5, delay: index * 0.1 }}
                          className={`h-full ${getConfidenceBarColor(step.confidence)} rounded-full`}
                        />
                      </div>
                      <span className={`text-xs font-mono ${getConfidenceColor(step.confidence)}`}>
                        {step.confidence}%
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* GPS Info */}
              {gpsInfo && distanceFromTarget !== undefined && (
                <div className="px-4 py-3 bg-zinc-800/30 border-t border-zinc-700">
                  <div className="flex items-center gap-2">
                    <MapPin className={`w-4 h-4 ${gpsInfo.color}`} />
                    <span className="text-xs font-sans text-gray-400">
                      GPS: {distanceFromTarget.toFixed(0)}m from target
                    </span>
                    <span className={`text-xs font-sans ${gpsInfo.color}`}>
                      ({gpsInfo.text})
                    </span>
                  </div>
                </div>
              )}

              {/* Overall Confidence Footer */}
              <div className={`px-4 py-3 border-t border-zinc-700 ${success ? 'bg-adventure-emerald/10' : 'bg-red-500/10'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-pixel text-gray-400 min-w-0 truncate">
                    OVERALL CONFIDENCE
                  </span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="w-20 h-2 bg-zinc-700 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${overallConfidence}%` }}
                        transition={{ duration: 0.6 }}
                        className={`h-full ${getConfidenceBarColor(overallConfidence)} rounded-full`}
                      />
                    </div>
                    <span className={`text-sm font-mono font-bold ${getConfidenceColor(overallConfidence)}`}>
                      {overallConfidence}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
