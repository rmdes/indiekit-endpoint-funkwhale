import { getAllStats, getListeningTrends } from "../stats.js";
import { getCachedStats } from "../sync.js";
import { formatTotalTime } from "../utils.js";

/**
 * Stats controller
 */
export const statsController = {
  /**
   * Render stats page with tabs
   * @type {import("express").RequestHandler}
   */
  async get(request, response, next) {
    try {
      const { funkwhaleConfig } = request.app.locals.application;

      if (!funkwhaleConfig) {
        return response.status(500).render("stats", {
          title: "Statistics",
          error: { message: "Funkwhale endpoint not configured" },
        });
      }

      const db = request.app.locals.database;
      if (!db) {
        return response.render("stats", {
          title: response.locals.__("funkwhale.stats"),
          error: { message: "Database not available for statistics" },
          mountPath: request.baseUrl,
        });
      }

      try {
        const stats = await getAllStats(db, funkwhaleConfig.limits);

        // Format durations for display
        const formattedStats = {
          summary: {
            all: {
              ...stats.summary.all,
              totalDurationFormatted: formatTotalTime(stats.summary.all.totalDuration),
            },
            month: {
              ...stats.summary.month,
              totalDurationFormatted: formatTotalTime(stats.summary.month.totalDuration),
            },
            week: {
              ...stats.summary.week,
              totalDurationFormatted: formatTotalTime(stats.summary.week.totalDuration),
            },
          },
          topArtists: stats.topArtists,
          topAlbums: stats.topAlbums,
          trends: stats.trends,
        };

        response.render("stats", {
          title: response.locals.__("funkwhale.stats"),
          stats: formattedStats,
          mountPath: request.baseUrl,
        });
      } catch (dbError) {
        console.error("[Funkwhale] Stats DB error:", dbError.message);
        return response.render("stats", {
          title: response.locals.__("funkwhale.stats"),
          error: { message: "Could not load statistics" },
          mountPath: request.baseUrl,
        });
      }
    } catch (error) {
      console.error("[Funkwhale] Stats error:", error);
      next(error);
    }
  },

  /**
   * JSON API for all stats
   * @type {import("express").RequestHandler}
   */
  async api(request, response, next) {
    try {
      const { funkwhaleConfig } = request.app.locals.application;

      if (!funkwhaleConfig) {
        return response.status(500).json({ error: "Not configured" });
      }

      // Try database first, fall back to cache for public routes
      const db =
        request.app.locals.application.getFunkwhaleDb?.() ||
        request.app.locals.database;
      let stats;

      if (db) {
        stats = await getAllStats(db, funkwhaleConfig.limits);
      } else {
        // Public routes don't have DB access, use cached stats
        stats = getCachedStats();
        if (!stats) {
          stats = {
            summary: {
              all: { totalPlays: 0, totalDuration: 0, uniqueTracks: 0, uniqueArtists: 0, uniqueAlbums: 0 },
              month: { totalPlays: 0, totalDuration: 0, uniqueTracks: 0, uniqueArtists: 0, uniqueAlbums: 0 },
              week: { totalPlays: 0, totalDuration: 0, uniqueTracks: 0, uniqueArtists: 0, uniqueAlbums: 0 },
            },
            topArtists: { all: [], month: [], week: [] },
            topAlbums: { all: [], month: [], week: [] },
            trends: [],
          };
        }
      }

      // Add formatted durations
      stats.summary.all.totalDurationFormatted = formatTotalTime(
        stats.summary.all.totalDuration
      );
      stats.summary.month.totalDurationFormatted = formatTotalTime(
        stats.summary.month.totalDuration
      );
      stats.summary.week.totalDurationFormatted = formatTotalTime(
        stats.summary.week.totalDuration
      );

      response.json(stats);
    } catch (error) {
      console.error("[Funkwhale] Stats API error:", error);
      response.status(500).json({ error: error.message });
    }
  },

  /**
   * JSON API for trends only (for charts)
   * @type {import("express").RequestHandler}
   */
  async apiTrends(request, response, next) {
    try {
      const { funkwhaleConfig } = request.app.locals.application;

      if (!funkwhaleConfig) {
        return response.status(500).json({ error: "Not configured" });
      }

      const db =
        request.app.locals.application.getFunkwhaleDb?.() ||
        request.app.locals.database;
      const days = Math.min(parseInt(request.query.days) || 30, 90);

      if (db) {
        const trends = await getListeningTrends(db, days);
        return response.json({ trends, days });
      }

      // Fall back to cached stats for public routes
      const cachedStats = getCachedStats();
      if (cachedStats?.trends) {
        return response.json({ trends: cachedStats.trends, days: 30 });
      }

      return response.json({ trends: [], days });
    } catch (error) {
      console.error("[Funkwhale] Trends API error:", error);
      response.status(500).json({ error: error.message });
    }
  },
};
