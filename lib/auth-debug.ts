/**
 * Auth Debug Utility
 *
 * Centralized debug logging for Google Auth on mobile devices.
 * Logs persist in sessionStorage to survive page redirects.
 */

const DEBUG_LOG_KEY = 'auth_debug_log';
const DEBUG_STATE_KEY = 'auth_debug_state';
const MAX_LOG_LENGTH = 15000;
const REDIRECT_TIMEOUT_MS = 30000;

export interface AuthDebugState {
  redirectStartedAt: number | null;
  lastAuthEvent: string | null;
  deviceInfo: DeviceInfo | null;
  networkState: NetworkState | null;
}

export interface DeviceInfo {
  userAgent: string;
  platform: string;
  isMobile: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isSafari: boolean;
  isChrome: boolean;
  screenWidth: number;
  screenHeight: number;
}

export interface NetworkState {
  online: boolean;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
}

/**
 * Log a debug message (persists across redirects)
 */
export function authLog(message: string, data?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;

  const timestamp = new Date().toISOString().slice(11, 23);
  const dataStr = data ? ` | ${JSON.stringify(data)}` : '';
  const logEntry = `[${timestamp}] ${message}${dataStr}\n`;

  try {
    const existing = sessionStorage.getItem(DEBUG_LOG_KEY) || '';
    const newLog = (existing + logEntry).slice(-MAX_LOG_LENGTH);
    sessionStorage.setItem(DEBUG_LOG_KEY, newLog);

    // Also log to console for dev tools
    console.log(`[AuthDebug] ${message}`, data || '');
  } catch {
    // sessionStorage not available
    console.log(`[AuthDebug] ${message}`, data || '');
  }
}

/**
 * Get all debug logs
 */
export function getAuthLogs(): string {
  if (typeof window === 'undefined') return '';
  try {
    return sessionStorage.getItem(DEBUG_LOG_KEY) || '';
  } catch {
    return '';
  }
}

/**
 * Clear all debug logs
 */
export function clearAuthLogs(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(DEBUG_LOG_KEY);
    sessionStorage.removeItem(DEBUG_STATE_KEY);
  } catch {
    // sessionStorage not available
  }
}

/**
 * Get device information for debugging
 */
export function getDeviceInfo(): DeviceInfo {
  if (typeof window === 'undefined') {
    return {
      userAgent: 'unknown',
      platform: 'unknown',
      isMobile: false,
      isIOS: false,
      isAndroid: false,
      isSafari: false,
      isChrome: false,
      screenWidth: 0,
      screenHeight: 0,
    };
  }

  const ua = navigator.userAgent;
  return {
    userAgent: ua,
    platform: navigator.platform,
    isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua),
    isIOS: /iPhone|iPad|iPod/i.test(ua),
    isAndroid: /Android/i.test(ua),
    isSafari: /Safari/i.test(ua) && !/Chrome/i.test(ua),
    isChrome: /Chrome/i.test(ua),
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
  };
}

/**
 * Get network state for debugging
 */
export function getNetworkState(): NetworkState {
  if (typeof window === 'undefined') {
    return { online: false };
  }

  const connection = (navigator as NavigatorWithConnection).connection;
  return {
    online: navigator.onLine,
    effectiveType: connection?.effectiveType,
    downlink: connection?.downlink,
    rtt: connection?.rtt,
  };
}

interface NavigatorWithConnection extends Navigator {
  connection?: {
    effectiveType?: string;
    downlink?: number;
    rtt?: number;
  };
}

/**
 * Save debug state (persists across redirects)
 */
export function saveDebugState(state: Partial<AuthDebugState>): void {
  if (typeof window === 'undefined') return;

  try {
    const existing = getDebugState();
    const newState = { ...existing, ...state };
    sessionStorage.setItem(DEBUG_STATE_KEY, JSON.stringify(newState));
  } catch {
    // sessionStorage not available
  }
}

/**
 * Get debug state
 */
