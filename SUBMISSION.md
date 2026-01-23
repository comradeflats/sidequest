# SideQuest - Hackathon Submission

## Inspiration

The idea for SideQuest came from a simple question: *What if AI could be your local guide, creating personalized adventures that adapt to wherever you are in the world?*

When I saw Gemini 3's multi-modal capabilities, especially the combination of text generation, vision understanding, audio analysis, and image synthesis, I realized I could build something that wasn't just a map app with pins, but an actual *game* that turns exploration into an adventure. The retro 16-bit aesthetic was inspired by the games I grew up with, where every quest felt meaningful and every location told a story.

---

## What it does

**SideQuest** transforms any city into an interactive scavenger hunt powered by Google's Gemini 3 AI.

**Here's how it works:**

1. **Enter any location worldwide** - From "Da Nang, Vietnam" to "Brooklyn, New York"
2. **AI generates personalized quests** - Gemini 3 Flash creates culturally-aware challenges with narratives, hidden verification criteria, and real GPS coordinates
3. **Each quest gets unique pixel art** - Gemini 3 Pro Image generates 16-bit visualizations in a consistent SNES/Genesis aesthetic
4. **Navigate with smart hints** - See the general area without spoiling the exact location (fuzzy 75-150m offset)
5. **Complete quests with multi-modal verification**:
   - **Photo quests**: Capture landmarks, street art, or local dishes
   - **Video quests**: Record 5-30 second clips of performances or environments
   - **Audio quests**: Capture ambient sounds, street music, or spoken content
6. **AI verifies your submission** - Gemini 3 Flash analyzes your media with GPS context for intelligent, forgiving verification
7. **Appeal if needed** - Made a mistake? Explain your context and the AI reconsiders

The game tracks your entire journey—distance walked, time spent, waypoints visited—and provides Google Maps integration for navigation.

---

## How we built it

### Architecture

SideQuest is a **Progressive Web App (PWA)** built with:
- **Next.js 16** with App Router for the frontend
- **React 19** with TypeScript for type safety
- **Tailwind CSS 4** for the retro terminal aesthetic
- **Framer Motion** for smooth animations

### Gemini 3 Integration

The app uses **three distinct Gemini 3 capabilities**:

| Capability | Model | Use Case |
|------------|-------|----------|
| Text Generation | `gemini-3-flash-preview` | Quest narrative creation with structured JSON output |
| Multi-Modal Analysis | `gemini-3-flash-preview` | Photo/video/audio verification with vision and audio understanding |
| Image Synthesis | `gemini-3-pro-image-preview` | 16-bit pixel art generation for quest visualizations |

### Key Technical Decisions

