# Multilingual Support Implementation Status

**🚧 PROJECT SHELVED FOR HACKATHON SUBMISSION**

This feature is ~60% complete (infrastructure done, UI migration pending) but has been shelved to focus on core gameplay and stability for the Gemini 3 Gameathon submission. The app will launch in English-only mode.

**Infrastructure is in place and can be completed post-hackathon in ~8-13 hours.**

---

## ✅ COMPLETED (Jan 13, 2026)

### 1. Video Generation Removal
- ❌ Removed `lib/video-utils.ts` (155 lines)
- ❌ Removed `components/QuestVideoPlayer.tsx` (154 lines)
- ❌ Removed `app/api/generate-video/route.ts` (112 lines)
- ✅ Cleaned up `app/page.tsx` - removed video imports, state, effects
- ✅ Cleaned up `lib/storage.ts` - removed video cache references
- ✅ Cleaned up `lib/gemini.ts` - removed Veo comments
- ✅ Removed `@google-cloud/vertexai` from package.json
- ✅ Removed GCP environment variables from .env.local

**Result:** App now uses image-only quest display, ~500 lines of code removed

### 2. Vietnamese Font Support Fixed
- ✅ Updated `app/layout.tsx` - Added `"latin-ext"` subset to Geist Sans/Mono
- ✅ Updated `app/globals.css` - Added system font fallback for pixel font
- ✅ Vietnamese diacritics (Ấ, Ẩ, Ơ, À, etc.) now render correctly

### 3. AI-Powered Translation System (Hybrid Approach)
- ✅ Created `messages/en.json` - 77 UI strings extracted manually
- ✅ Created `scripts/generate-translations.ts` - Gemini-powered translator
- ✅ Generated `messages/vi.json` - AI-translated Vietnamese (77 strings)
- ✅ Installed `next-intl` (v4.7.0) for i18n framework
- ✅ Installed `tsx` for running TypeScript scripts
- ✅ Installed `dotenv` for environment variable loading
- ✅ Added `npm run generate-translations` script

**How It Works:**
```bash
npm run generate-translations
# Uses Gemini 2.0 Flash to translate en.json → vi.json
# Zero runtime cost, works offline after generation
# Can add more languages by uncommenting lines in script
```

### 4. i18n Infrastructure
- ✅ Created `i18n.ts` - next-intl configuration
- ✅ Created `middleware.ts` - Locale routing (supports /en, /vi)
- ✅ Updated `next.config.ts` - Integrated next-intl plugin
- ✅ Created `app/[locale]/layout.tsx` - IntlProvider wrapper
- ✅ Moved `app/page.tsx` → `app/[locale]/page.tsx`
- ✅ Updated root `app/layout.tsx` - Removed hardcoded lang attribute

**URL Structure:**
- `/` or `/en` → English (default)
- `/vi` → Vietnamese
- Auto-detects browser language preference

---

## 📋 REMAINING WORK

### Phase 1: Update UI Components to Use Translations

**Priority:** HIGH | **Estimated Time:** 4-6 hours

#### Components Needing Translation (80+ strings):

**Main Page (`app/[locale]/page.tsx`):**
- [ ] Import `useTranslations` from 'next-intl'
- [ ] Replace all hard-coded English strings with `t()` calls
- [ ] Key areas:
  - Header: "GEOSEEKER", tagline
  - Location setup: labels, placeholders, buttons
  - Campaign type selector
  - Distance range selector
  - Quest display: objective, buttons, messages
  - Loading states
  - Error messages

**Example:**
```typescript
// Before:
<button>SCAN LOCATION</button>

// After:
import { useTranslations } from 'next-intl';
const t = useTranslations('quest');
<button>{t('scanLocation')}</button>
```

**Other Components:**
- [ ] `components/DistanceRangeSelector.tsx` - distance labels/descriptions
- [ ] `components/Scanner.tsx` - "SCANNING..." text
- [ ] `components/AppealDialog.tsx` - title, subtitle, buttons, placeholders
- [ ] `components/QuestBook.tsx` - tabs, labels, stats
- [ ] `components/JourneyMap.tsx` - completion messages, buttons
- [ ] `components/JourneyStatsCard.tsx` - stat labels
- [ ] `components/LoadingProgress.tsx` - loading messages

### Phase 2: Localize Gemini Quest Generation

**Priority:** HIGH | **Estimated Time:** 3-4 hours

#### lib/game-logic.ts

