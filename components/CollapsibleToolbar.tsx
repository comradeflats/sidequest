'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutGrid, X, BookOpen } from 'lucide-react';
import XPHeader from './XPHeader';
import AuthButton from './AuthButton';
import { Campaign } from '@/types';

interface CollapsibleToolbarProps {
  campaign: Campaign | null;
  onXPGain?: { amount: number; timestamp: number } | null;
  onOpenQuestBook: () => void;
}

export default function CollapsibleToolbar({
  campaign,
  onXPGain,
  onOpenQuestBook,
}: CollapsibleToolbarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const autoCollapseTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-collapse after 5 seconds of inactivity
  useEffect(() => {
    if (isExpanded) {
      autoCollapseTimerRef.current = setTimeout(() => {
        setIsExpanded(false);
      }, 5000);
    }

    return () => {
      if (autoCollapseTimerRef.current) {
        clearTimeout(autoCollapseTimerRef.current);
      }
    };
  }, [isExpanded]);

  // Reset timer on interaction
  const resetAutoCollapseTimer = () => {
    if (autoCollapseTimerRef.current) {
      clearTimeout(autoCollapseTimerRef.current);
    }
    autoCollapseTimerRef.current = setTimeout(() => {
      setIsExpanded(false);
    }, 5000);
  };

  // Close on tap outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
      }
    };

    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExpanded]);

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
  };

  const handleQuestBookClick = () => {
    resetAutoCollapseTimer();
    onOpenQuestBook();
  };

  return (
    <div ref={toolbarRef} className="relative">
      <AnimatePresence mode="wait">
        {!isExpanded ? (
          // Collapsed state - single grid icon
          <motion.button
            key="collapsed"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            onClick={handleToggle}
            className="w-10 h-10 bg-black/90 rounded-full border border-adventure-gold/30 shadow-lg hover:border-adventure-gold hover:bg-black transition-colors flex items-center justify-center"
            aria-label="Open toolbar"
          >
            <LayoutGrid className="w-5 h-5 text-adventure-gold" />
          </motion.button>
        ) : (
          // Expanded state - horizontal icon row
          <motion.div
            key="expanded"
            initial={{ opacity: 0, width: 40 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 40 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="flex items-center gap-2 bg-black/90 rounded-full border border-adventure-gold/30 shadow-lg px-2 py-1"
          >
            {/* XP Circle - only show when campaign active */}
            {campaign && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.05 }}
                onClick={resetAutoCollapseTimer}
              >
                <XPHeader onXPGain={onXPGain} />
              </motion.div>
            )}

            {/* Quest Book Button - only show when campaign active */}
            {campaign && (
              <motion.button
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
                onClick={handleQuestBookClick}
                className="w-10 h-10 bg-black/50 rounded-full border border-adventure-gold/20 hover:border-adventure-gold hover:bg-black/80 transition-colors flex items-center justify-center"
                aria-label="Open Quest Book"
              >
                <BookOpen className="w-5 h-5 text-adventure-gold" />
              </motion.button>
            )}

            {/* Auth Button */}
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: campaign ? 0.15 : 0.05 }}
              onClick={resetAutoCollapseTimer}
            >
              <AuthButton compact />
            </motion.div>

            {/* Collapse Button */}
            <motion.button
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: campaign ? 0.2 : 0.1 }}
              onClick={handleToggle}
              className="w-8 h-8 rounded-full hover:bg-white/10 transition-colors flex items-center justify-center"
              aria-label="Collapse toolbar"
            >
              <X className="w-4 h-4 text-gray-400" />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
