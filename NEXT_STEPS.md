# 🚀 GeoSeeker - Next Steps & Multi-Modal Roadmap

**Created:** January 12, 2026
**Focus:** Deployment + Multi-Modal Enhancements
**Budget:** $290 Google Cloud credits available
**Timeline:** 4-week phased rollout

---

## 🎯 Immediate Priority: Deployment to Production

### Phase 1: Deploy Current Version (Today)

#### Step 1: Test Production Build
```bash
npm run build
npm start  # Test production bundle locally
```

**Verify:**
- ✅ No TypeScript compilation errors
- ✅ No build errors
- ✅ Bundle size is reasonable (<1MB client JS)
- ✅ All features work in production mode

#### Step 2: Create GitHub Repository
1. Go to github.com/new
2. Repository name: `geoseeker` (or your preference)
3. Description: "AI-powered location-based scavenger hunt using Gemini 3"
4. Visibility: **Public** (recommended for hackathon visibility)
5. **DO NOT** initialize with README (we have one)

#### Step 3: Push to GitHub
```bash
# Add GitHub remote (replace with your repo URL)
git remote add origin https://github.com/YOUR_USERNAME/geoseeker.git

# Stage all changes
git add .

# Create initial commit
git commit -m "Initial commit: GeoSeeker - Gemini 3 Gameathon submission

Features:
- Gemini 3 Flash for campaign generation
- Gemini 3 Flash for photo verification
- Gemini 3 Pro Image for pixel art generation
- Real-time camera-based gameplay
- Location-aware quest generation"

# Push to GitHub
git push -u origin main
```

