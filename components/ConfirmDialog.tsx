'use client';

import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { useEffect } from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  additionalInfo?: React.ReactNode;
}

export default function ConfirmDialog({
  isOpen,
  onConfirm,
  onCancel,
  title,
  message,
  confirmText = 'CONFIRM',
  cancelText = 'CANCEL',
  isDestructive = false,
  additionalInfo
}: ConfirmDialogProps) {
  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-6"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-zinc-900 border-2 border-adventure-gold rounded-xl p-6 max-w-md w-full space-y-4"
      >
        {/* Header with Icon */}
        <div className="flex items-start gap-3">
          {isDestructive && (
            <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0 mt-1" />
          )}
          <div className="flex-1">
            <h2 className="text-lg font-pixel text-adventure-gold tracking-wider">
              {title}
            </h2>
            <p className="text-sm text-gray-400 font-sans mt-2">
              {message}
            </p>
            {additionalInfo && (
              <div className="mt-3">
                {additionalInfo}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onCancel}
            className="flex-1 border-2 border-gray-600 text-gray-400 font-pixel py-3 rounded-lg hover:bg-gray-600/10 transition-colors"
            style={{ fontSize: '0.85rem' }}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 font-pixel py-3 rounded-lg transition-colors ${
              isDestructive
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-adventure-emerald hover:bg-adventure-gold text-black'
            }`}
            style={{ fontSize: '0.85rem' }}
          >
            {confirmText}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
