import express from "express";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { dashboardController } from "./lib/controllers/dashboard.js";
import { listeningsController } from "./lib/controllers/listenings.js";
import { favoritesController } from "./lib/controllers/favorites.js";
import { statsController } from "./lib/controllers/stats.js";
import { nowPlayingController } from "./lib/controllers/now-playing.js";
import { startSync } from "./lib/sync.js";
import { waitForReady } from "@rmdes/indiekit-startup-gate";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const protectedRouter = express.Router();
const publicRouter = express.Router();

const defaults = {
  mountPath: "/funkwhale",
  instanceUrl: "",
  username: "",
  token: process.env.FUNKWHALE_TOKEN,
  cacheTtl: 900_000, // 15 minutes in ms
  syncInterval: 300_000, // 5 minutes in ms
  limits: {
    listenings: 20,
    favorites: 20,
    topArtists: 10,
    topAlbums: 10,
  },
};

export default class FunkwhaleEndpoint {
  name = "Funkwhale listening activity endpoint";

  constructor(options = {}) {
    this.options = { ...defaults, ...options };
    this.mountPath = this.options.mountPath;
  }

  get environment() {
    return ["FUNKWHALE_TOKEN", "FUNKWHALE_INSTANCE", "FUNKWHALE_USERNAME"];
  }

  get localesDirectory() {
    return path.join(__dirname, "locales");
  }

  get navigationItems() {
    return {
      href: this.options.mountPath,
      text: "funkwhale.title",
      requiresDatabase: true,
    };
  }

  get shortcutItems() {
    return {
      url: this.options.mountPath,
      name: "funkwhale.listenings",
      iconName: "syndicate",
      requiresDatabase: true,
    };
  }

  /**
   * Protected routes (require authentication)
   * Admin dashboard only - detailed views are on the public frontend
   */
  get routes() {
    // Dashboard overview
    protectedRouter.get("/", dashboardController.get);

    // Manual sync trigger
    protectedRouter.post("/sync", dashboardController.sync);

    return protectedRouter;
  }

  /**
   * Public routes (no authentication required)
   * JSON API endpoints for Eleventy frontend
   */
  get routesPublic() {
    publicRouter.get("/api/now-playing", nowPlayingController.api);
    publicRouter.get("/api/listenings", listeningsController.api);
    publicRouter.get("/api/favorites", favoritesController.api);
    publicRouter.get("/api/stats", statsController.api);
    publicRouter.get("/api/stats/trends", statsController.apiTrends);

    return publicRouter;
  }

  init(Indiekit) {
    Indiekit.addEndpoint(this);

    // Add MongoDB collection for listenings sync
    Indiekit.addCollection("listenings");

    // Store Funkwhale config in application for controller access
    Indiekit.config.application.funkwhaleConfig = this.options;
    Indiekit.config.application.funkwhaleEndpoint = this.mountPath;

    // Store database getter for controller access
    Indiekit.config.application.getFunkwhaleDb = () => Indiekit.database;

    // Start background sync if database is available
    if (Indiekit.config.application.mongodbUrl) {
      this._stopGate = waitForReady(
        () => startSync(Indiekit, this.options),
        { label: "Funkwhale" },
      );
    }
  }

  destroy() {
    this._stopGate?.();
  }
}
