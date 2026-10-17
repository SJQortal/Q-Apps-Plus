/**
 * Quiz questions about polls (CREATE_POLL and VOTE_ON_POLL): who created
 * one (asked by its own question when it is short), which option an
 * account voted for, and how many options a poll offers. Polls are rare:
 * the first came at block 955,267, so the stretches searched start there.
 */
import { getPoll } from '../legacyBy';
import type { TxRow } from '../../types';
import { say } from '../../../rules/explorer/quiz/words';
import {
  ACCOUNT_PLACEHOLDER,
  accountP,
  answerAccount,
  block,
  day,
  globalLink,
  nameP,
  person,
  pickRow,
  randomRows,
  subjects,
  text,
  type QuizTemplate,
} from './shared';

const FIRST_POLLS = 950_000;

const str = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const pollSubject = (name: string) => `p:${name.toLowerCase()}`;

/**
 * Polls an app made for its own board ("Minter-board-card-lC3QvE-poll",
 * "test-MDC-TOPIC-2pM0qm-poll"): fine to vote on, dull to be asked about.
 */
const madeByAnApp = (name: string) =>
  /-poll$|board-card|^test-|^qgram-|^app-library-|-rating-/i.test(name);

/** Text an app encrypted or encoded (a long run of base64 with no spaces). */
const looksEncoded = (value: unknown) =>
  typeof value === 'string' && /^[A-Za-z0-9+/=_-]{24,}$/.test(value.trim());

/** A poll people wrote for people: its name, question and options all readable. */
function readable(row: TxRow) {
  const name = str(row.pollName);
  if (!name || madeByAnApp(name) || looksEncoded(name) || looksEncoded(row.description))
    return false;
  if (str(row.description)?.toLowerCase() === 'an error occurred') return false;
  const options = Array.isArray(row.pollOptions)
    ? (row.pollOptions as Array<{ optionName?: unknown }>)
    : [];
  return !options.some((o) => looksEncoded(o?.optionName));
}

const optionsWords = (options: readonly string[]) => options.map((o) => `“${o}”`).join(', ');

const pollCreator: QuizTemplate = {
  id: 'pollCreator',
  level: 'medium',
  theme: 'polls',
  async make(ctx) {
    const found = await randomRows(ctx, ['CREATE_POLL'], 50_000, FIRST_POLLS);
    if (!found) return null;
    const tx = await pickRow(
      ctx,
      found.rows.filter((row) => readable(row) && row.blockHeight),
      (row) => [row.creatorAddress]
    );
    const poll = str(tx?.pollName);
    if (!tx?.creatorAddress || !poll || !ctx.fresh(pollSubject(poll))) return null;
    const key = `pollCreator:${tx.signature}`;
    if (ctx.seen(key)) return null;
    const creator = await person(tx.creatorAddress);
    const description = str(tx.description);
    // A question that names its own answer is no question.
    const asked =
      description &&
      !(creator.name && description.toLowerCase().includes(creator.name.toLowerCase()))
        ? description
        : null;
    const at = block(tx.blockHeight as number);
    return {
      key,
      parts:
        asked && asked.length <= 90
          ? [text(`A poll created in `), at, text(` asked: “${asked}” Who created it?`)]
          : say(ctx.rng, [
              [text('Who created the poll '), nameP(poll), text(', in '), at, text('?')],
              [
                text('Somebody wanted opinions in '),
                at,
                text(': who created the poll '),
                nameP(poll),
                text('?'),
              ],
            ]),
      answer: await answerAccount(tx.creatorAddress),
      placeholder: ACCOUNT_PLACEHOLDER,
      hint: 'Transactions on Qortal has a type for polls created.',
      how: 'Transactions on Qortal → Poll created at that block: “… created the poll …”, its question in the details.',
      fact: `The poll: “${poll}”, ${day(tx.timestamp)}.`,
      link: globalLink('CREATE_POLL', tx.blockHeight as number, 1),
      linkLabel: 'Show that block’s polls',
      subjects: subjects(tx.creatorAddress, pollSubject(poll)),
    };
  },
};

