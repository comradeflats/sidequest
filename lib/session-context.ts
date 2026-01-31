import { ThinkingStep, QuestType, Campaign, JourneyStats, JourneyPoint } from '@/types';

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
  questImageUrl?: string;        // Base64 data URL of quest image for context
  imageDescription?: string;     // AI-generated description (optional)
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
 * GEMINI 3 SHOWCASE: Uses full campaign history to demonstrate 1M token context window
 * This is injected into Gemini prompts to enable personalized responses
 */
export function buildContextPrompt(ctx: SessionContext, campaign?: Campaign, journeyStats?: JourneyStats): string {
  if (ctx.questHistory.length === 0) {
    return '';
  }

  // GEMINI 3: Use FULL quest history (not just last 3) to showcase 1M token context window
  const allQuests = ctx.questHistory;

  let prompt = `
GEMINI 3 MARATHON CONTEXT - FULL CAMPAIGN MEMORY:
This context showcases Gemini 3's 1M token context window by maintaining complete campaign history.

SESSION OVERVIEW:
- Session ID: ${ctx.sessionId}
- Campaign started: ${new Date(ctx.startedAt).toLocaleString()}
- Total quests attempted: ${ctx.questHistory.length}
- Success rate: ${(ctx.patterns.successRate * 100).toFixed(0)}%
- Average attempts per quest: ${ctx.patterns.averageAttemptsPerQuest.toFixed(1)}
- Average AI confidence: ${ctx.patterns.averageConfidence}%
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
COMPLETE QUEST HISTORY (showcasing full context):
`;

  // Include ALL quest attempts with detailed feedback and thinking steps
  for (const q of allQuests) {
    prompt += `\nQuest: "${q.questTitle}" (${q.questType})
- Status: ${q.finalSuccess ? '✓ Completed' : '✗ Failed'} in ${q.attempts} attempt(s)
- Time spent: ${q.timeSpent}s
`;
    if (q.distanceFromTarget !== undefined) {
      prompt += `- GPS distance from target: ${q.distanceFromTarget.toFixed(0)}m\n`;
    }

    // Include quest image for visual context (Gemini 3 multimodal showcase)
    if (q.questImageUrl) {
      prompt += `- Quest reference image included (base64 encoded for visual context)\n`;
      // Note: The actual image will be included separately in multimodal API calls
      // This is a text marker to indicate image presence
    }

    // Include verification feedback history
    if (q.verificationFeedback.length > 0) {
      prompt += `- Feedback history:\n`;
      q.verificationFeedback.forEach((fb, i) => {
        prompt += `  ${i + 1}. "${fb}"\n`;
      });
    }

    // Include thinking steps for deeper context
    if (q.thinkingSteps && q.thinkingSteps.length > 0) {
      prompt += `- AI reasoning:\n`;
      q.thinkingSteps.forEach((step) => {
        prompt += `  - ${step.criterion}: ${step.passed ? 'Passed' : 'Failed'} (${step.confidence}%)\n`;
      });
    }
  }

  // GEMINI 3: Include location research for rich context (5-10K tokens)
  if (campaign?.locationResearch && campaign.locationResearch.length > 0) {
    prompt += `
LOCATION INTELLIGENCE (Gemini 3 Context Window Showcase):
Rich background research on quest locations to demonstrate deep contextual understanding.

`;
    for (const research of campaign.locationResearch) {
      prompt += `\n=== ${research.placeName} ===\n\n`;
      prompt += `HISTORICAL SIGNIFICANCE:\n${research.historicalSignificance}\n\n`;
      prompt += `ARCHITECTURAL DETAILS:\n${research.architecturalDetails}\n\n`;
      prompt += `CULTURAL CONTEXT:\n${research.culturalContext}\n\n`;
      prompt += `MEDIA CAPTURE TIPS:\n${research.mediaTips}\n\n`;
    }
  }

  // GEMINI 3: Include journey analytics for behavioral context (8-10K tokens)
  if (journeyStats && journeyStats.pathPoints.length > 0) {
    prompt += `
JOURNEY ANALYTICS (Gemini 3 Context Window Showcase):
Comprehensive tracking of the player's physical journey through the campaign.

JOURNEY SUMMARY:
- Total distance traveled: ${journeyStats.totalDistanceTraveled.toFixed(2)} km
- Journey duration: ${journeyStats.durationMinutes} minutes
- GPS path points captured: ${journeyStats.pathPoints.length}
- Quests completed during journey: ${journeyStats.questCompletionTimes.length}
`;

    // GPS Path Visualization (sample recent points to avoid bloat)
    const recentPoints = journeyStats.pathPoints.slice(-20); // Last 20 points
    if (recentPoints.length > 0) {
      prompt += `\nRECENT GPS PATH (last ${recentPoints.length} points):\n`;
      for (const point of recentPoints) {
        const timestamp = new Date(point.timestamp).toLocaleTimeString();
        prompt += `- [${timestamp}] Quest ${point.questIndex + 1}: ${point.coordinates.lat.toFixed(5)}, ${point.coordinates.lng.toFixed(5)} (accuracy: ±${point.accuracy.toFixed(0)}m)\n`;
      }
    }

    // Movement pattern analysis
    if (journeyStats.pathPoints.length >= 2) {
      const timeDiff = (new Date(journeyStats.pathPoints[journeyStats.pathPoints.length - 1].timestamp).getTime() -
                       new Date(journeyStats.pathPoints[0].timestamp).getTime()) / 1000; // seconds
      const avgSpeed = timeDiff > 0 ? (journeyStats.totalDistanceTraveled * 1000) / timeDiff : 0; // m/s

      prompt += `\nMOVEMENT PATTERNS:\n`;
      prompt += `- Average movement speed: ${avgSpeed.toFixed(2)} m/s (${(avgSpeed * 3.6).toFixed(1)} km/h)\n`;

      if (avgSpeed < 0.5) {
        prompt += `- Movement style: Stationary/minimal movement\n`;
      } else if (avgSpeed < 1.5) {
        prompt += `- Movement style: Slow walking pace\n`;
      } else if (avgSpeed < 2.5) {
        prompt += `- Movement style: Normal walking pace\n`;
      } else {
        prompt += `- Movement style: Brisk walking/running\n`;
      }
    }

    // Temporal analysis (quest completion timing)
    if (journeyStats.questCompletionTimes.length > 0) {
      prompt += `\nQUEST COMPLETION TIMELINE:\n`;
      for (let i = 0; i < journeyStats.questCompletionTimes.length; i++) {
        const completionTime = new Date(journeyStats.questCompletionTimes[i]);
        const elapsedMinutes = Math.round((completionTime.getTime() - journeyStats.startTime.getTime()) / 60000);

        let timeToComplete = 'N/A';
        if (i > 0) {
          const prevTime = new Date(journeyStats.questCompletionTimes[i - 1]);
          const minutes = Math.round((completionTime.getTime() - prevTime.getTime()) / 60000);
          timeToComplete = `${minutes} minutes`;
        }

        prompt += `- Quest ${i + 1}: Completed at ${completionTime.toLocaleTimeString()} (${elapsedMinutes}min into journey, ${timeToComplete} from previous)\n`;
      }
    }

    // Geographic coverage analysis
    if (journeyStats.pathPoints.length >= 2) {
      const latitudes = journeyStats.pathPoints.map(p => p.coordinates.lat);
      const longitudes = journeyStats.pathPoints.map(p => p.coordinates.lng);
      const latRange = Math.max(...latitudes) - Math.min(...latitudes);
      const lngRange = Math.max(...longitudes) - Math.min(...longitudes);
      const avgAccuracy = journeyStats.pathPoints.reduce((sum, p) => sum + p.accuracy, 0) / journeyStats.pathPoints.length;

      prompt += `\nGEOGRAPHIC COVERAGE:\n`;
      prompt += `- Latitude range: ${latRange.toFixed(5)}° (${(latRange * 111).toFixed(2)} km)\n`;
      prompt += `- Longitude range: ${lngRange.toFixed(5)}° (${(lngRange * 111).toFixed(2)} km)\n`;
      prompt += `- Average GPS accuracy: ±${avgAccuracy.toFixed(0)}m\n`;

      if (latRange < 0.01 && lngRange < 0.01) {
        prompt += `- Exploration pattern: Localized (stayed in small area)\n`;
      } else if (latRange < 0.05 && lngRange < 0.05) {
        prompt += `- Exploration pattern: Neighborhood exploration\n`;
      } else {
        prompt += `- Exploration pattern: Wide-ranging journey\n`;
      }
    }
  }

  // GEMINI 3: Include campaign generation reasoning (5-6K tokens)
  if (campaign?.generationReasoning) {
    const reasoning = campaign.generationReasoning;

    prompt += `
CAMPAIGN DESIGN REASONING (Gemini 3 Context Window Showcase):
The AI's thought process during campaign generation to demonstrate extended thinking.

DIFFICULTY PROGRESSION STRATEGY:
${reasoning.difficultyProgression}

LOCATION SELECTION RATIONALE:
`;
    reasoning.locationSelection.forEach((reason, i) => {
      prompt += `Quest ${i + 1}: ${reason}\n`;
    });

    prompt += `
MEDIA TYPE CHOICES:
`;
    reasoning.mediaTypeChoices.forEach((reason, i) => {
      prompt += `Quest ${i + 1}: ${reason}\n`;
    });

    prompt += `
CRITERIA DESIGN RATIONALE:
`;
    reasoning.criteriaDesign.forEach((reason, i) => {
      prompt += `Quest ${i + 1}: ${reason}\n`;
    });
  }

  prompt += `
PERSONALITY CONTEXT:
- Voice: ${ctx.thoughtSignature.narrativeVoice}
- Encouragement level: ${ctx.thoughtSignature.encouragementLevel}
- Reference style: ${ctx.thoughtSignature.referenceStyle}
`;

  if (ctx.thoughtSignature.playerNickname) {
    prompt += `- Player nickname: "${ctx.thoughtSignature.playerNickname}"\n`;
  }

  if (ctx.thoughtSignature.runningJokes.length > 0) {
    prompt += `- Running jokes: ${ctx.thoughtSignature.runningJokes.join('; ')}\n`;
  }

  prompt += `
CONTEXT USAGE NOTE: This full campaign history is maintained in Gemini 3's 1M token context window,
allowing the AI to reference any past quest, learn from patterns, and provide deeply personalized feedback.
Reference past quests naturally when they provide useful learning context.
`;

  return prompt;
}

