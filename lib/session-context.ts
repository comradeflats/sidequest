import { ThinkingStep, QuestType } from '@/types';

/**
 * Session Context Management for Gemini 3's 1M Token Context Window
 * Implements Marathon Agent track: persistent memory across quest sessions
 */

// Quest attempt history for context building
export interface QuestAttempt {
  questId: string;
  questTitle: string;
  questType: QuestType;
  attempts: number;
  finalSuccess: boolean;
  verificationFeedback: string[];
  thinkingSteps?: ThinkingStep[];
  timeSpent: number; // seconds
  distanceFromTarget?: number;
}

// User behavior patterns computed from quest history
export interface UserPatterns {
  totalAttempts: number;
  successRate: number;
  averageAttemptsPerQuest: number;
  strongestMediaType: QuestType | null;
  weakestMediaType: QuestType | null;
  commonIssues: string[]; // e.g., "lighting", "framing", "wrong subject"
  averageConfidence: number;
}

// Thought signature - maintains AI personality consistency
export interface ThoughtSignature {
  narrativeVoice: string;       // Consistent personality description
  encouragementLevel: 'high' | 'medium' | 'low'; // Based on performance
  referenceStyle: 'detailed' | 'brief'; // How much to reference past quests
  runningJokes: string[];       // Callbacks to create continuity
  playerNickname?: string;      // Personalized reference if earned
}

// Full session context
export interface SessionContext {
  sessionId: string;
  campaignId: string;
  startedAt: string;
  lastUpdatedAt: string;

  // Quest history for context building
  questHistory: QuestAttempt[];

  // User behavior patterns (computed)
  patterns: UserPatterns;

  // Thought signature - maintains AI personality consistency
  thoughtSignature: ThoughtSignature;
}

// Storage key prefix
const SESSION_CONTEXT_KEY = 'sidequest_session_context_';

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create a new session context for a campaign
 */
export function createSessionContext(campaignId: string): SessionContext {
  const now = new Date().toISOString();

  return {
    sessionId: generateSessionId(),
    campaignId,
    startedAt: now,
    lastUpdatedAt: now,
    questHistory: [],
    patterns: {
      totalAttempts: 0,
      successRate: 0,
      averageAttemptsPerQuest: 0,
      strongestMediaType: null,
      weakestMediaType: null,
      commonIssues: [],
      averageConfidence: 0
    },
    thoughtSignature: {
      narrativeVoice: 'Friendly and encouraging guide with a sense of adventure',
      encouragementLevel: 'medium',
      referenceStyle: 'brief',
      runningJokes: []
    }
  };
}

/**
 * Analyze failed thinking steps to identify common issues
 */
function analyzeCommonIssues(history: QuestAttempt[]): string[] {
  const issuePatterns: Record<string, number> = {};

  for (const attempt of history) {
    if (attempt.thinkingSteps) {
      for (const step of attempt.thinkingSteps) {
        if (!step.passed) {
          // Extract issue keywords from criterion
          const criterion = step.criterion.toLowerCase();
          if (criterion.includes('light') || criterion.includes('bright') || criterion.includes('dark')) {
            issuePatterns['lighting'] = (issuePatterns['lighting'] || 0) + 1;
          }
          if (criterion.includes('frame') || criterion.includes('angle') || criterion.includes('composition')) {
            issuePatterns['framing'] = (issuePatterns['framing'] || 0) + 1;
          }
          if (criterion.includes('subject') || criterion.includes('object') || criterion.includes('target')) {
            issuePatterns['wrong subject'] = (issuePatterns['wrong subject'] || 0) + 1;
          }
          if (criterion.includes('distance') || criterion.includes('close') || criterion.includes('far')) {
            issuePatterns['distance'] = (issuePatterns['distance'] || 0) + 1;
          }
          if (criterion.includes('motion') || criterion.includes('movement') || criterion.includes('activity')) {
            issuePatterns['motion capture'] = (issuePatterns['motion capture'] || 0) + 1;
          }
          if (criterion.includes('sound') || criterion.includes('audio') || criterion.includes('noise')) {
            issuePatterns['audio clarity'] = (issuePatterns['audio clarity'] || 0) + 1;
          }
        }
      }
    }
  }

  // Return issues that occurred more than once, sorted by frequency
  return Object.entries(issuePatterns)
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([issue]) => issue);
}

/**
 * Analyze media type performance
 */
