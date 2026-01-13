'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, MapPin, AlertCircle, Send } from 'lucide-react';
import { Coordinates } from '@/types';

interface AppealDialogProps {
  onSubmit: (explanation: string) => void;
  onCancel: () => void;
  distanceFromTarget: number | null; // meters
  userGps: Coordinates | null;
  gpsAccuracy: number | null; // meters
  isSubmitting?: boolean;
}

export default function AppealDialog({
  onSubmit,
  onCancel,
  distanceFromTarget,
  userGps,
  gpsAccuracy,
  isSubmitting = false
}: AppealDialogProps) {
  const [explanation, setExplanation] = useState('');

  const handleSubmit = () => {
    if (explanation.trim()) {
      onSubmit(explanation);
    }
  };

  // Determine GPS status display
  const getGpsStatus = () => {
    if (!userGps || distanceFromTarget === null) {
      return {
        color: 'text-gray-500',
        icon: AlertCircle,
        text: 'GPS unavailable',
        helpful: false
      };
    }

    if (distanceFromTarget <= 30) {
      return {
        color: 'text-adventure-emerald',
        icon: MapPin,
        text: `${distanceFromTarget.toFixed(0)}m from target`,
        helpful: true,
        subtext: 'GPS will help your appeal!'
      };
    } else if (distanceFromTarget <= 100) {
      return {
        color: 'text-yellow-500',
        icon: MapPin,
        text: `${distanceFromTarget.toFixed(0)}m from target`,
        helpful: true,
        subtext: 'GPS may help'
      };
    } else {
      return {
        color: 'text-red-400',
        icon: AlertCircle,
        text: `${distanceFromTarget.toFixed(0)}m from target`,
        helpful: false,
        subtext: 'Too far for GPS assist'
      };
    }
  };

  const gpsStatus = getGpsStatus();
  const GpsIcon = gpsStatus.icon;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-zinc-900 border-2 border-adventure-gold rounded-lg p-6 max-w-md w-full space-y-4"
      >
        {/* Header */}
        <div className="flex items-start gap-3">
          <MessageSquare className="w-6 h-6 text-adventure-gold flex-shrink-0 mt-1" />
          <div>
            <h2 className="text-xl font-pixel text-adventure-gold" style={{ fontSize: '1rem' }}>
              APPEAL VERIFICATION
            </h2>
            <p className="text-sm text-gray-400 font-sans mt-1">
              Explain what you found. The AI will reconsider.
            </p>
          </div>
        </div>

        {/* GPS Status Card */}
        <div className={`bg-black/30 border-2 ${
          gpsStatus.helpful ? 'border-adventure-emerald' : 'border-gray-700'
        } rounded-lg p-3 flex items-center gap-3`}>
          <GpsIcon className={`w-5 h-5 ${gpsStatus.color}`} />
          <div className="flex-1">
            <p className={`text-sm font-sans ${gpsStatus.color}`}>
              {gpsStatus.text}
            </p>
            {gpsStatus.subtext && (
              <p className="text-xs text-gray-500 mt-0.5">
                {gpsStatus.subtext}
              </p>
            )}
            {gpsAccuracy && (
              <p className="text-xs text-gray-600 mt-0.5">
                Accuracy: ±{gpsAccuracy.toFixed(0)}m
              </p>
            )}
          </div>
        </div>

        {/* Text Input */}
        <div className="space-y-2">
          <label className="block text-xs font-pixel text-adventure-gold">
            YOUR_EXPLANATION
          </label>
          <textarea
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            placeholder="e.g., 'The lifeguard station here is green and yellow, not blue and yellow'"
            className="w-full bg-black border-2 border-adventure-brown rounded-lg p-3 min-h-[100px] focus:outline-none focus:border-adventure-emerald transition-colors placeholder:text-zinc-700 font-sans text-white resize-none"
            autoFocus
            disabled={isSubmitting}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1 border-2 border-gray-600 text-gray-400 font-pixel py-3 rounded-lg hover:bg-gray-600/10 transition-colors disabled:opacity-50"
            style={{ fontSize: '0.85rem' }}
          >
            CANCEL
          </button>
          <button
            onClick={handleSubmit}
            disabled={!explanation.trim() || isSubmitting}
            className="flex-1 bg-adventure-emerald text-black font-pixel py-3 rounded-lg hover:bg-adventure-gold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ fontSize: '0.85rem' }}
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                SUBMITTING...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                SUBMIT APPEAL
              </>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
