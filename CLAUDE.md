# CLAUDE.md - @rmdes/indiekit-endpoint-funkwhale

## Package Overview

**Name:** `@rmdes/indiekit-endpoint-funkwhale`
**Version:** 1.0.10
**Purpose:** Funkwhale listening activity endpoint for Indiekit. Displays listening history, favorites, and statistics for your Funkwhale music server.

This plugin syncs your Funkwhale listening data to MongoDB, aggregates statistics, and exposes both admin views and public JSON APIs for integration with static site generators like Eleventy.

## Architecture

### Entry Point

**File:** `index.js`

The main export is the `FunkwhaleEndpoint` class which:
- Registers admin routes (dashboard, manual sync) at `mountPath` (default `/funkwhale`)
- Registers public JSON API routes at `mountPath/api/*`
- Creates a MongoDB collection called `listenings`
- Starts a background sync process that runs every 5 minutes (configurable)
- Caches statistics in memory for fast public API access

### Data Flow

```
Background Sync (every 5 minutes)
    → FunkwhaleClient.getNewListenings(since: lastSyncDate)
        → Fetch from Funkwhale API v2
        → Transform to internal schema
        → Upsert to MongoDB (deduplicated by funkwhaleId)
        → Aggregate statistics (top artists, top albums, totals)
        → Cache statistics in memory

Admin Dashboard (protected route)
    → Fetch recent listenings/favorites from Funkwhale API (live)
    → Fetch statistics from in-memory cache
    → Render Nunjucks template with overview

Public API (JSON, no auth)
    → /api/listenings - Recent listenings from Funkwhale API
    → /api/favorites - Favorites from Funkwhale API
    → /api/stats - All statistics from memory cache
    → /api/stats/trends - 30-day daily counts from MongoDB
    → /api/now-playing - Latest listening with status ("now-playing" if <60 min)

Eleventy Integration
    → Fetch from public API in _data/*.js files
    → Cache with @11ty/eleventy-fetch (15 min TTL)
    → Display on static site
```

### Key Classes and Modules

| Module | Purpose |
|--------|---------|
| `index.js` | Plugin class, route registration, sync initialization |
| `lib/funkwhale-client.js` | Funkwhale API v2 client with in-memory cache |
| `lib/sync.js` | Background sync process, stats cache management |
| `lib/stats.js` | MongoDB aggregation queries for statistics |
| `lib/utils.js` | Formatting helpers (duration, relative time, cover URLs) |
| `lib/controllers/dashboard.js` | Admin dashboard overview |
| `lib/controllers/listenings.js` | Listenings list (admin + public API) |
| `lib/controllers/favorites.js` | Favorites list (admin + public API) |
| `lib/controllers/stats.js` | Statistics (public API) |
| `lib/controllers/now-playing.js` | Now playing/recently played (public API) |

## Key Files Table

| File | Description |
|------|-------------|
| `index.js` | Plugin entry point, route registration, sync start |
| `lib/funkwhale-client.js` | HTTP client for Funkwhale API v2 with caching |
| `lib/sync.js` | Background sync loop, incremental fetch, stats cache |
| `lib/stats.js` | MongoDB aggregation pipelines for top artists/albums/trends |
| `lib/utils.js` | Formatting utilities (duration, dates, cover URLs, status) |
| `lib/controllers/dashboard.js` | GET: admin overview, POST: manual sync trigger |
| `lib/controllers/listenings.js` | GET: admin view, GET /api: JSON API |
| `lib/controllers/favorites.js` | GET: admin view, GET /api: JSON API |
| `lib/controllers/stats.js` | GET /api: all stats, GET /api/trends: 30-day chart |
| `lib/controllers/now-playing.js` | GET /api: latest track with playing status |
| `views/funkwhale.njk` | Admin dashboard template |
| `locales/en.json` | i18n strings for UI |

## Routes

### Protected Routes (require authentication)

| Method | Path | Controller | Purpose |
|--------|------|------------|---------|
| GET | `/funkwhale/` | `dashboard.get` | Dashboard overview with recent activity and stats |
| POST | `/funkwhale/sync` | `dashboard.sync` | Trigger manual sync (returns JSON result) |

### Public Routes (JSON API, no authentication)

