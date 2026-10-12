/**
 * History for Minter Admin Activity and the group pulse in the mock world:
 * decided MINTER transactions and their signatures over the last 180 days.
 * Filled in with the Activity screen; until then it adds nothing.
 */

/** Add activity history to `world`. */
export function extendActivity(world) {
  world.activity = { decisions: [], approvals: [] };
}

/** Answer a Core GET about activity history, or undefined. */
export function answerActivity(_world, _pathname, _sp) {
  return undefined;
}
