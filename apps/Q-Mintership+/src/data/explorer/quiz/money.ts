/**
 * Quiz questions that follow the money: a payment in a block, an account's
 * first QORT (and its payer's), what one account paid another in all, who
 * it paid most, the biggest payment of a block and its sum, and a trade
 * contract's payout. Totals between two accounts are live (more payments
 * may come) and read again when an answer doesn't match. Viewers without
 * Connections are sent to an account's Transactions tab instead (its
 * payments, oldest first, or searched for the other account); who was paid
 * most is asked only of those with Connections, which adds it up.
 */
import { isAddress } from '../../accounts';
import { getJson, query } from '../../core';
import type { TxRow } from '../../types';
import { getFirstSeen } from '../account';
import { explorerTxPath } from '../../../routes/paths';
import { amountRemark, say } from '../../../rules/explorer/quiz/words';
import {
  ACCOUNT_PLACEHOLDER,
  accountLink,
  accountP,
  accountTxLink,
  answerAccount,
  atomic,
  block,
  blockSubject,
  busyBlockOf,
  count,
  day,
  fromAtomic,
  globalLink,
  person,
  personP,
  pickRow,
  randomMember,
  randomRows,
  searchRange,
  subjects,
  text,
  where,
  wholeRange,
  type QuizTemplate,
} from './shared';

/** An account's payments, oldest first, in its Transactions tab. */
const paymentsLink = (address: string) =>
  accountTxLink(address, { kind: 'payments', order: 'oldest' });

/** Most payments added up by hand, for a viewer without Connections's totals. */
const BASIC_MAX_PAYMENTS = 8;

const str = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value : null;

/** A personal account (a Q-address), not a trade contract. */
const isPersonal = (value: unknown): value is string =>
  isAddress(value) && (value as string).startsWith('Q');

const remarkOn = (amount: string) => amountRemark(Number(amount));

const paymentInBlock: QuizTemplate = {
  id: 'paymentInBlock',
  level: 'easy',
  theme: 'money',
  async make(ctx) {
    const found = await randomRows(ctx, ['PAYMENT'], 1000, 1_000_000);
    if (!found) return null;
    const tx = await pickRow(ctx, found.rows, (row) => [row.creatorAddress, str(row.recipient)]);
    const to = str(tx?.recipient);
    const amount = str(tx?.amount);
    if (!tx || !tx.creatorAddress || !isPersonal(to) || !amount || !tx.blockHeight) return null;
    const key = `payment:${tx.signature}`;
    if (ctx.seen(key)) return null;
    // One payment between them in that block, or the question has two answers.
    const same = (await searchRange(['PAYMENT'], tx.blockHeight, 1)).filter(
      (row) => row.creatorAddress === tx.creatorAddress && row.recipient === to
    );
    if (same.length !== 1) return null;
    const from = await accountP(tx.creatorAddress);
    const target = await accountP(to);
    return {
      key,
      parts: say(ctx.rng, [
        [
          text('In '),
          block(tx.blockHeight),
          text(', '),
          from,
          text(' paid '),
          target,
          text('. How much QORT?'),
        ],
        [
          text('Psst: how much did '),
          from,
          text(' send '),
          target,
          text(' in '),
          block(tx.blockHeight),
          text('?'),
        ],
      ]),
      answer: { kind: 'number', value: amount, unit: 'QORT' },
      placeholder: 'An amount of QORT',
      hint: 'Transactions on Qortal can show just one block.',
      how: 'Transactions on Qortal → Payment → From a block, “Just this block”, lists every payment in it; the payer’s Transactions tab has it too.',
      fact: [`Sent ${day(tx.timestamp)}.`, remarkOn(amount)].filter(Boolean).join(' '),
      link: globalLink('PAYMENT', tx.blockHeight, 1),
      linkLabel: 'Show that block’s payments',
      subjects: subjects(tx.creatorAddress, to, blockSubject(tx.blockHeight)),
    };
  },
};