#### Step 4: Deploy to Vercel
1. Visit [vercel.com](https://vercel.com)
2. Sign in with GitHub account
3. Click **"New Project"**
4. Import the `geoseeker` repository
5. Framework will auto-detect as **Next.js**
6. **Add Environment Variables:**
   - `NEXT_PUBLIC_GEMINI_API_KEY` = [your Gemini API key]
   - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` = [your Google Maps API key]
7. Click **Deploy**
8. Wait ~2-3 minutes for build

#### Step 5: Production Testing
Once deployed, test the live URL:

**Core Features:**
- ✅ Location input works
- ✅ Campaign generation creates quests
- ✅ Quest images load correctly
- ✅ Distance calculations work
- ✅ Camera opens on mobile
- ✅ Photo verification analyzes images
- ✅ Quest progression works
- ✅ No console errors

**API Routes:**
- ✅ `/api/maps/geocode` returns 200
- ✅ `/api/maps/distance` returns 200
- ✅ `/api/maps/places` returns 200

**Mobile Testing:**
- ✅ Test on iOS Safari
- ✅ Test on Android Chrome
- ✅ Camera permissions work
- ✅ Responsive design looks good

#### Step 6: Configure API Security
In Google Cloud Console:
1. Go to **APIs & Services** > **Credentials**
2. Click on your API key
3. Under **Application restrictions**:
   - Select **HTTP referrers**
   - Add: `https://YOUR_VERCEL_URL.vercel.app/*`
   - Add: `http://localhost:3000/*` (for local dev)
4. Save

**Deployment Complete! 🎉**

---

## 🎬 Phase 2: Multi-Modal Enhancements (Weeks 2-4)

### Overview: Push Gemini 3 to Its Limits

With $290 in Google Cloud credits, we can add three game-changing features:

1. **Video Generation (Veo 3.1)** - Cinematic quest reveals
2. **User Video Submission** - Enhanced verification
3. **User Audio Submission** - Ambient sound verification

---

## 💰 Budget Planning

### Cost Analysis

**Current Baseline (per session):**
- 5 quests × $0.10/image = $0.50
- Campaign generation = $0.01
- 5 photo verifications = $0.05
- **Total: ~$0.56 per session**

**With Multi-Modal Enhancements:**

#### Scenario A: Conservative ($4.56/session)
- 5 quest videos (Veo 3.1 Fast, no audio) = $4.00
- Baseline features = $0.56
- **Sessions possible: 290 ÷ 4.56 = ~63 full games**

#### Scenario B: Moderate ($7.76/session) ⭐ RECOMMENDED
- 5 quest videos (Veo 3.1 Fast with audio) = $6.00
- 1 completion video = $1.20
- Baseline features = $0.56
- **Sessions possible: 290 ÷ 7.76 = ~37 full games**

#### Scenario C: Premium ($19.76/session)
- 6 videos (Veo 3.1 Standard with audio) = $19.20
- Baseline features = $0.56
- **Sessions possible: 290 ÷ 19.76 = ~14 full games**

#### User Video/Audio Verification Costs
- User video analysis: ~$0.03-0.05 per submission
- User audio analysis: ~$0.01-0.02 per submission
- **Negligible impact on budget**

**Recommendation:** Start with **Scenario B** for maximum hackathon impact.

### Budget Tracking
Set up Google Cloud budget alerts:
- Alert at $50 spent
- Alert at $100 spent
- Alert at $150 spent
- Alert at $200 spent
- Hard cap at $250 (keep $40 buffer)

---

## 🎥 Enhancement 1: Video Generation with Veo 3.1

### What It Adds
- **Quest reveal cinematics**: 5-8 second pixel art videos when starting quests
- **Completion celebrations**: Victory animations after successful verification
- **Native audio**: Ambient sounds and chiptune music
- **Wow factor**: Massive differentiation for hackathon demo

### Implementation Plan

#### Files to Create
```
lib/video-utils.ts       # Video generation & caching logic
components/VideoPlayer.tsx   # Custom video player with retro HUD
components/QuestReveal.tsx   # Full-screen quest reveal experience
```

#### Files to Modify
```
lib/gemini.ts           # Add getVeoModel() function
lib/game-logic.ts       # Integrate video generation into campaign flow
app/page.tsx            # Add video player states
```

#### Key Code: Veo Model Setup

```typescript
// lib/gemini.ts
export const getVeoModel = (type: 'fast' | 'standard' = 'fast') => {
  const modelName = type === 'fast'
    ? 'veo-3.1-fast'
    : 'veo-3.1';

  return genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      includeAudio: true,    // Enable native audio generation
      aspectRatio: '16:9',   // Widescreen format
      duration: 5            // 5 seconds (balance cost/impact)
    }
  });
};
```

#### Key Code: Quest Reveal Video

```typescript
// lib/video-utils.ts
export async function generateQuestRevealVideo(
  quest: Quest,
  userLocation: { lat: number; lng: number }
): Promise<string | null> {
  const model = getVeoModel('fast');

  const prompt = `
    Create a 5-second cinematic reveal for a location-based quest.

    Location: ${quest.locationName}
    Quest Theme: ${quest.narrative}
    Art Style: 16-bit pixel art (SNES/Genesis era)

    VISUAL REQUIREMENTS:
    - Establishing shot: Start wide, slowly zoom toward location
    - 16-bit pixel art aesthetic with emerald green (#10b981) palette
    - Vibrant retro game colors with dramatic lighting
    - Clear sense of place and atmosphere
    - NO TEXT or UI elements

    AUDIO REQUIREMENTS:
    - Ambient environmental sounds (city/nature depending on location)
    - Subtle adventurous background music (chiptune style)
    - Audio should build anticipation

    Camera Movement:
    - Smooth cinematic pan or zoom
    - End frame should be hero shot of the location

    The video should feel like the opening to a quest in a classic adventure game.
  `;

  const result = await model.generateContent(prompt);
  const videoPart = result.response.candidates?.[0]?.content?.parts?.[0];

  if (videoPart?.inlineData) {
    const mimeType = videoPart.inlineData.mimeType || 'video/mp4';
    const base64Data = videoPart.inlineData.data;
    return `data:${mimeType};base64,${base64Data}`;
  }

  return null;
}
```

#### Video Caching Strategy

Use **IndexedDB** for browser storage:
- Cache videos by quest ID
- Videos persist across sessions
- LRU eviction when cache exceeds 50MB
- Graceful fallback to static images if generation fails

```typescript
// lib/video-utils.ts
export async function cacheVideo(questId: string, videoData: string): Promise<void> {
  const db = await openDB('geoseeker-videos', 1, {
    upgrade(db) {
      db.createObjectStore('videos', { keyPath: 'questId' });
    }
  });

  await db.put('videos', {
    questId,
    videoData,
    timestamp: Date.now(),
    size: videoData.length
  });
}

export async function getCachedVideo(questId: string): Promise<string | null> {
  const db = await openDB('geoseeker-videos', 1);
  const cached = await db.get('videos', questId);

  if (cached && Date.now() - cached.timestamp < 7 * 24 * 60 * 60 * 1000) {
    return cached.videoData;  // Cache valid for 7 days
  }

  return null;
}
```

#### User Experience Flow

```
User Flow:
1. User clicks "Start New Campaign"
2. Campaign generates with quests
3. User clicks first quest "START QUEST" button
4. → Show loading: "Preparing your cinematic adventure..."
5. → Generate video in background (30-60 seconds)
6. → Play full-screen quest reveal video with audio
7. → Video ends, fade to quest details
8. User proceeds to location

Optimizations:
- Generate first video during campaign creation
- Preload next video while user travels to current quest
- Skip button appears after 2 seconds
- Fallback to static image if generation fails
```

### Testing Checklist

Before merging video generation:
- ✅ Video generates successfully for all quest types
- ✅ Audio plays on mobile (iOS Safari, Android Chrome)
- ✅ Videos cache in IndexedDB correctly
- ✅ Cache eviction works (doesn't exceed 50MB)
- ✅ Fallback to static image works
- ✅ Loading states are clear and informative
- ✅ Video playback is smooth (no stuttering)
- ✅ Skip button works after 2-second delay
- ✅ Fullscreen works on mobile devices
- ✅ Cost tracking accurate in Google Cloud Console
- ✅ Generation time acceptable (30-60 seconds)

### Estimated Timeline
**Week 2:** 5-7 hours implementation + testing

---

## 📹 Enhancement 2: User Video Submission

### What It Adds
- Users can submit **10-second videos** instead of photos
- AI analyzes multiple frames + motion + context
- Higher verification accuracy for ambiguous locations
- More engaging user experience

### Use Cases

**Option A: Photo OR Video (User Choice)**
```
Quest verification screen shows:
[📷 Take Photo] button (current method)
[🎥 Record Video] button (new option)

User chooses based on confidence/situation.
```

**Option B: Video Only for Difficult Quests**
```
High-difficulty quests require video verification.
More evidence = higher confidence in completion.
```

### Implementation Plan

#### Files to Create
```
components/VideoRecorder.tsx    # Video capture with 10-second limit
```

#### Files to Modify
```
components/Scanner.tsx          # Extend to support video mode toggle
lib/game-logic.ts              # Add verifyQuestWithVideo() function
app/page.tsx                   # Add video recording state
```

#### Key Code: Video Recording

```typescript
// components/VideoRecorder.tsx
export function VideoRecorder({ onCapture }: Props) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [countdown, setCountdown] = useState(10);

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: true  // Include ambient audio for context
    });

    const recorder = new MediaRecorder(stream, {
      mimeType: 'video/webm',
      videoBitsPerSecond: 1000000  // 1 Mbps for quality/size balance
    });

    recorder.start();
    setIsRecording(true);

    // Auto-stop after 10 seconds
    setTimeout(() => {
      recorder.stop();
      setIsRecording(false);
      stream.getTracks().forEach(track => track.stop());
    }, 10000);

    recorder.ondataavailable = (e) => {
      const videoBlob = e.data;
      onCapture(videoBlob);
    };
  };

  return (
    <div className="relative w-full h-full">
      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
      {isRecording && (
        <div className="absolute top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-full">
          🔴 {countdown}s
        </div>
      )}
      <button
        onClick={startRecording}
        disabled={isRecording}
        className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
      >
        {isRecording ? 'Recording...' : 'Start Recording'}
      </button>
    </div>
  );
}
```

#### Key Code: Video Verification

```typescript
// lib/game-logic.ts
export async function verifyQuestWithVideo(
  quest: Quest,
  videoBlob: Blob,
  userLocation: { lat: number; lng: number }
): Promise<QuestVerificationResult> {
  const model = getModel('verification');

  // Convert video blob to base64
  const videoBase64 = await blobToBase64(videoBlob);

  const prompt = `
    Analyze this video to verify the user completed a location-based quest.

    QUEST REQUIREMENTS:
    - Target Location: ${quest.locationName}
    - Quest Description: ${quest.narrative}
    - What to find: ${quest.locationHint}
    - Expected GPS: ${quest.location.lat}, ${quest.location.lng}
    - User's GPS: ${userLocation.lat}, ${userLocation.lng}

    VERIFICATION TASK:
    Watch the video and determine:
    1. Does the video show the correct location?
    2. Are the visual landmarks consistent with the quest?
    3. Does the movement/pan provide additional context?
    4. Is there any evidence of photo manipulation or screen recording?

    Respond with JSON:
    {
      "verified": boolean,
      "confidence": number (0-100),
      "reasoning": "detailed explanation of what you see",
      "keyFramesAnalyzed": number,
      "matchedFeatures": ["fountain", "architecture", etc.]
    }
  `;

  const result = await model.generateContent([
    { text: prompt },
    {
      inlineData: {
        mimeType: 'video/webm',
        data: videoBase64
      }
    }
  ]);

  const analysis = JSON.parse(result.response.text());

  return {
    success: analysis.verified && analysis.confidence >= 70,
    confidence: analysis.confidence,
    feedback: analysis.reasoning,
    matchedFeatures: analysis.matchedFeatures
  };
}
```

### Benefits
- **Higher accuracy**: More visual context reduces false positives/negatives
- **Better UX**: Users feel more confident showing multiple angles
- **Fraud prevention**: Much harder to fake a video than a screenshot
- **Cost efficient**: Only ~$0.03-0.05 per verification

### Considerations
- **File size**: 10-second video ≈ 5-10MB (requires compression)
- **Upload time**: May take 10-30 seconds on slow connections
- **Battery drain**: Video recording uses more power
- **UX guidance**: Show tip: "Pan slowly around the location"

### Testing Checklist
- ✅ Video recording starts/stops correctly
- ✅ 10-second auto-cutoff works
- ✅ Video blob converts to base64
- ✅ Upload progress indicator works
- ✅ AI analyzes video frames correctly
- ✅ Verification feedback is detailed
- ✅ Works on iOS Safari and Android Chrome
- ✅ Fallback to photo works if video fails

### Estimated Timeline
**Week 3:** 4-6 hours implementation + testing

---

## 🎙️ Enhancement 3: User Audio Submission

### What It Adds
- **Ambient audio verification**: Record 10 seconds of location sounds
- **Voice narratives**: Users describe what they see
- **Soundscape collection**: Build audio map of locations
- **Multi-modal verification**: Combine photo + audio for highest confidence

### Use Cases

#### 1. Ambient Audio Verification (Recommended)
```
Fountain quest → AI verifies water sounds
Park quest → AI detects birds, wind, children
Busy street → AI confirms traffic, horns, chatter
```

#### 2. Voice Narrative Journal
```
After each quest, record voice reflection:
"I'm standing in front of the old courthouse. There's a statue of..."

AI transcribes + analyzes for location markers.
Creates shareable "audio story" at end of campaign.
```

#### 3. Audio-Only Quests (Experimental)
```
Special quest type: "Close your eyes and listen..."
More abstract, sensory-focused challenges.
Unique differentiation in hackathon.
```

### Implementation Plan

#### Files to Create
```
components/AudioRecorder.tsx    # Audio capture with 10-second limit
```

#### Files to Modify
```
lib/game-logic.ts              # Add verifyQuestWithAudio() function
components/Scanner.tsx         # Add audio recording option
app/page.tsx                   # Add audio recording state
```

#### Key Code: Audio Recording

```typescript
// components/AudioRecorder.tsx
export function AudioRecorder({ onCapture }: Props) {
  const [isRecording, setIsRecording] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);

    const audioChunks: Blob[] = [];
    recorder.ondataavailable = (e) => audioChunks.push(e.data);
    recorder.onstop = () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      onCapture(audioBlob);
      stream.getTracks().forEach(track => track.stop());
    };

    recorder.start();
    setIsRecording(true);

    // Countdown timer
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          recorder.stop();
          setIsRecording(false);
          return 10;
        }
        return prev - 1;
      });
    }, 1000);
  };

  return (
    <div className="audio-recorder">
      <button onClick={startRecording} disabled={isRecording}>
        {isRecording ? '🔴 Recording...' : '🎤 Record Audio'}
      </button>
      {isRecording && (
        <div className="countdown">Time: {countdown}s</div>
      )}
    </div>
  );
}
```

#### Key Code: Audio Analysis

```typescript
// lib/game-logic.ts
export async function verifyQuestWithAudio(
  quest: Quest,
  audioBlob: Blob
): Promise<AudioVerificationResult> {
  const model = getModel('verification');
  const audioBase64 = await blobToBase64(audioBlob);

  const prompt = `
    Analyze this audio recording to help verify a location-based quest.

    QUEST CONTEXT:
    - Location: ${quest.locationName}
    - Type: ${quest.locationHint}

    ANALYSIS TASKS:
    1. Transcribe any speech (if present)
    2. Identify ambient sounds (traffic, water, nature, crowds, etc.)
    3. Determine if audio is consistent with the quest location type
    4. Detect any signs of audio manipulation or playback

    Expected audio characteristics for this location type:
    ${getExpectedAudioForLocationType(quest.locationHint)}

    Respond with JSON:
    {
      "transcription": "text if speech detected",
      "ambientSounds": ["traffic", "birds", "water", etc.],
      "consistentWithLocation": boolean,
      "confidence": number (0-100),
      "reasoning": "explanation"
    }
  `;

  const result = await model.generateContent([
    { text: prompt },
    { inlineData: { mimeType: 'audio/webm', data: audioBase64 } }
  ]);

  return JSON.parse(result.response.text());
}

function getExpectedAudioForLocationType(hint: string): string {
  const audioProfiles = {
    'park': 'birds, wind, children playing, rustling leaves',
    'fountain': 'water flowing, splashing',
    'busy street': 'traffic, car horns, pedestrian chatter',
    'museum': 'quiet indoor ambiance, echoing footsteps',
    'cafe': 'conversation, coffee machines, background music',
    'beach': 'waves, seagulls, wind',
    'market': 'vendors calling, crowd chatter, items moving'
  };

  // Match quest hint to audio profile
  for (const [type, profile] of Object.entries(audioProfiles)) {
    if (hint.toLowerCase().includes(type)) return profile;
  }

  return 'ambient sounds appropriate for the location';
}
```

### User Experience Options

**Option 1: Supplemental Audio (Recommended)**
```
Photo verification is primary.
Audio is optional bonus: "Add ambient audio for +10% confidence boost?"
Low-risk, high-reward feature.
```

**Option 2: Multi-Modal Combo**
```
Require photo AND audio for high-difficulty quests.
Highest confidence verification.
Best for ambiguous or contentious locations.
```

**Option 3: Audio Journal**
```
After each quest completion:
"Record a voice note about your experience... (optional)"
Creates narrative thread throughout campaign.
Shareable as "audio story" at the end.
```

### Benefits
- **Very affordable**: Only $0.01-0.02 per verification
- **Unique verification dimension**: Sound complements visual
- **Creative gameplay**: Sound scavenger hunts
- **Social feature**: Community soundscape collection

### Testing Checklist
- ✅ Audio recording starts/stops correctly
- ✅ 10-second auto-stop works
- ✅ Audio blob converts to base64
- ✅ AI transcribes speech accurately
- ✅ AI identifies ambient sounds correctly
- ✅ Verification reasoning makes sense
- ✅ Works on iOS Safari and Android Chrome
- ✅ Microphone permissions handled gracefully

### Estimated Timeline
**Week 3:** 3-4 hours implementation + testing

---

## 📅 Complete 4-Week Roadmap

### Week 1: Deployment & Stabilization
- ✅ Test production build locally
- ✅ Deploy to Vercel
- ✅ Production testing (all features)
- ✅ Set up cost monitoring
- ✅ Enable Veo 3.1 API access
- ✅ Configure budget alerts
- 📸 Take screenshots for demo
- 🎥 Record initial demo video

### Week 2: Video Generation (Veo 3.1)
- Implement Veo model support in `lib/gemini.ts`
- Create `lib/video-utils.ts` with caching
- Build `components/VideoPlayer.tsx`
- Build `components/QuestReveal.tsx`
- Update `app/page.tsx` for video states
- Test video generation end-to-end
- Monitor costs per session
- Optimize if needed

### Week 3: User Multi-Modal Input
- Implement `components/VideoRecorder.tsx`
- Implement `components/AudioRecorder.tsx`
- Add video verification to `lib/game-logic.ts`
- Add audio verification to `lib/game-logic.ts`
- Update Scanner component for mode toggle
- Test recording on multiple devices
- Test verification accuracy

### Week 4: Polish & Hackathon Prep
- Optimize video compression
- Improve loading states
- Add analytics tracking
- Cost optimization based on real usage
- Create final demo video showcasing all features
- Prepare presentation slides
- Write submission materials
- Final testing on mobile devices
- Monitor budget closely

---

## 🎯 Success Metrics

### Technical Metrics
- ✅ Video generation success rate > 95%
- ✅ Average video generation time < 45 seconds
- ✅ Video cache hit rate > 60%
- ✅ User video verification accuracy > photo verification
- ✅ Audio verification provides +10% confidence boost

### Cost Metrics
- ✅ Average cost per session < $8
- ✅ Total spend < $250 (keep $40 buffer)
- ✅ Cost per feature tracked and optimized

### User Experience Metrics
- ✅ Users complete video-enabled quests at same rate
- ✅ Skip rate for quest reveal videos < 30%
- ✅ Users opt-in to video verification > 40%
- ✅ Positive feedback on cinematic experience

### Hackathon Impact
- ✅ Demo video showcases all multi-modal features
- ✅ Judges recognize technical sophistication
- ✅ Feature complexity aligns with "push Gemini 3 limits" goal
- ✅ Project stands out in multi-modal category

---

## 🛡️ Risk Mitigation

### Risk 1: Video Generation Too Slow
**Impact:** Users drop off during 30-60 second wait
**Mitigation:**
- Preload first video during campaign creation
- Show engaging loading animation with progress
- Provide skip option after 10 seconds
- Cache videos for repeat locations

### Risk 2: Costs Spike Unexpectedly
**Impact:** Budget exhausted before demo
**Mitigation:**
- Set budget alerts at $50, $100, $150, $200
- Feature flags to disable video generation remotely
- Rate limit: Max 1 video per user per minute
- Switch to Scenario A (no audio) if needed

### Risk 3: Browser Compatibility Issues
**Impact:** Features don't work on some devices
**Mitigation:**
- Feature detection before enabling video/audio
- Graceful fallback to static images
- Test on iOS Safari and Android Chrome extensively
- Provide clear error messages

### Risk 4: Veo API Rate Limits
**Impact:** Video generation fails during peak usage
**Mitigation:**
- Implement exponential backoff retry logic
- Queue system for video generation
- Fallback to static images if API unavailable
- Monitor API quotas in Cloud Console

---

## 📊 Cost Tracking Setup

### Google Cloud Budget Alerts

1. Go to **Google Cloud Console**
2. Navigate to **Billing** > **Budgets & alerts**
3. Click **Create Budget**
4. Set budget amount: **$250**
5. Add threshold alerts:
   - 20% ($50) - Email notification
   - 40% ($100) - Email notification
   - 60% ($150) - Email notification + Slack webhook
   - 80% ($200) - Email notification + Slack webhook
   - 100% ($250) - Email notification + disable feature flags

### Daily Cost Reports

Check daily at:
- **Billing** > **Reports**
- Filter by API:
  - Veo 3.1 usage
  - Gemini 3 Flash usage
  - Gemini 3 Pro Image usage
- Export CSV for analysis

### Feature Flags for Cost Control

```typescript
// lib/config.ts
export const FEATURE_FLAGS = {
  VIDEO_GENERATION_ENABLED: process.env.ENABLE_VIDEO_GENERATION === 'true',
  USER_VIDEO_ENABLED: process.env.ENABLE_USER_VIDEO === 'true',
  USER_AUDIO_ENABLED: process.env.ENABLE_USER_AUDIO === 'true',
  VEO_MODEL_TYPE: process.env.VEO_MODEL_TYPE || 'fast' // 'fast' or 'standard'
};
```

Add to Vercel environment variables for remote control.

---

## 🏆 Hackathon Strategy

### Unique Selling Points

1. **Only Project Using Full Gemini 3 Ecosystem**
   - Gemini 3 Flash (text generation)
   - Gemini 3 Flash Vision (photo analysis)
   - Gemini 3 Pro Image (pixel art)
   - Veo 3.1 (video generation)
   - Gemini 3 Audio (audio analysis)

2. **Real-World Gameplay**
   - Actually gets users exploring their city
   - Not just a tech demo, fully playable game

3. **Multi-Modal Verification**
   - Photo + Video + Audio verification
   - Showcases AI's ability to understand multiple modalities

4. **Technical Sophistication**
   - Complex state management
   - Parallel API calls
   - Intelligent caching
   - Graceful degradation

5. **Polished UX**
   - 16-bit pixel art aesthetic
   - Smooth animations
   - Clear feedback
   - Mobile-optimized

### Demo Video Script (2 minutes)

**[0:00-0:15]** Hook
- "What if your city became a video game?"
- Show app on mobile phone
- Cinematic quest reveal playing

**[0:15-0:45]** Setup
- Enter location
- Select CITY_ODYSSEY campaign
- AI generates 5 culturally-aware quests
- Pixel art images appear
- Explain Gemini 3 Flash + Pro Image usage

**[0:45-1:15]** Quest Reveal
- Tap "START QUEST"
- Full-screen Veo 3.1 video plays
- Cinematic flyover with chiptune music
- Quest details appear
- Walk to location (time-lapse)

**[1:15-1:45]** Verification
- Arrive at location
- Show photo option
- Show video option (10-second pan)
- Show audio option (ambient sounds)
- AI analyzes: "Perfect! I can see the fountain..."
- Quest complete animation

**[1:45-2:00]** Wrap-up
- Show completed campaign
- List all 5 Gemini 3 models used
- "Pushing multi-modal AI to its limits"
- Call to action: Try it at [URL]

### Presentation Talking Points

1. **Problem:** Traditional scavenger hunts are static and boring
2. **Solution:** AI-powered, dynamic quests that adapt to any location
3. **Innovation:** First game to use Gemini 3 + Veo 3.1 together
4. **Technical depth:** 5 different AI models working in harmony
5. **Impact:** Encourages real-world exploration and cultural discovery
6. **Scalability:** Works anywhere in the world, any city
7. **Future:** Add multiplayer, leaderboards, user-generated quests

---

## 📝 Final Deployment Checklist

### Pre-Deployment
- ✅ Test production build locally
- ✅ Verify all TypeScript types compile
- ✅ Check .gitignore includes .env.local
- ✅ Verify API keys work
- ✅ Test all features in production mode
- ✅ Optimize bundle size if needed

### GitHub
- ✅ Repository created and public
- ✅ README.md is comprehensive
- ✅ Code pushed to main branch
- ✅ .gitignore configured correctly
- ✅ All commits have clear messages

### Vercel
- ✅ Project imported from GitHub
- ✅ Environment variables added
- ✅ Production deployment successful
- ✅ No build errors
- ✅ Custom domain configured (optional)

### Testing
- ✅ Production URL accessible
- ✅ Location detection works
- ✅ Campaign generation works
- ✅ Quest images load
- ✅ Distance calculations work
- ✅ Camera opens on mobile
- ✅ Photo verification works
- ✅ Quest progression works
- ✅ No console errors

### Security
- ✅ API keys restricted to production domain
- ✅ HTTPS enabled (automatic on Vercel)
- ✅ Environment variables not exposed
- ✅ Rate limiting considered

### Monitoring
- ✅ Google Cloud budget alerts set up
- ✅ Vercel analytics enabled
- ✅ Error tracking configured (optional)
- ✅ Cost monitoring dashboard bookmarked

### Multi-Modal Features (Week 2+)
- ✅ Veo 3.1 API access enabled
- ✅ Video generation tested locally
- ✅ Caching strategy implemented
- ✅ User video recording tested on devices
- ✅ Audio recording tested on devices
- ✅ Cost per session tracked
- ✅ Feature flags configured

---

## 🎬 Let's Ship It!

**Current Status:** ✅ Ready to deploy
**Next Action:** Run `npm run build` and test production bundle
**Timeline:** Can deploy today, enhancements over next 3 weeks
**Budget:** $290 ready to showcase Gemini 3's full power

**This is your hackathon submission. Make it count!** 🚀

---

**Document Version:** 1.0
**Last Updated:** January 12, 2026
**Author:** @comradeflats
**Built For:** Gemini 3 Gameathon 2026
