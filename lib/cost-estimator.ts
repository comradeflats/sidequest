
type CostListener = (cost: number, breakdown: CostBreakdown) => void;

interface CostBreakdown {
  maps: number;
  gemini: number;
  total: number;
}

export class CostEstimator {
  private totalCost = 0;
  private mapsCost = 0;
  private geminiCost = 0;
  private listeners: CostListener[] = [];
  private STORAGE_KEY = 'gemini_gameathon_cost';

  // Pricing Constants (Estimated)
  // Based on Google Cloud Pricing as of Jan 2026 (projected/current)
  private PRICING = {
    // Maps Platform
    MAPS_PLACES_NEARBY: 0.017, // ~$17 per 1000 requests
    MAPS_GEOCODE: 0.005,      // ~$5 per 1000 requests
    MAPS_DISTANCE: 0.005,     // ~$5 per 1000 elements

    // Gemini API (1.5 Flash - Text/Multimodal)
    GEMINI_FLASH_INPUT_1M: 0.075,
    GEMINI_FLASH_OUTPUT_1M: 0.30,

    // Gemini API (Image Generation - Imagen 3 / Pro Image)
    GEMINI_IMAGE_GEN: 0.040,   // ~$0.04 per image

    // Gemini API (Video Input - ~300 tokens/second)
    // Cost per 1000 video tokens (similar to text input pricing)
    GEMINI_VIDEO_INPUT_1K: 0.000075,  // ~$0.075 per 1M tokens

    // Gemini API (Audio Input - ~32 tokens/second)
    // Cost per 1000 audio tokens (similar to text input pricing)
    GEMINI_AUDIO_INPUT_1K: 0.000075,  // ~$0.075 per 1M tokens
  };

  constructor() {
    if (typeof window !== 'undefined') {
      this.load();
      // Reset logic could go here if we wanted per-session, but let's keep it persistent for now
      // so users see the cumulative impact.
    }
  }

  private load() {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        this.totalCost = data.total || 0;
        this.mapsCost = data.maps || 0;
        this.geminiCost = data.gemini || 0;
      }
    } catch (e) {
      // Ignore parsing errors
    }
  }

  private save() {
    if (typeof window !== 'undefined') {
      const data = {
        total: this.totalCost,
        maps: this.mapsCost,
        gemini: this.geminiCost
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    }
  }

  private notify() {
    const breakdown = {
      maps: this.mapsCost,
      gemini: this.geminiCost,
      total: this.totalCost
    };
    this.listeners.forEach(listener => listener(this.totalCost, breakdown));
  }

  public subscribe(listener: CostListener) {
    this.listeners.push(listener);
    // Initial notify
    listener(this.totalCost, { maps: this.mapsCost, gemini: this.geminiCost, total: this.totalCost });
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  // Tracking Methods

  public trackMapsPlacesCall() {
    this.mapsCost += this.PRICING.MAPS_PLACES_NEARBY;
    this.totalCost += this.PRICING.MAPS_PLACES_NEARBY;
    this.notify();
    this.save();
  }

  public trackMapsGeocodeCall() {
    this.mapsCost += this.PRICING.MAPS_GEOCODE;
    this.totalCost += this.PRICING.MAPS_GEOCODE;
    this.notify();
    this.save();
  }

  public trackMapsDistanceCall(elements: number = 1) {
    const cost = elements * this.PRICING.MAPS_DISTANCE;
    this.mapsCost += cost;
    this.totalCost += cost;
    this.notify();
    this.save();
  }

  public trackGeminiInput(charCount: number) {
    // Approximation: 4 chars per token
    const tokens = charCount / 4;
    const cost = (tokens / 1_000_000) * this.PRICING.GEMINI_FLASH_INPUT_1M;
    this.geminiCost += cost;
    this.totalCost += cost;
    this.notify();
    this.save();
  }

  public trackGeminiOutput(charCount: number) {
    // Approximation: 4 chars per token
    const tokens = charCount / 4;
    const cost = (tokens / 1_000_000) * this.PRICING.GEMINI_FLASH_OUTPUT_1M;
    this.geminiCost += cost;
    this.totalCost += cost;
    this.notify();
    this.save();
  }

  public trackGeminiImageGen(count: number = 1) {
    const cost = count * this.PRICING.GEMINI_IMAGE_GEN;
    this.geminiCost += cost;
    this.totalCost += cost;
    this.notify();
    this.save();
  }

  /**
   * Track video input cost
   * @param tokenCount - Number of video tokens (~300 tokens/second of video)
   */
  public trackGeminiVideoInput(tokenCount: number) {
    const cost = (tokenCount / 1000) * this.PRICING.GEMINI_VIDEO_INPUT_1K;
    this.geminiCost += cost;
    this.totalCost += cost;
    this.notify();
    this.save();
  }

  /**
   * Track audio input cost
   * @param tokenCount - Number of audio tokens (~32 tokens/second of audio)
   */
  public trackGeminiAudioInput(tokenCount: number) {
    const cost = (tokenCount / 1000) * this.PRICING.GEMINI_AUDIO_INPUT_1K;
    this.geminiCost += cost;
    this.totalCost += cost;
    this.notify();
    this.save();
  }

  public reset() {
    this.totalCost = 0;
    this.mapsCost = 0;
    this.geminiCost = 0;
    this.save();
    this.notify();
  }
}

export const costEstimator = new CostEstimator();
