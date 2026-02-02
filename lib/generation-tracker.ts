type GenerationListener = (stats: GenerationStats) => void;

export interface DeviceInfo {
  userAgent: string;
  platform: string;
  connection?: string; // 4g, 3g, wifi, unknown
  screenWidth: number;
  screenHeight: number;
  isMobile: boolean;
}

export interface GenerationStep {
  stepName: string;
  stepNumber: number;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'pending' | 'running' | 'complete' | 'error';
  details?: {
    apiCalls?: number;
    tokenCount?: number;
    cost?: number;
    imageCount?: number;
  };
  errorMessage?: string;
}

export interface GenerationStats {
  startTime: number;
  endTime?: number;
  totalDuration?: number;
  steps: GenerationStep[];
  deviceInfo: DeviceInfo;
  status: 'idle' | 'running' | 'complete' | 'error';
}

export class GenerationTracker {
  private currentStats: GenerationStats | null = null;
  private listeners: GenerationListener[] = [];
  private updateThrottle: NodeJS.Timeout | null = null;
  private lastUpdateTime = 0;
  private readonly MIN_UPDATE_INTERVAL = 100; // Max 10 updates/sec

  constructor() {
    // Initialize in browser only
    if (typeof window !== 'undefined') {
      this.deviceInfo = this.detectDeviceInfo();
    }
  }

  private deviceInfo: DeviceInfo = {
    userAgent: '',
    platform: '',
    screenWidth: 0,
    screenHeight: 0,
    isMobile: false
  };