/** The account its first QORT payment came from, as Connections → In common says. */
async function firstPayer(address: string): Promise<string | null> {
  const funding = (await getFirstSeen(address)).funding;
  if (!funding?.from || (funding.kind !== 'payment' && funding.kind !== 'multiPayment'))
    return null;
  return isPersonal(funding.from) ? funding.from : null;
}

const firstQortFrom: QuizTemplate = {
  id: 'firstQortFrom',
  level: 'medium',
  theme: 'money',
  async make(ctx) {
    const m = await randomMember(ctx);
    const key = `firstQort:${m.address}`;
    if (ctx.seen(key)) return null;
    const from = await firstPayer(m.address);
    if (!from || from === m.address) return null;
    return {
      key,
      parts: say(ctx.rng, [
        [text('Which account sent '), personP(m), text(' its very first QORT payment?')],
        [text('Every account starts somewhere. Who sent '), personP(m), text(' its first QORT?')],
      ]),
      answer: await answerAccount(from),
      placeholder: ACCOUNT_PLACEHOLDER,
      ...where(
        ctx,
        {
          hint: 'Connections → In common says where its first QORT came from.',
          how: 'Connections → In common: “First QORT payment received: … from …”.',
          link: accountLink(m.address, 'connections'),
          linkLabel: 'Open its Connections',
        },
        {
          hint: 'Its Transactions tab can show just its payments, oldest first.',
          how: 'Its Transactions tab → Payments, Oldest first: the first payment it received names who sent it.',
          link: paymentsLink(m.address),
          linkLabel: 'Show its payments, oldest first',
        }
      ),
      subjects: subjects(m.address, from),
    };
  },
};

const firstQortTwoHops: QuizTemplate = {
  id: 'firstQortTwoHops',
  level: 'expert',
  theme: 'detective',
  async make(ctx) {
    const m = await randomMember(ctx);
    const key = `firstQort2:${m.address}`;
    if (ctx.seen(key)) return null;
    const first = await firstPayer(m.address);
    if (!first || first === m.address) return null;
    const second = await firstPayer(first);
    if (!second || second === first || second === m.address) return null;
    const middle = await person(first);
    return {
      key,
      parts: [
        text('Follow the money two steps back: '),
        personP(m),
        text('’s first QORT came from someone. Where did that account’s own first QORT come from?'),
      ],
      answer: await answerAccount(second),
      placeholder: ACCOUNT_PLACEHOLDER,
      ...where(
        ctx,
        {
          hint: 'Connections → In common says where an account’s first QORT came from. Then do it again.',
          how: 'Its Connections → In common names who sent its first QORT; open that account, and its In common names the next one.',
          link: accountLink(first, 'connections'),
          linkLabel: 'Open the middle account’s Connections',
        },
        {
          hint: 'An account’s Transactions tab can show its payments, oldest first: the first one it received. Then do it again.',
          how: 'Its Transactions tab → Payments, Oldest first: the first payment it received names who sent it; open that account and do the same.',
          link: paymentsLink(first),
          linkLabel: 'Show the middle account’s payments, oldest first',
        }
      ),
      fact: `The middle step: ${middle.name ?? middle.address}.`,
      subjects: subjects(m.address, first, second),
    };
  },
};

/** QORT `from` paid `to` in payments (it sent fewer than 100 in all, none another way), or null. */
async function paidBetween(
  from: string,
  to: string
): Promise<{ total: string; count: number } | null> {
  const sent = await getJson<TxRow[]>(
    `/transactions/payments/between?${query({
      senderAddress: from,
      confirmationStatus: 'CONFIRMED',
      limit: 100,
    })}`
  );
  if (!Array.isArray(sent) || sent.length >= 100) return null;
  if (await sendsOtherwise(from, to)) return null;
  const rows = sent.filter((row) => row.recipient === to && typeof row.amount === 'string');
  if (!rows.length) return null;
  const total = rows.reduce((sum, row) => sum + atomic(row.amount as string), 0n);
  return { total: fromAtomic(total), count: rows.length };
}

