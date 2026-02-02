'use client';

import { useEffect, useState } from 'react';
import { generationTracker, GenerationStats, GenerationStep } from '@/lib/generation-tracker';
import { Bug, X, Trash2, Copy, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DebugPanelProps {
  isGenerating: boolean;
}

export default function DebugPanel({ isGenerating }: DebugPanelProps) {
  const [stats, setStats] = useState<GenerationStats | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const unsubscribe = generationTracker.subscribe((newStats) => {
      setStats(newStats);
    });
    return unsubscribe;
  }, []);

  // Auto-expand panel when generation starts
  useEffect(() => {
    if (isGenerating && !isExpanded) {
      setIsExpanded(true);
    }
  }, [isGenerating, isExpanded]);

  const handleCopyLogs = () => {
    const success = generationTracker.copyLogsToClipboard();
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClear = () => {
    generationTracker.clear();
    setExpandedSteps(new Set());
  };

  const toggleStepExpansion = (stepNumber: number) => {
    setExpandedSteps(prev => {
      const newSet = new Set(prev);
      if (newSet.has(stepNumber)) {
        newSet.delete(stepNumber);
      } else {
        newSet.add(stepNumber);
      }
      return newSet;
    });
  };

  const getStepIcon = (step: GenerationStep) => {
    switch (step.status) {
      case 'complete':
        return '✓';
      case 'error':
        return '✗';
      case 'running':
        return '⏳';
      default:
        return '○';
    }
  };

  const getStepColor = (step: GenerationStep) => {
    switch (step.status) {
      case 'complete':
        return 'text-emerald-400';
      case 'error':
        return 'text-red-400';
      case 'running':
        return 'text-yellow-400';
      default:
        return 'text-zinc-600';
    }
  };

  const formatDuration = (ms: number | undefined) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  // Calculate total cost and tokens from completed steps
  const totalCost = stats?.steps.reduce((sum, step) => sum + (step.details?.cost || 0), 0) || 0;
  const totalTokens = stats?.steps.reduce((sum, step) => sum + (step.details?.tokenCount || 0), 0) || 0;
  const totalDuration = stats?.totalDuration || (stats?.startTime ? Date.now() - stats.startTime : 0);

  // Check if debug panel should be shown (dev mode or localStorage flag)
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isDev = process.env.NODE_ENV === 'development';
      const localStorageFlag = localStorage.getItem('ENABLE_DEBUG_PANEL') === 'true';
      setShowDebug(isDev || localStorageFlag);
    }
  }, []);

  if (!showDebug) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 font-mono text-xs">
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="absolute bottom-12 left-0 bg-black/95 backdrop-blur-md border border-purple-700 rounded-lg p-3 w-80 text-white shadow-2xl max-h-[70vh] overflow-y-auto"
          >
            <div className="space-y-3">
              {/* Header */}
              <div className="flex items-center justify-between mb-2 pb-2 border-b border-purple-900">
                <div className="flex items-center gap-2">
                  <Bug className="w-4 h-4 text-purple-400" />
                  <span className="text-[10px] text-purple-400 uppercase tracking-wider font-bold">
                    Debug Panel
                  </span>
                </div>
                <button
                  onClick={() => setIsExpanded(false)}
                  className="text-zinc-500 hover:text-white transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              {stats ? (
                <>
                  {/* Summary Stats */}
                  <div className="bg-purple-950/30 rounded p-2 space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-zinc-400">⏱️ Duration:</span>
                      <span className="text-white font-medium">{formatDuration(totalDuration)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-zinc-400">💰 Cost:</span>
                      <span className="text-emerald-400">${totalCost.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-zinc-400">📊 Tokens:</span>
                      <span className="text-blue-400">{totalTokens.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-zinc-400">📱 Device:</span>
                      <span className="text-zinc-300">{stats.deviceInfo.isMobile ? 'Mobile' : 'Desktop'}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-zinc-400">📡 Network:</span>
                      <span className="text-zinc-300">{stats.deviceInfo.connection || 'unknown'}</span>
                    </div>
                  </div>

                  {/* Step Breakdown */}
                  <div>
                    <div className="text-[10px] text-purple-400 uppercase tracking-wider mb-2">
                      Step Breakdown
                    </div>
                    <div className="space-y-1">
                      {stats.steps.map((step) => (
                        <div key={step.stepNumber} className="bg-zinc-900/50 rounded">
                          <button
                            onClick={() => toggleStepExpansion(step.stepNumber)}
                            className="w-full flex items-center justify-between p-2 hover:bg-zinc-800/50 transition-colors text-left"
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className={`${getStepColor(step)} flex-shrink-0`}>
                                {getStepIcon(step)}
                              </span>
                              <span className="text-[10px] text-zinc-300 truncate">
                                {step.stepNumber}. {step.stepName}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-[10px] text-zinc-500">
                                {formatDuration(step.duration)}
                              </span>
                              {step.details && (
                                expandedSteps.has(step.stepNumber) ? (
                                  <ChevronDown className="w-3 h-3 text-zinc-500" />
                                ) : (
                                  <ChevronRight className="w-3 h-3 text-zinc-500" />
                                )
                              )}
                            </div>
                          </button>

                          {/* Expanded Step Details */}
                          {expandedSteps.has(step.stepNumber) && step.details && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="px-2 pb-2 space-y-0.5 border-t border-zinc-800"
                            >
                              {step.details.apiCalls && (
                                <div className="flex justify-between text-[10px]">
                                  <span className="text-zinc-500">API Calls:</span>
                                  <span className="text-zinc-400">{step.details.apiCalls}</span>
                                </div>
                              )}
                              {step.details.tokenCount && (
                                <div className="flex justify-between text-[10px]">
                                  <span className="text-zinc-500">Tokens:</span>
                                  <span className="text-blue-400">{step.details.tokenCount.toLocaleString()}</span>
                                </div>
                              )}
                              {step.details.cost && (
                                <div className="flex justify-between text-[10px]">
                                  <span className="text-zinc-500">Cost:</span>
                                  <span className="text-emerald-400">${step.details.cost.toFixed(4)}</span>
                                </div>
                              )}
                              {step.details.imageCount && (
                                <div className="flex justify-between text-[10px]">
                                  <span className="text-zinc-500">Images:</span>
                                  <span className="text-zinc-400">{step.details.imageCount}</span>
                                </div>
                              )}
                            </motion.div>
                          )}

                          {/* Error Message */}
                          {step.errorMessage && (
                            <div className="px-2 pb-2 text-[10px] text-red-400 border-t border-zinc-800">
                              {step.errorMessage}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2 border-t border-purple-900">
                    <button
                      onClick={handleCopyLogs}
                      className="flex-1 text-[10px] text-purple-400 hover:text-purple-300 flex items-center justify-center gap-1.5 py-2 border border-purple-800 rounded hover:border-purple-600 transition-colors"
                    >
                      {copied ? (
                        <>
                          <Check size={10} /> Copied!
                        </>
                      ) : (
                        <>
                          <Copy size={10} /> Copy Log
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleClear}
                      className="flex-1 text-[10px] text-zinc-500 hover:text-zinc-300 flex items-center justify-center gap-1.5 py-2 border border-zinc-800 rounded hover:border-zinc-600 transition-colors"
                    >
                      <Trash2 size={10} /> Clear
                    </button>
                  </div>

                  {/* Status Indicator */}
                  <div className="text-center pt-2 border-t border-purple-900">
                    <div className={`text-[10px] font-medium ${
                      stats.status === 'complete' ? 'text-emerald-400' :
                      stats.status === 'error' ? 'text-red-400' :
                      stats.status === 'running' ? 'text-yellow-400' :
                      'text-zinc-500'
                    }`}>
                      {stats.status === 'complete' ? '✓ Generation Complete' :
                       stats.status === 'error' ? '✗ Generation Failed' :
                       stats.status === 'running' ? '⏳ Generation In Progress...' :
                       'Idle'}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-zinc-500 text-[11px]">
                  No generation data yet.
                  <br />
                  Start a campaign to see debug info.
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapsed Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`p-2 backdrop-blur-sm border rounded-full transition-all shadow-lg ${
          isGenerating
            ? 'bg-purple-900/80 border-purple-600 text-purple-400 animate-pulse'
            : stats
            ? 'bg-purple-900/60 border-purple-700 text-purple-400 hover:border-purple-500'
            : 'bg-zinc-900/80 border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600'
        }`}
        title="Debug Panel"
      >
        <Bug size={14} />
      </button>

      {/* Active Generation Indicator */}
      {isGenerating && !isExpanded && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute -top-1 -right-1 w-2 h-2 bg-purple-500 rounded-full"
        >
          <span className="absolute inset-0 w-2 h-2 bg-purple-500 rounded-full animate-ping" />
        </motion.div>
      )}
    </div>
  );
}
