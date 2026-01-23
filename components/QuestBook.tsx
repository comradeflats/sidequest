'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, Target, Lock, MapPin, Calendar, Trophy, Trash2, AlertTriangle } from 'lucide-react';
import { Campaign, StoredCampaign } from '@/types';
import { getVisitedPlacesCount, clearVisitedPlaces } from '@/lib/storage';

interface QuestBookProps {
  isOpen: boolean;
  onClose: () => void;
  currentCampaign: Campaign | null;
  currentQuestIndex: number;
  campaignHistory: StoredCampaign[];
  completedQuests: string[];
}

// Standard Galactic Alphabet mapping (Minecraft/Commander Keen style)
const GALACTIC_ALPHABET: Record<string, string> = {
  a: '⏃', b: '⏚', c: '☊', d: '⎅', e: '⟒', f: '⎎', g: '☌', h: '⊑', i: '⟟', j: '⟊',
  k: '☍', l: '⌰', m: '⋔', n: '⋏', o: '⍜', p: '⌿', q: '⍾', r: '⍀', s: '⌇', t: '⏁',
  u: '⎍', v: '⎐', w: '⍙', x: '⌖', y: '⊬', z: '⋉'
};

function toGalactic(text: string): string {
  return text.toLowerCase().split('').map(char => GALACTIC_ALPHABET[char] || char).join('');
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
}