| Method | Path | Controller | Purpose |
|--------|------|------------|---------|
| GET | `/funkwhale/api/now-playing` | `nowPlaying.api` | Current/recent track with status |
| GET | `/funkwhale/api/listenings` | `listenings.api` | Recent listenings (paginated) |
| GET | `/funkwhale/api/favorites` | `favorites.api` | Favorites list (paginated) |
| GET | `/funkwhale/api/stats` | `stats.api` | All statistics (summary, top artists, top albums) |
| GET | `/funkwhale/api/stats/trends` | `stats.apiTrends` | 30-day listening trends for charts |

**Query Parameters:**
- `page` (integer) - Page number for pagination (default: 1)
- `limit` (integer) - Items per page, max 100 (default: from config)

## Configuration Options

```javascript
import FunkwhaleEndpoint from "@rmdes/indiekit-endpoint-funkwhale";

export default {
  plugins: [
    new FunkwhaleEndpoint({
      mountPath: "/funkwhale",
      instanceUrl: process.env.FUNKWHALE_INSTANCE,
      username: process.env.FUNKWHALE_USERNAME,
      token: process.env.FUNKWHALE_TOKEN,
      cacheTtl: 900_000,      // 15 minutes
      syncInterval: 300_000,  // 5 minutes
      limits: {
        listenings: 20,
        favorites: 20,
        topArtists: 10,
        topAlbums: 10,
      },
    }),
  ],
};
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `FUNKWHALE_INSTANCE` | Yes | Funkwhale instance URL (e.g., `https://funkwhale.example.com`) |
| `FUNKWHALE_TOKEN` | Yes | API access token (Bearer token) |
| `FUNKWHALE_USERNAME` | Yes | Your username on the Funkwhale instance (for favorites filtering) |

**Getting an API Token:**
1. Log in to your Funkwhale instance
2. Go to Settings > Applications
3. Create a new application with read permissions
4. Copy the access token

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `mountPath` | string | `/funkwhale` | URL path for the endpoint |
| `instanceUrl` | string | - | Funkwhale instance URL (required) |
| `token` | string | - | API access token (required) |
| `username` | string | - | User to track (required) |
| `cacheTtl` | number | 900000 | Cache TTL in ms (15 min) |
| `syncInterval` | number | 300000 | Background sync interval in ms (5 min) |
| `limits.listenings` | number | 20 | Listenings per page |
| `limits.favorites` | number | 20 | Favorites per page |
| `limits.topArtists` | number | 10 | Top artists to show in stats |
| `limits.topAlbums` | number | 10 | Top albums to show in stats |

## MongoDB Schema

### `listenings` Collection

The plugin creates a MongoDB collection with this schema:

```javascript
{
  funkwhaleId: 12345,           // Unique ID from Funkwhale (indexed)
  trackId: 67890,               // Track ID
  trackTitle: "Song Title",
  trackFid: "https://...",      // Federation ID (track URL)
  artistName: "Artist Name",
  artistId: 111,                // Artist ID (indexed for aggregation)
  albumTitle: "Album Title",
  albumId: 222,                 // Album ID (indexed for aggregation)
  coverUrl: "https://...",      // Cover image URL (200x200)
  duration: 180,                // Duration in seconds
  listenedAt: ISODate("..."),   // When listened (indexed, DESC)
  syncedAt: ISODate("..."),     // When synced to DB
}
```

**Indexes:**
- `funkwhaleId` (unique) - For upsert deduplication
- `listenedAt` (descending) - For time-based queries
- `artistId` - For top artists aggregation
- `albumId` - For top albums aggregation

## Inter-Plugin Relationships

### Provides to Indiekit Core

- `application.funkwhaleConfig` - Plugin configuration
- `application.funkwhaleEndpoint` - Mount path
- `application.getFunkwhaleDb` - Getter for MongoDB database instance
- Adds to `navigationItems` - Admin sidebar link (requires database)
- Adds to `shortcutItems` - Dashboard shortcut widget (requires database)
- Registers `listenings` collection in Indiekit's MongoDB

### Dependencies

- **@indiekit/error** - Error handling utilities
- **express** - Web framework
- **@indiekit/indiekit** (peer) - Indiekit core >= 1.0.0-beta.25

### Used By

