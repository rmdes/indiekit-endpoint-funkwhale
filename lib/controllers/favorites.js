import { FunkwhaleClient } from "../funkwhale-client.js";
import * as utils from "../utils.js";

/**
 * Favorites controller
 */
export const favoritesController = {
  /**
   * Render favorites page
   * @type {import("express").RequestHandler}
   */
  async get(request, response, next) {
    try {
      const { funkwhaleConfig } = request.app.locals.application;

      if (!funkwhaleConfig) {
        return response.status(500).render("favorites", {
          title: "Favorites",
          error: { message: "Funkwhale endpoint not configured" },
        });
      }

      const { instanceUrl, token, username, cacheTtl, limits } = funkwhaleConfig;
      const page = parseInt(request.query.page) || 1;
      const pageSize = limits.favorites || 20;

      const client = new FunkwhaleClient({
        instanceUrl,
        token,
        username,
        cacheTtl,
      });

      try {
        const favoritesRes = await client.getFavorites(page, pageSize);
        const favorites = favoritesRes.results.map((f) =>
          utils.formatFavorite(f)
        );

        // Note: count may not reflect filtered count
        const totalPages = Math.ceil(favoritesRes.count / pageSize);

        response.render("favorites", {
          title: response.locals.__("funkwhale.favorites"),
          favorites,
          pagination: {
            current: page,
            total: totalPages,
            hasNext: favoritesRes.next !== null,
            hasPrev: favoritesRes.previous !== null,
          },
          mountPath: request.baseUrl,
        });
      } catch (apiError) {
        console.error("[Funkwhale] API error:", apiError.message);
        return response.render("favorites", {
          title: response.locals.__("funkwhale.favorites"),
          error: { message: response.locals.__("funkwhale.error.connection") },
        });
      }
    } catch (error) {
      console.error("[Funkwhale] Favorites error:", error);
      next(error);
    }
  },

  /**
   * JSON API for favorites
   * @type {import("express").RequestHandler}
   */
  async api(request, response, next) {
    try {
      const { funkwhaleConfig } = request.app.locals.application;

      if (!funkwhaleConfig) {
        return response.status(500).json({ error: "Not configured" });
      }

      const { instanceUrl, token, username, cacheTtl, limits } = funkwhaleConfig;
      const page = parseInt(request.query.page) || 1;
      const limit = Math.min(
        parseInt(request.query.limit) || limits.favorites || 20,
        100
      );

      const client = new FunkwhaleClient({
        instanceUrl,
        token,
        username,
        cacheTtl,
      });

      const favoritesRes = await client.getFavorites(page, limit);
      const favorites = favoritesRes.results.map((f) =>
        utils.formatFavorite(f)
      );

      response.json({
        favorites,
        total: favoritesRes.count,
        page,
        hasNext: favoritesRes.next !== null,
        hasPrev: favoritesRes.previous !== null,
      });
    } catch (error) {
      console.error("[Funkwhale] Favorites API error:", error);
      response.status(500).json({ error: error.message });
    }
  },
};