function analyzeMediaTypePerformance(history: QuestAttempt[]): {
  strongest: QuestType | null;
  weakest: QuestType | null
} {
  const performance: Record<QuestType, { success: number; total: number }> = {
    'PHOTO': { success: 0, total: 0 },
    'VIDEO': { success: 0, total: 0 },
    'AUDIO': { success: 0, total: 0 }
  };

  for (const attempt of history) {
    const type = attempt.questType;
    performance[type].total++;
    if (attempt.finalSuccess) {
      performance[type].success++;
    }
  }

  // Calculate success rates for types with at least 1 attempt
  const rates: { type: QuestType; rate: number }[] = [];
  for (const [type, data] of Object.entries(performance)) {
    if (data.total > 0) {
      rates.push({ type: type as QuestType, rate: data.success / data.total });
    }
  }

  if (rates.length === 0) {
    return { strongest: null, weakest: null };
  }

  rates.sort((a, b) => b.rate - a.rate);

  return {
    strongest: rates[0].rate > 0 ? rates[0].type : null,
    weakest: rates.length > 1 && rates[rates.length - 1].rate < 1
      ? rates[rates.length - 1].type
      : null
  };
}

/**
 * Update thought signature based on player performance
 */
function updateThoughtSignature(
  currentSignature: ThoughtSignature,
  patterns: UserPatterns,
  history: QuestAttempt[]
): ThoughtSignature {
  const signature = { ...currentSignature };

  // Adjust encouragement level based on success rate
  if (patterns.successRate >= 0.8) {
    signature.encouragementLevel = 'low'; // Player is doing great, less cheerleading
    signature.narrativeVoice = 'Confident companion who respects your skills';
  } else if (patterns.successRate >= 0.5) {
    signature.encouragementLevel = 'medium';
    signature.narrativeVoice = 'Friendly and encouraging guide with a sense of adventure';
  } else {
    signature.encouragementLevel = 'high'; // Player needs support
    signature.narrativeVoice = 'Supportive mentor who celebrates small wins';
  }

  // Adjust reference style based on history length
  signature.referenceStyle = history.length >= 3 ? 'detailed' : 'brief';

  // Add running jokes based on patterns
  const newJokes: string[] = [];

  if (patterns.commonIssues.includes('lighting')) {
    newJokes.push('your ongoing battle with lighting');
  }
  if (patterns.strongestMediaType === 'PHOTO' && patterns.weakestMediaType === 'VIDEO') {
    newJokes.push('being a photo pro but video-shy');
  }
  if (patterns.strongestMediaType === 'AUDIO') {
    newJokes.push('having golden ears for audio quests');
  }
  if (patterns.averageAttemptsPerQuest > 2) {
    newJokes.push('your persistence and determination');
  }

  // Keep max 3 running jokes
  signature.runningJokes = [...new Set([...signature.runningJokes, ...newJokes])].slice(0, 3);

  // Award nickname for achievements
  if (!signature.playerNickname) {
    const questCount = history.length;
    if (questCount >= 5 && patterns.successRate >= 0.8) {
      signature.playerNickname = 'Explorer';
    } else if (patterns.totalAttempts >= 10 && patterns.successRate < 0.5) {
      signature.playerNickname = 'Determined One';
    }
  }

  return signature;
}

/**
 * Update session context with a new quest attempt
 */
export function updateSessionContext(
  ctx: SessionContext,
  attempt: QuestAttempt
): SessionContext {
  const questHistory = [...ctx.questHistory];

  // Find existing attempt for this quest or add new
  const existingIndex = questHistory.findIndex(q => q.questId === attempt.questId);
  if (existingIndex >= 0) {
    questHistory[existingIndex] = attempt;
  } else {
    questHistory.push(attempt);
  }

  // Compute new patterns
  const totalAttempts = questHistory.reduce((sum, q) => sum + q.attempts, 0);
  const successfulQuests = questHistory.filter(q => q.finalSuccess).length;
  const { strongest, weakest } = analyzeMediaTypePerformance(questHistory);

  // Calculate average confidence from thinking steps
  let totalConfidence = 0;
  let confidenceCount = 0;
  for (const q of questHistory) {
    if (q.thinkingSteps) {
      for (const step of q.thinkingSteps) {
        totalConfidence += step.confidence;
        confidenceCount++;
      }
    }
  }

  const patterns: UserPatterns = {
    totalAttempts,
    successRate: questHistory.length > 0 ? successfulQuests / questHistory.length : 0,
    averageAttemptsPerQuest: questHistory.length > 0 ? totalAttempts / questHistory.length : 0,
    strongestMediaType: strongest,
    weakestMediaType: weakest,
    commonIssues: analyzeCommonIssues(questHistory),
    averageConfidence: confidenceCount > 0 ? Math.round(totalConfidence / confidenceCount) : 0
  };

  // Update thought signature
  const thoughtSignature = updateThoughtSignature(ctx.thoughtSignature, patterns, questHistory);

  return {
    ...ctx,
    lastUpdatedAt: new Date().toISOString(),
    questHistory,
    patterns,
    thoughtSignature
  };
}

