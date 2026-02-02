'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, RefreshCw, Image } from 'lucide-react';

export interface ImageErrorDetails {
  questId: string;
  questTitle: string;
  errorType: 'timeout' | 'quota' | 'overload' | 'unknown';
  retries: number;
}

interface ImageGenerationErrorProps {
  error: ImageErrorDetails;
  onRetry: (questId: string) => void;
  onUsePlaceholder: (questId: string) => void;
  onDismiss: (questId: string) => void;
  isRetrying?: boolean;
}

export default function ImageGenerationError({
  error,
  onRetry,
  onUsePlaceholder,
  onDismiss,
  isRetrying = false
}: ImageGenerationErrorProps) {

  const getErrorMessage = () => {
    switch (error.errorType) {
      case 'timeout':
        return 'Generation taking longer than expected';
      case 'quota':
        return 'API limit reached, try again later';
      case 'overload':
        return 'Service temporarily overloaded, will retry automatically';
      default:
        return "Couldn't generate image, please retry";
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="bg-yellow-900/20 border-2 border-yellow-600 rounded-lg p-4 mb-4"
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-pixel text-yellow-500 mb-1">
              IMAGE GENERATION FAILED
            </h4>
            <p className="text-xs font-sans text-gray-300 mb-2">
              {getErrorMessage()} for &ldquo;{error.questTitle}&rdquo;
            </p>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => onRetry(error.questId)}
                disabled={isRetrying}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-600 text-black font-pixel text-xs rounded hover:bg-yellow-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`w-3 h-3 ${isRetrying ? 'animate-spin' : ''}`} />
                {isRetrying ? 'RETRYING...' : 'RETRY (45s)'}
              </button>

              <button
                onClick={() => onUsePlaceholder(error.questId)}
                disabled={isRetrying}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-700 text-gray-300 font-pixel text-xs rounded hover:bg-zinc-600 transition-colors disabled:opacity-50"
              >
                <Image className="w-3 h-3" />
                PLACEHOLDER
              </button>

              <button
                onClick={() => onDismiss(error.questId)}
                disabled={isRetrying}
                className="px-3 py-1.5 text-gray-500 font-pixel text-xs rounded hover:text-gray-300 transition-colors disabled:opacity-50"
              >
                DISMISS
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
