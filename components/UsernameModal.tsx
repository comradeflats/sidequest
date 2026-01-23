'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, X, Loader2 } from 'lucide-react';

interface UsernameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (displayName: string) => Promise<void>;
  defaultValue?: string;
}

export default function UsernameModal({ isOpen, onClose, onSubmit, defaultValue = '' }: UsernameModalProps) {
  const [displayName, setDisplayName] = useState(defaultValue);

  // Update displayName when defaultValue changes (e.g., Google name loaded)
  useEffect(() => {
    if (defaultValue) {
      setDisplayName(defaultValue);
    }
  }, [defaultValue]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateName = (name: string): string | null => {
    const trimmed = name.trim();
    if (trimmed.length < 3) {
      return 'Name must be at least 3 characters';
    }
    if (trimmed.length > 20) {
      return 'Name must be 20 characters or less';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validateName(displayName);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit(displayName.trim());
      // Don't call onClose() here - parent handles closing after successful save
    } catch (err) {
      setError('Failed to save name. Please try again.');
      console.error('Username submit error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = async () => {
    setIsSubmitting(true);
    try {
      await onSubmit('Anonymous Explorer');
      onClose();
    } catch (err) {
      setError('Failed to save. Please try again.');
      console.error('Username skip error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 max-w-sm mx-auto z-50"
          >
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="relative p-6 pb-4 border-b border-zinc-800">
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 p-1 text-gray-500 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-adventure-emerald/20 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-adventure-emerald" />
                  </div>
                  <h2 className="text-lg font-semibold text-white">
                    Welcome, Explorer!
                  </h2>
                </div>
                <p className="text-sm text-gray-400">
                  What should we call you?
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="p-6">
                <div className="mb-4">
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => {
                      setDisplayName(e.target.value);
                      setError(null);
                    }}
                    placeholder="Enter your explorer name"
                    className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-adventure-emerald/50 focus:border-adventure-emerald transition-colors"
                    maxLength={20}
                    autoFocus
                    disabled={isSubmitting}
                  />
                  <div className="flex justify-between mt-2">
                    <span className={`text-xs ${error ? 'text-red-400' : 'text-gray-500'}`}>
                      {error || '3-20 characters'}
                    </span>
                    <span className="text-xs text-gray-500">
                      {displayName.length}/20
                    </span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleSkip}
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2.5 text-sm text-gray-400 hover:text-white border border-zinc-700 hover:border-zinc-600 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Skip
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || displayName.trim().length < 3}
                    className="flex-1 px-4 py-2.5 text-sm font-medium text-black bg-adventure-emerald hover:bg-adventure-emerald/90 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Let's Go!"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
