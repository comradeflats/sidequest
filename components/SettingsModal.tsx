'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Ruler } from 'lucide-react';
import { UnitSystem } from '@/lib/units';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  unitSystem: UnitSystem;
  onToggleUnit: () => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
  unitSystem,
  onToggleUnit,
}: SettingsModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-sm mx-auto bg-zinc-900 border-2 border-adventure-gold rounded-lg overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <h2 className="text-lg font-pixel text-adventure-gold">SETTINGS</h2>
              <button
                onClick={onClose}
                className="p-1 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              {/* Unit System Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Ruler className="w-5 h-5 text-adventure-sky" />
                  <div>
                    <p className="text-sm font-medium text-white">Distance Units</p>
                    <p className="text-xs text-gray-500">
                      {unitSystem === 'metric' ? 'Kilometers & meters' : 'Miles & feet'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onToggleUnit}
                  className={`relative w-20 h-8 rounded-full transition-colors ${
                    unitSystem === 'imperial'
                      ? 'bg-adventure-gold'
                      : 'bg-zinc-700'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all shadow-md flex items-center justify-center text-xs font-bold ${
                      unitSystem === 'imperial'
                        ? 'left-[calc(100%-28px)] text-adventure-gold'
                        : 'left-1 text-zinc-700'
                    }`}
                  >
                    {unitSystem === 'metric' ? 'M' : 'I'}
                  </span>
                  <span className={`absolute top-1/2 -translate-y-1/2 text-[10px] font-medium transition-opacity ${
                    unitSystem === 'metric' ? 'right-2 opacity-100 text-gray-400' : 'right-2 opacity-0'
                  }`}>
                    km
                  </span>
                  <span className={`absolute top-1/2 -translate-y-1/2 text-[10px] font-medium transition-opacity ${
                    unitSystem === 'imperial' ? 'left-2 opacity-100 text-black' : 'left-2 opacity-0'
                  }`}>
                    mi
                  </span>
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
