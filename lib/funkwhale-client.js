import { IndiekitError } from "@indiekit/error";

export class FunkwhaleClient {
  /**
   * @param {object} options - Client options
   * @param {string} options.instanceUrl - Funkwhale instance URL
   * @param {string} options.token - API access token
   * @param {string} options.username - Username to filter by
   * @param {number} [options.cacheTtl] - Cache TTL in milliseconds
   */
  constructor(options = {}) {
    this.instanceUrl = options.instanceUrl?.replace(/\/$/, ""); // Remove trailing slash
    this.token = options.token;
    this.username = options.username;
    this.cacheTtl = options.cacheTtl || 900_000;
    this.cache = new Map();
  }

  /**
   * Fetch from Funkwhale API with caching
   * @param {string} endpoint - API endpoint path
   * @param {object} [params] - Query parameters
   * @returns {Promise<object>} - Response data
   */
  async fetch(endpoint, params = {}) {
    const url = new URL(endpoint, this.instanceUrl);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });

    const cacheKey = url.toString();

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTtl) {
      return cached.data;
    }

    const headers = {
      Accept: "application/json",
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const response = await fetch(url.toString(), { headers });

    if (!response.ok) {
      throw await IndiekitError.fromFetch(response);
    }

    const data = await response.json();

    // Cache result
    this.cache.set(cacheKey, { data, timestamp: Date.now() });

    return data;
  }

  /**
   * Get listening history
   * @param {number} [page] - Page number
   * @param {number} [pageSize] - Items per page
   * @returns {Promise<object>} - Paginated listenings
   */
  async getListenings(page = 1, pageSize = 50) {
    return this.fetch("/api/v2/history/listenings", {
      page,
      page_size: pageSize,
      scope: this.username && this.token ? "me" : "all",
    });
  }

  /**
   * Get all listenings by paginating through all pages
   * @returns {Promise<Array>} - All listenings
   */
  async getAllListenings() {
    const allListenings = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await this.getListenings(page, 100);
      allListenings.push(...response.results);
      hasMore = response.next !== null;
      page++;
    }

    return allListenings;
  }

  /**
   * Get new listenings since a given date
   * Used for incremental sync
   * @param {Date} since - Only fetch listenings after this date
   * @returns {Promise<Array>} - New listenings
   */
  async getNewListenings(since) {
    const newListenings = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await this.getListenings(page, 100);

      for (const listening of response.results) {
        const listenedAt = new Date(listening.creation_date);
        if (listenedAt > since) {
          newListenings.push(listening);
        } else {
          // We've reached older listenings, stop
          hasMore = false;
          break;
        }
      }

      if (hasMore && response.next !== null) {
        page++;
      } else {
        hasMore = false;
      }
    }

    return newListenings;
  }

  /**
   * Get favorite tracks
   * @param {number} [page] - Page number
   * @param {number} [pageSize] - Items per page
   * @returns {Promise<object>} - Paginated favorites filtered to username
   */
  async getFavorites(page = 1, pageSize = 50) {
    const response = await this.fetch("/api/v2/favorites/tracks", {
      page,
      page_size: pageSize,
    });

    // Filter to configured username only
    if (this.username) {
      response.results = response.results.filter(
        (fav) => fav.actor?.preferred_username === this.username
      );
    }

    return response;
  }

  /**
   * Get all favorites for the configured user
   * @returns {Promise<Array>} - All favorites
   */
  async getAllFavorites() {
    const allFavorites = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await this.getFavorites(page, 100);
      allFavorites.push(...response.results);
      hasMore = response.next !== null && response.results.length > 0;
      page++;
    }

    return allFavorites;
  }

  /**
   * Get the most recent listening
   * @returns {Promise<object|null>} - Most recent listening or null
   */
  async getLatestListening() {
    const response = await this.getListenings(1, 1);
    return response.results?.[0] || null;
  }

  /**
   * Clear the cache
   */
  clearCache() {
    this.cache.clear();
  }
}