export default function QuestBook({
  isOpen,
  onClose,
  currentCampaign,
  currentQuestIndex,
  campaignHistory,
  completedQuests
}: QuestBookProps) {
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');
  const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(null);
  const [visitedPlacesCount, setVisitedPlacesCount] = useState(0);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Load visited places count when component opens
  useEffect(() => {
    if (isOpen) {
      setVisitedPlacesCount(getVisitedPlacesCount());
    }
  }, [isOpen]);

  const handleClearVisitedPlaces = () => {
    clearVisitedPlaces();
    setVisitedPlacesCount(0);
    setShowClearConfirm(false);
  };

  if (!isOpen) return null;

  const getQuestStatus = (questId: string, questIndex: number) => {
    if (completedQuests.includes(questId)) return 'completed';
    if (questIndex === currentQuestIndex) return 'current';
    return 'locked';
  };

  const totalDistance = currentCampaign?.quests
    .slice(0, currentQuestIndex + 1)
    .reduce((sum, quest) => sum + (quest.distanceFromPrevious || 0), 0) || 0;

  // Get stats from all campaigns
  const totalCampaigns = campaignHistory.length + (currentCampaign ? 1 : 0);
  const totalQuestsCompleted = campaignHistory.reduce(
    (sum, stored) => sum + stored.progress.completedQuests.length,
    completedQuests.length
  );
  const totalDistanceAllCampaigns = campaignHistory.reduce(
    (sum, stored) => sum + (stored.journeyStats?.totalDistanceTraveled || 0),
    0
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-zinc-900 border-2 border-adventure-gold rounded-lg w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="bg-zinc-950 border-b-2 border-adventure-gold p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-6 h-6 text-adventure-gold" />
            <h2 className="text-xl font-pixel text-adventure-gold">QUEST BOOK</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-adventure-gold transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b-2 border-zinc-800">
          <button
            onClick={() => setActiveTab('current')}
            className={`flex-1 py-3 text-sm font-semibold uppercase tracking-wide transition-colors ${
              activeTab === 'current'
                ? 'bg-zinc-800 text-adventure-gold border-b-2 border-adventure-gold'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Current
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-3 text-sm font-semibold uppercase tracking-wide transition-colors ${
              activeTab === 'history'
                ? 'bg-zinc-800 text-adventure-gold border-b-2 border-adventure-gold'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            History ({campaignHistory.length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <AnimatePresence mode="wait">
            {activeTab === 'current' && (
              <motion.div
                key="current"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-4"
              >
                {currentCampaign ? (
                  <>
                    <div className="bg-zinc-950 border border-adventure-emerald/30 rounded-lg p-4">
                      <h3 className="font-semibold text-adventure-emerald text-sm mb-2">
                        {currentCampaign.location}
                      </h3>
                      <div className="flex gap-4 text-xs text-gray-400 font-sans">
                        <span>Progress: {currentQuestIndex + 1}/{currentCampaign.quests.length}</span>
                        <span>•</span>
                        <span>{totalDistance.toFixed(1)}km traveled</span>
                      </div>
                    </div>

                    {/* Quest List */}
                    {currentCampaign.quests.map((quest, index) => {
                      const status = getQuestStatus(quest.id, index);

                      return (
                        <div
                          key={quest.id}
                          className={`border-2 rounded-lg p-4 transition-all ${
                            status === 'completed'
                              ? 'border-emerald-600/50 bg-emerald-950/20'
                              : status === 'current'
                              ? 'border-adventure-gold bg-adventure-gold/10 animate-pulse'
                              : 'border-zinc-800 bg-zinc-900/50'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            {/* Status Icon */}
                            <div className="flex-shrink-0 mt-1">
                              {status === 'completed' && (
                                <CheckCircle className="w-5 h-5 text-emerald-500" />
                              )}
                              {status === 'current' && (
                                <Target className="w-5 h-5 text-adventure-gold" />
                              )}
                              {status === 'locked' && (
                                <Lock className="w-5 h-5 text-zinc-600" />
                              )}
                            </div>

                            {/* Quest Info */}
                            <div className="flex-1">
                              {status === 'locked' ? (
                                <>
                                  <h4 className="font-semibold text-sm text-zinc-600 mb-1">
                                    {toGalactic(`Quest ${index + 1}`)}
                                  </h4>
                                  <p className="text-xs text-zinc-700 font-sans">
                                    Complete current quest to unlock...
                                  </p>
                                  {quest.imageUrl && (
                                    <div className="mt-2 relative">
                                      <img
                                        src={quest.imageUrl}
                                        alt="Locked quest"
                                        className="w-full h-24 object-cover rounded blur-md opacity-30"
                                      />
                                      <div className="absolute inset-0 flex items-center justify-center">
                                        <Lock className="w-8 h-8 text-zinc-600" />
                                      </div>
                                    </div>
                                  )}
                                </>
                              ) : (
                                <>
                                  <h4
                                    className={`font-semibold text-sm mb-1 ${
                                      status === 'completed'
                                        ? 'text-emerald-500'
                                        : status === 'current'
                                        ? 'text-adventure-gold'
                                        : 'text-gray-400'
                                    }`}
                                  >
                                    {quest.title}
                                  </h4>
                                  <p className="text-xs text-gray-400 font-sans mb-2">
                                    {quest.objective}
                                  </p>
                                  {quest.imageUrl && (
                                    <img
                                      src={quest.imageUrl}
                                      alt={quest.title}
                                      className="w-full h-24 object-cover rounded"
                                    />
                                  )}
                                  {status === 'completed' && (
                                    <div className="mt-2 text-xs text-emerald-500 font-sans">
                                      ✓ Completed
                                    </div>
                                  )}
                                  {status === 'current' && quest.coordinates && (
                                    <div className="mt-2 text-xs text-adventure-gold font-sans">
                                      → Currently tracking
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </>
                ) : (
                  <div className="text-center py-12 text-gray-500 font-sans">
                    <MapPin className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No active campaign</p>
                    <p className="text-sm">Start a new adventure to begin tracking</p>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'history' && (
              <motion.div
                key="history"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                {/* Stats Card */}
                {totalCampaigns > 0 && (
                  <div className="bg-zinc-950 border border-adventure-gold/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Trophy className="w-5 h-5 text-adventure-gold" />
                      <h3 className="font-semibold uppercase text-adventure-gold text-sm">Your Stats</h3>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <div className="text-2xl font-bold tabular-nums text-adventure-emerald">
                          {totalCampaigns}
                        </div>
                        <div className="text-xs text-gray-500 font-sans">Campaigns</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold tabular-nums text-adventure-emerald">
                          {totalQuestsCompleted}
                        </div>
                        <div className="text-xs text-gray-500 font-sans">Quests</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold tabular-nums text-adventure-emerald">
                          {totalDistanceAllCampaigns.toFixed(1)}
                        </div>
                        <div className="text-xs text-gray-500 font-sans">km</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Visited Places Reset */}
                {visitedPlacesCount > 0 && (
                  <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-sm text-gray-300 mb-1">Visited Locations</h3>
                        <p className="text-xs text-gray-500 font-sans">
                          {visitedPlacesCount} places tracked for variety
                        </p>
                      </div>
                      <button
                        onClick={() => setShowClearConfirm(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-400 border border-red-500/30 rounded hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Clear
                      </button>
                    </div>
                    <p className="text-xs text-gray-600 font-sans mt-2">
                      Clearing allows revisiting the same locations in new campaigns.
                    </p>
                  </div>
                )}

                {/* Clear Confirmation Dialog */}
                <AnimatePresence>
                  {showClearConfirm && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 bg-black/80 z-60 flex items-center justify-center p-4"
                      onClick={() => setShowClearConfirm(false)}
                    >
                      <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-zinc-900 border-2 border-red-500/50 rounded-lg p-6 max-w-sm w-full"
                      >
                        <div className="flex items-center gap-3 mb-4">
                          <AlertTriangle className="w-6 h-6 text-red-500" />
                          <h3 className="text-lg font-semibold text-red-400">Clear Location History?</h3>
                        </div>
                        <p className="text-sm text-gray-400 font-sans mb-6">
                          This will reset all {visitedPlacesCount} tracked locations. Future campaigns may revisit places you&apos;ve already been to.
                        </p>
                        <div className="flex gap-3">
                          <button
                            onClick={() => setShowClearConfirm(false)}
                            className="flex-1 py-2 px-4 text-sm font-semibold text-gray-400 border border-zinc-700 rounded hover:bg-zinc-800 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleClearVisitedPlaces}
                            className="flex-1 py-2 px-4 text-sm font-semibold text-white bg-red-600 rounded hover:bg-red-500 transition-colors"
                          >
                            Clear History
                          </button>
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Campaign History */}
                {campaignHistory.length > 0 ? (
                  campaignHistory.map((stored) => {
                    const isExpanded = expandedCampaignId === stored.campaign.id;

                    return (
                      <div
                        key={stored.campaign.id}
                        className="border-2 border-zinc-800 bg-zinc-900/50 rounded-lg overflow-hidden"
                      >
                        <button
                          onClick={() =>
                            setExpandedCampaignId(isExpanded ? null : stored.campaign.id)
                          }
                          className="w-full p-4 text-left hover:bg-zinc-800/50 transition-colors"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-semibold text-sm text-adventure-emerald mb-1">
                                {stored.campaign.location}
                              </h4>
                              <div className="flex gap-3 text-xs text-gray-500 font-sans">
                                {stored.completedAt && (
                                  <>
                                    <span className="flex items-center gap-1">
                                      <Calendar className="w-3 h-3" />
                                      {formatDate(stored.completedAt)}
                                    </span>
                                    <span>•</span>
                                  </>
                                )}
                                <span>{stored.campaign.quests.length} quests</span>
                                {stored.journeyStats && (
                                  <>
                                    <span>•</span>
                                    <span>{stored.journeyStats.totalDistanceTraveled.toFixed(1)}km</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                          </div>
                        </button>

                        {/* Expanded Quest List */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="border-t border-zinc-800 bg-zinc-950/50 p-3 space-y-2"
                            >
                              {stored.campaign.quests.map((quest) => (
                                <div
                                  key={quest.id}
                                  className="flex items-center gap-2 text-sm"
                                >
                                  <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                                  <span className="text-gray-400 font-sans">{quest.title}</span>
                                </div>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-12 text-gray-500 font-sans">
                    <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No completed campaigns yet</p>
                    <p className="text-sm">Your adventure history will appear here</p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}
