import { getAllStats, getListeningTrends } from "../stats.js";
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

      const db = request.app.locals.database;
      if (!db) {
        return response.status(500).json({ error: "Database not available" });
      }

      const stats = await getAllStats(db, funkwhaleConfig.limits);

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

      const db = request.app.locals.database;
      if (!db) {
        return response.status(500).json({ error: "Database not available" });
      }

      const days = Math.min(parseInt(request.query.days) || 30, 90);
      const trends = await getListeningTrends(db, days);

      response.json({ trends, days });
    } catch (error) {
      console.error("[Funkwhale] Trends API error:", error);
      response.status(500).json({ error: error.message });
    }
  },
};