export function getDebugState(): AuthDebugState {
  if (typeof window === 'undefined') {
    return {
      redirectStartedAt: null,
      lastAuthEvent: null,
      deviceInfo: null,
      networkState: null,
    };
  }

  try {
    const data = sessionStorage.getItem(DEBUG_STATE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch {
    // sessionStorage not available or invalid data
  }

  return {
    redirectStartedAt: null,
    lastAuthEvent: null,
    deviceInfo: null,
    networkState: null,
  };
}

/**
 * Mark redirect as started (for timeout detection)
 */
export function markRedirectStarted(): void {
  const deviceInfo = getDeviceInfo();
  const networkState = getNetworkState();

  authLog('Redirect started', {
    url: window.location.href,
    device: deviceInfo.isMobile ? 'mobile' : 'desktop',
    platform: deviceInfo.isIOS ? 'iOS' : deviceInfo.isAndroid ? 'Android' : 'other',
    browser: deviceInfo.isSafari ? 'Safari' : deviceInfo.isChrome ? 'Chrome' : 'other',
    online: networkState.online,
  });

  saveDebugState({
    redirectStartedAt: Date.now(),
    deviceInfo,
    networkState,
  });
}

/**
 * Check if redirect has timed out
 */
export function checkRedirectTimeout(): { timedOut: boolean; elapsedMs: number } {
  const state = getDebugState();
  if (!state.redirectStartedAt) {
    return { timedOut: false, elapsedMs: 0 };
  }

  const elapsed = Date.now() - state.redirectStartedAt;
  return {
    timedOut: elapsed > REDIRECT_TIMEOUT_MS,
    elapsedMs: elapsed,
  };
}

/**
 * Clear redirect timeout state
 */
export function clearRedirectState(): void {
  saveDebugState({
    redirectStartedAt: null,
  });
}

/**
 * Log auth event with full context
 */
export function logAuthEvent(event: string, details?: Record<string, unknown>): void {
  const deviceInfo = getDeviceInfo();
  const networkState = getNetworkState();

  authLog(event, {
    ...details,
    isMobile: deviceInfo.isMobile,
    online: networkState.online,
    url: typeof window !== 'undefined' ? window.location.href : 'unknown',
  });

  saveDebugState({
    lastAuthEvent: event,
    deviceInfo,
    networkState,
  });
}

/**
 * Check if we're returning from a redirect
 */
export function isReturningFromRedirect(): boolean {
  const state = getDebugState();
  return state.redirectStartedAt !== null;
}

/**
 * Format logs for display
 */
export function formatLogsForDisplay(): string[] {
  const logs = getAuthLogs();
  if (!logs) return [];
  return logs.trim().split('\n').filter(line => line.length > 0);
}

/**
 * Extract detailed error information for debugging
 */
export interface ExtractedErrorInfo {
  code: string;
  message: string;
  name: string;
  stack?: string;
  customData?: Record<string, unknown>;
}

export function extractErrorInfo(error: unknown): ExtractedErrorInfo {
  if (!error) {
    return { code: 'unknown', message: 'No error provided', name: 'Unknown' };
  }

  if (error instanceof Error) {
    const firebaseError = error as Error & { code?: string; customData?: Record<string, unknown> };
    return {
      code: firebaseError.code || 'unknown',
      message: error.message || 'No message',
      name: error.name || 'Error',
      stack: error.stack?.slice(0, 1000), // Truncate stack to avoid huge logs
      customData: firebaseError.customData,
    };
  }

  if (typeof error === 'object') {
    const obj = error as Record<string, unknown>;
    return {
      code: String(obj.code || 'unknown'),
      message: String(obj.message || 'No message'),
      name: String(obj.name || 'Unknown'),
    };
  }

  return {
    code: 'unknown',
    message: String(error),
    name: 'Unknown',
  };
}

/**
 * Log an auth error with full details including stack trace
 */
export function logAuthError(context: string, error: unknown): void {
  const errorInfo = extractErrorInfo(error);

  authLog(`ERROR [${context}]`, {
    code: errorInfo.code,
    message: errorInfo.message,
    name: errorInfo.name,
  });

  // Log stack trace separately if available
  if (errorInfo.stack) {
    authLog(`STACK [${context}]`, { trace: errorInfo.stack.slice(0, 500) });
  }

  // Log custom data if available (Firebase often includes this)
  if (errorInfo.customData) {
    authLog(`CUSTOM_DATA [${context}]`, errorInfo.customData);
  }
}

/**
 * Log when returning from a redirect (captures URL state)
 */
export function logRedirectReturn(): void {
  if (typeof window === 'undefined') return;

  const url = new URL(window.location.href);
  const searchParams: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    searchParams[key] = value;
  });

  authLog('=== REDIRECT RETURN ===', {
    pathname: url.pathname,
    hash: url.hash ? 'present' : 'none',
    searchParams: Object.keys(searchParams).length > 0 ? searchParams : 'none',
    referrer: document.referrer || 'none',
  });
}

/**
 * Get Firebase configuration debug info (safe - no secrets)
 */
export function getFirebaseDebugInfo(): Record<string, string> {
  // This will be populated from the Firebase config when called
  return {
    authDomain: typeof window !== 'undefined' ? (window as Window & { FIREBASE_AUTH_DOMAIN?: string }).FIREBASE_AUTH_DOMAIN || 'not-set' : 'ssr',
    projectId: typeof window !== 'undefined' ? (window as Window & { FIREBASE_PROJECT_ID?: string }).FIREBASE_PROJECT_ID || 'not-set' : 'ssr',
  };
}
