# Firebase Multiplayer Implementation Plan for GeoSeeker

## Overview

Add optional multiplayer functionality using Firebase while preserving the existing single-player experience. Players can choose to play offline (current behavior) or connect to Firebase for profile sync, quest sharing, and social features.

---

## Firebase Services to Use

| Service | Purpose |
|---------|---------|
| **Firebase Auth** | User authentication (Anonymous + Google sign-in) |
| **Cloud Firestore** | Player profiles, shared campaigns, leaderboards |
| **Firebase Storage** | Media uploads (photos, videos, audio submissions) |
| **Firebase Hosting** | Optional - already using Vercel/Next.js |

---

## Firestore Data Schema

```
/users/{userId}
  - displayName: string
  - photoURL: string (optional)
  - createdAt: timestamp
  - lastActiveAt: timestamp
  - totalXP: number
  - level: number
  - questsCompleted: number
  - totalDistanceTraveled: number
  - isAnonymous: boolean

/campaigns/{campaignId}
  - ownerId: string (userId)
  - location: string
  - type: 'short' | 'long'
  - distanceRange: 'local' | 'nearby' | 'far'
  - startCoordinates: { lat, lng }
  - totalDistance: number
  - quests: Quest[] (embedded array)
  - isPublic: boolean
  - shareCode: string (6-char unique code)
  - createdAt: timestamp
  - playCount: number

/campaigns/{campaignId}/completions/{odId}
  - odId: odId
  - odName: string
  - completedAt: timestamp
  - journeyStats: JourneyStats
  - totalTime: number (minutes)
  - mediaSubmissions: string[] (Storage URLs)

/campaigns/{campaignId}/questMedia/{odId}_{questId}
  - odId: string
  - questId: string
  - mediaType: 'photo' | 'video' | 'audio'
  - storageUrl: string
  - thumbnailUrl: string (for videos)
  - uploadedAt: timestamp
  - verificationResult: { success, confidence, feedback }

/leaderboards/global
  - topPlayers: PlayerSummary[] (top 100 by XP)
  - lastUpdated: timestamp

/leaderboards/campaigns/{campaignId}
  - completions: CompletionSummary[] (sorted by time)
```

---

## New Files to Create