const pollVote: QuizTemplate = {
  id: 'pollVote',
  level: 'medium',
  theme: 'polls',
  async make(ctx) {
    const found = await randomRows(ctx, ['VOTE_ON_POLL'], 50_000, FIRST_POLLS);
    if (!found) return null;
    const tx = await pickRow(
      ctx,
      found.rows.filter((row) => str(row.pollName) && Number.isInteger(Number(row.optionIndex))),
      (row) => [row.creatorAddress]
    );
    const poll = str(tx?.pollName);
    if (!tx?.creatorAddress || !poll || !tx.blockHeight) return null;
    const key = `pollVote:${tx.signature}`;
    if (ctx.seen(key)) return null;
    const index = Number(tx.optionIndex);
    const info = await getPoll(poll).catch(() => null);
    if (looksEncoded(poll) || info?.options.some(looksEncoded)) return null;
    const option = info?.options[index] ?? null;
    const n = index + 1;
    return {
      key,
      parts: [
        text('In '),
        block(tx.blockHeight),
        text(', '),
        await accountP(tx.creatorAddress),
        text(' voted in the poll '),
        nameP(poll),
        text('. Which option did it pick? (Its number, or its words.)'),
      ],
      answer: {
        kind: 'text',
        accepted: [String(n), `Option ${n}`, ...(option ? [option] : [])],
        shown: option ? `Option ${n}: “${option}”` : `Option ${n}`,
      },
      placeholder: 'Like Option 2',
      hint: 'Poll votes are a type of their own in Transactions on Qortal; open the vote for its details.',
      how: 'Transactions on Qortal → Poll vote at that block; the vote’s details say which option, counted from 1.',
      fact: info?.options.length ? `The options: ${optionsWords(info.options)}.` : undefined,
      link: globalLink('VOTE_ON_POLL', tx.blockHeight, 1),
      linkLabel: 'Show that block’s votes',
      subjects: subjects(tx.creatorAddress, pollSubject(poll)),
    };
  },
};

const pollOptions: QuizTemplate = {
  id: 'pollOptions',
  level: 'easy',
  theme: 'polls',
  async make(ctx) {
    const found = await randomRows(ctx, ['CREATE_POLL'], 50_000, FIRST_POLLS);
    if (!found) return null;
    const rows = found.rows.filter(
      (row) => readable(row) && Array.isArray(row.pollOptions) && row.blockHeight
    );
    const tx = rows[Math.floor(ctx.rng() * rows.length)];
    const poll = str(tx?.pollName);
    if (!tx || !poll || !ctx.fresh(pollSubject(poll))) return null;
    const options = (tx.pollOptions as Array<{ optionName?: unknown }>)
      .map((o) => str(o?.optionName))
      .filter((o): o is string => Boolean(o));
    if (options.length < 2) return null;
    const key = `pollOptions:${tx.signature}`;
    if (ctx.seen(key)) return null;
    const asked = str(tx.description);
    return {
      key,
      parts: [
        text('How many options does the poll '),
        nameP(poll),
        text(', created in '),
        block(tx.blockHeight as number),
        text(', offer?'),
      ],
      answer: { kind: 'number', value: String(options.length) },
      placeholder: 'A number',
      hint: 'Find the poll in that block; its details list the options.',
      how: 'Transactions on Qortal → Poll created at that block; the details list its options.',
      fact: `${asked ? `It asked: “${asked.slice(0, 120)}” ` : ''}The options: ${optionsWords(options)}.`,
      link: globalLink('CREATE_POLL', tx.blockHeight as number, 1),
      linkLabel: 'Show that block’s polls',
      subjects: [pollSubject(poll)],
    };
  },
};

export const POLL_TEMPLATES: readonly QuizTemplate[] = [pollCreator, pollVote, pollOptions];
