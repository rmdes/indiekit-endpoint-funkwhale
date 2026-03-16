import { FunkwhaleClient } from "./funkwhale-client.js";
import { getCoverUrl, getArtistName } from "./utils.js";
import { getAllStats, getListeningTrends } from "./stats.js";

let syncInterval = null;

// In-memory cache for stats (accessible to public routes)
let cachedStats = null;
let cachedStatsTime = null;
const STATS_CACHE_TTL = 300_000; // 5 minutes

/**
 * Get cached stats (for public API routes that can't access DB)
 * @returns {object|null} - Cached stats or null
 */
export function getCachedStats() {
  if (!cachedStats) return null;
  if (cachedStatsTime && Date.now() - cachedStatsTime > STATS_CACHE_TTL) {
    return cachedStats; // Return stale cache, sync will refresh
  }
  return cachedStats;
}

/**
 * Update stats cache
 * @param {object} stats - Stats to cache
 */
export function setCachedStats(stats) {
  cachedStats = stats;
  cachedStatsTime = Date.now();
}

/**
 * Refresh stats cache from database (for when cache is empty)
 * @param {object} db - MongoDB database instance
 * @param {object} limits - Limits for top lists
 * @returns {Promise<object|null>} - Stats or null if failed
 */
export async function refreshStatsCache(db, limits = {}) {
  if (!db) return null;
  try {
    const stats = await getAllStats(db, limits);
    setCachedStats(stats);
    console.log("[Funkwhale] Stats cache refreshed on-demand");
    return stats;
  } catch (err) {
    console.error("[Funkwhale] Failed to refresh stats cache:", err.message);
    return null;
  }
}

/**
 * Start background sync process
 * @param {object} Indiekit - Indiekit instance
 * @param {object} options - Plugin options
 */
export function startSync(Indiekit, options) {
  const intervalMs = options.syncInterval || 300_000; // 5 minutes default

  // Initial sync after a short delay
  setTimeout(() => {
    runSync(Indiekit, options).catch((err) => {
      console.error("[Funkwhale] Initial sync error:", err.message);
    });
  }, 5000);

  // Schedule recurring sync
  syncInterval = setInterval(() => {
    runSync(Indiekit, options).catch((err) => {
      console.error("[Funkwhale] Sync error:", err.message);
    });
  }, intervalMs);

  console.log(
    `[Funkwhale] Background sync started (interval: ${intervalMs / 1000}s)`
  );
}

/**
 * Stop background sync
 */
export function stopSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    console.log("[Funkwhale] Background sync stopped");
  }
}

/**
 * Run a single sync operation
 * @param {object} Indiekit - Indiekit instance
 * @param {object} options - Plugin options
 * @returns {Promise<object>} - Sync result
 */
export async function runSync(Indiekit, options) {
  const db = Indiekit.database;
  if (!db) {
    console.log("[Funkwhale] No database available, skipping sync");
    return { synced: 0, error: "No database" };
  }

  const client = new FunkwhaleClient({
    instanceUrl: options.instanceUrl,
    token: options.token,
    username: options.username,
    cacheTtl: 60_000, // Short cache for sync
  });

  let result;
  try {
    result = await syncListenings(db, client);
  } catch (err) {
    const status = Number(err?.status || err?.statusCode || 0);
    const message = String(err?.message || "");
    if (status === 404 || /not found/i.test(message)) {
      console.warn(
        "[Funkwhale] Remote API endpoint not found; skipping sync. Check FUNKWHALE_INSTANCE points to your Funkwhale server root URL."
      );
      return { synced: 0, error: "Not Found" };
    }
    throw err;
  }

  // Update stats cache after sync
  try {
    const stats = await getAllStats(db, options.limits || {});
    setCachedStats(stats);
    console.log("[Funkwhale] Stats cache updated");
  } catch (err) {
    console.error("[Funkwhale] Failed to cache stats:", err.message);
  }

  return result;
}

/**
 * Sync listenings to MongoDB
 * @param {object} db - MongoDB database instance
 * @param {FunkwhaleClient} client - Funkwhale API client
 * @returns {Promise<object>} - Sync result
 */
export async function syncListenings(db, client) {
  const collection = db.collection("listenings");

  // Create index on funkwhaleId for upsert operations
  await collection.createIndex({ funkwhaleId: 1 }, { unique: true });
  // Create index on listenedAt for time-based queries
  await collection.createIndex({ listenedAt: -1 });
  // Create indexes for aggregation
  await collection.createIndex({ artistId: 1 });
  await collection.createIndex({ albumId: 1 });

  // Get the latest synced listening
  const latest = await collection.findOne({}, { sort: { listenedAt: -1 } });
  const latestRawDate = latest?.listenedAt;
  let latestDate = latestRawDate ? new Date(latestRawDate) : new Date(0);

  if (Number.isNaN(latestDate.getTime())) {
    console.warn(
      "[Funkwhale] Invalid listenedAt in latest record; falling back to full sync"
    );
    latestDate = new Date(0);
  }

  console.log(
    `[Funkwhale] Syncing listenings since: ${latestDate.toISOString()}`
  );

  // Fetch new listenings
  let newListenings;
  if (latestDate.getTime() === 0) {
    // First sync: get all
    console.log("[Funkwhale] First sync, fetching all listenings...");
    newListenings = await client.getAllListenings();
  } else {
    // Incremental sync
    newListenings = await client.getNewListenings(latestDate);
  }

  if (newListenings.length === 0) {
    console.log("[Funkwhale] No new listenings to sync");
    return { synced: 0 };
  }

  console.log(`[Funkwhale] Found ${newListenings.length} new listenings`);

  // Transform to our schema
  const docs = [];
  for (const listening of newListenings) {
    try {
      docs.push(transformListening(listening));
    } catch (error) {
      console.warn(
        "[Funkwhale] Skipping malformed listening during sync:",
        error.message,
      );
    }
  }

  // Upsert each document (in case of duplicates)
  let synced = 0;
  for (const doc of docs) {
    try {
      await collection.updateOne(
        { funkwhaleId: doc.funkwhaleId },
        { $set: doc },
        { upsert: true }
      );
      synced++;
    } catch (err) {
      // Ignore duplicate key errors
      if (err.code !== 11000) {
        console.error(`[Funkwhale] Error inserting listening:`, err.message);
      }
    }
  }

  console.log(`[Funkwhale] Synced ${synced} listenings`);
  return { synced };
}

/**
 * Transform Funkwhale listening to our schema
 * @param {object} listening - Funkwhale listening object
 * @returns {object} - Transformed document
 */
function transformListening(listening) {
  const track = listening.track || {};
  const artist = track.artist_credit?.[0]?.artist;
  const album = track.album || null;
  const upload = Array.isArray(track.uploads) ? track.uploads[0] : null;

  const stableListeningId =
    listening.fid ||
    [
      track?.fid || track?.id || "unknown-track",
      listening.creation_date || "unknown-date",
    ].join(":");

  return {
    funkwhaleId: stableListeningId,
    listeningFid: listening.fid || null,
    trackId: track.id,
    trackTitle: track.title,
    trackFid: track.fid,
    artistName: artist?.name || getArtistName(track),
    artistId: artist?.id || null,
    albumTitle: album?.title || null,
    albumId: album?.id || null,
    coverUrl: getCoverUrl(track),
    duration: upload?.duration || 0,
    listenedAt: new Date(listening.creation_date).toISOString(),
    syncedAt: new Date().toISOString(),
  };
}
