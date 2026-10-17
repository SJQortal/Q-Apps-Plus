/**
 * Quiz questions about names: what one sold for and who sold it, an asking
 * price, a rename either way, how many were registered in 100 blocks, the
 * day of the week one was registered, and who registered a name that has
 * since changed hands.
 */
import { isAddress } from '../../accounts';
import { getNameData } from '../account';
import { say, weekdayForms } from '../../../rules/explorer/quiz/words';
import {
  ACCOUNT_PLACEHOLDER,
  accountLink,
  accountP,
  answerAccount,
  block,
  blockSubject,
  count,
  day,
  daysAgo,
  globalLink,
  nameP,
  nameSubject,
  person,
  personP,
  randInt,
  randomRows,
  stretchOf,
  subjects,
  text,
  wholeRange,
  type QuizContext,
  type QuizTemplate,
} from './shared';
import type { TxRow } from '../../types';

const str = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value : null;

/** A name bought in a random stretch, with its buyer and seller, not asked about lately. */
async function nameSale(ctx: QuizContext): Promise<TxRow | null> {
  const found = await randomRows(ctx, ['BUY_NAME'], 10_000, 300_000);
  if (!found) return null;
  const rows = found.rows.filter(
    (tx) =>
      str(tx.name) &&
      str(tx.amount) &&
      isAddress(tx.creatorAddress) &&
      isAddress(tx.seller) &&
      ctx.fresh(nameSubject(tx.name as string))
  );
  return rows.length ? rows[Math.floor(ctx.rng() * rows.length)] : null;
}

const namePrice: QuizTemplate = {
  id: 'namePrice',
  level: 'medium',
  theme: 'names',
  async make(ctx) {
    const tx = await nameSale(ctx);
    if (!tx) return null;
    const key = `namePrice:${tx.signature}`;
    if (ctx.seen(key)) return null;
    const buyer = await accountP(tx.creatorAddress as string);
    const name = nameP(tx.name as string);
    const at = block(tx.blockHeight as number);
    return {
      key,
      parts: say(ctx.rng, [
        [
          text('In '),
          at,
          text(', '),
          buyer,
          text(' bought the name '),
          name,
          text('. How much QORT did it pay?'),
        ],
        [name, text(' changed hands in '), at, text('. What did '), buyer, text(' pay for it?')],
      ]),
      answer: { kind: 'number', value: tx.amount as string, unit: 'QORT' },
      placeholder: 'An amount of QORT',
      hint: 'Name purchases are a type of their own in Transactions on Qortal; the buyer’s Connections lists them too.',
      how: 'Transactions on Qortal → Name purchase at that block, or the buyer’s Connections → Names: “Bought … from … for … QORT”.',
      fact: `Bought ${day(tx.timestamp)}.`,
      link: globalLink('BUY_NAME', tx.blockHeight as number, 1),
      linkLabel: 'Show that block’s name purchases',
      subjects: subjects(tx.creatorAddress, nameSubject(tx.name as string)),
    };
  },
};

const nameSeller: QuizTemplate = {
  id: 'nameSeller',
  level: 'medium',
  theme: 'names',
  async make(ctx) {
    const tx = await nameSale(ctx);
    if (!tx) return null;
    const key = `nameSeller:${tx.signature}`;
    if (ctx.seen(key)) return null;
    const buyer = await accountP(tx.creatorAddress as string);
    // "Who sold “east” to east?" reads oddly: a buyer known by that very name is left out.
    if (buyer.kind === 'account' && buyer.name?.toLowerCase() === String(tx.name).toLowerCase())
      return null;
    const name = nameP(tx.name as string);
    return {
      key,
      parts: say(ctx.rng, [
        [text('Who sold the name '), name, text(' to '), buyer, text('?')],
        [buyer, text(' bought '), name, text('. Who parted with it?')],
      ]),
      answer: await answerAccount(tx.seller as string),
      placeholder: ACCOUNT_PLACEHOLDER,
      hint: 'Look at the buyer’s connections, or the name’s history.',
      how: 'The buyer’s Connections → Names says who sold it; the Names tab shows each name’s history too.',
      fact: `It went for ${String(tx.amount).replace(/\.?0+$/, '')} QORT, ${day(tx.timestamp)}.`,
      link: accountLink(tx.creatorAddress as string, 'connections'),
      linkLabel: 'Open the buyer’s Connections',
      subjects: subjects(tx.creatorAddress, tx.seller as string, nameSubject(tx.name as string)),
    };
  },
};