```
/lib/firebase/
  ├── config.ts           # Firebase initialization
  ├── auth.ts             # Authentication helpers
  ├── firestore.ts        # Firestore CRUD operations
  ├── storage.ts          # Media upload/download
  └── sync.ts             # Local ↔ Cloud sync logic

/hooks/
  ├── useAuth.ts          # Authentication state hook
  ├── useMultiplayer.ts   # Multiplayer mode toggle + sync
  └── useSharedCampaign.ts # Load campaigns by share code

/components/
  ├── AuthButton.tsx      # Sign in/out UI
  ├── MultiplayerToggle.tsx # Mode switch component
  ├── ShareCampaignDialog.tsx # Generate/copy share links
  ├── CampaignBrowser.tsx # Browse public campaigns
  └── Leaderboard.tsx     # Global/campaign leaderboards
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `package.json` | Add firebase dependency |
| `types/index.ts` | Add User, SharedCampaign, Leaderboard types |
| `lib/storage.ts` | Add multiplayer sync hooks, maintain local-first |
| `app/[locale]/page.tsx` | Add auth state, multiplayer toggle, share buttons |
| `components/QuestBook.tsx` | Add share button, show shared campaigns |
| `components/XPHeader.tsx` | Show cloud sync status indicator |
| `.env.local` | Firebase config environment variables |

---

## Implementation Phases

### Phase 1: Firebase Setup & Auth (Foundation)
1. Install Firebase SDK (`firebase` package)
2. Create `/lib/firebase/config.ts` with initialization
3. Add environment variables for Firebase config (with setup guide)
4. Implement `/lib/firebase/auth.ts` with:
   - **Anonymous sign-in first** (frictionless onboarding)
   - Google sign-in (optional upgrade for persistence)
   - Link anonymous → Google account flow
5. Create `useAuth.ts` hook
6. Add `AuthButton.tsx` component to header

### Phase 2: Campaign Sharing (Primary Feature)
1. Add `shareCode` generation (6-char alphanumeric)
2. Create `ShareCampaignDialog.tsx`:
   - Generate shareable link: `geoseeker.app/join/{shareCode}`
   - Copy to clipboard functionality
   - QR code generation (optional)
3. Create `/app/[locale]/join/[code]/page.tsx` route
4. Implement `useSharedCampaign.ts` hook
5. Add "Import Shared Campaign" to QuestBook
6. Store shared campaigns in Firestore with quest data

### Phase 3: Media Gallery & Social Sharing
1. Implement `/lib/firebase/storage.ts`:
   - Upload photo/video/audio to Firebase Storage
   - Generate thumbnails for videos
   - Return download URLs
2. Store media URLs in Firestore with verification results
3. **Media Gallery**: View submissions from all players on shared campaigns
4. Implement lazy loading and caching for media
5. Add "View Others' Submissions" button on completed quests

### Phase 4: Leaderboards & Competition
1. Create leaderboard Firestore structure
2. Implement `Leaderboard.tsx` component
3. **Per-Campaign Rankings**: Fastest completion time, highest confidence scores
4. **Global Leaderboard**: Top players by XP, quests completed, distance traveled
5. Real-time updates with Firestore listeners

### Phase 5: Profile Sync (Optional Enhancement)
1. Create `/lib/firebase/firestore.ts` with user CRUD
2. Implement profile sync on auth state change
3. Add cloud sync indicator to `XPHeader.tsx`
4. Handle conflict resolution (take highest XP/level)
5. Cross-device progress continuation

---

## Mode Switching Logic

```typescript
// useMultiplayer.ts
const useMultiplayer = () => {
  const [mode, setMode] = useState<'offline' | 'online'>('offline');
  const { user } = useAuth();

  // Offline: Use existing localStorage/IndexedDB
  // Online: Sync to Firebase, fallback to local on network issues

  const enableMultiplayer = async () => {
    if (!user) await signInAnonymously();
    await syncLocalToCloud();
    setMode('online');
  };

  const disableMultiplayer = () => {
    setMode('offline');
    // Keep local data, stop syncing
  };
};
```

---

## Backward Compatibility

- **Default mode**: Offline (single-player) - no Firebase calls
- **Opt-in multiplayer**: User explicitly enables in settings
- **Local-first**: All data saved locally first, then synced
- **Graceful degradation**: If Firebase unavailable, continue offline
- **No data loss**: Existing localStorage data preserved and migratable

---

## Firebase Project Setup Guide

### Step 1: Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" → Name it (e.g., "geoseeker-multiplayer")
3. Disable Google Analytics (optional) → Create project

### Step 2: Enable Authentication
1. In Firebase Console → Authentication → Get started
2. Sign-in method tab → Enable "Anonymous"
3. Enable "Google" (configure OAuth consent screen if prompted)

### Step 3: Create Firestore Database
1. Firestore Database → Create database
2. Choose "Start in test mode" (we'll add security rules later)
3. Select region closest to your users

### Step 4: Enable Storage
1. Storage → Get started
2. Start in test mode
3. Choose same region as Firestore

### Step 5: Get Config Values
1. Project Settings (gear icon) → General
2. Scroll to "Your apps" → Add web app (</> icon)
3. Register app → Copy the `firebaseConfig` object values

### Step 6: Add Environment Variables
Create/update `.env.local`:

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef
```

### Step 7: Security Rules (Before Production)
Firestore rules and Storage rules will be provided in implementation.

---

## Verification Steps

1. **Auth flow**: Sign in anonymously → Sign in with Google → Link accounts
2. **Profile sync**: Create local progress → Enable multiplayer → Verify cloud sync
3. **Campaign sharing**: Complete campaign → Generate share code → Open in incognito → Verify campaign loads
4. **Media upload**: Complete quest with photo → Enable multiplayer → Verify photo in Firebase Storage
5. **Leaderboard**: Complete campaigns with multiple accounts → Verify rankings
6. **Offline resilience**: Disable network → Play game → Re-enable → Verify sync

---

## Estimated Scope & Priority

| Phase | Feature | Priority |
|-------|---------|----------|
| **Phase 1** | Firebase setup + Anonymous auth | Required (foundation) |
| **Phase 2** | Campaign/Quest sharing | **High** (primary feature) |
| **Phase 3** | Media gallery & social | **High** (user requested) |
| **Phase 4** | Leaderboards & competition | **High** (user requested) |
| **Phase 5** | Cross-device profile sync | Low (optional enhancement) |

Each phase is independently deployable. After Phase 1-2, users can share campaigns with friends. Phases 3-4 add the social/competitive layer.
