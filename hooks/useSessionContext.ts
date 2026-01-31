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
  buildVerificationContextHint,
  estimateContextTokens,
  getContextTokenBreakdown,
  ContextTokenBreakdown
} from '@/lib/session-context';
import { ThinkingStep, QuestType, Campaign, JourneyStats } from '@/types';

interface UseSessionContextProps {
  campaignId: string | null;
  campaign?: Campaign | null;  // Pass full campaign for location research
  journeyStats?: JourneyStats | null;  // Pass journey stats for analytics
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
    questImageUrl?: string;        // Quest image for context
  }) => void;

  // Start a new attempt on a quest (increments attempt count)
  startAttempt: (questId: string) => void;

  // Get context prompt for AI
  getContextPrompt: () => string;

  // Get brief hint for verification
  getVerificationHint: () => string;

  // Get estimated token usage for context window showcase
  getContextTokenCount: () => number;

  // Get detailed token breakdown for visualization
  getTokenBreakdown: () => ContextTokenBreakdown;

  // Reset context (for new campaign)
  resetContext: () => void;
}

export function useSessionContext({
  campaignId,
  campaign,
  journeyStats,
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
    } else {
      // Create new context
      const newContext = createSessionContext(campaignId);
      setContext(newContext);
      saveSessionContext(newContext);
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
  }, []);

  // Record a quest attempt result
  const recordAttempt = useCallback(({
    questId,
    questTitle,
    questType,
    success,
    feedback,
    thinkingSteps,
    distanceFromTarget,
    questImageUrl
  }: {
    questId: string;
    questTitle: string;
    questType: QuestType;
    success: boolean;
    feedback: string;
    thinkingSteps?: ThinkingStep[];
    distanceFromTarget?: number;
    questImageUrl?: string;
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
      distanceFromTarget,
      questImageUrl: questImageUrl || existingAttempt?.questImageUrl  // Preserve image from first attempt
    };

    const updatedContext = updateSessionContext(context, attempt);
    setContext(updatedContext);
  }, [context]);

  // Get context prompt for AI
  const getContextPrompt = useCallback(() => {
    if (!context) return '';
    return buildContextPrompt(context, campaign || undefined, journeyStats || undefined);
  }, [context, campaign, journeyStats]);

  // Get brief hint for verification
  const getVerificationHint = useCallback(() => {
    if (!context) return '';
    return buildVerificationContextHint(context, campaign || undefined);
  }, [context, campaign]);

  // Get estimated token count for context window showcase
  const getContextTokenCount = useCallback(() => {
    if (!context) return 0;
    return estimateContextTokens(context, campaign || undefined, journeyStats || undefined);
  }, [context, campaign, journeyStats]);

  // Get detailed token breakdown for visualization
  const getTokenBreakdown = useCallback((): ContextTokenBreakdown => {
    if (!context) {
      return {
        total: 0,
        baseText: 0,
        images: 0,
        journey: 0,
        research: 0,
        reasoning: 0
      };
    }
    return getContextTokenBreakdown(context, campaign || undefined, journeyStats || undefined);
  }, [context, campaign, journeyStats]);

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
    getContextTokenCount,
    getTokenBreakdown,
    resetContext
  };
}