- **Eleventy static site** - Fetches data from public JSON API in `_data/*.js` files
- **indiekit-eleventy-theme** - Displays listening activity widgets on homepage/sidebar

## Known Gotchas

### 1. Now Playing Logic

The `status` field in listenings indicates:
- `"now-playing"` - Track listened to within the last 60 minutes
- `"recently-played"` - Track listened to within the last 24 hours
- `null` - Older tracks

This logic is in `lib/utils.js:getPlayingStatus()`.

### 2. Favorites Filtering

The Funkwhale API returns ALL users' favorites. This plugin filters them server-side to only show favorites by the configured `username`.

```javascript
// In funkwhale-client.js
response.results = response.results.filter(
  (fav) => fav.actor?.preferred_username === this.username
);
```

Without this filtering, you'd see favorites from all users on the instance.

### 3. Incremental Sync

The sync process is incremental:
- First sync: Fetches ALL listenings (paginated, can be slow)
- Subsequent syncs: Only fetch listenings newer than the latest in the database

The `listenedAt` field is used to determine the cutoff date.

### 4. Statistics Cache

Statistics are cached in memory (not MongoDB) with a 5-minute TTL. This cache is:
- Refreshed after every successful sync
- Used by the public `/api/stats` endpoint
- Refreshed on-demand if empty when the admin dashboard loads

**Why in-memory?** The aggregation queries are expensive. Caching avoids hitting MongoDB for every public API request.

### 5. Cover Image URLs

Cover images are fetched in this order:
1. Track cover (`track.cover.urls.medium_square_crop`)
2. Album cover (`track.album.cover.urls.medium_square_crop`)
3. Artist cover (`track.artist_credit[0].artist.cover.urls.medium_square_crop`)

Prefers 200x200 square crops for consistent display. Falls back to `original` if crop unavailable.

### 6. API Client Cache

The `FunkwhaleClient` class has its own in-memory cache (default 15 min TTL). This is separate from:
- Stats cache (in `sync.js`)
- Eleventy's `@11ty/eleventy-fetch` cache (frontend)

**Why three caches?**
- Client cache: Avoid redundant HTTP requests to Funkwhale within a short time
- Stats cache: Avoid expensive MongoDB aggregations
- Eleventy cache: Avoid hitting Indiekit API on every Eleventy build

### 7. Date Handling

**IMPORTANT:** This plugin follows Indiekit's date convention:
- Dates are stored as ISO 8601 strings in MongoDB (`listenedAt: "2025-02-13T14:30:00.000Z"`)
- Dates are passed to templates as ISO strings, NOT `Date` objects
- Templates use `| date("PPp")` filter for formatting

**Common mistake:** Storing `new Date()` instead of `new Date().toISOString()` causes Nunjucks template crashes.

See CLAUDE.md "CRITICAL: Indiekit Date Handling Convention" for details.

### 8. Background Sync

The sync starts automatically when Indiekit starts (if MongoDB is available):
- Initial sync runs after 5 seconds
- Recurring sync runs every `syncInterval` ms (default 5 minutes)
- Can be triggered manually via POST `/funkwhale/sync`

**Note:** The sync runs in the same Node.js process (no separate worker). Long sync times block the event loop.

### 9. API Rate Limits

The plugin does NOT implement rate limiting for the public API. If your site gets heavy traffic, consider:
- Increasing `cacheTtl` to reduce Funkwhale API load
- Using a CDN to cache the JSON responses
- Setting up Eleventy's cache with a longer TTL

### 10. Duration Formatting

Durations under 1 hour: `"3:45"` (minutes:seconds)
Durations over 1 hour: `"1h 23m"` (hours and minutes)

Total listening time uses different formatting:
- Under 1 hour: `"45 minutes"`
- Under 24 hours: `"5h 30m"`
- Over 24 hours: `"2d 5h"` or `"2 days"`

See `lib/utils.js:formatDuration()` and `formatTotalTime()`.

## Commands

No CLI commands. The sync runs automatically in the background.

**Manual sync via API:**
```bash
curl -X POST https://your-indiekit.example.com/funkwhale/sync \
  -H "Cookie: session=YOUR_SESSION_COOKIE" \
  -H "Content-Type: application/json"
```

## Eleventy Integration Example

