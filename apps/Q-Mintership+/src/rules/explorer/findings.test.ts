import { describe, expect, it } from 'vitest';
import { EXPLORER_NEUTRAL_LINE } from '../../pages/explorer/explorerWords';
import { findingsText, partsText, type FindingsInput } from './findings';
import { levelMoveParts, sponsorParts } from './connections';
import { flowParts, flowsOf } from './money';
import type { TxRow } from '../../data/types';

const addr = (c: string) => `Q${c.repeat(33)}`;
const ME = addr('m');
const B = addr('b');
const C = addr('c');
const SIG =
  '4Kw5V2Zmh7mfV6KjPuX2ZXCK3HE2fsR6w5CWD75CdMa8Rfat1mXcf5rCiLpm8tm96FMPhCUBpMUaLpvUmitbqJ';
const LINK = `qortal://APP/Q-Mintership+/explorer/account/${ME}/connections`;
const NAMES: Record<string, string> = { [ME]: 'Nora Nominator', [B]: 'Bob' };

/** Words that would read as a verdict about who runs an account. */
const VERDICTS =
  /\b(alts?|suspicious|same person|fraud|strong(est)?|weak|consolidation|linked accounts|likel(y|ihood)|score)\b/i;

function input(extra: Partial<FindingsInput> = {}): FindingsInput {
  const pays: TxRow[] = [1_364_500, 1_500_000].map((height, i) => ({
    type: 'PAYMENT',
    timestamp: Date.UTC(2025, 2 + i * 2, 14),
    signature: i ? SIG : `${SIG.slice(0, 80)}AAAAAAAA`,
    txGroupId: 0,
    blockHeight: height,
    creatorAddress: ME,
    recipient: B,
    amount: '60',
  }));
  const [flow] = flowsOf(pays, ME, 'sent');
  return {
    address: ME,
    name: 'Nora Nominator',
    checkedAt: 2_757_500,
    neutralLine: EXPLORER_NEUTRAL_LINE,
    coverage: ['In its latest 100 QORT payments each way.'],
    recorded: [
      {
        parts: levelMoveParts({
          direction: 'to',
          other: C,
          ref: { height: 2_000_000, timestamp: 0, signature: SIG },
          tx: pays[0],
        }),
        height: 2_000_000,
        signature: SIG,
      },
      {
        parts: sponsorParts({
          sponsor: B,
          percent: '0',
          start: { height: 1_371_641, timestamp: 0, signature: SIG },
          removal: null,
          blocks: 7_234,
          txs: [],
        }),
        height: 1_371_641,
        signature: SIG,
      },
      {
        parts: flowParts(flow, 'sent'),
        height: flow.last.height,
        firstHeight: flow.first.height,
        signature: flow.last.signature,
        count: flow.count,
      },
    ],
    common: [],
    noneFound: 'Also checked, nothing found: name sales.',
    link: LINK,
    nameOf: (a) => NAMES[a],
    ...extra,
  };
}

describe('Copy findings', () => {
  it('says whose findings, at which block, how much was read, and every finding with block and signature', () => {
    const text = findingsText(input());
    const lines = text.split('\n');
    expect(lines[0]).toBe(
      `Explorer findings for Nora Nominator (${ME}), checked at block 2,757,500`
    );
    expect(lines[1]).toBe(EXPLORER_NEUTRAL_LINE);
    expect(text).toContain('What was read:\n- In its latest 100 QORT payments each way.');
    expect(text).toContain('- Moved its minting level to Qccccc…cccc (block 2,000,000, 4Kw5V2Zm…)');
    expect(text).toContain(
      `- Sponsored by Bob (Qbbbbb…bbbb) at 0 % for 7,234 blocks (block 1,371,641, 4Kw5V2Zm…)`
    );
    expect(text).toContain(
      '- Paid Bob (Qbbbbb…bbbb) 120 QORT in 2 payments (Mar–May 2025) (blocks 1,364,500–1,500,000, 2 transactions, newest 4Kw5V2Zm…)'
    );
    expect(text).toContain('Also checked, nothing found: name sales.');
    expect(lines[lines.length - 1]).toBe(LINK);
  });

  it('never words a verdict', () => {
    expect(findingsText(input())).not.toMatch(VERDICTS);
    expect(findingsText(input({ recorded: [], noneFound: null }))).not.toMatch(VERDICTS);
  });

  it('says when nothing was found, and leaves out the block when it isn’t known', () => {
    const text = findingsText(input({ recorded: [], checkedAt: null, name: null }));
    expect(text.split('\n')[0]).toBe(`Explorer findings for ${ME}`);
    expect(text).toContain('No links found in the data checked.');
    expect(text).not.toContain('Recorded between them');
  });

  it('writes names as names, quoted, and accounts without a name as short addresses', () => {
    expect(
      partsText([
        { kind: 'text', text: 'Bought the name ' },
        { kind: 'name', name: 'Spare Room' },
        { kind: 'text', text: ' from ' },
        { kind: 'account', address: C },
        { kind: 'text', text: ' for ' },
        { kind: 'amount', amount: '5', asset: 'QORT' },
      ])
    ).toBe('Bought the name “Spare Room” from Qccccc…cccc for 5 QORT');
  });
});