  private detectDeviceInfo(): DeviceInfo {
    if (typeof window === 'undefined') {
      return this.deviceInfo;
    }

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    // Detect connection type (if supported)
    let connection = 'unknown';
    const nav = navigator as any;
    if (nav.connection || nav.mozConnection || nav.webkitConnection) {
      const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
      connection = conn.effectiveType || conn.type || 'unknown';
    }

    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      connection,
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight,
      isMobile
    };
  }

  private notify() {
    // Throttle updates to max 10/sec
    const now = Date.now();
    if (now - this.lastUpdateTime < this.MIN_UPDATE_INTERVAL) {
      // Schedule a delayed update
      if (this.updateThrottle) {
        clearTimeout(this.updateThrottle);
      }
      this.updateThrottle = setTimeout(() => {
        this.notifyImmediate();
      }, this.MIN_UPDATE_INTERVAL);
      return;
    }

    this.notifyImmediate();
  }

  private notifyImmediate() {
    this.lastUpdateTime = Date.now();
    if (this.currentStats) {
      this.listeners.forEach(listener => listener(this.currentStats!));
    }
  }

  public subscribe(listener: GenerationListener) {
    this.listeners.push(listener);
    // Initial notify if we have stats
    if (this.currentStats) {
      listener(this.currentStats);
    }
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  public startGeneration() {
    const now = Date.now();
    this.currentStats = {
      startTime: now,
      steps: [
        { stepName: 'Geocode Location', stepNumber: 1, startTime: 0, status: 'pending' },
        { stepName: 'Places API', stepNumber: 2, startTime: 0, status: 'pending' },
        { stepName: 'Distance Calculations', stepNumber: 3, startTime: 0, status: 'pending' },
        { stepName: 'Campaign Generation', stepNumber: 4, startTime: 0, status: 'pending' },
        { stepName: 'Location Research', stepNumber: 5, startTime: 0, status: 'pending' },
        { stepName: 'Metadata Enrichment', stepNumber: 6, startTime: 0, status: 'pending' },
        { stepName: 'JSON Parsing', stepNumber: 7, startTime: 0, status: 'pending' },
        { stepName: 'Image Generation', stepNumber: 8, startTime: 0, status: 'pending' }
      ],
      deviceInfo: this.detectDeviceInfo(),
      status: 'running'
    };
    this.notify();
  }

  public startStep(stepNumber: number, details?: GenerationStep['details']) {
    if (!this.currentStats) return;

    const step = this.currentStats.steps[stepNumber - 1];
    if (step) {
      step.startTime = Date.now();
      step.status = 'running';
      if (details) {
        step.details = details;
      }
      this.notify();
    }
  }

  public completeStep(stepNumber: number, details?: GenerationStep['details']) {
    if (!this.currentStats) return;

    const step = this.currentStats.steps[stepNumber - 1];
    if (step) {
      step.endTime = Date.now();
      step.duration = step.endTime - step.startTime;
      step.status = 'complete';
      if (details) {
        step.details = { ...step.details, ...details };
      }
      this.notify();
    }
  }

  public failStep(stepNumber: number, errorMessage: string) {
    if (!this.currentStats) return;

    const step = this.currentStats.steps[stepNumber - 1];
    if (step) {
      step.endTime = Date.now();
      step.duration = step.endTime - step.startTime;
      step.status = 'error';
      step.errorMessage = errorMessage;
      this.currentStats.status = 'error';
      this.notify();
    }
  }

  public endGeneration() {
    if (!this.currentStats) return;

    this.currentStats.endTime = Date.now();
    this.currentStats.totalDuration = this.currentStats.endTime - this.currentStats.startTime;
    this.currentStats.status = 'complete';
    this.notify();
  }

  public clear() {
    this.currentStats = null;
    this.notify();
  }

  public getStats(): GenerationStats | null {
    return this.currentStats;
  }

  public exportLogs(): string {
    if (!this.currentStats) {
      return 'No generation data available';
    }

    const stats = this.currentStats;
    const totalDuration = stats.totalDuration || (Date.now() - stats.startTime);
    const totalDurationSec = (totalDuration / 1000).toFixed(1);

    // Calculate total cost from all steps
    const totalCost = stats.steps.reduce((sum, step) => {
      return sum + (step.details?.cost || 0);
    }, 0);

    // Calculate total tokens from all steps
    const totalTokens = stats.steps.reduce((sum, step) => {
      return sum + (step.details?.tokenCount || 0);
    }, 0);

    // Find slowest steps
    const sortedSteps = [...stats.steps]
      .filter(s => s.duration && s.duration > 0)
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, 3);

    // Format timestamp
    const timestamp = new Date(stats.startTime).toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    let log = `=== QUEST GENERATION DEBUG LOG ===\n`;
    log += `Generated: ${timestamp}\n`;
    log += `Device: ${stats.deviceInfo.platform} (${stats.deviceInfo.isMobile ? 'Mobile' : 'Desktop'})\n`;
    log += `Connection: ${stats.deviceInfo.connection || 'unknown'}\n`;
    log += `Screen: ${stats.deviceInfo.screenWidth}x${stats.deviceInfo.screenHeight}\n`;
    log += `\n`;
    log += `SUMMARY:\n`;
    log += `- Total Duration: ${totalDurationSec}s\n`;
    log += `- Total Cost: $${totalCost.toFixed(4)}\n`;
    log += `- Total Tokens: ${totalTokens.toLocaleString()}\n`;
    log += `- Status: ${stats.status === 'complete' ? 'Success' : stats.status === 'error' ? 'Failed' : 'In Progress'}\n`;
    log += `\n`;
    log += `STEP BREAKDOWN:\n`;

    stats.steps.forEach((step, i) => {
      const statusIcon = step.status === 'complete' ? '✓' :
                        step.status === 'error' ? '✗' :
                        step.status === 'running' ? '⏳' : '○';
      const durationMs = step.duration || 0;
      const durationStr = durationMs >= 1000
        ? `${(durationMs / 1000).toFixed(2)}s`
        : `${durationMs}ms`;

      log += `[${i + 1}] ${step.stepName} - ${durationStr} ${statusIcon}\n`;

      if (step.details) {
        if (step.details.apiCalls) log += `    API Calls: ${step.details.apiCalls}\n`;
        if (step.details.tokenCount) log += `    Tokens: ${step.details.tokenCount.toLocaleString()}\n`;
        if (step.details.cost) log += `    Cost: $${step.details.cost.toFixed(4)}\n`;
        if (step.details.imageCount) log += `    Images: ${step.details.imageCount}\n`;
      }

      if (step.errorMessage) {
        log += `    Error: ${step.errorMessage}\n`;
      }
    });

    log += `\n`;
    log += `BOTTLENECK ANALYSIS:\n`;
    if (sortedSteps.length > 0) {
      log += `⚠️  Slowest Steps:\n`;
      sortedSteps.forEach((step, i) => {
        const durationSec = ((step.duration || 0) / 1000).toFixed(1);
        const percentage = totalDuration > 0 ? ((step.duration || 0) / totalDuration * 100).toFixed(1) : '0';
        log += `${i + 1}. ${step.stepName}: ${durationSec}s (${percentage}% of total)\n`;
      });
    }

    log += `\n`;
    log += `💡 Performance Insights:\n`;

    // Network-related insights
    if (stats.deviceInfo.connection === '4g' || stats.deviceInfo.connection === '3g') {
      log += `- Mobile network detected (${stats.deviceInfo.connection}): Image download may be slower\n`;
    }

    // Device-related insights
    if (stats.deviceInfo.isMobile) {
      log += `- Mobile device: May experience browser throttling\n`;
    }

    // Step-specific insights
    const imageStep = stats.steps.find(s => s.stepNumber === 8);
    const campaignStep = stats.steps.find(s => s.stepNumber === 4);

    if (imageStep?.duration && campaignStep?.duration) {
      const imagePercent = (imageStep.duration / totalDuration * 100).toFixed(0);
      const campaignPercent = (campaignStep.duration / totalDuration * 100).toFixed(0);

      if (imageStep.duration > campaignStep.duration) {
        log += `- Image generation is the primary bottleneck (${imagePercent}% of time)\n`;
      } else {
        log += `- Campaign generation is the primary bottleneck (${campaignPercent}% of time)\n`;
      }
    }

    log += `\n`;
    log += `=== END DEBUG LOG ===\n`;

    return log;
  }

  public copyLogsToClipboard(): boolean {
    const logs = this.exportLogs();

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(logs).catch(err => {
        console.error('Failed to copy logs:', err);
      });
      return true;
    }

    return false;
  }
}

export const generationTracker = new GenerationTracker();
