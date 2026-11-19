/**
 * Emergency Crash Guard & Blackout Defense
 * Synchronously mirrors active session state into LocalStorage micro-buffer
 * and captures window pagehide / visibilitychange events.
 */

const FLASH_BUFFER_KEY = 'edu_combine_flash_buffer_v1';

export interface FlashBufferPayload {
  questId: string | null;
  stepIndex: number;
  inputDrafts?: Record<string, string | number>;
  completedBlockIds?: string[];
  sandboxState?: Record<string, any>;
  timestamp: number;
}

export class CrashGuard {
  private static isInitialized = false;

  public static init(getCurrentState: () => FlashBufferPayload): void {
    if (this.isInitialized || typeof window === 'undefined') return;

    const forceFlush = () => {
      try {
        const payload = getCurrentState();
        if (payload.questId) {
          localStorage.setItem(FLASH_BUFFER_KEY, JSON.stringify(payload));
        }
      } catch {
        // Silently fail if quota exceeded
      }
    };

    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        forceFlush();
      }
    });

    window.addEventListener('pagehide', forceFlush);
    window.addEventListener('beforeunload', forceFlush);

    this.isInitialized = true;
  }

  public static saveFlashBuffer(payload: FlashBufferPayload): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(FLASH_BUFFER_KEY, JSON.stringify(payload));
    } catch {
      // LocalStorage quota fallback
    }
  }

  public static recoverFlashBuffer(): FlashBufferPayload | null {
    if (typeof localStorage === 'undefined') return null;
    try {
      const raw = localStorage.getItem(FLASH_BUFFER_KEY);
      if (!raw) return null;
      const data: FlashBufferPayload = JSON.parse(raw);
      // Only recover if saved within last 24 hours
      if (Date.now() - data.timestamp < 86400000) {
        return data;
      }
      return null;
    } catch {
      return null;
    }
  }

  public static clearFlashBuffer(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.removeItem(FLASH_BUFFER_KEY);
    } catch {
      // Ignore
    }
  }
}