/**
 * Whether `from` also sent `to` (or, without `to`, anyone) QORT by a
 * multi-payment or an asset transfer, which Connections counts too.
 */
async function sendsOtherwise(from: string, to?: string): Promise<boolean> {
  const other = await getJson<TxRow[]>(
    `/transactions/search?${query({
      address: from,
      txType: ['MULTI_PAYMENT', 'TRANSFER_ASSET'],
      confirmationStatus: 'CONFIRMED',
      limit: 100,
    })}`
  );
  if (!Array.isArray(other) || other.length >= 100) return true;
  const mine = other.filter((row) => row.creatorAddress === from);
  return to ? mine.some((row) => JSON.stringify(row).includes(to)) : mine.length > 0;
}

const payTotal: QuizTemplate = {
  id: 'payTotal',
  level: 'tricky',
  theme: 'money',
  async make(ctx) {
    const found = await randomRows(ctx, ['PAYMENT'], 10_000, 500_000);
    if (!found) return null;
    const tx = await pickRow(ctx, found.rows, (row) => [row.creatorAddress, str(row.recipient)]);
    const to = str(tx?.recipient);
    if (!tx?.creatorAddress || !isPersonal(to) || to === tx.creatorAddress) return null;
    const asTotal = ctx.rng() < 0.55;
    const key = `${asTotal ? 'payTotal' : 'payCount'}:${tx.creatorAddress}:${to}`;
    if (ctx.seen(key)) return null;
    const paid = await paidBetween(tx.creatorAddress, to);
    if (!paid || (!asTotal && paid.count < 2)) return null;
    // Without Connections's sum, only as many as are fair to add up by hand.
    if (!ctx.full && paid.count > BASIC_MAX_PAYMENTS) return null;
    const from = await accountP(tx.creatorAddress);
    const payee = await person(to);
    const target = personP(payee);
    return {
      key,
      parts: asTotal
        ? say(ctx.rng, [
            [
              text('How much QORT has '),
              from,
              text(' paid '),
              target,
              text(' in all, over every payment?'),
            ],
            [
              text('Add up every payment '),
              from,
              text(' ever sent '),
              target,
              text('. How much QORT?'),
            ],
          ])
        : paid.count >= 3
          ? say(ctx.rng, [
              [text('How many payments has '), from, text(' sent '), target, text('?')],
              [from, text(' keeps paying '), target, text('. How many payments so far?')],
            ])
          : [text('How many payments has '), from, text(' sent '), target, text('?')],
      answer: asTotal
        ? { kind: 'number', value: paid.total, unit: 'QORT' }
        : { kind: 'number', value: String(paid.count) },
      placeholder: asTotal ? 'An amount of QORT' : 'A number',
      ...where(
        ctx,
        {
          hint: 'Connections groups payments by the other account.',
          how: 'The payer’s Connections → Payments → Sent to: “Paid … QORT in … payments”.',
          link: accountLink(tx.creatorAddress, 'connections'),
          linkLabel: 'Open the payer’s Connections',
        },
        {
          hint: 'The payer’s Transactions tab can show just its payments, and its search narrows them to one account.',
          how: `The payer’s Transactions tab → Payments → Payment, searched for the other account: ${
            asTotal ? 'add up' : 'count'
          } the payments it sent there (not the ones it received).`,
          link: accountTxLink(tx.creatorAddress, {
            kind: 'payments',
            type: 'PAYMENT',
            q: payee.name ?? payee.address,
          }),
          linkLabel: 'Show the payer’s payments',
        }
      ),
      fact: asTotal
        ? `In ${count(paid.count)} ${paid.count === 1 ? 'payment' : 'payments'}.`
        : `${fromAtomic(atomic(paid.total)).replace(/\.?0+$/, '')} QORT in all.`,
      live: true,
      args: { from: tx.creatorAddress, to, kind: asTotal ? 'total' : 'count' },
      subjects: subjects(tx.creatorAddress, to),
    };
  },
  async recheck(args) {
    const paid = await paidBetween(String(args.from), String(args.to));
    if (!paid) return null;
    return args.kind === 'total'
      ? { kind: 'number', value: paid.total, unit: 'QORT' }
      : { kind: 'number', value: String(paid.count) };
  },
};