/**
 * Context token breakdown for detailed visualization
 */
export interface ContextTokenBreakdown {
  total: number;
  baseText: number;
  images: number;
  journey: number;      // Journey analytics tokens
  research: number;     // Location research tokens
  reasoning: number;    // Campaign reasoning tokens (will be populated in Task #5)
}

/**
 * Estimate token count for context (rough approximation: ~4 chars per token)
 * GEMINI 3 SHOWCASE: Includes quest images (~2-3K tokens each), location research, and journey analytics
 */
export function estimateContextTokens(ctx: SessionContext, campaign?: Campaign, journeyStats?: JourneyStats): number {
  const breakdown = getContextTokenBreakdown(ctx, campaign, journeyStats);
  return breakdown.total;
}

/**
 * Get detailed token breakdown for context window showcase
 * GEMINI 3 FEATURE: Demonstrates multimodal context usage
 */
export function getContextTokenBreakdown(ctx: SessionContext, campaign?: Campaign, journeyStats?: JourneyStats): ContextTokenBreakdown {
  const contextPrompt = buildContextPrompt(ctx, campaign, journeyStats);

  // Count quest images (each base64 image ~2500 tokens on average)
  const imageCount = ctx.questHistory.filter(q => q.questImageUrl).length;
  const imageTokens = imageCount * 2500;

  // Journey analytics tokens (estimated based on pathPoints count)
  const journeyTokens = journeyStats && journeyStats.pathPoints.length > 0
    ? Math.ceil(
        500 + // Base journey summary
        (Math.min(journeyStats.pathPoints.length, 20) * 30) + // GPS points (30 tokens each, max 20 points)
        300 + // Movement patterns
        (journeyStats.questCompletionTimes.length * 40) + // Quest timeline
        200   // Geographic coverage
      )
    : 0;

  // Location research tokens (from campaign data)
  const researchTokens = campaign?.locationResearch
    ? campaign.locationResearch.reduce((sum, r) => sum + r.estimatedTokens, 0)
    : 0;

  // Campaign reasoning tokens (from campaign data)
  const reasoningTokens = campaign?.generationReasoning
    ? campaign.generationReasoning.estimatedTokens
    : 0;

  // Calculate base text tokens (total minus structured components)
  const structuredTokens = imageTokens + journeyTokens + researchTokens + reasoningTokens;
  const baseTextTokens = Math.max(0, Math.ceil(contextPrompt.length / 4) - structuredTokens);

  return {
    total: baseTextTokens + imageTokens + journeyTokens + researchTokens + reasoningTokens,
    baseText: baseTextTokens,
    images: imageTokens,
    journey: journeyTokens,
    research: researchTokens,
    reasoning: reasoningTokens
  };
}

/**
 * Build a brief context hint for verification prompts (lighter weight)
 */
export function buildVerificationContextHint(ctx: SessionContext, campaign?: Campaign): string {
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
