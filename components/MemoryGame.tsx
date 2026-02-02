'use client';

import { useState, useEffect } from 'react';
import { MapPin, Search, Star, Target } from 'lucide-react';
import { motion } from 'framer-motion';

interface MemoryGameProps {
  isActive: boolean;
  onComplete?: () => void;
}

// Quest-themed icons with colors
const GAME_ICONS = [
  { icon: MapPin, color: '#10b981', name: 'map' },      // Emerald
  { icon: Search, color: '#fbbf24', name: 'search' },   // Gold
  { icon: Star, color: '#3b82f6', name: 'star' },       // Blue
  { icon: Target, color: '#ef4444', name: 'target' }    // Red
];

export function MemoryGame({ isActive, onComplete }: MemoryGameProps) {
  const [sequence, setSequence] = useState<number[]>([]);
  const [userInput, setUserInput] = useState<number[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isUserTurn, setIsUserTurn] = useState(false);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState<number | null>(null);

  // Start new round
  const startRound = () => {
    const nextSequence = [...sequence, Math.floor(Math.random() * 4)];
    setSequence(nextSequence);
    setUserInput([]);
    setIsPlaying(true);
    setIsUserTurn(false);
    playSequence(nextSequence);
  };

  // Play the sequence for user to memorize
  const playSequence = async (seq: number[]) => {
    for (let i = 0; i < seq.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 600));
      setHighlightIndex(seq[i]);
      await new Promise(resolve => setTimeout(resolve, 400));
      setHighlightIndex(null);
    }
    setIsUserTurn(true);
  };

  // Handle user symbol tap
  const handleSymbolClick = (index: number) => {
    if (!isUserTurn || gameOver) return;

    const newUserInput = [...userInput, index];
    setUserInput(newUserInput);

    // Check if correct
    if (newUserInput[newUserInput.length - 1] !== sequence[newUserInput.length - 1]) {
      // Wrong! Game over
      setGameOver(true);
      setIsUserTurn(false);
      return;
    }

    // Check if sequence complete
    if (newUserInput.length === sequence.length) {
      setScore(score + 1);
      setIsUserTurn(false);
      setTimeout(() => startRound(), 1000);
    }
  };

  // Start first round on mount
  useEffect(() => {
    if (isActive && sequence.length === 0) {
      setTimeout(() => startRound(), 500);
    }
  }, [isActive]);

  if (!isActive) return null;

  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-6">
      {/* Title */}
      <div className="text-center">
        <h3 className="text-2xl font-bold text-emerald-400 mb-2">
          Quest Memory Challenge
        </h3>
        <p className="text-gray-300 text-sm">
          {isUserTurn ? 'Repeat the pattern!' : 'Watch carefully...'}
        </p>
      </div>

      {/* Score */}
      <motion.div
        key={score}
        initial={{ scale: 1 }}
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 0.3 }}
        className="text-4xl font-bold text-gold-400"
        style={{ color: '#fbbf24' }}
      >
        {score}
      </motion.div>

      {/* Game Grid */}
      <div className="grid grid-cols-2 gap-4">
        {GAME_ICONS.map((iconData, index) => {
          const IconComponent = iconData.icon;
          const isHighlighted = highlightIndex === index;
          const isClickable = isUserTurn && !gameOver;

          return (
            <motion.button
              key={index}
              onClick={() => handleSymbolClick(index)}
              disabled={!isClickable}
              className={`
                w-24 h-24 rounded-lg flex items-center justify-center
                transition-all duration-200
                ${isClickable ? 'cursor-pointer hover:scale-105' : 'cursor-default'}
                ${gameOver ? 'opacity-50' : 'opacity-100'}
              `}
              style={{
                backgroundColor: isHighlighted ? iconData.color : `${iconData.color}80`,
                border: `3px solid ${iconData.color}`,
              }}
              animate={{
                scale: isHighlighted ? 1.1 : 1,
                filter: isHighlighted ? 'brightness(1.5)' : 'brightness(1)',
              }}
              whileHover={isClickable ? { scale: 1.05 } : {}}
              whileTap={isClickable ? { scale: 0.95 } : {}}
            >
              <IconComponent
                size={48}
                color="white"
              />
            </motion.button>
          );
        })}
      </div>

      {/* Game Over / Restart */}
      {gameOver && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => {
            setSequence([]);
            setUserInput([]);
            setScore(0);
            setGameOver(false);
            setTimeout(() => startRound(), 100);
          }}
          className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 rounded-lg font-semibold transition-colors"
        >
          Try Again
        </motion.button>
      )}

      {/* Instructions */}
      {!isPlaying && !gameOver && (
        <p className="text-gray-400 text-sm text-center max-w-xs">
          Watch the pattern, then tap the icons in the same order. Each round adds one more!
        </p>
      )}
    </div>
  );
}
