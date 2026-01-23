import express from "express";

import { dashboardController } from "./lib/controllers/dashboard.js";
import { listeningsController } from "./lib/controllers/listenings.js";
import { favoritesController } from "./lib/controllers/favorites.js";
import { statsController } from "./lib/controllers/stats.js";
import { nowPlayingController } from "./lib/controllers/now-playing.js";
import { startSync } from "./lib/sync.js";

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
   * HTML pages for admin dashboard
   */
  get routes() {
    // Dashboard
    protectedRouter.get("/", dashboardController.get);

    // Individual sections (HTML pages)
    protectedRouter.get("/listenings", listeningsController.get);
    protectedRouter.get("/favorites", favoritesController.get);
    protectedRouter.get("/stats", statsController.get);

    // Manual sync trigger
    protectedRouter.post("/sync", dashboardController.sync);

    return protectedRouter;
  }

  /**
   * Public routes (no authentication required)
   * JSON API endpoints for Eleventy widgets
   */
  get routesPublic() {
    // Now playing widget
    publicRouter.get("/api/now-playing", nowPlayingController.api);

    // JSON API for widgets
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

    // Start background sync if database is available
    if (Indiekit.config.application.mongodbUrl) {
      startSync(Indiekit, this.options);
    }
  }
}
