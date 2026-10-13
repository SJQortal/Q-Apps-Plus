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
// answers-wording (night 2): former members ready to mint, name search.
export const FORMER_READY: Record<'removed' | 'left', { address: string; name: string }>;
export function addFormerReady(world: World): void;
export function answerNameSearch(
  world: World,
  pathname: string,
  searchParams: URLSearchParams
): { status: number; body: unknown } | undefined;
