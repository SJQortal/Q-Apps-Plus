/* Types for the mock world (e2e/world.mjs), for TypeScript tests. */
export const NOW: number;
export const TIP: number;
export const MS_PER_BLOCK: number;
export const GROUP: number;
export const NULL_OWNER: string;
export const PEOPLE: Record<string, { name: string | null; level: number; blocks: number }>;
export const ADDR: Record<string, string>;
export function fakeAddress(seed: string): string;
export function fakeKey(seed: string, bytes?: number): string;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type World = any;
export function createWorld(): World;
export function addOtherPending(world: World): string[];
export function addReady(world: World): void;
export function addRejections(world: World): {
  kick: string;
  ban: string;
  lift: string;
  rejectedInvite: string;
  invitee: string;
};
export function addConsidering(world: World): {
  decisionKey: string;
  inviteSignature: string;
  waitingKey: string;
};
export function answerCore(
  world: World,
  pathname: string,
  searchParams: URLSearchParams
): { status: number; body?: unknown; text?: string } | undefined;
export function personaAddress(persona: string): string;
export function answerQortal(
  world: World,
  persona: string,
  request: Record<string, unknown>
): unknown;
export function addTargetShift(world: World): {
  seenBefore: { adminCount: number; needed: number; height: number };
  demote: string;
  kick: string;
  met: string;
  removed: string[];
  outgoing: string[];
};
// Shareable links (decision and nomination pages).
export function addDecidedSignatures(world: World): string;
export function addComments(world: World): {
  waitingKey: string;
  decisionKey: string;
  ids: Record<string, string>;
};
// answers-wording (night 2): former members ready to mint, name search.
export const FORMER_READY: Record<'removed' | 'left', { address: string; name: string }>;
export function addFormerReady(world: World): void;
export function answerNameSearch(
  world: World,
  pathname: string,
  searchParams: URLSearchParams
): { status: number; body: unknown } | undefined;
export const LAST_VISIT_HEIGHT: number;
export const LAST_VISIT_AT: number;
export function lastVisitStorageKey(address: string, groupId?: number): string;
export function lastVisitSnapshots(
  world: World
): Record<
  'admin' | 'nominatedSigning' | 'nominatedWaiting',
  { address: string; snapshot: unknown }
>;
// Doubles: admin changes that change nothing, or repeat one already waiting.
export function addDoubles(world: World): {
  alreadyAdmin: { signature: string; approved: string; subject: string };
  notAdmin: { signature: string; subject: string };
  duplicate: { signature: string; older: string; subject: string };
};

// A nominator's last visit (activity-alerts).
export function addNominatorHistory(world: World): string;
export function nominatorLastVisit(world: World): { address: string; snapshot: unknown };