**generateCampaign() function:**
```typescript
// Add locale parameter (line 6):
export async function generateCampaign(
  location: string,
  type: 'short' | 'long',
  distanceRange: DistanceRange,
  locale: string = 'en'  // NEW
): Promise<Campaign> {

  // Add language instructions:
  const languageInstructions = {
    en: 'Generate all quest content in English.',
    vi: 'Generate all quest content in Vietnamese (tiếng Việt). Use proper Vietnamese grammar and cultural context.'
  };

  // Update prompt (around line 72):
  const prompt = `
    You are an expert travel guide and game designer.

    IMPORTANT: ${languageInstructions[locale] || languageInstructions.en}

    Create a ${type} walking scavenger hunt campaign...

    CRITICAL: All text fields (title, narrative, objective, locationHint)
    must be in ${locale === 'vi' ? 'Vietnamese' : 'English'}.

    // ... rest of prompt
  `;
}
```

**verifyPhoto() function (line 210):**
```typescript
export async function verifyPhoto(
  base64Image: string,
  objective: string,
  secretCriteria: string[],
  userGps?: Coordinates,
  targetGps?: Coordinates,
  locale: string = 'en'  // NEW
): Promise<VerificationResult> {

  const feedbackLanguage = {
    en: 'Respond in English',
    vi: 'Respond in Vietnamese (tiếng Việt)'
  };

  const prompt = `
    ${feedbackLanguage[locale] || feedbackLanguage.en}

    Analyze this image...
    // ... rest of prompt
  `;
}
```

**verifyPhotoWithAppeal() function (line 243):**
- Add same locale parameter
- Update prompt with language instructions

**Update Callers:**
- [ ] `app/[locale]/page.tsx` - Pass locale to generateCampaign(), verifyPhoto(), verifyPhotoWithAppeal()
- [ ] Get locale from `useParams()` hook or `useLocale()` from next-intl

### Phase 3: Add Language Selector UI

**Priority:** MEDIUM | **Estimated Time:** 1-2 hours

#### Create components/LanguageSelector.tsx

```typescript
'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Globe } from 'lucide-react';
import { useState } from 'react';

const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
];

export default function LanguageSelector() {
  const router = useRouter();
  const pathname = usePathname();
  const currentLocale = useLocale();
  const [isOpen, setIsOpen] = useState(false);

  const switchLocale = (newLocale: string) => {
    // Save preference
    localStorage.setItem('preferred_locale', newLocale);

    // Navigate to new locale
    const newPath = pathname.replace(`/${currentLocale}`, `/${newLocale}`);
    router.push(newPath);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-zinc-800 border-2 border-adventure-brown rounded-lg hover:border-adventure-emerald transition-colors"
      >
        <Globe className="w-4 h-4 text-adventure-emerald" />
        <span className="text-sm font-sans text-white">
          {LANGUAGES.find(l => l.code === currentLocale)?.flag}
        </span>
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 right-0 bg-zinc-900 border-2 border-adventure-gold rounded-lg overflow-hidden shadow-xl z-50">
          {LANGUAGES.map(lang => (
            <button
              key={lang.code}
              onClick={() => switchLocale(lang.code)}
              className={`w-full px-4 py-2 text-left font-sans hover:bg-adventure-gold/10 transition-colors flex items-center gap-3 ${
                currentLocale === lang.code ? 'bg-adventure-gold/20 text-adventure-gold' : 'text-white'
              }`}
            >
              <span className="text-xl">{lang.flag}</span>
              <span className="text-sm">{lang.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Add to Header in app/[locale]/page.tsx:**
```typescript
import LanguageSelector from '@/components/LanguageSelector';

// In header section:
<header className="mb-12 text-center relative">
  {/* Language selector - top right */}
  <div className="absolute top-0 right-0">
    <LanguageSelector />
  </div>

  <motion.h1 /* ... */>
    GEOSEEKER
  </motion.h1>
