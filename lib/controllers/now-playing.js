import { FunkwhaleClient } from "../funkwhale-client.js";
import * as utils from "../utils.js";

/**
 * Now Playing controller
 */
export const nowPlayingController = {
  /**
   * JSON API for now playing / recently played
   * @type {import("express").RequestHandler}
   */
  async api(request, response, next) {
    try {
      const { funkwhaleConfig } = request.app.locals.application;

      if (!funkwhaleConfig) {
        return response.status(500).json({ error: "Not configured" });
      }

      const { instanceUrl, token, username, cacheTtl } = funkwhaleConfig;

      const client = new FunkwhaleClient({
        instanceUrl,
        token,
        username,
        cacheTtl: Math.min(cacheTtl, 60_000), // Max 1 minute cache for now playing
      });

      const listening = await client.getLatestListening();

      if (!listening) {
        return response.json({
          playing: false,
          status: null,
          message: "No recent plays",
        });
      }

      const formatted = utils.formatListening(listening);

      response.json({
        playing: formatted.status === "now-playing",
        status: formatted.status,
        track: formatted.track,
        artist: formatted.artist,
        album: formatted.album,
        coverUrl: formatted.coverUrl,
        trackUrl: formatted.trackUrl,
        duration: formatted.duration,
        listenedAt: formatted.listenedAt,
        relativeTime: formatted.relativeTime,
      });
    } catch (error) {
      const message = String(error?.message || "");
      if (/not found/i.test(message)) {
        return response.json({
          playing: false,
          status: null,
          message: "No recent plays",
        });
      }

      console.error("[Funkwhale] Now Playing API error:", error);
      response.status(500).json({ error: message || "Unknown error" });
    }
  },
};