/** Who `from` paid the most QORT, when one account clearly leads (live). */
async function topPayeeOf(
  from: string
): Promise<{ to: string; total: bigint; second: bigint } | null> {
  const sent = await getJson<TxRow[]>(
    `/transactions/payments/between?${query({
      senderAddress: from,
      confirmationStatus: 'CONFIRMED',
      limit: 100,
    })}`
  );
  if (!Array.isArray(sent) || sent.length >= 100 || (await sendsOtherwise(from))) return null;
  const totals = new Map<string, bigint>();
  for (const row of sent)
    if (isAddress(row.recipient) && typeof row.amount === 'string')
      totals.set(row.recipient, (totals.get(row.recipient) ?? 0n) + atomic(row.amount));
  const ranked = [...totals.entries()].sort((a, b) => (a[1] === b[1] ? 0 : a[1] > b[1] ? -1 : 1));
  if (ranked.length < 2 || ranked[0][1] === ranked[1][1]) return null;
  return { to: ranked[0][0], total: ranked[0][1], second: ranked[1][1] };
}

const topPayee: QuizTemplate = {
  id: 'topPayee',
  level: 'tricky',
  theme: 'money',
  full: true,
  async make(ctx) {
    const found = await randomRows(ctx, ['PAYMENT'], 10_000, 500_000);
    if (!found) return null;
    const tx = await pickRow(ctx, found.rows, (row) => [row.creatorAddress]);
    if (!tx?.creatorAddress) return null;
    const key = `topPayee:${tx.creatorAddress}`;
    if (ctx.seen(key)) return null;
    const top = await topPayeeOf(tx.creatorAddress);
    if (!top || !top.to.startsWith('Q')) return null;
    const from = await accountP(tx.creatorAddress);
    return {
      key,
      parts: say(ctx.rng, [
        [text('Of everyone '), from, text(' has paid, who got the most QORT?')],
        [from, text(' has a favourite. Which account has it paid the most QORT, in all?')],
      ]),
      answer: await answerAccount(top.to),
      placeholder: ACCOUNT_PLACEHOLDER,
      hint: 'Connections → Payments → Sent to, and sort it.',
      how: 'Connections → Payments → Sent to, Sort: Most QORT. The first row is the answer.',
      fact: `${fromAtomic(top.total).replace(/\.?0+$/, '')} QORT in all.`,
      link: accountLink(tx.creatorAddress, 'connections'),
      linkLabel: 'Open its Connections',
      live: true,
      args: { from: tx.creatorAddress },
      subjects: subjects(tx.creatorAddress, top.to),
    };
  },
  async recheck(args) {
    const top = await topPayeeOf(String(args.from));
    return top ? answerAccount(top.to) : null;
  },
};

/** A block with 3 to 20 payments, picked at random; its payments. */
async function paymentBlock(
  ctx: Parameters<QuizTemplate['make']>[0]
): Promise<{ height: number; rows: TxRow[] } | null> {
  const height = await busyBlockOf(ctx, ['PAYMENT'], 3, 500_000, 4);
  if (height === null) return null;
  const rows = await wholeRange(['PAYMENT'], height, 1, 1);
  if (!rows || rows.length < 3) return null;
  return { height, rows };
}

