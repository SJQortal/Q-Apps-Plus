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
export function addCommunityVotes(world: World): { waiting: string; signing: string };
export function addDecisionVotes(world: World): {
  kick: string;
  ban: string;
  addAdmin: string;
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

// Declines: a kick of someone who asked to join and isn't a member.
export const DECLINED: { address: string; name: string };
export function addDecline(world: World): {
  waiting: { signature: string; subject: string };
  declined: { address: string; join: string; kick: string };
};
// Minter Admin polls: DOCUMENT_PRIVATE records encrypted to the Minter Admins.
export function mockEncrypt(publicKeys: string[], data64: string): string;
export function mockDecrypt(encryptedData: string, publicKey: string): string;
export function answerDecrypt(
  world: World,
  persona: string,
  request: Record<string, unknown>
): string;
export const ADMIN_POLL_IDS: Record<
  'open' | 'voted' | 'closed' | 'shared' | 'locked' | 'notAdmin',
  string
>;
export function addAdminPolls(world: World): {
  ids: typeof ADMIN_POLL_IDS;
  comments: { reply: string; shared: string };
};
export function answerAdminPolls(
  world: World,
  pathname: string,
  searchParams: URLSearchParams
): { status: number; body?: unknown; text?: string } | undefined;

// The Explorer (e2e/world-explorer.mjs): payments, names, reward shares and more.
export interface ExplorerPerson {
  address: string;
  name: string | null;
}
/** Sponsored five accounts with 0 % reward shares (not in PEOPLE). */
export const SPONSOR: ExplorerPerson & { name: string };
/** Sent the first QORT to Kit Kicked, Lou Left and many newcomers: 640 payments (500+). */
export const FUNDER: ExplorerPerson & { name: string };
/** Moved its minting level to Kai Target (TRANSFER_PRIVS); level 0 since. */
export const OLD_MINTER: ExplorerPerson & { name: string };
/** A valid address Core has never seen (`/addresses/{it}`: 404, error 124). */
export const UNUSED_ADDRESS: string;
/** An AT Lou Left deployed; it paid Kit Kicked. */
export const AT_ADDRESS: string;
/** Sid Sponsor's sponsees: four new accounts (no public key) and Leo Learner. */
export const SPONSEES: ExplorerPerson[];
/** The unencrypted MESSAGE's content: it must never show anywhere. */
export const MESSAGE_CONTENT: string;
/** What world.explorer holds, for tests (world.explorer.sigs names the rows tests point at). */
export interface ExplorerWorld {
  rows: Array<Record<string, unknown> & { type: string; signature: string; blockHeight: number }>;
  sponsees: string[];
  sigs: {
    funding: { kicked: string; left: string };
    kitLou: string[];
    privs: string;
    sell: string;
    buy: string;
    message: string;
    deploy: string;
    payout: string;
    multi: string;
    assets: string[];
    publishes: string[];
  };
}
/** The Overview and Names tabs' name collector: 30 names, QDN under five, a minting penalty. */
export const COLLECTOR: ExplorerPerson & { name: string };
/** Its names in Core's order (when each was registered); the primary is the third. */
export const COLLECTOR_NAMES: string[];
