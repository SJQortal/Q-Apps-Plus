/**
 * The original Q-Mintership's data in the mock world (read-only History):
 * nomination cards, their polls and comments, and AR cards. Filled in with
 * the History screens; until then it adds nothing.
 */

/** Add legacy records to `world` (e.g. world.legacyCards). */
export function extendLegacy(world) {
  world.legacy = { cards: [], polls: {}, comments: [] };
}

/** Answer a Core GET about legacy data, or undefined. Same shape as answerCore in world.mjs. */
export function answerLegacy(_world, _pathname, _sp) {
  return undefined;
}