const biggestPayInBlock: QuizTemplate = {
  id: 'biggestPayInBlock',
  level: 'tricky',
  theme: 'blocks',
  async make(ctx) {
    const found = await paymentBlock(ctx);
    if (!found) return null;
    const byReceiver = ctx.rng() < 0.5;
    const key = `biggestPay:${byReceiver ? 'to' : 'from'}:${found.height}`;
    if (ctx.seen(key)) return null;
    const sorted = [...found.rows].sort((a, b) => {
      const d = atomic(String(b.amount)) - atomic(String(a.amount));
      return d === 0n ? 0 : d > 0n ? 1 : -1;
    });
    if (atomic(String(sorted[0].amount)) === atomic(String(sorted[1].amount))) return null;
    const who = byReceiver ? str(sorted[0].recipient) : sorted[0].creatorAddress;
    if (!isPersonal(who)) return null;
    return {
      key,
      parts: [
        text(`${count(found.rows.length)} payments were made in `),
        block(found.height),
        text(byReceiver ? '. Who received the biggest one?' : '. Who sent the biggest one?'),
      ],
      answer: await answerAccount(who),
      placeholder: ACCOUNT_PLACEHOLDER,
      hint: 'Show just that block’s payments and compare the amounts.',
      how: 'Transactions on Qortal → Payment → From a block, “Just this block”: the amounts are in bold on each row.',
      fact: `It was ${fromAtomic(atomic(String(sorted[0].amount))).replace(/\.?0+$/, '')} QORT.`,
      link: globalLink('PAYMENT', found.height, 1),
      linkLabel: 'Show that block’s payments',
      subjects: subjects(who, blockSubject(found.height)),
    };
  },
};

const blockPaymentsSum: QuizTemplate = {
  id: 'blockPaymentsSum',
  level: 'tricky',
  theme: 'money',
  async make(ctx) {
    const found = await paymentBlock(ctx);
    if (!found || found.rows.length > 12) return null;
    const key = `paySum:${found.height}`;
    if (ctx.seen(key)) return null;
    const total = found.rows.reduce((sum, row) => sum + atomic(String(row.amount ?? '0')), 0n);
    return {
      key,
      parts: say(ctx.rng, [
        [
          text('Add it up: how much QORT moved in plain payments in '),
          block(found.height),
          text(', all together?'),
        ],
        [
          text('Calculator out: what do all the payments in '),
          block(found.height),
          text(' add up to, in QORT?'),
        ],
      ]),
      answer: { kind: 'number', value: fromAtomic(total), unit: 'QORT' },
      placeholder: 'An amount of QORT',
      hint: 'Show just that block’s payments, then add.',
      how: 'Transactions on Qortal → Payment → From a block, “Just this block”: add up the amounts.',
      fact: `That’s ${count(found.rows.length)} payments.`,
      link: globalLink('PAYMENT', found.height, 1),
      linkLabel: 'Show that block’s payments',
      subjects: [blockSubject(found.height)],
    };
  },
};

const blockPayerFirstQort: QuizTemplate = {
  id: 'blockPayerFirstQort',
  level: 'expert',
  theme: 'detective',
  async make(ctx) {
    const found = await paymentBlock(ctx);
    if (!found) return null;
    const key = `payerFirstQort:${found.height}`;
    if (ctx.seen(key)) return null;
    const sorted = [...found.rows].sort((a, b) => {
      const d = atomic(String(b.amount)) - atomic(String(a.amount));
      return d === 0n ? 0 : d > 0n ? 1 : -1;
    });
    if (atomic(String(sorted[0].amount)) === atomic(String(sorted[1].amount))) return null;
    const payer = sorted[0].creatorAddress;
    if (!isPersonal(payer)) return null;
    const source = await firstPayer(payer);
    if (!source || source === payer) return null;
    const middle = await person(payer);
    return {
      key,
      parts: [
        text('The biggest payment in '),
        block(found.height),
        text(' came from someone. Where did that account’s very first QORT come from?'),
      ],
      answer: await answerAccount(source),
      placeholder: ACCOUNT_PLACEHOLDER,
      ...where(
        ctx,
        {
          hint: 'Three steps: the block’s biggest payment, its payer, then that payer’s Connections → In common.',
          how: 'Transactions on Qortal at that block names the biggest payer; its Connections → In common says where its first QORT came from.',
          link: accountLink(payer, 'connections'),
          linkLabel: 'Open the payer’s Connections',
        },
        {
          hint: 'Three steps: the block’s biggest payment, its payer, then the first payment that payer received.',
          how: 'Transactions on Qortal at that block names the biggest payer; its Transactions tab → Payments, Oldest first: the first payment it received names who sent it.',
          link: paymentsLink(payer),
          linkLabel: 'Show the payer’s payments, oldest first',
        }
      ),
      fact: `The payer: ${middle.name ?? middle.address}.`,
      subjects: subjects(payer, source, blockSubject(found.height)),
    };
  },
};

