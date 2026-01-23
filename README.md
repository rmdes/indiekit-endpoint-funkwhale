# @rmdes/indiekit-endpoint-funkwhale

Funkwhale listening activity endpoint for [Indiekit](https://getindiekit.com/).

Display your Funkwhale listening history, favorite tracks, and listening statistics on your IndieWeb site.

## Features

- **Now Playing Widget** - Shows currently playing or recently played tracks
- **Listening History** - Browse your listening history with album art
- **Favorites** - Display your favorite tracks
- **Statistics** - View listening stats with tabbed interface:
  - All Time / This Month / This Week views
  - Top Artists and Albums
  - Listening trend charts
- **Public JSON API** - For integration with static site generators like Eleventy

## Installation

```bash
npm install @rmdes/indiekit-endpoint-funkwhale
```

## Configuration

Add to your `indiekit.config.js`:

```javascript
export default {
  plugins: [
    "@rmdes/indiekit-endpoint-funkwhale",
  ],

  "@rmdes/indiekit-endpoint-funkwhale": {
    mountPath: "/funkwhale",
    instanceUrl: process.env.FUNKWHALE_INSTANCE,
    username: process.env.FUNKWHALE_USERNAME,
    token: process.env.FUNKWHALE_TOKEN,
    cacheTtl: 900_000,  // 15 minutes
    syncInterval: 300_000,  // 5 minutes
    limits: {
      listenings: 20,
      favorites: 20,
      topArtists: 10,
      topAlbums: 10
    }
  },
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

### Protected Routes (require authentication)

| Route | Description |
|-------|-------------|
| `GET /funkwhale/` | Dashboard with overview |
| `GET /funkwhale/listenings` | Full listening history |
| `GET /funkwhale/favorites` | Favorite tracks |
| `GET /funkwhale/stats` | Statistics with tabs |

### Public API Routes (JSON)

| Route | Description |
|-------|-------------|
| `GET /funkwhale/api/now-playing` | Current/recent track |
| `GET /funkwhale/api/listenings` | Recent listenings |
| `GET /funkwhale/api/favorites` | Favorites list |
| `GET /funkwhale/api/stats` | All statistics |
| `GET /funkwhale/api/stats/trends` | Trend data for charts |

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
- MongoDB (for statistics aggregation)
- Funkwhale instance with API v2

## License

MIT
