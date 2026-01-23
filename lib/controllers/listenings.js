import { FunkwhaleClient } from "../funkwhale-client.js";
import * as utils from "../utils.js";

/**
 * Listenings controller
 */
export const listeningsController = {
  /**
   * Render listenings page
   * @type {import("express").RequestHandler}
   */
  async get(request, response, next) {
    try {
      const { funkwhaleConfig } = request.app.locals.application;

      if (!funkwhaleConfig) {
        return response.status(500).render("listenings", {
          title: "Listening History",
          error: { message: "Funkwhale endpoint not configured" },
        });
      }

      const { instanceUrl, token, username, cacheTtl, limits } = funkwhaleConfig;
      const page = parseInt(request.query.page) || 1;
      const pageSize = limits.listenings || 20;

      const client = new FunkwhaleClient({
        instanceUrl,
        token,
        username,
        cacheTtl,
      });

      try {
        const listeningsRes = await client.getListenings(page, pageSize);
        const listenings = listeningsRes.results.map((l) =>
          utils.formatListening(l)
        );

        const totalPages = Math.ceil(listeningsRes.count / pageSize);

        response.render("listenings", {
          title: response.locals.__("funkwhale.listenings"),
          listenings,
          pagination: {
            current: page,
            total: totalPages,
            hasNext: listeningsRes.next !== null,
            hasPrev: listeningsRes.previous !== null,
          },
          mountPath: request.baseUrl,
        });
      } catch (apiError) {
        console.error("[Funkwhale] API error:", apiError.message);
        return response.render("listenings", {
          title: response.locals.__("funkwhale.listenings"),
          error: { message: response.locals.__("funkwhale.error.connection") },
        });
      }
    } catch (error) {
      console.error("[Funkwhale] Listenings error:", error);
      next(error);
    }
  },

  /**
   * JSON API for listenings
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
        parseInt(request.query.limit) || limits.listenings || 20,
        100
      );

      const client = new FunkwhaleClient({
        instanceUrl,
        token,
        username,
        cacheTtl,
      });

      const listeningsRes = await client.getListenings(page, limit);
      const listenings = listeningsRes.results.map((l) =>
        utils.formatListening(l)
      );

      response.json({
        listenings,
        total: listeningsRes.count,
        page,
        hasNext: listeningsRes.next !== null,
        hasPrev: listeningsRes.previous !== null,
      });
    } catch (error) {
      console.error("[Funkwhale] Listenings API error:", error);
      response.status(500).json({ error: error.message });
    }
  },
};
