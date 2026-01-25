'use client';

import { DistanceRange, DISTANCE_RANGES } from '@/types';
import { Footprints, Navigation, Map, LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { UnitSystem, formatDistanceRange } from '@/lib/units';

interface Props {
  selectedRange: DistanceRange | null;
  onSelect: (range: DistanceRange) => void;
  unitSystem: UnitSystem;
}

// Icons for each distance range
const ICONS: Record<DistanceRange, LucideIcon> = {
  local: Footprints,   // Walking icon for local strolls
  nearby: Navigation,  // Navigation for nearby walks
  far: Map,           // Map for far distances
};

export default function DistanceRangeSelector({ selectedRange, onSelect, unitSystem }: Props) {
  return (
    <div className="space-y-3">
      <label className="block text-xs font-pixel text-adventure-gold">
        RANGE
      </label>
      <div className="grid grid-cols-3 gap-3">
        {Object.values(DISTANCE_RANGES).map((config) => {
          const Icon = ICONS[config.range];
          const isSelected = selectedRange === config.range;

          return (
            <motion.button
              key={config.range}
              type="button"
              onClick={() => onSelect(config.range)}
              whileHover={{ scale: isSelected ? 1 : 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`
                relative p-4 rounded-xl transition-all
                ${
                  isSelected
                    ? 'bg-adventure-gold/20 border-2 border-adventure-gold'
                    : 'bg-zinc-900 border-2 border-adventure-brown hover:border-adventure-emerald'
                }
              `}
            >
              {/* Icon */}
              <Icon
                className={`w-8 h-8 mx-auto mb-2 ${
                  isSelected ? 'text-adventure-gold' : 'text-adventure-emerald'
                }`}
              />

              {/* Label */}
              <div className={`text-xs font-bold mb-1 font-pixel ${
                isSelected ? 'text-adventure-gold' : 'text-emerald-400'
              }`}>
                {config.label}
              </div>

              {/* Distance range */}
              <div className="text-xs text-gray-400 font-sans">
                {formatDistanceRange(config.minDistance, config.maxDistance, unitSystem)}
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
