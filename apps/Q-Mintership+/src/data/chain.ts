/**
 * The chain tip and real block times. Countdowns are measured in blocks and
 * turned into time with the measured average, never an assumed 60 s.
 */
import { FALLBACK_MS_PER_BLOCK } from './constants';
import { getJson, seg } from './core';
import { fetchQuery } from './query';
import type { BlockSummary } from './types';

export const TIP_TTL_MS = 30_000;
const TIMING_TTL_MS = 30 * 60_000;
/** Blocks averaged for the block time: about 20 hours. */
export const TIMING_SAMPLE_BLOCKS = 1000;

export interface BlockTiming {
  msPerBlock: number;
  /** True when the measurement failed and the fallback (72.9 s) is used. */
  estimated: boolean;
  sampleBlocks: number;
}

export interface ChainNow {
  height: number;
  /** The tip block's timestamp. */
  timestamp: number;
  msPerBlock: number;
  estimated: boolean;
}

function toSummary(body: Record<string, unknown>): BlockSummary {
  return {
    height: Number(body.height ?? 0),
    timestamp: Number(body.timestamp ?? 0),
    signature: typeof body.signature === 'string' ? body.signature : undefined,
    minterAddress: typeof body.minterAddress === 'string' ? body.minterAddress : undefined,
    onlineAccountsCount:
      typeof body.onlineAccountsCount === 'number' ? body.onlineAccountsCount : undefined,
  };
}

/** `GET /blocks/last`. */
export function getTip(options: { force?: boolean } = {}): Promise<BlockSummary> {
  return fetchQuery(
    'chain:tip',
    async () => toSummary(await getJson<Record<string, unknown>>('/blocks/last')),
    {
      ttlMs: TIP_TTL_MS,
      force: options.force,
    }
  );
}

/** `GET /blocks/byheight/{h}`. Blocks never change, so they are kept for the session. */
export function getBlock(height: number): Promise<BlockSummary> {
  return fetchQuery(
    `chain:block:${height}`,
    async () =>
      toSummary(await getJson<Record<string, unknown>>(`/blocks/byheight/${seg(height)}`)),
    {
      ttlMs: Number.POSITIVE_INFINITY,
    }
  );
}

/** `GET /blocks/timestamp/{ms}`: the block at or before a moment, for windows like "the last 30 days". */
export function getBlockAtTime(timestamp: number): Promise<BlockSummary> {
  // Rounded to the minute so nearby callers share one read.
  const minute = Math.floor(timestamp / 60_000) * 60_000;
  return fetchQuery(
    `chain:at:${minute}`,
    async () =>
      toSummary(await getJson<Record<string, unknown>>(`/blocks/timestamp/${seg(minute)}`)),
    {
      ttlMs: Number.POSITIVE_INFINITY,
    }
  );
}

/** The average block time over the last TIMING_SAMPLE_BLOCKS blocks (2 reads, kept 30 minutes). */
export function getBlockTiming(): Promise<BlockTiming> {
  return fetchQuery(
    'chain:timing',
    async () => {
      try {
        const tip = await getTip();
        const from = Math.max(1, tip.height - TIMING_SAMPLE_BLOCKS);
        const old = await getBlock(from);
        const blocks = tip.height - from;
        const ms = blocks > 0 ? (tip.timestamp - old.timestamp) / blocks : 0;
        if (!Number.isFinite(ms) || ms <= 0) throw new Error('bad block timing');
        return { msPerBlock: ms, estimated: false, sampleBlocks: blocks };
      } catch {
        return { msPerBlock: FALLBACK_MS_PER_BLOCK, estimated: true, sampleBlocks: 0 };
      }
    },
    { ttlMs: TIMING_TTL_MS }
  );
}

/** Tip plus block time, the input every countdown needs (key `chain:now`). */
export function getChainNow(options: { force?: boolean } = {}): Promise<ChainNow> {
  return fetchQuery(
    'chain:now',
    async () => {
      const [tip, timing] = await Promise.all([getTip(options), getBlockTiming()]);
      return {
        height: tip.height,
        timestamp: tip.timestamp,
        msPerBlock: timing.msPerBlock,
        estimated: timing.estimated,
      };
    },
    { ttlMs: TIP_TTL_MS, force: options.force }
  );
}

/** When block `height` was or will be made, estimated from the tip. */
export function heightToTime(now: ChainNow, height: number): number {
  return now.timestamp + (height - now.height) * now.msPerBlock;
}

/** How long `blocks` blocks take at the measured pace. */
export function blocksToMs(now: Pick<ChainNow, 'msPerBlock'>, blocks: number): number {
  return blocks * now.msPerBlock;
}

/** Roughly how many blocks fit in `ms`. */
export function msToBlocks(now: Pick<ChainNow, 'msPerBlock'>, ms: number): number {
  return Math.round(ms / now.msPerBlock);
}
