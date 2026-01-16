/**
 * IndexedDB storage for quest images
 * Provides much larger storage than localStorage (~50MB+ vs 5MB)
 */

const DB_NAME = 'sidequest-db';
const DB_VERSION = 1;
const IMAGES_STORE = 'quest-images';

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
      console.error('[IndexedDB] Failed to open database:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      console.log('[IndexedDB] Database opened successfully');
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create images store with compound key (campaignId + questId)
      if (!db.objectStoreNames.contains(IMAGES_STORE)) {
        const store = db.createObjectStore(IMAGES_STORE, { keyPath: ['campaignId', 'questId'] });
        store.createIndex('campaignId', 'campaignId', { unique: false });
        console.log('[IndexedDB] Created quest-images store');
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
        console.log(`[IndexedDB] Saved image for quest ${questId}`);
        resolve();
      };

      request.onerror = () => {
        console.error(`[IndexedDB] Failed to save image for quest ${questId}:`, request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('[IndexedDB] saveImageToIndexedDB error:', error);
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
        console.error(`[IndexedDB] Failed to get image for quest ${questId}:`, request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('[IndexedDB] getImageFromIndexedDB error:', error);
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
  console.log(`[IndexedDB] Saved ${savePromises.length} images for campaign ${campaignId}`);
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
  console.log(`[IndexedDB] Loaded ${Object.keys(images).length}/${questIds.length} images for campaign ${campaignId}`);

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
          console.log(`[IndexedDB] Deleted all images for campaign ${campaignId}`);
          resolve();
        }
      };

      request.onerror = () => {
        console.error(`[IndexedDB] Failed to delete images for campaign ${campaignId}:`, request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('[IndexedDB] deleteImagesForCampaign error:', error);
  }
}

/**
 * Check if IndexedDB is available
 */
export function isIndexedDBAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}