</header>
```

### Phase 4: Locale Persistence in Storage

**Priority:** MEDIUM | **Estimated Time:** 30 minutes

#### lib/storage.ts

**saveCampaign() function:**
```typescript
export function saveCampaign(
  campaign: Campaign,
  progress: any,
  journeyStats?: JourneyStats,
  locale: string = 'en'  // NEW
): void {
  const stored: StoredCampaign = {
    campaign,
    progress,
    journeyStats,
    locale,  // Save locale with campaign
    timestamp: Date.now()
  };
  // ... rest
}
```

**loadCampaign() function:**
```typescript
export function loadCampaign(campaignId: string): StoredCampaign | null {
  // ... existing code
  const stored = JSON.parse(data);

  // Backward compatibility: old saves won't have locale
  if (!stored.locale) {
    stored.locale = 'en';
  }

  return stored;
}
```

**Update TypeScript Types (types/index.ts):**
```typescript
export interface StoredCampaign {
  campaign: Campaign;
  progress: any;
  journeyStats?: JourneyStats;
  locale?: string;  // NEW - optional for backward compat
  timestamp: number;
  completedAt?: number;
}
```

### Phase 5: Testing & Validation

**Priority:** HIGH | **Estimated Time:** 2-3 hours

#### Test Checklist:

**Basic Functionality:**
- [ ] App loads without errors at `/` and `/vi`
- [ ] Language selector appears and works
- [ ] Switching languages updates all UI text
- [ ] Vietnamese fonts render correctly (no broken diacritics)

**Quest Generation:**
- [ ] Generate campaign in English - quests in English
- [ ] Generate campaign in Vietnamese - quests in Vietnamese
- [ ] Quest titles, narratives, objectives all in correct language
- [ ] Photo verification responds in correct language
- [ ] Appeals respond in correct language

**Persistence:**
- [ ] Start campaign in English, switch to Vietnamese - UI updates
- [ ] Resume saved campaign - loads with correct locale
- [ ] Language preference persists across browser sessions
- [ ] Old campaigns (without locale) load correctly

**Edge Cases:**
- [ ] Invalid locale in URL → redirects to English
- [ ] Browser language detection works
- [ ] Placeholders {distance}, {duration} work in both languages
- [ ] Distance/time formatting correct per locale

---

## 🚀 Quick Start Guide

### To Continue Implementation:

1. **Start with one component as proof-of-concept:**
   ```bash
   # Edit app/[locale]/page.tsx
   # Add: import { useTranslations } from 'next-intl';
   # Replace one string: <button>{t('quest.scanLocation')}</button>
   # Test: npm run dev
   ```

2. **Add Gemini localization:**
   ```bash
   # Edit lib/game-logic.ts
   # Add locale parameter to functions
   # Update prompts with language instructions
   ```

3. **Create Language Selector:**
   ```bash
   # Create components/LanguageSelector.tsx
   # Add to header in app/[locale]/page.tsx
   ```

4. **Test thoroughly:**
   ```bash
   npm run dev
   # Visit http://localhost:3000
   # Visit http://localhost:3000/vi
   # Test language switching
   # Generate quests in both languages
   ```

### To Add More Languages:

1. **Update scripts/generate-translations.ts:**
   ```typescript
   // Uncomment:
   await generateTranslation('es', 'Spanish (español)');
   await generateTranslation('fr', 'French (français)');
   ```

2. **Run generator:**
   ```bash
   npm run generate-translations
   ```

3. **Update middleware.ts:**
   ```typescript
   locales: ['en', 'vi', 'es', 'fr'],
   ```

4. **Add to LanguageSelector:**
   ```typescript
   { code: 'es', name: 'Español', flag: '🇪🇸' },
   { code: 'fr', name: 'Français', flag: '🇫🇷' },
   ```

---

## 📁 File Reference

### Translation Files:
- `messages/en.json` - English UI strings (77 strings)
- `messages/vi.json` - Vietnamese UI strings (AI-generated)

### Configuration:
- `i18n.ts` - next-intl configuration
- `middleware.ts` - Locale routing
- `next.config.ts` - next-intl plugin integration

### Scripts:
- `scripts/generate-translations.ts` - AI translation generator
- `npm run generate-translations` - Generate new language files

### Components Needing Updates:
- `app/[locale]/page.tsx` - Main app (BIGGEST CHANGE)
- `components/DistanceRangeSelector.tsx`
- `components/Scanner.tsx`
- `components/AppealDialog.tsx`
- `components/QuestBook.tsx`
- `components/JourneyMap.tsx`
- `components/JourneyStatsCard.tsx`
- `components/LoadingProgress.tsx`

### Logic Updates:
- `lib/game-logic.ts` - Add locale to Gemini functions
- `lib/storage.ts` - Add locale persistence
- `types/index.ts` - Update StoredCampaign interface

---

## 🎯 Success Criteria

When complete, GeoSeeker should:
- ✅ Load in English by default
- ✅ Support Vietnamese with `/vi` URL
- ✅ Display all UI text in selected language
- ✅ Generate quests in selected language
- ✅ Verify photos with responses in selected language
- ✅ Remember language preference across sessions
- ✅ Render Vietnamese diacritics correctly
- ✅ Work offline (translations are pre-generated)
- ✅ Have minimal bundle size impact (<20KB for next-intl)

---

## 💡 Tips

- Use `useTranslations('namespace')` in client components
- Use `getTranslations('namespace')` in server components
- Test both languages after each component update
- Keep translation keys semantic (e.g., `quest.scanLocation` not `button1`)
- Review AI-generated translations - edit vi.json if needed
- Use `npm run generate-translations` to regenerate after adding strings

---

## 🐛 Known Issues / Future Enhancements

- RTL languages (Arabic, Hebrew) not yet supported - requires additional CSS
- Date/time formatting could use next-intl's `useFormatter()`
- Number formatting (distances) could be locale-specific
- Consider adding language detection from GPS coordinates
- Could add "Report Translation Issue" feature

---

**Last Updated:** January 13, 2026
**Status:** Infrastructure Complete, UI Migration Pending
**Next Step:** Update app/[locale]/page.tsx with useTranslations()