/**
 * Build context prompt for AI from session context
 * This is injected into Gemini prompts to enable personalized responses
 */
export function buildContextPrompt(ctx: SessionContext): string {
  if (ctx.questHistory.length === 0) {
    return '';
  }

  const recentQuests = ctx.questHistory.slice(-3); // Last 3 quests for context

  let prompt = `
SESSION MEMORY (use to personalize your response naturally):
- Quests completed: ${ctx.questHistory.length}
- Success rate: ${(ctx.patterns.successRate * 100).toFixed(0)}%
- Average attempts per quest: ${ctx.patterns.averageAttemptsPerQuest.toFixed(1)}
`;

  if (ctx.patterns.strongestMediaType) {
    prompt += `- Strongest media type: ${ctx.patterns.strongestMediaType}\n`;
  }

  if (ctx.patterns.weakestMediaType) {
    prompt += `- Needs practice with: ${ctx.patterns.weakestMediaType}\n`;
  }

  if (ctx.patterns.commonIssues.length > 0) {
    prompt += `- Common challenges: ${ctx.patterns.commonIssues.join(', ')}\n`;
  }

  prompt += `
Recent quest history:
`;

  for (const q of recentQuests) {
    prompt += `- "${q.questTitle}" (${q.questType}): ${q.finalSuccess ? 'Completed' : 'Failed'} in ${q.attempts} attempt(s)`;
    if (q.verificationFeedback.length > 0) {
      prompt += ` - "${q.verificationFeedback[q.verificationFeedback.length - 1]}"`;
    }
    prompt += '\n';
  }

  prompt += `
PERSONALITY GUIDELINES:
- Voice: ${ctx.thoughtSignature.narrativeVoice}
- Encouragement level: ${ctx.thoughtSignature.encouragementLevel}
`;

  if (ctx.thoughtSignature.playerNickname) {
    prompt += `- You can occasionally call them "${ctx.thoughtSignature.playerNickname}"\n`;
  }

  if (ctx.thoughtSignature.runningJokes.length > 0) {
    prompt += `- Running jokes to subtly reference when appropriate: ${ctx.thoughtSignature.runningJokes.join('; ')}\n`;
  }

  prompt += `
IMPORTANT: Reference past quests naturally, not forcefully. Only mention history when relevant.
`;

  return prompt;
}

/**
 * Build a brief context hint for verification prompts (lighter weight)
 */
export function buildVerificationContextHint(ctx: SessionContext): string {
  if (ctx.questHistory.length === 0) {
    return '';
  }

  let hint = `\nPLAYER CONTEXT: `;
  hint += `${ctx.questHistory.length} quests completed (${(ctx.patterns.successRate * 100).toFixed(0)}% success rate). `;

  if (ctx.patterns.commonIssues.length > 0) {
    hint += `Common issues: ${ctx.patterns.commonIssues.join(', ')}. `;
  }

  hint += `Encouragement level: ${ctx.thoughtSignature.encouragementLevel}. `;

  if (ctx.thoughtSignature.playerNickname) {
    hint += `Call them "${ctx.thoughtSignature.playerNickname}" if appropriate.`;
  }

  return hint;
}

/**
 * Save session context to localStorage
 */
export function saveSessionContext(ctx: SessionContext): void {
  try {
    const key = SESSION_CONTEXT_KEY + ctx.campaignId;
    localStorage.setItem(key, JSON.stringify(ctx));
  } catch {
    // Failed to save context
  }
}

/**
 * Load session context from localStorage
 */
export function loadSessionContext(campaignId: string): SessionContext | null {
  try {
    const key = SESSION_CONTEXT_KEY + campaignId;
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored) as SessionContext;
    }
  } catch {
    // Failed to load context
  }
  return null;
}

/**
 * Clear session context for a campaign
 */
export function clearSessionContext(campaignId: string): void {
  try {
    const key = SESSION_CONTEXT_KEY + campaignId;
    localStorage.removeItem(key);
  } catch {
    // Failed to clear context
  }
}
