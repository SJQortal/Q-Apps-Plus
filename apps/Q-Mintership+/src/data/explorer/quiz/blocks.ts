/**
 * Quiz questions about single blocks: how many transactions one holds
 * (messages aside, as Transactions on Qortal lists them), which type is
 * most common in it, how many different accounts made them, what kind of
 * QDN resource someone published in it, and block 1's other asset.
 */
import { isAddress } from '../../accounts';
import type { TxRow } from '../../types';
import { ALL_TX_TYPES, txTypeLabel, typesFor } from '../../../rules/explorer/txFamilies';
import { isPrivateService, serviceName, serviceWords } from '../../../rules/explorer/qdnServices';
import { say } from '../../../rules/explorer/quiz/words';
import {
  accountP,
  block,
  blockSubject,
  busyBlockOf,
  count,
  day,
  globalLink,
  nameP,
  nameSubject,
  pickRow,
  randomRows,
  subjects,
  text,
  wholeRange,
  type QuizContext,
  type QuizTemplate,
} from './shared';

/** Transactions on Qortal's All: every type but messages. */
function offered(): string[] {
  const messages = new Set<string>(typesFor('messages'));
  return ALL_TX_TYPES.filter((type) => !messages.has(type));
}

/** A random block that holds some transactions, and all of them (up to 60), messages aside. */
const SEEDS = ['PAYMENT', 'REGISTER_NAME', 'ARBITRARY', 'REWARD_SHARE', 'JOIN_GROUP', 'AT'];

