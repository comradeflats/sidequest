'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  UserProfile,
  getUserProfile,
  updateUserProfile,
  getPlayerProgress,
  getCurrentStreak,
  AVATAR_OPTIONS,
  AvatarOption,
} from '@/lib/storage';
import { PlayerProgress } from '@/types';

export interface UserStats {
  level: number;
  totalXP: number;
  questsCompleted: number;
  dayStreak: number;
}

export interface UseUserProfileReturn {
  profile: UserProfile | null;
  stats: UserStats;
  avatarOptions: readonly AvatarOption[];
  currentAvatar: AvatarOption | undefined;
  updateUsername: (username: string) => void;
  updateAvatar: (avatarId: string) => void;
  refreshStats: () => void;
}

export function useUserProfile(): UseUserProfileReturn {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats>({
    level: 1,
    totalXP: 0,
    questsCompleted: 0,
    dayStreak: 0,
  });

  // Load profile and stats on mount
  useEffect(() => {
    const loadedProfile = getUserProfile();
    if (loadedProfile) {
      setProfile(loadedProfile);
    } else {
      // Create default profile if none exists
      const newProfile = updateUserProfile({
        username: 'Adventurer',
        avatarId: 'compass',
      });
      setProfile(newProfile);
    }

    refreshStats();
  }, []);

  const refreshStats = useCallback(() => {
    const progress: PlayerProgress = getPlayerProgress();
    const streak = getCurrentStreak();

    setStats({
      level: progress.level,
      totalXP: progress.totalXP,
      questsCompleted: progress.questsCompleted,
      dayStreak: streak,
    });
  }, []);

  const updateUsername = useCallback((username: string) => {
    const trimmed = username.trim().slice(0, 20); // Max 20 chars
    if (trimmed) {
      const updated = updateUserProfile({ username: trimmed });
      setProfile(updated);
    }
  }, []);

  const updateAvatar = useCallback((avatarId: string) => {
    const updated = updateUserProfile({ avatarId });
    setProfile(updated);
  }, []);

  const currentAvatar = profile
    ? AVATAR_OPTIONS.find(a => a.id === profile.avatarId)
    : AVATAR_OPTIONS[0];

  return {
    profile,
    stats,
    avatarOptions: AVATAR_OPTIONS,
    currentAvatar,
    updateUsername,
    updateAvatar,
    refreshStats,
  };
}
