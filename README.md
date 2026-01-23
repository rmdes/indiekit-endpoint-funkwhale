# @rmdes/indiekit-endpoint-funkwhale

[![npm version](https://img.shields.io/npm/v/@rmdes/indiekit-endpoint-funkwhale.svg)](https://www.npmjs.com/package/@rmdes/indiekit-endpoint-funkwhale)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Funkwhale listening activity endpoint for [Indiekit](https://getindiekit.com/).

Display your Funkwhale listening history, favorite tracks, and listening statistics on your IndieWeb site.

## Installation

Install from npm:

```bash
npm install @rmdes/indiekit-endpoint-funkwhale
```

## Features

- **Admin Dashboard** - Overview of your listening activity in Indiekit's admin UI
- **Now Playing Widget** - Shows currently playing or recently played tracks
- **Listening History** - Browse your listening history with album art
- **Favorites** - Display your favorite tracks
- **Statistics** - View listening stats (plays, unique tracks, unique artists)
- **Background Sync** - Automatically syncs listening data to MongoDB
- **Public JSON API** - For integration with static site generators like Eleventy

## Configuration

Add to your `indiekit.config.js`:

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
        topAlbums: 10
      }
    }),
  ],
};
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `FUNKWHALE_INSTANCE` | Yes | Your Funkwhale instance URL (e.g., `https://funkwhale.example.com`) |
| `FUNKWHALE_TOKEN` | Yes | API access token (Bearer token) |
| `FUNKWHALE_USERNAME` | Yes | Your username on the Funkwhale instance |

### Getting an API Token

1. Log in to your Funkwhale instance
2. Go to Settings > Applications
3. Create a new application with read permissions
4. Copy the access token

## Routes

### Admin Routes (require authentication)

| Route | Description |
|-------|-------------|
| `GET /funkwhale/` | Dashboard overview with stats, recent plays, favorites |
| `POST /funkwhale/sync` | Trigger manual sync |

### Public API Routes (JSON)

These endpoints are publicly accessible and can be used by static site generators like Eleventy to display listening activity on your site.

| Route | Description |
|-------|-------------|
| `GET /funkwhale/api/now-playing` | Current/recent track |
| `GET /funkwhale/api/listenings` | Recent listenings |
| `GET /funkwhale/api/favorites` | Favorites list |
| `GET /funkwhale/api/stats` | All statistics (summary, top artists, top albums) |
| `GET /funkwhale/api/stats/trends` | Trend data for charts (30 days) |

### Example: Eleventy Integration

Fetch data from the public API in your Eleventy `_data` file:

```javascript
// _data/funkwhale.js
import EleventyFetch from "@11ty/eleventy-fetch";

export default async function() {
  const baseUrl = process.env.SITE_URL || "https://example.com";

  const [nowPlaying, listenings, stats] = await Promise.all([
    EleventyFetch(`${baseUrl}/funkwhale/api/now-playing`, { duration: "15m", type: "json" }),
    EleventyFetch(`${baseUrl}/funkwhale/api/listenings`, { duration: "15m", type: "json" }),
    EleventyFetch(`${baseUrl}/funkwhale/api/stats`, { duration: "15m", type: "json" }),
  ]);

  return { nowPlaying, listenings, stats };
}
```

## Options

| Option | Default | Description |
|--------|---------|-------------|
| `mountPath` | `/funkwhale` | URL path for the endpoint |
| `instanceUrl` | - | Funkwhale instance URL |
| `token` | - | API access token |
| `username` | - | User to track |
| `cacheTtl` | `900000` | Cache TTL in ms (15 min) |
| `syncInterval` | `300000` | Background sync interval in ms (5 min) |
| `limits.listenings` | `20` | Listenings per page |
| `limits.favorites` | `20` | Favorites per page |
| `limits.topArtists` | `10` | Top artists to show |
| `limits.topAlbums` | `10` | Top albums to show |

## Now Playing Logic

- **Now Playing**: Track listened to within the last 60 minutes
- **Recently Played**: Track listened to within the last 24 hours
- **Last Played**: Older tracks show timestamp only

## Requirements

- Indiekit >= 1.0.0-beta.25
- MongoDB (for statistics aggregation and sync)
- Funkwhale instance with API v2

## License

MIT
