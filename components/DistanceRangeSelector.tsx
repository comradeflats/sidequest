'use client';

import { DistanceRange, DISTANCE_RANGES } from '@/types';
import { Navigation, MapPin, Map } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
  selectedRange: DistanceRange | null;
  onSelect: (range: DistanceRange) => void;
}

// Icons for each distance range
const ICONS: Record<DistanceRange, any> = {
  nearby: MapPin,      // Pin for nearby locations
  medium: Navigation,  // Navigation for medium distances
  far: Map,           // Map for far distances
};

export default function DistanceRangeSelector({ selectedRange, onSelect }: Props) {
  return (
    <div className="space-y-3">
      <label className="block text-xs font-pixel text-adventure-gold">
        SELECT_DISTANCE_RANGE
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
                    ? 'bg-adventure-gold/20 border-3 border-adventure-gold shadow-pixel'
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
                {config.description}
              </div>

              {/* Selection checkmark */}
              {isSelected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-adventure-gold rounded-full flex items-center justify-center border-2 border-black"
                >
                  <span className="text-black text-xs font-bold">✓</span>
                </motion.div>
              )}

              {/* Corner ornaments for selected range */}
              {isSelected && (
                <>
                  <div className="corner-ornament" style={{ top: '-3px', left: '-3px' }} />
                  <div
                    className="corner-ornament"
                    style={{ top: '-3px', right: '-3px', clipPath: 'polygon(0 0, 100% 0, 100% 100%)' }}
                  />
                </>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
