'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Ruler, User, Settings, Star, Trophy, MapPin, Flame, Compass, Map, Mountain, Tent, Gem, Swords, Crown, Ship, Bird, LucideIcon } from 'lucide-react';
import { UnitSystem } from '@/lib/units';
import { useUserProfile } from '@/hooks/useUserProfile';
import { AVATAR_OPTIONS } from '@/lib/storage';

// Map icon names to Lucide components
const ICON_MAP: Record<string, LucideIcon> = {
  Compass,
  Map,
  Mountain,
  Tent,
  Gem,
  Flame,
  Star,
  Trophy,
  Swords,
  Crown,
  Ship,
  Bird,
};

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  unitSystem: UnitSystem;
  onToggleUnit: () => void;
}

type TabType = 'profile' | 'settings';

export default function SettingsModal({
  isOpen,
  onClose,
  unitSystem,
  onToggleUnit,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');

  const {
    profile,
    stats,
    avatarOptions,
    currentAvatar,
    updateUsername,
    updateAvatar,
    refreshStats,
  } = useUserProfile();

  // Refresh stats when modal opens
  useEffect(() => {
    if (isOpen) {
      refreshStats();
      setEditingUsername(false);
    }
  }, [isOpen, refreshStats]);

  // Initialize username input when profile loads
  useEffect(() => {
    if (profile) {
      setUsernameInput(profile.username);
    }
  }, [profile]);

  const handleUsernameSubmit = () => {
    if (usernameInput.trim()) {
      updateUsername(usernameInput);
      setEditingUsername(false);
    }
  };

  const CurrentAvatarIcon = currentAvatar ? ICON_MAP[currentAvatar.icon] : Compass;

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
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-sm mx-auto bg-zinc-900 border-2 border-adventure-gold rounded-lg overflow-hidden max-h-[85vh] flex flex-col"
          >
            {/* Header with Tabs */}
            <div className="border-b border-zinc-800">
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <h2 className="text-lg font-pixel text-adventure-gold">
                  {activeTab === 'profile' ? 'PROFILE' : 'SETTINGS'}
                </h2>
                <button
                  onClick={onClose}
                  className="p-1 hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Tab Buttons */}
              <div className="flex px-4 gap-2">
                <button
                  onClick={() => setActiveTab('profile')}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                    activeTab === 'profile'
                      ? 'bg-zinc-800 text-adventure-gold border-b-2 border-adventure-gold'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  <User className="w-4 h-4" />
                  Profile
                </button>
                <button
                  onClick={() => setActiveTab('settings')}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                    activeTab === 'settings'
                      ? 'bg-zinc-800 text-adventure-gold border-b-2 border-adventure-gold'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  <Settings className="w-4 h-4" />
                  Settings
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              {activeTab === 'profile' ? (
                <>
                  {/* Current Avatar & Username */}
                  <div className="flex items-center gap-4 p-4 bg-zinc-800/50 rounded-lg">
                    <div className={`w-16 h-16 rounded-xl bg-zinc-800 border-2 border-adventure-gold flex items-center justify-center ${currentAvatar?.color || 'text-adventure-gold'}`}>
                      <CurrentAvatarIcon className="w-10 h-10" strokeWidth={2.5} />
                    </div>
                    <div className="flex-1">
                      {editingUsername ? (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={usernameInput}
                            onChange={(e) => setUsernameInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleUsernameSubmit();
                              if (e.key === 'Escape') setEditingUsername(false);
                            }}
                            maxLength={20}
                            autoFocus
                            className="flex-1 bg-zinc-900 border border-adventure-gold rounded px-2 py-1 text-white text-sm focus:outline-none"
                          />
                          <button
                            onClick={handleUsernameSubmit}
                            className="px-3 py-1 bg-adventure-gold text-black text-xs font-bold rounded hover:bg-yellow-400 transition-colors"
                          >
                            OK
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditingUsername(true)}
                          className="text-left group"
                        >
                          <p className="text-lg font-bold text-white group-hover:text-adventure-gold transition-colors">
                            {profile?.username || 'Adventurer'}
                          </p>
                          <p className="text-xs text-gray-500">Tap to edit</p>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700">
                      <div className="flex items-center gap-2 mb-1">
                        <Star className="w-4 h-4 text-yellow-400" />
                        <span className="text-xs text-gray-400">Level</span>
                      </div>
                      <p className="text-2xl font-bold text-white">{stats.level}</p>
                    </div>
                    <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700">
                      <div className="flex items-center gap-2 mb-1">
                        <Trophy className="w-4 h-4 text-amber-500" />
                        <span className="text-xs text-gray-400">Total XP</span>
                      </div>
                      <p className="text-2xl font-bold text-white">{stats.totalXP.toLocaleString()}</p>
                    </div>
                    <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700">
                      <div className="flex items-center gap-2 mb-1">
                        <MapPin className="w-4 h-4 text-adventure-emerald" />
                        <span className="text-xs text-gray-400">Quests Done</span>
                      </div>
                      <p className="text-2xl font-bold text-white">{stats.questsCompleted}</p>
                    </div>
                    <div className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700">
                      <div className="flex items-center gap-2 mb-1">
                        <Flame className="w-4 h-4 text-orange-500" />
                        <span className="text-xs text-gray-400">Day Streak</span>
                      </div>
                      <p className="text-2xl font-bold text-white">{stats.dayStreak}</p>
                    </div>
                  </div>

                  {/* Avatar Selection */}
                  <div className="space-y-2">
                    <p className="text-xs font-pixel text-adventure-gold">CHOOSE AVATAR</p>
                    <div className="grid grid-cols-6 gap-2">
                      {avatarOptions.map((avatar) => {
                        const Icon = ICON_MAP[avatar.icon];
                        const isSelected = profile?.avatarId === avatar.id;
                        return (
                          <button
                            key={avatar.id}
                            onClick={() => updateAvatar(avatar.id)}
                            className={`aspect-square rounded-lg flex items-center justify-center transition-all ${
                              isSelected
                                ? 'bg-adventure-gold/20 border-2 border-adventure-gold scale-110'
                                : 'bg-zinc-800 border border-zinc-700 hover:border-adventure-emerald hover:scale-105'
                            }`}
                            title={avatar.label}
                          >
                            <Icon
                              className={`w-5 h-5 ${isSelected ? 'text-adventure-gold' : avatar.color}`}
                              strokeWidth={isSelected ? 2.5 : 2}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <>
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
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
