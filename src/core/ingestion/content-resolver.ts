import { db } from '../storage/db';

export class ContentResolver {
  private static objectUrlCache = new Map<string, string>();

  /**
   * Resolve an asset path (e.g. "./assets/avatar.png" or "games/khortytsia.html") to a usable Blob URL
   */
  public static async resolveAssetUrl(path: string): Promise<string> {
    if (!path) return '';

    // If it's already an absolute HTTP/HTTPS URL or data URL, return directly
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
      return path;
    }

    const cleanPath = path.replace(/^\.\//, '');

    // Check in-memory cache
    if (this.objectUrlCache.has(cleanPath)) {
      return this.objectUrlCache.get(cleanPath)!;
    }

    // Resolve from Dexie IndexedDB
    try {
      const blob = await db.getAssetBlob(cleanPath);
      if (blob) {
        const objectUrl = URL.createObjectURL(blob);
        this.objectUrlCache.set(cleanPath, objectUrl);
        return objectUrl;
      }
    } catch (err) {
      console.warn(`ContentResolver failed to fetch asset ${cleanPath}:`, err);
    }

    // Fallback if not found in DB
    return path;
  }

  /**
   * Synchronous check if asset URL is already resolved in cache
   */
  public static getCachedUrl(path: string): string | null {
    const cleanPath = path.replace(/^\.\//, '');
    return this.objectUrlCache.get(cleanPath) || null;
  }

  /**
   * Clear Blob URL object cache and release memory
   */
  public static revokeAll() {
    this.objectUrlCache.forEach((url) => {
      URL.revokeObjectURL(url);
    });
    this.objectUrlCache.clear();
  }
}