/** An AT's payout to a personal account, alone of its kind for it in its block. */
async function atPayout(ctx: Parameters<QuizTemplate['make']>[0]): Promise<TxRow | null> {
  const found = await randomRows(ctx, ['AT'], 20_000, 200_000);
  if (!found) return null;
  const tx = await pickRow(ctx, found.rows, (row) => [str(row.recipient)]);
  const to = str(tx?.recipient);
  if (!tx || !isPersonal(to) || !str(tx.amount) || !tx.blockHeight) return null;
  const same = (await searchRange(['AT'], tx.blockHeight, 1)).filter((row) => row.recipient === to);
  return same.length === 1 ? tx : null;
}

const atPaid: QuizTemplate = {
  id: 'atPaid',
  level: 'medium',
  theme: 'trading',
  async make(ctx) {
    const tx = await atPayout(ctx);
    if (!tx) return null;
    const key = `atPaid:${tx.signature}`;
    if (ctx.seen(key)) return null;
    return {
      key,
      parts: [
        text('In '),
        block(tx.blockHeight as number),
        text(', a trade contract (an AT) paid '),
        await accountP(tx.recipient as string),
        text('. How much QORT?'),
      ],
      answer: { kind: 'number', value: tx.amount as string, unit: 'QORT' },
      placeholder: 'An amount of QORT',
      hint: 'Trading has its own types in Transactions on Qortal; one block is enough.',
      how: 'Transactions on Qortal → AT transaction → From a block, “Just this block”.',
      fact: `Paid ${day(tx.timestamp)}.`,
      link: globalLink('AT', tx.blockHeight as number, 1),
      linkLabel: 'Show that block’s AT transactions',
      subjects: subjects(tx.recipient as string, blockSubject(tx.blockHeight as number)),
    };
  },
};

const atSignature: QuizTemplate = {
  id: 'atSignature',
  level: 'expert',
  theme: 'trading',
  async make(ctx) {
    const tx = await atPayout(ctx);
    if (!tx) return null;
    const key = `atSig:${tx.signature}`;
    if (ctx.seen(key)) return null;
    return {
      key,
      parts: [
        text('In '),
        block(tx.blockHeight as number),
        text(', a trade contract (an AT) paid '),
        await accountP(tx.recipient as string),
        text('. What are the first 8 characters of that transaction’s signature?'),
      ],
      answer: { kind: 'prefix', value: tx.signature, min: 8 },
      placeholder: 'The first 8 characters',
      hint: 'Find the payout in that block, then open the transaction itself.',
      how: 'Transactions on Qortal → AT transaction at that block; the transaction’s page shows its signature, with Copy.',
      link: explorerTxPath(tx.signature),
      linkLabel: 'Open that transaction',
      subjects: subjects(tx.recipient as string, blockSubject(tx.blockHeight as number)),
    };
  },
};

export const MONEY_TEMPLATES: readonly QuizTemplate[] = [
  paymentInBlock,
  firstQortFrom,
  firstQortTwoHops,
  payTotal,
  topPayee,
  biggestPayInBlock,
  blockPaymentsSum,
  blockPayerFirstQort,
  atPaid,
  atSignature,
];
