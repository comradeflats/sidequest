'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, LogOut, LogIn, Loader2, Cloud, CloudOff, HardDrive } from 'lucide-react';
import { useFirebase, signInAnonymous, signInWithGoogle, linkAnonymousToGoogle, signOut, PopupBlockedError } from '@/lib/firebase';
import UsernameModal from './UsernameModal';

// Debug: detect mobile
const isMobile = typeof window !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// Persistent debug logging that survives redirects
const logToSession = (msg: string) => {
  if (typeof window === 'undefined') return;
  const key = 'auth_debug_log';
  const existing = sessionStorage.getItem(key) || '';
  const timestamp = new Date().toISOString().slice(11, 19);
  sessionStorage.setItem(key, (existing + `${timestamp}: ${msg}\n`).slice(-3000));
  console.log(`[AuthButton] ${msg}`);
};

// Get session debug log
const getSessionLog = (): string => {
  if (typeof window === 'undefined') return '';
  return sessionStorage.getItem('auth_debug_log') || '';
};

interface AuthButtonProps {
  compact?: boolean;
}

export default function AuthButton({ compact = false }: AuthButtonProps) {
  const {
    user,
    loading,
    isAuthenticated,
    displayName,
    storageMode,
    syncStatus,
    needsProfileSetup,
    updateUserDisplayName,
    completeProfileSetup
  } = useFirebase();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [debugLog, setDebugLog] = useState<string[]>([]);

  const addDebug = (msg: string) => {
    logToSession(msg);
    setDebugLog(prev => [...prev.slice(-4), `${new Date().toLocaleTimeString()}: ${msg}`]);
  };

  // Log auth state changes for debugging
  useEffect(() => {
    if (!loading) {
      logToSession(`Auth state: ${user ? `User ${user.uid} (anon: ${user.isAnonymous})` : 'No user'}`);
    }
  }, [user, loading]);

  // Show username modal when profile setup is needed (after anonymous sign-in)
  useEffect(() => {
    if (needsProfileSetup && !loading) {
      setShowUsernameModal(true);
    }
  }, [needsProfileSetup, loading]);

  const handleUsernameSubmit = async (name: string) => {
    await updateUserDisplayName(name);
    completeProfileSetup();
    setShowUsernameModal(false);  // Close modal after successful save
  };

  const handleUsernameModalClose = () => {
    setShowUsernameModal(false);
    // Don't auto-submit - the modal's Skip button handles default name explicitly
  };

  const handleAnonymousSignIn = async () => {
    setIsSigningIn(true);
    setError(null);
    try {
      await signInAnonymous();
      setIsMenuOpen(false);
    } catch (err) {
      setError('Failed to sign in. Please try again.');
      console.error('Anonymous sign in error:', err);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    setError(null);
    addDebug(`Starting Google sign-in (mobile: ${isMobile})`);
    try {
      if (user?.isAnonymous) {
        addDebug('User is anonymous, attempting to link...');
        try {
          // Try to link anonymous account to Google
          await linkAnonymousToGoogle();
          addDebug('Link successful');
        } catch (linkError: any) {
          addDebug(`Link error: ${linkError.code}`);
          // If Google account already exists, sign out and sign in fresh
          if (linkError.code === 'auth/credential-already-in-use') {
            addDebug('Credential in use, signing out...');
            await signOut();
            addDebug('Signed out, signing in fresh...');
            await signInWithGoogle();
          } else {
            throw linkError;
          }
        }
      } else {
        addDebug('No user, calling signInWithGoogle...');
        await signInWithGoogle();
        addDebug('signInWithGoogle returned');
      }
      setIsMenuOpen(false);
    } catch (err: any) {
      addDebug(`Caught error: ${err.code || err.message}`);
      if (err instanceof PopupBlockedError || err.code === 'auth/popup-blocked') {
        setError('Please allow popups for this site, or try Chrome/Safari.');
      } else {
        // Show detailed error for debugging
        const errorCode = err.code || 'unknown';
        const errorMsg = err.message || 'Unknown error';
        setError(`Error: ${errorCode} - ${errorMsg}`);
      }
      console.error('Google sign in error:', err);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setIsMenuOpen(false);
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  // Get status text and color based on storage mode
  const getStatusInfo = () => {
    if (storageMode === 'local') {
      return {
        text: 'Playing Locally',
        color: 'text-gray-400',
        dotColor: 'bg-gray-500',
      };
    }

    if (syncStatus === 'syncing') {
      return {
        text: 'Syncing...',
        color: 'text-yellow-400',
        dotColor: 'bg-yellow-400 animate-pulse',
      };
    }

    if (syncStatus === 'error') {
      return {
        text: 'Sync Error',
        color: 'text-red-400',
        dotColor: 'bg-red-400',
      };
    }

    if (user?.isAnonymous) {
      return {
        text: 'Cloud Connected',
        color: 'text-yellow-400',
        dotColor: 'bg-yellow-400',
      };
    }

    return {
      text: 'Cloud Synced',
      color: 'text-adventure-emerald',
      dotColor: 'bg-adventure-emerald',
    };
  };

  const statusInfo = getStatusInfo();

  if (loading) {
    return (
      <div className={`flex flex-col items-center ${compact ? '' : 'gap-1'}`}>
        <div className="w-10 h-10 bg-black/90 rounded-full border border-zinc-700 flex items-center justify-center">
          <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />
        </div>
        {!compact && <span className="text-[10px] text-gray-500">Loading...</span>}
      </div>
    );
  }

  return (
    <div className="relative">
      <div className={`flex flex-col items-center ${compact ? '' : 'gap-1'}`}>
        {/* Main Button */}
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className={`w-10 h-10 rounded-full border flex items-center justify-center transition-colors relative ${
            isAuthenticated
              ? user?.isAnonymous
                ? 'bg-black/90 border-yellow-500/50 hover:border-yellow-500'
                : 'bg-black/90 border-adventure-emerald/50 hover:border-adventure-emerald'
              : 'bg-black/90 border-zinc-700 hover:border-zinc-500'
          }`}
        >
          {isAuthenticated ? (
            user?.photoURL ? (
              <img
                src={user.photoURL}
                alt="Profile"
                className="w-8 h-8 rounded-full"
              />
            ) : (
              <div className="relative">
                <User className={`w-5 h-5 ${user?.isAnonymous ? 'text-yellow-400' : 'text-adventure-emerald'}`} />
                <Cloud className={`w-3 h-3 ${user?.isAnonymous ? 'text-yellow-400' : 'text-adventure-emerald'} absolute -bottom-1 -right-1`} />
              </div>
            )
          ) : (
            <div className="relative">
              <User className="w-5 h-5 text-gray-500" />
              <HardDrive className="w-3 h-3 text-gray-600 absolute -bottom-1 -right-1" />
            </div>
          )}

          {/* Status dot overlay - visible in compact mode */}
          {compact && (
            <span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-black ${statusInfo.dotColor}`} />
          )}
        </button>

        {/* Status Text - only in non-compact mode */}
        {!compact && (
          <div className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotColor}`} />
            <span className={`text-[10px] ${statusInfo.color}`}>
              {statusInfo.text}
            </span>
          </div>
        )}
      </div>

      {/* Username Modal */}
      <UsernameModal
        isOpen={showUsernameModal}
        onClose={handleUsernameModalClose}
        onSubmit={handleUsernameSubmit}
        defaultValue={displayName || user?.displayName || ''}
      />

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsMenuOpen(false)}
            />

            {/* Menu */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              className="absolute top-full right-0 mt-2 w-64 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-50 overflow-hidden"
            >
              {isAuthenticated ? (
                <>
                  {/* User Info */}
                  <div className="p-4 border-b border-zinc-800">
                    <div className="flex items-center gap-3">
                      {user?.photoURL ? (
                        <img
                          src={user.photoURL}
                          alt="Profile"
                          className="w-10 h-10 rounded-full"
                        />
                      ) : (
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          user?.isAnonymous ? 'bg-yellow-400/20' : 'bg-adventure-emerald/20'
                        }`}>
                          <User className={`w-5 h-5 ${user?.isAnonymous ? 'text-yellow-400' : 'text-adventure-emerald'}`} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {displayName || 'Anonymous Explorer'}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {user?.email || (user?.isAnonymous ? 'Anonymous account' : '')}
                        </p>
                      </div>
                    </div>

                    {/* Cloud Sync Status */}
                    <div className="mt-3 flex items-center gap-2 text-xs">
                      <span className={`w-2 h-2 rounded-full ${statusInfo.dotColor}`} />
                      <span className={statusInfo.color}>{statusInfo.text}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="p-2">
                    {user?.isAnonymous && (
                      <button
                        onClick={handleGoogleSignIn}
                        disabled={isSigningIn}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-white hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                          <path
                            fill="#4285F4"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                          />
                        </svg>
                        <span>Link Google Account</span>
                        {isSigningIn && <Loader2 className="w-4 h-4 animate-spin ml-auto" />}
                      </button>
                    )}

                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-400 hover:bg-zinc-800 rounded-lg transition-colors"
                    >
                      <LogOut className="w-5 h-5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Current Status */}
                  <div className="p-4 border-b border-zinc-800">
                    <div className="flex items-center gap-2 mb-2">
                      <HardDrive className="w-4 h-4 text-gray-400" />
                      <h3 className="text-sm font-medium text-white">
                        Playing Locally
                      </h3>
                    </div>
                    <p className="text-xs text-gray-500">
                      Your progress is saved on this device. Sign in to sync across devices.
                    </p>
                  </div>

                  {error && (
                    <div className="px-4 py-2 bg-red-500/10 text-red-400 text-xs">
                      {error}
                    </div>
                  )}

                  <div className="p-2 space-y-1">
                    <button
                      onClick={handleAnonymousSignIn}
                      disabled={isSigningIn}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-white hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Cloud className="w-5 h-5 text-yellow-400" />
                      <div className="flex-1 text-left">
                        <span className="block">Quick Cloud Save</span>
                        <span className="text-xs text-gray-500">No email required</span>
                      </div>
                      {isSigningIn && <Loader2 className="w-4 h-4 animate-spin" />}
                    </button>

                    <button
                      onClick={handleGoogleSignIn}
                      disabled={isSigningIn}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-white hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                      <div className="flex-1 text-left">
                        <span className="block">Sign in with Google</span>
                        <span className="text-xs text-gray-500">Sync across all devices</span>
                      </div>
                      {isSigningIn && <Loader2 className="w-4 h-4 animate-spin" />}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Debug Panel - Remove after fixing */}
      {debugLog.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 bg-black/95 border border-yellow-500 rounded-lg p-3 z-[100] max-h-48 overflow-auto">
          <div className="text-yellow-500 text-xs font-bold mb-1">Debug Log (mobile: {isMobile ? 'YES' : 'NO'})</div>
          {debugLog.map((log, i) => (
            <div key={i} className="text-white text-xs font-mono">{log}</div>
          ))}
          {/* Session log persists across redirects */}
          <div className="text-gray-400 text-xs font-bold mt-2 mb-1 border-t border-yellow-500/30 pt-2">Session Log (persists):</div>
          <pre className="text-gray-300 text-xs font-mono whitespace-pre-wrap">{getSessionLog()}</pre>
        </div>
      )}
    </div>
  );
}
