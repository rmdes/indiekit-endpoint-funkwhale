/**
 * Funkwhale v2 block declaration (Phase 7c — plugin block ownership).
 *
 * The `funkwhale` block (label "Listening") was a site-config BUILTIN_BLOCKS seed
 * (requiresPlugin null). Declaring it here makes site-config's scanPlugins stamp
 * `sourcePlugin` → `requiresPlugin` ("Funkwhale listening activity endpoint"), so
 * the block is properly plugin-gated (theme ENDPOINT_SLUGS maps it to the
 * `funkwhale` loadout slug). scanPlugins precedence is `built-in < plugin blocks`,
 * so this entry OVERWRITES the builtin seed where the plugin is loaded; the seed
 * itself is removed from site-config in Phase 7d.
 *
 * `source:"api"` is honest: as of 7c the combined "Listening" widget fetches the
 * plugin APIs LIVE client-side (now-playing/listenings + Last.fm now-playing/
 * scrobbles) — now-playing is always current, no rebuild. The widget is COMBINED
 * (Funkwhale + Last.fm); this plugin owns the single "Listening" block (Last.fm is
 * a silent data contributor in v1 — see the future "listening plugin" rename).
 * Bespoke template: the theme owns `components/widgets/funkwhale.njk` +
 * `js/widgets/listening.js`.
 *
 * @module lib/blocks
 */

/** @type {Array<object>} */
export const FUNKWHALE_BLOCKS = [
  {
    id: "funkwhale",
    version: 1,
    label: "Listening",
    description: "Funkwhale now playing and stats",
    icon: "music",
    category: "social",
    placement: { regions: ["sidebar"], surfaces: ["homepage"] },
    multiple: false,
    data: { source: "api" },
    schema: { type: "object", additionalProperties: false, properties: {} },
  },
];
