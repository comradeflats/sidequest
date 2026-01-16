'use client';

import { motion } from 'framer-motion';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { Quest } from '@/types';

// Standard Galactic Alphabet mapping (Minecraft/Commander Keen style)
const GALACTIC_ALPHABET: Record<string, string> = {
  a: '\u23C3', b: '\u23DA', c: '\u260A', d: '\u238D', e: '\u27D2', f: '\u238E', g: '\u260C', h: '\u2291', i: '\u27DF', j: '\u27CA',
  k: '\u260D', l: '\u2330', m: '\u22D4', n: '\u22CF', o: '\u235C', p: '\u233F', q: '\u237E', r: '\u2340', s: '\u2307', t: '\u23C1',
  u: '\u238D', v: '\u238D', w: '\u2359', x: '\u2316', y: '\u226C', z: '\u22C9'
};

function toGalactic(text: string): string {
  return text.toLowerCase().split('').map(char => GALACTIC_ALPHABET[char] || char).join('');
}

interface QuestPreviewProps {
  quest: Quest;
  questNumber: number;
  totalQuests: number;
  revealLevel: 'next' | 'hidden'; // 'next' = partially visible, 'hidden' = fully obscured
}

export default function QuestPreview({
  quest,
  questNumber,
  totalQuests,
  revealLevel
}: QuestPreviewProps) {
  const isNextQuest = revealLevel === 'next';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative border-2 rounded-lg overflow-hidden transition-all ${
        isNextQuest
          ? 'border-zinc-700 bg-zinc-900/80'
          : 'border-zinc-800 bg-zinc-950/80'
      }`}
    >
      {/* Quest Image - Blurred */}
      {quest.imageUrl && (
        <div className="relative h-20 overflow-hidden">
          <img
            src={quest.imageUrl}
            alt="Upcoming quest"
            className={`w-full h-full object-cover ${
              isNextQuest ? 'blur-md opacity-50' : 'blur-xl opacity-20'
            }`}
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/50 to-zinc-900" />

          {/* Lock icon overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={`p-3 rounded-full ${
              isNextQuest ? 'bg-zinc-800/80' : 'bg-zinc-900/90'
            }`}>
              <Lock className={`w-6 h-6 ${
                isNextQuest ? 'text-adventure-gold/70' : 'text-zinc-600'
              }`} />
            </div>
          </div>
        </div>
      )}

      {/* Quest Info */}
      <div className="p-4 space-y-2">
        {/* Header with quest number */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isNextQuest ? (
              <Eye className="w-4 h-4 text-adventure-gold/60" />
            ) : (
              <EyeOff className="w-4 h-4 text-zinc-600" />
            )}
            <span className={`text-xs font-pixel ${
              isNextQuest ? 'text-adventure-gold/60' : 'text-zinc-600'
            }`}>
              {isNextQuest ? `QUEST ${questNumber}` : toGalactic(`Quest ${questNumber}`)}
            </span>
          </div>
          <span className={`text-xs font-sans ${
            isNextQuest ? 'text-zinc-500' : 'text-zinc-700'
          }`}>
            {questNumber}/{totalQuests}
          </span>
        </div>

        {/* Quest Title - visible for next, obscured for hidden */}
        <h4 className={`font-pixel text-sm leading-tight ${
          isNextQuest ? 'text-zinc-400' : 'text-zinc-700'
        }`}>
          {isNextQuest ? quest.title : toGalactic(quest.title)}
        </h4>

        {/* Hint text */}
        <p className={`text-xs font-sans ${
          isNextQuest ? 'text-zinc-500' : 'text-zinc-700'
        }`}>
          {isNextQuest
            ? 'Complete current quest to unlock'
            : toGalactic('Complete previous quests')
          }
        </p>

        {/* Distance hint for next quest */}
        {isNextQuest && quest.distanceFromPrevious && (
          <div className="text-xs font-sans text-zinc-600 flex items-center gap-1">
            <span>{quest.distanceFromPrevious.toFixed(1)}km from current</span>
          </div>
        )}
      </div>

      {/* Locked overlay pattern */}
      {!isNextQuest && (
        <div
          className="absolute inset-0 pointer-events-none opacity-10"
          style={{
            backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.3) 10px, rgba(0,0,0,0.3) 20px)'
          }}
        />
      )}
    </motion.div>
  );
}
