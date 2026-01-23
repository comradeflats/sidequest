/**
 * IndexedDB storage for quest media (images, videos, audio)
 * Provides much larger storage than localStorage (~50MB+ vs 5MB)
 */

const DB_NAME = 'sidequest-db';
const DB_VERSION = 2;  // Bumped for schema changes
const IMAGES_STORE = 'quest-images';
const MEDIA_STORE = 'quest-media';  // New store for video/audio submissions

let dbInstance: IDBDatabase | null = null;

/**
 * Open (or create) the IndexedDB database
 */
export function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    // Return cached instance if available
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create images store with compound key (campaignId + questId)
      if (!db.objectStoreNames.contains(IMAGES_STORE)) {
        const store = db.createObjectStore(IMAGES_STORE, { keyPath: ['campaignId', 'questId'] });
        store.createIndex('campaignId', 'campaignId', { unique: false });
      }

      // Create media store for video/audio submissions
      if (!db.objectStoreNames.contains(MEDIA_STORE)) {
        const mediaStore = db.createObjectStore(MEDIA_STORE, { keyPath: ['campaignId', 'questId'] });
        mediaStore.createIndex('campaignId', 'campaignId', { unique: false });
        mediaStore.createIndex('mediaType', 'mediaType', { unique: false });
      }
    };
  });
}

/**
 * Save a quest image to IndexedDB
 */
export async function saveImageToIndexedDB(
  campaignId: string,
  questId: string,
  base64Data: string
): Promise<void> {
  try {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(IMAGES_STORE, 'readwrite');
      const store = transaction.objectStore(IMAGES_STORE);

      const request = store.put({
        campaignId,
        questId,
        imageData: base64Data,
        savedAt: new Date().toISOString(),
      });

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch {
    // saveImageToIndexedDB error
  }
}

/**
 * Get a quest image from IndexedDB
 */
export async function getImageFromIndexedDB(
  campaignId: string,
  questId: string
): Promise<string | null> {
  try {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(IMAGES_STORE, 'readonly');
      const store = transaction.objectStore(IMAGES_STORE);

      const request = store.get([campaignId, questId]);

      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result.imageData);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch {
    return null;
  }
}

/**
 * Save all images for a campaign to IndexedDB
 */
export async function saveCampaignImages(
  campaignId: string,
  quests: Array<{ id: string; imageUrl?: string }>
): Promise<void> {
  const savePromises = quests
    .filter(quest => quest.imageUrl && quest.imageUrl.startsWith('data:'))
    .map(quest => saveImageToIndexedDB(campaignId, quest.id, quest.imageUrl!));

  await Promise.all(savePromises);
}

/**
 * Load all images for a campaign from IndexedDB
 */
export async function loadCampaignImages(
  campaignId: string,
  questIds: string[]
): Promise<Record<string, string>> {
  const images: Record<string, string> = {};

  const loadPromises = questIds.map(async (questId) => {
    const imageData = await getImageFromIndexedDB(campaignId, questId);
    if (imageData) {
      images[questId] = imageData;
    }
  });

  await Promise.all(loadPromises);

  return images;
}

/**
 * Delete all images for a campaign from IndexedDB
 */
export async function deleteImagesForCampaign(campaignId: string): Promise<void> {
  try {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(IMAGES_STORE, 'readwrite');
      const store = transaction.objectStore(IMAGES_STORE);
      const index = store.index('campaignId');

      const request = index.openCursor(IDBKeyRange.only(campaignId));

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch {
    // deleteImagesForCampaign error
  }
}

/**
 * Check if IndexedDB is available
 */
export function isIndexedDBAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

// ============================================
// Video/Audio Media Storage Functions
// ============================================

export type StoredMediaType = 'video' | 'audio';

interface StoredMedia {
  campaignId: string;
  questId: string;
  mediaType: StoredMediaType;
  mediaData: string;  // base64 data URL
  mimeType: string;
  duration: number;
  savedAt: string;
}

/**
 * Save video/audio media to IndexedDB
 */
export async function saveMediaToIndexedDB(
  campaignId: string,
  questId: string,
  mediaType: StoredMediaType,
  base64Data: string,
  mimeType: string,
  duration: number
): Promise<void> {
  try {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(MEDIA_STORE, 'readwrite');
      const store = transaction.objectStore(MEDIA_STORE);

      const mediaRecord: StoredMedia = {
        campaignId,
        questId,
        mediaType,
        mediaData: base64Data,
        mimeType,
        duration,
        savedAt: new Date().toISOString(),
      };

      const request = store.put(mediaRecord);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch {
    // saveMediaToIndexedDB error
  }
}

/**
 * Get video/audio media from IndexedDB
 */
export async function getMediaFromIndexedDB(
  campaignId: string,
  questId: string
): Promise<StoredMedia | null> {
  try {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(MEDIA_STORE, 'readonly');
      const store = transaction.objectStore(MEDIA_STORE);

      const request = store.get([campaignId, questId]);

      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result as StoredMedia);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch {
    return null;
  }
}

/**
 * Delete all media for a campaign from IndexedDB
 */
export async function deleteMediaForCampaign(campaignId: string): Promise<void> {
  try {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(MEDIA_STORE, 'readwrite');
      const store = transaction.objectStore(MEDIA_STORE);
      const index = store.index('campaignId');

      const request = index.openCursor(IDBKeyRange.only(campaignId));

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch {
    // deleteMediaForCampaign error
  }
}

/**
 * Get estimated storage size for a media file
 * Video: ~5-15MB for 720p 30sec
 * Audio: ~0.5-1MB for 60sec WebM
 */
export function estimateMediaSize(base64Data: string): { bytes: number; megabytes: number } {
  // Base64 is ~33% larger than binary
  const bytes = Math.ceil((base64Data.length * 3) / 4);
  return {
    bytes,
    megabytes: Math.round((bytes / (1024 * 1024)) * 100) / 100
  };
}
