/**
 * Truncate text with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} [maxLength] - Maximum length
 * @returns {string} - Truncated text
 */
export function truncate(text, maxLength = 80) {
  if (!text || text.length <= maxLength) return text || "";
  return text.slice(0, maxLength - 1) + "...";
}

/**
 * Get the primary artist name from a track
 * @param {object} track - Funkwhale track object
 * @returns {string} - Artist name
 */
export function getArtistName(track) {
  if (!track) return "Unknown Artist";

  const credit = track.artist_credit?.[0];
  if (credit?.artist?.name) {
    return credit.artist.name;
  }
  if (credit?.credit) {
    return credit.credit;
  }

  return "Unknown Artist";
}

/**
 * Get the best available cover URL from a track
 * Prefers medium square crop (200x200) for consistent display
 * @param {object} track - Funkwhale track object
 * @param {string} [size] - Size preference: 'small', 'medium', 'large', 'original'
 * @returns {string|null} - Cover URL or null
 */
export function getCoverUrl(track, size = "medium") {
  if (!track) return null;

  const sizeKey = `${size}_square_crop`;

  // Check track cover
  if (track.cover?.urls) {
    return track.cover.urls[sizeKey] || track.cover.urls.original || null;
  }

  // Check album cover
  if (track.album?.cover?.urls) {
    return track.album.cover.urls[sizeKey] || track.album.cover.urls.original || null;
  }

  // Check artist cover
  const artist = track.artist_credit?.[0]?.artist;
  if (artist?.cover?.urls) {
    return artist.cover.urls[sizeKey] || artist.cover.urls.original || null;
  }

  return null;
}

/**
 * Get the track URL (federation ID)
 * @param {object} track - Funkwhale track object
 * @returns {string|null} - Track URL or null
 */
export function getTrackUrl(track) {
  return track?.fid || null;
}

/**
 * Format duration in seconds to human-readable string
 * @param {number} seconds - Duration in seconds
 * @returns {string} - Formatted duration (e.g., "3:45" or "1h 23m")
 */
export function formatDuration(seconds) {
  if (!seconds || seconds < 0) return "0:00";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Format total listening time for stats display
 * @param {number} seconds - Total seconds
 * @returns {string} - Human-readable duration
 */
export function formatTotalTime(seconds) {
  if (!seconds || seconds < 0) return "0 minutes";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    if (remainingHours > 0) {
      return `${days}d ${remainingHours}h`;
    }
    return `${days} days`;
  }

  if (hours > 0) {
    if (minutes > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${hours} hours`;
  }

  return `${minutes} minutes`;
}

/**
 * Format date for display
 * @param {string|Date} dateInput - ISO date string or Date object
 * @param {string} [locale] - Locale for formatting
 * @returns {string} - Formatted date
 */
export function formatDate(dateInput, locale = "en") {
  const date = new Date(dateInput);
  return date.toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format relative time
 * @param {string|Date} dateInput - ISO date string or Date object
 * @returns {string} - Relative time string
 */
export function formatRelativeTime(dateInput) {
  const date = new Date(dateInput);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return formatDate(dateInput);
}

/**
 * Determine the playing status based on when track was listened
 * @param {string|Date} dateInput - When the track was listened
 * @returns {string|null} - 'now-playing', 'recently-played', or null
 */
export function getPlayingStatus(dateInput) {
  const date = new Date(dateInput);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = diffMs / 60_000;

  if (diffMins < 60) {
    return "now-playing";
  }

  if (diffMins < 24 * 60) {
    return "recently-played";
  }

  return null;
}

/**
 * Format a listening entry for API response
 * @param {object} listening - Funkwhale listening object or MongoDB document
 * @param {boolean} [fromDb] - Whether the listening is from MongoDB
 * @returns {object} - Formatted listening
 */
export function formatListening(listening, fromDb = false) {
  if (fromDb) {
    // From MongoDB
    const listenedAt = listening.listenedAt;
    return {
      id: listening.funkwhaleId,
      track: listening.trackTitle,
      artist: listening.artistName,
      album: listening.albumTitle,
      coverUrl: listening.coverUrl,
      trackUrl: listening.trackFid,
      duration: formatDuration(listening.duration),
      durationSeconds: listening.duration,
      listenedAt: listenedAt.toISOString(),
      relativeTime: formatRelativeTime(listenedAt),
      status: getPlayingStatus(listenedAt),
    };
  }

  // From API
  const track = listening.track;
  const listenedAt = listening.creation_date;

  return {
    id: listening.id,
    track: track.title,
    artist: getArtistName(track),
    album: track.album?.title || null,
    coverUrl: getCoverUrl(track),
    trackUrl: getTrackUrl(track),
    duration: formatDuration(track.uploads?.[0]?.duration),
    durationSeconds: track.uploads?.[0]?.duration || 0,
    listenedAt,
    relativeTime: formatRelativeTime(listenedAt),
    status: getPlayingStatus(listenedAt),
  };
}

/**
 * Format a favorite entry for API response
 * @param {object} favorite - Funkwhale favorite object
 * @returns {object} - Formatted favorite
 */
export function formatFavorite(favorite) {
  const track = favorite.track;

  return {
    id: favorite.id,
    track: track.title,
    artist: getArtistName(track),
    album: track.album?.title || null,
    coverUrl: getCoverUrl(track),
    trackUrl: getTrackUrl(track),
    duration: formatDuration(track.uploads?.[0]?.duration),
    durationSeconds: track.uploads?.[0]?.duration || 0,
    favoritedAt: favorite.creation_date,
    relativeTime: formatRelativeTime(favorite.creation_date),
  };
}