const nameListed: QuizTemplate = {
  id: 'nameListed',
  level: 'medium',
  theme: 'names',
  async make(ctx) {
    const found = await randomRows(ctx, ['SELL_NAME'], 10_000, 300_000);
    if (!found) return null;
    const rows = found.rows.filter(
      (tx) => str(tx.name) && str(tx.amount) && isAddress(tx.creatorAddress) && tx.blockHeight
    );
    const tx = rows[Math.floor(ctx.rng() * rows.length)];
    if (!tx || !ctx.fresh(nameSubject(tx.name as string))) return null;
    const key = `nameListed:${tx.signature}`;
    if (ctx.seen(key)) return null;
    const at = block(tx.blockHeight as number);
    const name = nameP(tx.name as string);
    return {
      key,
      parts: say(ctx.rng, [
        [
          text('In '),
          at,
          text(', '),
          await accountP(tx.creatorAddress as string),
          text(' put the name '),
          name,
          text(' up for sale. At what price?'),
        ],
        [
          text('For sale! In '),
          at,
          text(', '),
          name,
          text(' went on the market. What was the asking price, in QORT?'),
        ],
      ]),
      answer: { kind: 'number', value: tx.amount as string, unit: 'QORT' },
      placeholder: 'An amount of QORT',
      hint: 'Transactions on Qortal has a type for names listed for sale.',
      how: 'Transactions on Qortal → Name listed for sale at that block: “listed the name … for sale at … QORT”.',
      link: globalLink('SELL_NAME', tx.blockHeight as number, 1),
      linkLabel: 'Show that block’s listings',
      subjects: subjects(tx.creatorAddress, nameSubject(tx.name as string)),
    };
  },
};

const renamed: QuizTemplate = {
  id: 'renamed',
  level: 'medium',
  theme: 'names',
  async make(ctx) {
    const found = await randomRows(ctx, ['UPDATE_NAME'], 10_000, 300_000);
    if (!found) return null;
    const rows = found.rows.filter((tx) => {
      const old = str(tx.name);
      const next = str(tx.newName);
      return old && next && old !== next && tx.blockHeight;
    });
    const tx = rows[Math.floor(ctx.rng() * rows.length)];
    if (!tx) return null;
    const old = tx.name as string;
    const next = tx.newName as string;
    if (!ctx.fresh(nameSubject(old)) || !ctx.fresh(nameSubject(next))) return null;
    const key = `renamed:${tx.signature}`;
    if (ctx.seen(key)) return null;
    const forward = ctx.rng() < 0.6;
    const at = block(tx.blockHeight as number);
    return {
      key,
      parts: forward
        ? [
            text('In '),
            at,
            text(', the name '),
            nameP(old),
            text(' was renamed. What was it renamed to?'),
          ]
        : [
            text('In '),
            at,
            text(', a name became '),
            nameP(next),
            text('. What was it called before?'),
          ],
      answer: forward
        ? { kind: 'text', accepted: [next], shown: next }
        : { kind: 'text', accepted: [old], shown: old },
      placeholder: 'A name',
      hint: 'Transactions on Qortal has a type for name updates.',
      how: 'Transactions on Qortal → Name update at that block: “renamed … to …”.',
      link: globalLink('UPDATE_NAME', tx.blockHeight as number, 1),
      linkLabel: 'Show that block’s name updates',
      subjects: subjects(tx.creatorAddress, nameSubject(old), nameSubject(next)),
    };
  },
};

const namesInBlocks: QuizTemplate = {
  id: 'namesInBlocks',
  level: 'medium',
  theme: 'names',
  async make(ctx) {
    let start = 0;
    let rows: TxRow[] | null = null;
    for (let i = 0; i < 3 && !(rows && rows.length >= 2); i += 1) {
      // A stretch of 100 blocks around a registration, so it isn't empty.
      const near = await randomRows(ctx, ['REGISTER_NAME'], 10_000, 200_000, 1);
      const height = near?.rows[Math.floor(ctx.rng() * near.rows.length)]?.blockHeight;
      if (typeof height !== 'number') continue;
      start = Math.max(200_000, height - randInt(ctx.rng, 0, 60));
      rows = await wholeRange(['REGISTER_NAME'], start, 100);
    }
    const key = `namesIn:${start}`;
    if (!rows || rows.length < 2 || ctx.seen(key)) return null;
    return {
      key,
      parts: say(ctx.rng, [
        [
          text('How many names were registered in the 100 blocks from '),
          block(start),
          text(' to '),
          block(start + 99),
          text('?'),
        ],
        [
          text('Name rush? Count the names registered from '),
          block(start),
          text(' to '),
          block(start + 99),
          text('.'),
        ],
      ]),
      answer: { kind: 'number', value: String(rows.length) },
      placeholder: 'A number',
      hint: 'Transactions on Qortal can show one type over 100 blocks from a block.',
      how: 'Transactions on Qortal → Name registration → From a block, “100 blocks”: the line under the list counts them once all are shown.',
      fact: `The first of them: “${String(rows[0].name)}”.`,
      link: globalLink('REGISTER_NAME', start, 100),
      linkLabel: 'Show those blocks',
      subjects: [blockSubject(start)],
    };
  },
};