**Prompt Engineering for Consistency:**
Quest generation uses carefully crafted prompts that ensure:
- Cultural relevance based on location
- Appropriate difficulty scaling
- Hidden verification criteria (the AI knows what to look for, but the player doesn't)
- Valid GPS coordinates within the target area

**Multi-Modal Verification Pipeline:**
```
User Media → Base64 Encoding → Gemini 3 Flash
                                    ↓
                            [Photo/Video/Audio Analysis]
                                    ↓
                            GPS Context Injection
                                    ↓
                            Verification Decision + Feedback
```

**Cost Optimization with IndexedDB:**
Quest images are cached locally in IndexedDB (~50MB storage) rather than localStorage (5MB limit). This eliminates redundant image regeneration when users resume sessions, saving $0.12-$0.20 per session resume.

**GPS-Enhanced Verification:**
The verification system is more forgiving when users are within 30 meters of the target location. This accounts for GPS drift and the inherent imprecision of mobile location services.

---

## Challenges we ran into

### 1. The "Hallucinated Coordinates" Problem
Early versions of quest generation would sometimes return GPS coordinates that were technically valid but pointed to the middle of rivers or private property. I solved this by:
- Adding explicit constraints in prompts for "publicly accessible locations"
- Cross-referencing with general area bounds
- Implementing the fuzzy location view so users see the neighborhood, not exact pins

### 2. Multi-Modal Verification Accuracy
Getting Gemini 3 to reliably verify photos was harder than expected. A photo of "a coffee shop" could be rejected because the AI was looking for specific elements. I implemented:
- Hidden verification criteria that are more flexible than public objectives
- The appeal system, where users can explain context
- GPS proximity as a "trust boost" for marginal cases

### 3. Image Generation Consistency
Gemini 3 Pro Image would sometimes generate images in different styles—some photorealistic, some cartoon, some pixel art. I spent significant time on prompt engineering to achieve consistent 16-bit SNES/Genesis aesthetics across all generated images.

### 4. Mobile Battery Drain
Continuous GPS tracking was killing battery life. I optimized to:
- Use `watchPosition` with appropriate accuracy settings
- Only record waypoints when the user has moved significantly
- Achieve <10% battery drain per 30 minutes of active play

### 5. Session Persistence
Users would close the app mid-quest and lose all progress. I implemented:
- Full session state persistence in localStorage
- Image caching in IndexedDB (separate from session state)
- Graceful session resume with all images intact

---

## Accomplishments that we're proud of

### True Multi-Modal AI Integration
SideQuest isn't just using Gemini for text—it's using **text generation, vision analysis, audio understanding, and image synthesis** in a single, cohesive application. Each modality serves a specific purpose in the gameplay loop.

### The Appeal System
When AI verification fails unfairly, users can explain their situation. The AI reconsiders with this context, combining the original media analysis with the user's explanation. This feels genuinely intelligent and forgiving.

### Consistent Retro Aesthetic
Every generated image looks like it belongs in the same game. The 16-bit pixel art style is consistent across thousands of potential quests worldwide, creating a cohesive visual identity.

### Works Anywhere in the World
Enter "Tokyo, Japan" or "Reykjavik, Iceland" or "Buenos Aires, Argentina"—the AI generates culturally appropriate quests with accurate local context. The system is truly global.

### Zero Server Infrastructure
The entire app runs client-side with direct Gemini API calls. No backend servers to maintain, scale, or pay for beyond API usage.

---

## What we learned

### Prompt Engineering is an Art
The difference between "generate a quest" and a carefully structured prompt with examples, constraints, and output formatting is enormous. I spent more time on prompts than on React components.

### Multi-Modal AI Changes Everything
Being able to analyze photos, videos, AND audio in a single model opens up game mechanics that weren't possible before. Quest design becomes much richer when you can ask players to "record the sound of the market" or "capture a video of the street performer."

### GPS is Messy
Mobile GPS is far less accurate than I assumed. Building systems that gracefully handle 20-50 meter drift while still verifying "are you at the right place?" required significant engineering.

### Caching Matters for Cost
Without IndexedDB caching, every session resume would regenerate all quest images. At ~$0.04 per image, a 5-quest campaign costs $0.20 just for images. Caching eliminates this entirely for returning users.

### AI Verification Needs Human Escape Hatches
Even the best AI makes mistakes. The appeal system transformed user frustration ("the AI is wrong!") into engagement ("let me explain why this is actually correct").

---

## What's next for SideQuest

### Multiplayer Campaigns
Compete with friends on the same scavenger hunt. See who completes quests faster, compare photos, and race across the city.

### Themed Quest Packs
- **History Mode**: AI generates quests around historical sites with educational narratives
- **Food Tour**: Discover local cuisine with taste-focused challenges
- **Photo Safari**: Artistic photography challenges with composition criteria
- **Night Mode**: Quests designed for evening exploration

### Community Quest Sharing
Let users create and share their own quest campaigns. The AI can enhance user-created quests with narratives and verification criteria.

### AR Integration
Use device orientation and camera feed to overlay quest hints in augmented reality, creating an even more immersive exploration experience.

### Offline Mode
Pre-download quest campaigns for areas with poor connectivity. Cache everything needed to play without internet, syncing completions when back online.

---

## Built With

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Framer Motion
- Google Gemini 3 (Flash + Pro Image)
- IndexedDB
- Geolocation API
- Progressive Web App (PWA)

---

## Try It Out

- **Repository**: [github.com/comradeflats/sidequest](https://github.com/comradeflats/sidequest)
- **Live Demo**: [Coming Soon]
- **Demo Video**: [Link to 3-minute demonstration]

---

*Built by [@comradeflats](https://github.com/comradeflats) for the Gemini 3 Hackathon 2026*