/** Counts by type, most first. */
function typeCounts(rows: readonly TxRow[]): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.type, (counts.get(row.type) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

/**
 * A busy block whose transactions (all of them up to 60, messages aside)
 * pass `test`, from a few random stretches; null when none did.
 */
async function busyBlock(
  ctx: QuizContext,
  test: (rows: TxRow[]) => boolean,
  seeds: readonly string[] = SEEDS
): Promise<{ height: number; rows: TxRow[] } | null> {
  for (let i = 0; i < 4; i += 1) {
    const height = await busyBlockOf(ctx, seeds, 3, 100_000, 1);
    if (height === null) continue;
    const rows = await wholeRange(offered(), height, 1);
    if (rows && test(rows)) return { height, rows };
  }
  return null;
}

const blockCount: QuizTemplate = {
  id: 'blockCount',
  level: 'medium',
  theme: 'blocks',
  async make(ctx) {
    const found = await busyBlock(ctx, (rows) => rows.length >= 2);
    if (!found) return null;
    const key = `blockCount:${found.height}`;
    if (ctx.seen(key)) return null;
    return {
      key,
      parts: say(ctx.rng, [
        [
          text('How many transactions, not counting messages, are in '),
          block(found.height),
          text('?'),
        ],
        [
          text('How many transactions (messages aside) made it into '),
          block(found.height),
          text('?'),
        ],
      ]),
      answer: { kind: 'number', value: String(found.rows.length) },
      placeholder: 'A number',
      hint: 'Transactions on Qortal: every type, one block.',
      how: 'Transactions on Qortal → All types → From a block, “Just this block”: the line under the list counts them (messages are never listed there).',
      fact: `Block ${count(found.height)} was made ${day(found.rows[0].timestamp)}.`,
      link: globalLink('all', found.height, 1, { order: 'oldest' }),
      linkLabel: 'Show that block',
      subjects: [blockSubject(found.height)],
    };
  },
};

const blockTopType: QuizTemplate = {
  id: 'blockTopType',
  level: 'tricky',
  theme: 'blocks',
  async make(ctx) {
    const found = await busyBlock(ctx, (rows) => {
      const ranked = typeCounts(rows);
      return rows.length >= 4 && ranked.length >= 2 && ranked[0][1] > ranked[1][1];
    });
    if (!found) return null;
    const key = `blockTopType:${found.height}`;
    if (ctx.seen(key)) return null;
    const ranked = typeCounts(found.rows);
    const [type, n] = ranked[0];
    const label = txTypeLabel(type);
    return {
      key,
      parts: [
        text('Which type of transaction appears most often in '),
        block(found.height),
        text(' (messages aside)?'),
      ],
      answer: {
        kind: 'text',
        accepted: [label, type, type.replace(/_/g, ' ')],
        shown: `${label} (${count(n)} of ${count(found.rows.length)})`,
      },
      placeholder: 'A type, like Payment',
      hint: 'Show that block with every type, then look at what each row is.',
      how: 'Transactions on Qortal → All types → just that block; the Type picker narrows it one type at a time.',
      fact: ranked.map(([t, c]) => `${txTypeLabel(t)}: ${count(c)}`).join(' · '),
      link: globalLink('all', found.height, 1, { order: 'oldest' }),
      linkLabel: 'Show that block',
      subjects: [blockSubject(found.height)],
    };
  },
};

const blockMakers: QuizTemplate = {
  id: 'blockMakers',
  level: 'tricky',
  theme: 'blocks',
  async make(ctx) {
    const makersOf = (rows: readonly TxRow[]) =>
      new Set(rows.map((row) => row.creatorAddress as string));
    const found = await busyBlock(
      ctx,
      (rows) => {
        // Contracts and the genesis account make rows of their own: such blocks are left out.
        if (rows.some((row) => !isAddress(row.creatorAddress) || row.type === 'AT')) return false;
        const n = makersOf(rows).size;
        return rows.length >= 3 && n >= 2 && n < rows.length;
      },
      ['PAYMENT', 'REGISTER_NAME', 'ARBITRARY', 'REWARD_SHARE']
    );
    if (!found) return null;
    const key = `blockMakers:${found.height}`;
    if (ctx.seen(key)) return null;
    const makers = makersOf(found.rows);
    return {
      key,
      parts: say(ctx.rng, [
        [
          text('How many different accounts made the transactions in '),
          block(found.height),
          text(' (messages aside)?'),
        ],
        [
          block(found.height),
          text(
            ` holds ${count(found.rows.length)} transactions (messages aside). How many different accounts made them?`
          ),
        ],
      ]),
      answer: { kind: 'number', value: String(makers.size) },
      placeholder: 'A number',
      hint: 'Show that block with every type and count the accounts that made the rows.',
      how: 'Transactions on Qortal → All types → just that block: count each account once.',
      link: globalLink('all', found.height, 1, { order: 'oldest' }),
      linkLabel: 'Show that block',
      subjects: [blockSubject(found.height)],
    };
  },
};

const blockOneAsset: QuizTemplate = {
  id: 'blockOneAsset',
  level: 'easy',
  theme: 'history',
  async make(ctx) {
    const key = 'block1assets';
    if (ctx.seen(key)) return null;
    const rows = (await wholeRange(['ISSUE_ASSET'], 1, 1, 1)) ?? [];
    const names = rows
      .map((row) => (typeof row.assetName === 'string' ? row.assetName : ''))
      .filter(Boolean);
    const others = names.filter((name) => name !== 'QORT');
    if (!names.includes('QORT') || !others.length) return null;
    const many = others.length === 1 ? 'one more asset' : `${count(others.length)} more assets`;
    return {
      key,
      parts: [
        text(
          `Block 1, the genesis block, issued QORT itself and ${many}. ${others.length === 1 ? 'What was it called?' : 'Name one of them.'}`
        ),
      ],
      answer: { kind: 'text', accepted: others, shown: others.join(' and ') },
      placeholder: 'An asset’s name',
      hint: 'Transactions on Qortal has a type for assets issued; look at block 1 alone.',
      how: 'Transactions on Qortal → Asset issued → From block 1, “Just this block”.',
      link: globalLink('ISSUE_ASSET', 1, 1),
      linkLabel: 'Show block 1’s assets',
      subjects: [blockSubject(1)],
    };
  },
};

const qdnService: QuizTemplate = {
  id: 'qdnService',
  level: 'medium',
  theme: 'qdn',
  async make(ctx) {
    const found = await randomRows(ctx, ['ARBITRARY'], 1000, 1_000_000);
    if (!found) return null;
    const usable = found.rows.filter((row) => {
      const service = serviceName(row.service);
      return (
        service && !isPrivateService(service) && typeof row.name === 'string' && row.blockHeight
      );
    });
    const tx = await pickRow(ctx, usable, (row) => [row.creatorAddress]);
    if (!tx?.creatorAddress) return null;
    const service = serviceName(tx.service) as string;
    const name = tx.name as string;
    // One publish under that name in that block, or two answers.
    const same = found.rows.filter(
      (row) => row.name === name && row.blockHeight === tx.blockHeight
    );
    if (same.length !== 1 || !ctx.fresh(nameSubject(name))) return null;
    const key = `qdn:${tx.signature}`;
    if (ctx.seen(key)) return null;
    const words = serviceWords(service).replace(/^an? /, '');
    return {
      key,
      parts: say(ctx.rng, [
        [
          text('In '),
          block(tx.blockHeight as number),
          text(', '),
          await accountP(tx.creatorAddress),
          text(' published something on QDN as '),
          nameP(name),
          text('. What kind of resource was it?'),
        ],
        [
          text('What kind of thing did '),
          nameP(name),
          text(' publish on QDN in '),
          block(tx.blockHeight as number),
          text('? (Like a website, or a video.)'),
        ],
      ]),
      answer: {
        kind: 'text',
        accepted: [service, service.replace(/_/g, ' '), words],
        shown: `${words} (${service})`,
      },
      placeholder: 'A kind, like website',
      hint: 'QDN publishes are a type of their own in Transactions on Qortal.',
      how: 'Transactions on Qortal → QDN publish → From a block, “Just this block”: “… published a … as …”, and its Service in the details.',
      link: globalLink('ARBITRARY', tx.blockHeight as number, 1),
      linkLabel: 'Show that block’s publishes',
      subjects: subjects(
        tx.creatorAddress,
        nameSubject(name),
        blockSubject(tx.blockHeight as number)
      ),
    };
  },
};

export const BLOCK_TEMPLATES: readonly QuizTemplate[] = [
  blockCount,
  blockTopType,
  blockMakers,
  blockOneAsset,
  qdnService,
];
