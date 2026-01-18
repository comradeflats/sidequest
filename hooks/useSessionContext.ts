import { useState, useCallback, useEffect, useRef } from 'react';
import {
  SessionContext,
  QuestAttempt,
  createSessionContext,
  updateSessionContext,
  saveSessionContext,
  loadSessionContext,
  clearSessionContext,
  buildContextPrompt,
  buildVerificationContextHint
} from '@/lib/session-context';
import { ThinkingStep, QuestType } from '@/types';

interface UseSessionContextProps {
  campaignId: string | null;
  enabled?: boolean;
}

interface UseSessionContextReturn {
  context: SessionContext | null;
  isLoaded: boolean;

  // Record quest attempts
  recordAttempt: (params: {
    questId: string;
    questTitle: string;
    questType: QuestType;
    success: boolean;
    feedback: string;
    thinkingSteps?: ThinkingStep[];
    distanceFromTarget?: number;
  }) => void;

  // Start a new attempt on a quest (increments attempt count)
  startAttempt: (questId: string) => void;

  // Get context prompt for AI
  getContextPrompt: () => string;

  // Get brief hint for verification
  getVerificationHint: () => string;

  // Reset context (for new campaign)
  resetContext: () => void;
}

export function useSessionContext({
  campaignId,
  enabled = true
}: UseSessionContextProps): UseSessionContextReturn {
  const [context, setContext] = useState<SessionContext | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const currentAttempts = useRef<Record<string, number>>({});
  const attemptStartTimes = useRef<Record<string, number>>({});

  // Load context when campaign ID changes
  useEffect(() => {
    if (!enabled || !campaignId) {
      setContext(null);
      setIsLoaded(true);
      return;
    }

    // Try to load existing context
    const existingContext = loadSessionContext(campaignId);
    if (existingContext) {
      setContext(existingContext);
      // Restore attempt counts from history
      for (const attempt of existingContext.questHistory) {
        currentAttempts.current[attempt.questId] = attempt.attempts;
      }
      console.log('[useSessionContext] Loaded existing context:', {
        questsCompleted: existingContext.questHistory.length,
        successRate: existingContext.patterns.successRate
      });
    } else {
      // Create new context
      const newContext = createSessionContext(campaignId);
      setContext(newContext);
      saveSessionContext(newContext);
      console.log('[useSessionContext] Created new context for campaign:', campaignId);
    }

    setIsLoaded(true);
  }, [campaignId, enabled]);

  // Save context when it changes
  useEffect(() => {
    if (context && enabled) {
      saveSessionContext(context);
    }
  }, [context, enabled]);

  // Start a new attempt on a quest
  const startAttempt = useCallback((questId: string) => {
    currentAttempts.current[questId] = (currentAttempts.current[questId] || 0) + 1;
    attemptStartTimes.current[questId] = Date.now();
    console.log('[useSessionContext] Started attempt', currentAttempts.current[questId], 'for quest:', questId);
  }, []);

  // Record a quest attempt result
  const recordAttempt = useCallback(({
    questId,
    questTitle,
    questType,
    success,
    feedback,
    thinkingSteps,
    distanceFromTarget
  }: {
    questId: string;
    questTitle: string;
    questType: QuestType;
    success: boolean;
    feedback: string;
    thinkingSteps?: ThinkingStep[];
    distanceFromTarget?: number;
  }) => {
    if (!context) return;

    // Calculate time spent
    const startTime = attemptStartTimes.current[questId] || Date.now();
    const timeSpent = Math.round((Date.now() - startTime) / 1000);

    // Find existing attempt or create new
    const existingAttempt = context.questHistory.find(q => q.questId === questId);

    const attempt: QuestAttempt = {
      questId,
      questTitle,
      questType,
      attempts: currentAttempts.current[questId] || 1,
      finalSuccess: success,
      verificationFeedback: existingAttempt
        ? [...existingAttempt.verificationFeedback, feedback]
        : [feedback],
      thinkingSteps,
      timeSpent: existingAttempt
        ? existingAttempt.timeSpent + timeSpent
        : timeSpent,
      distanceFromTarget
    };

    const updatedContext = updateSessionContext(context, attempt);
    setContext(updatedContext);

    console.log('[useSessionContext] Recorded attempt:', {
      questId,
      success,
      attempts: attempt.attempts,
      totalQuests: updatedContext.questHistory.length
    });
  }, [context]);

  // Get context prompt for AI
  const getContextPrompt = useCallback(() => {
    if (!context) return '';
    return buildContextPrompt(context);
  }, [context]);

  // Get brief hint for verification
  const getVerificationHint = useCallback(() => {
    if (!context) return '';
    return buildVerificationContextHint(context);
  }, [context]);

  // Reset context for new campaign
  const resetContext = useCallback(() => {
    if (campaignId) {
      clearSessionContext(campaignId);
    }
    currentAttempts.current = {};
    attemptStartTimes.current = {};
    setContext(null);
    setIsLoaded(false);
  }, [campaignId]);

  return {
    context,
    isLoaded,
    recordAttempt,
    startAttempt,
    getContextPrompt,
    getVerificationHint,
    resetContext
  };
}