const nameWeekday: QuizTemplate = {
  id: 'nameWeekday',
  level: 'tricky',
  theme: 'time',
  async make(ctx) {
    const found = await randomRows(ctx, ['REGISTER_NAME'], 10_000, 100_000);
    if (!found) return null;
    const rows = found.rows.filter((tx) => str(tx.name) && tx.blockHeight);
    const tx = rows[Math.floor(ctx.rng() * rows.length)];
    if (!tx || !ctx.fresh(nameSubject(tx.name as string))) return null;
    const key = `weekday:${tx.signature}`;
    if (ctx.seen(key)) return null;
    const { shown, accepted } = weekdayForms(tx.timestamp);
    return {
      key,
      parts: say(ctx.rng, [
        [
          text('The name '),
          nameP(tx.name as string),
          text(' was registered in '),
          block(tx.blockHeight as number),
          text('. On what day of the week was that?'),
        ],
        [
          text('Calendar time: '),
          nameP(tx.name as string),
          text(' was registered in '),
          block(tx.blockHeight as number),
          text('. Which day of the week?'),
        ],
      ]),
      answer: { kind: 'text', accepted, shown },
      placeholder: 'A day, like Monday',
      hint: 'Find the registration in that block: its date is on the row. Then a calendar.',
      how: 'Transactions on Qortal → Name registration at that block gives the date (in your time zone); the rest is the calendar.',
      fact: `It was ${day(tx.timestamp)}, ${count(daysAgo(tx.timestamp))} days ago.`,
      link: globalLink('REGISTER_NAME', tx.blockHeight as number, 1),
      linkLabel: 'Show that block’s registrations',
      subjects: subjects(tx.creatorAddress, nameSubject(tx.name as string)),
    };
  },
};

const registeredBy: QuizTemplate = {
  id: 'registeredBy',
  level: 'expert',
  theme: 'detective',
  async make(ctx) {
    const found = await randomRows(ctx, ['REGISTER_NAME'], 10_000, 100_000);
    if (!found) return null;
    // Names that changed hands are a minority: look through the stretch's first rows.
    for (const tx of found.rows.slice(0, 14)) {
      const name = str(tx.name);
      if (!name || !isAddress(tx.creatorAddress) || !ctx.fresh(nameSubject(name))) continue;
      const data = await getNameData(name);
      // Still the same name, and it changed hands since.
      if (!data || data.name !== name || data.owner === tx.creatorAddress) continue;
      const key = `registeredBy:${name.toLowerCase()}`;
      if (ctx.seen(key)) continue;
      const owner = await person(data.owner);
      return {
        key,
        parts:
          owner.name?.toLowerCase() === name.toLowerCase()
            ? [
                text('The name '),
                nameP(name),
                text(
                  ' has changed hands since it was registered. Who registered it in the first place?'
                ),
              ]
            : [
                text('The name '),
                nameP(name),
                text(' belongs to '),
                personP(owner),
                text(' now. Who registered it in the first place?'),
              ],
        answer: await answerAccount(tx.creatorAddress),
        placeholder: ACCOUNT_PLACEHOLDER,
        hint: 'Names keep their history: start at its owner’s Names tab and follow the sales back.',
        hint2: `Or: it was registered in the 10,000 blocks from block ${count(stretchOf(tx.blockHeight as number))}.`,
        how: 'The owner’s Names tab shows who it was bought from; that account’s Names tab, under the names it had, goes one step further back, down to the registration.',
        fact: `Registered ${day(tx.timestamp)}, in block ${count(tx.blockHeight as number)}.`,
        link: globalLink('REGISTER_NAME', stretchOf(tx.blockHeight as number), 10000, {
          order: 'oldest',
          find: name,
        }),
        linkLabel: 'Show its registration',
        subjects: subjects(tx.creatorAddress, data.owner, nameSubject(name)),
      };
    }
    return null;
  },
};

export const NAME_TEMPLATES: readonly QuizTemplate[] = [
  namePrice,
  nameSeller,
  nameListed,
  renamed,
  namesInBlocks,
  nameWeekday,
  registeredBy,
];