```javascript
// _data/funkwhale.js
import EleventyFetch from "@11ty/eleventy-fetch";

export default async function() {
  const baseUrl = process.env.SITE_URL || "https://example.com";

  try {
    const [nowPlaying, listenings, stats] = await Promise.all([
      EleventyFetch(`${baseUrl}/funkwhale/api/now-playing`, {
        duration: "15m",
        type: "json",
      }),
      EleventyFetch(`${baseUrl}/funkwhale/api/listenings?limit=10`, {
        duration: "15m",
        type: "json",
      }),
      EleventyFetch(`${baseUrl}/funkwhale/api/stats`, {
        duration: "15m",
        type: "json",
      }),
    ]);

    return { nowPlaying, listenings, stats };
  } catch (error) {
    console.error("Funkwhale data fetch error:", error);
    return { nowPlaying: null, listenings: [], stats: null };
  }
}
```

## Testing

No test suite included. Test manually by:

1. Starting Indiekit with MongoDB and this plugin
2. Verifying the sync runs and populates the `listenings` collection
3. Accessing the admin dashboard at `/funkwhale/`
4. Fetching the public API endpoints with `curl`:

```bash
# Check now playing
curl https://your-indiekit.example.com/funkwhale/api/now-playing

# Check stats
curl https://your-indiekit.example.com/funkwhale/api/stats

# Check listenings
curl https://your-indiekit.example.com/funkwhale/api/listenings?page=1&limit=5
```

## Requirements

- **Indiekit** >= 1.0.0-beta.25
- **MongoDB** (for statistics aggregation and sync)
- **Funkwhale instance** with API v2 support

Without MongoDB, the plugin will not work (sync will not start, stats will not be available).

## Statistics Aggregation Details

### Summary Statistics

For all time, past month, and past week:
- Total plays
- Total listening time (seconds)
- Unique tracks
- Unique artists
- Unique albums

### Top Artists

Grouped by `artistId`, sorted by play count:
- Artist name
- Play count
- Total duration

### Top Albums

Grouped by `albumId`, sorted by play count:
- Album title
- Artist name
- Cover URL
- Play count
- Total duration

### Listening Trends

Daily counts for the last 30 days:
- Date (YYYY-MM-DD)
- Play count
- Total duration

Used for charting listening activity over time.

## Startup Gate

This plugin uses `@rmdes/indiekit-startup-gate` to defer background tasks until the host signals readiness (after Eleventy build completes). This prevents resource contention during the build.

**Deferred:** `startSync()` — periodic Funkwhale listening history sync
**Immediate:** Routes, indexes, collection registration

See workspace CLAUDE.md for the full startup-gate pattern. Any new background tasks added to this plugin MUST be wrapped in `waitForReady()`.

## Public API Response Formats

### GET /api/now-playing

```json
{
  "id": 12345,
  "track": "Song Title",
  "artist": "Artist Name",
  "album": "Album Title",
  "coverUrl": "https://...",
  "trackUrl": "https://...",
  "duration": "3:45",
  "durationSeconds": 225,
  "listenedAt": "2025-02-13T14:30:00.000Z",
  "relativeTime": "5m ago",
  "status": "now-playing"
}
```

### GET /api/listenings

```json
{
  "listenings": [...],  // Array of listening objects (same format as now-playing)
  "total": 1234,
  "page": 1,
  "hasNext": true,
  "hasPrev": false
}
```

### GET /api/favorites

```json
{
  "favorites": [...],  // Array of favorite objects (similar to listenings, with favoritedAt)
  "total": 56,
  "page": 1,
  "hasNext": false,
  "hasPrev": false
}
```

### GET /api/stats

```json
{
  "summary": {
    "all": { "totalPlays": 5000, "totalDuration": 900000, "uniqueTracks": 1200, ... },
    "month": { ... },
    "week": { ... }
  },
  "topArtists": {
    "all": [{ "_id": 123, "name": "Artist", "playCount": 100, "totalDuration": 18000 }, ...],
    "month": [...],
    "week": [...]
  },
  "topAlbums": {
    "all": [{ "_id": 456, "title": "Album", "artist": "Artist", "coverUrl": "...", ... }, ...],
    "month": [...],
    "week": [...]
  },
  "trends": [
    { "date": "2025-02-01", "count": 50, "duration": 9000 },
    ...
  ]
}
```
