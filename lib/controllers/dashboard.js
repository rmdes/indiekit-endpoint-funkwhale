import { FunkwhaleClient } from "../funkwhale-client.js";
import { runSync } from "../sync.js";
import { getSummary } from "../stats.js";
import * as utils from "../utils.js";

/**
 * Dashboard controller
 */
export const dashboardController = {
  /**
   * Render dashboard page
   * @type {import("express").RequestHandler}
   */
  async get(request, response, next) {
    try {
      const { funkwhaleConfig } = request.app.locals.application;

      if (!funkwhaleConfig) {
        return response.status(500).render("funkwhale", {
          title: "Funkwhale",
          error: { message: "Funkwhale endpoint not configured" },
        });
      }

      const { instanceUrl, token, username, cacheTtl, limits } = funkwhaleConfig;

      if (!instanceUrl || !token) {
        return response.render("funkwhale", {
          title: response.locals.__("funkwhale.title"),
          error: { message: response.locals.__("funkwhale.error.noConfig") },
        });
      }

      const client = new FunkwhaleClient({
        instanceUrl,
        token,
        username,
        cacheTtl,
      });

      // Fetch recent data from API
      let listenings = [];
      let favorites = [];
      let nowPlaying = null;

      try {
        const [listeningsRes, favoritesRes] = await Promise.all([
          client.getListenings(1, limits.listenings || 10),
          client.getFavorites(1, limits.favorites || 5),
        ]);

        listenings = listeningsRes.results.map((l) => utils.formatListening(l));
        favorites = favoritesRes.results.map((f) => utils.formatFavorite(f));

        // Check for now playing
        if (listenings.length > 0 && listenings[0].status) {
          nowPlaying = listenings[0];
        }
      } catch (apiError) {
        console.error("[Funkwhale] API error:", apiError.message);
        return response.render("funkwhale", {
          title: response.locals.__("funkwhale.title"),
          error: { message: response.locals.__("funkwhale.error.connection") },
        });
      }

      // Get stats summary from database if available
      let summary = null;
      const db = request.app.locals.database;
      if (db) {
        try {
          summary = await getSummary(db, "all");
        } catch (dbError) {
          console.error("[Funkwhale] DB error:", dbError.message);
        }
      }

      response.render("funkwhale", {
        title: response.locals.__("funkwhale.title"),
        nowPlaying,
        listenings: listenings.slice(0, 5),
        favorites: favorites.slice(0, 5),
        summary,
        mountPath: request.baseUrl,
      });
    } catch (error) {
      console.error("[Funkwhale] Dashboard error:", error);
      next(error);
    }
  },

  /**
   * Trigger manual sync
   * @type {import("express").RequestHandler}
   */
  async sync(request, response, next) {
    try {
      const { funkwhaleConfig } = request.app.locals.application;

      if (!funkwhaleConfig) {
        return response.status(500).json({ error: "Not configured" });
      }

      // Get Indiekit instance from app
      const Indiekit = request.app.locals.indiekit;
      if (!Indiekit || !Indiekit.database) {
        return response.status(500).json({ error: "Database not available" });
      }

      const result = await runSync(Indiekit, funkwhaleConfig);

      response.json({
        success: true,
        synced: result.synced,
        message: `Synced ${result.synced} new listenings`,
      });
    } catch (error) {
      console.error("[Funkwhale] Manual sync error:", error);
      response.status(500).json({ error: error.message });
    }
  },
};
