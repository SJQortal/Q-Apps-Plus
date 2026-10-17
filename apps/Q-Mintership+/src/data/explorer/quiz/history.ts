/**
 * Chain history: the very first of a kind of transaction on Qortal (the
 * first name, payment, group, QDN publish, poll, name sale, level move,
 * trade contract, removal, ban, vote, rename, listing), each asked once a
 * device. Core finds a first with one read (`limit=1`, oldest first, no
 * block range, about 2 seconds, kept for the session); the question names
 * the 10,000 blocks it is in, so Transactions on Qortal shows it as the
 * first row, oldest first.
 */
import { getPoll } from '../legacyBy';
import type { TxRow } from '../../types';
import { txTypeLabel } from '../../../rules/explorer/txFamilies';
import type { QuizAnswer } from '../../../rules/explorer/quiz/types';
import {
  answerAccount,
  count,
  day,
  daysAgo,
  firstEver,
  globalLink,
  groupName,
  person,
  pick,
  stretchOf,
  text,
  type QuizTemplate,
} from './shared';

const str = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const textAnswer = (value: string | null): QuizAnswer | null =>
  value ? { kind: 'text', accepted: [value], shown: value } : null;

interface First {
  type: string;
  /** "name registration": "the very first name registration on Qortal". */
  noun: string;
  id: string;
  question: string;
  placeholder: string;
  answer: (tx: TxRow) => Promise<QuizAnswer | null>;
  /** More to say with the answer. */
  more?: (tx: TxRow) => Promise<string | null>;
}

async function groupAnswer(tx: TxRow): Promise<QuizAnswer | null> {
  if (typeof tx.groupId !== 'number') return null;
  const name = await groupName(tx.groupId);
  return {
    kind: 'text',
    accepted: [name ?? '', `#${tx.groupId}`, String(tx.groupId)].filter(Boolean),
    shown: name ? `${name} (#${tx.groupId})` : `#${tx.groupId}`,
  };
}

async function pollWords(tx: TxRow): Promise<string | null> {
  const name = str(tx.pollName);
  const info = name ? await getPoll(name).catch(() => null) : null;
  if (!info) return null;
  const asked = str(info.description);
  const options = info.options.map((o) => `“${o}”`).join(', ');
  return `${asked ? `It asked: “${asked}” ` : ''}Its options: ${options}.`;
}

const FIRSTS: readonly First[] = [
  {
    type: 'REGISTER_NAME',
    noun: 'name registration',
    id: 'name',
    question: 'What was the name?',
    placeholder: 'A name',
    answer: async (tx) => textAnswer(str(tx.name)),
  },
  {
    type: 'REGISTER_NAME',
    noun: 'name registration',
    id: 'who',
    question: 'Who registered it?',
    placeholder: 'A name or an address',
    answer: async (tx) => (tx.creatorAddress ? answerAccount(tx.creatorAddress) : null),
    more: async (tx) => (str(tx.name) ? `The name: “${tx.name}”.` : null),
  },
  {
    type: 'PAYMENT',
    noun: 'payment',
    id: 'amount',
    question: 'How much QORT did it send?',
    placeholder: 'An amount of QORT',
    answer: async (tx) =>
      str(tx.amount) ? { kind: 'number', value: tx.amount as string, unit: 'QORT' } : null,
    more: async (tx) => {
      const from = tx.creatorAddress ? await person(tx.creatorAddress) : null;
      return from?.name ? `It came from ${from.name}.` : null;
    },
  },
  {
    type: 'PAYMENT',
    noun: 'payment',
    id: 'to',
    question: 'Who received it?',
    placeholder: 'A name or an address',
    answer: async (tx) => (str(tx.recipient) ? answerAccount(tx.recipient as string) : null),
  },
  {
    type: 'CREATE_GROUP',
    noun: 'group',
    id: 'name',
    question: 'What was the group called?',
    placeholder: 'A group’s name',
    answer: async (tx) => textAnswer(str(tx.groupName)),
  },
  {
    type: 'ARBITRARY',
    noun: 'QDN publish',
    id: 'name',
    question: 'Under which name was it published?',
    placeholder: 'A name',
    answer: async (tx) => textAnswer(str(tx.name)),
  },
  {
    type: 'CREATE_POLL',
    noun: 'poll',
    id: 'name',
    question: 'What was the poll called?',
    placeholder: 'A poll’s name',
    answer: async (tx) => textAnswer(str(tx.pollName)),
    more: pollWords,
  },
  {
    type: 'CREATE_POLL',
    noun: 'poll',
    id: 'options',
    question: 'How many options did it offer?',
    placeholder: 'A number',
    answer: async (tx) =>
      Array.isArray(tx.pollOptions)
        ? { kind: 'number', value: String(tx.pollOptions.length) }
        : null,
    more: pollWords,
  },
  {
    type: 'VOTE_ON_POLL',
    noun: 'poll vote',
    id: 'poll',
    question: 'Which poll was it for?',
    placeholder: 'A poll’s name',
    answer: async (tx) => textAnswer(str(tx.pollName)),
  },
  {
    type: 'BUY_NAME',
    noun: 'name purchase',
    id: 'name',
    question: 'Which name was bought?',
    placeholder: 'A name',
    answer: async (tx) => textAnswer(str(tx.name)),
    more: async (tx) =>
      str(tx.amount) ? `It went for ${String(tx.amount).replace(/\.?0+$/, '')} QORT.` : null,
  },
  {
    type: 'SELL_NAME',
    noun: 'name listed for sale',
    id: 'name',
    question: 'Which name was it?',
    placeholder: 'A name',
    answer: async (tx) => textAnswer(str(tx.name)),
  },
  {
    type: 'UPDATE_NAME',
    noun: 'name update',
    id: 'name',
    question: 'Which name was updated?',
    placeholder: 'A name',
    answer: async (tx) => textAnswer(str(tx.name)),
  },
  {
    type: 'TRANSFER_PRIVS',
    noun: 'minting level move',
    id: 'who',
    question: 'Which account moved its level?',
    placeholder: 'A name or an address',
    answer: async (tx) => (tx.creatorAddress ? answerAccount(tx.creatorAddress) : null),
  },
  {
    type: 'DEPLOY_AT',
    noun: 'AT (automated contract)',
    id: 'name',
    question: 'What was it called?',
    placeholder: 'Its name',
    answer: async (tx) => textAnswer(str(tx.name)),
  },
  {
    type: 'GROUP_KICK',
    noun: 'removal from a group',
    id: 'group',
    question: 'Which group was it from?',
    placeholder: 'A group’s name or number',
    answer: groupAnswer,
  },
  {
    type: 'GROUP_BAN',
    noun: 'group ban',
    id: 'group',
    question: 'Which group was it from?',
    placeholder: 'A group’s name or number',
    answer: groupAnswer,
  },
];

const firstEverTemplate: QuizTemplate = {
  id: 'firstEver',
  level: 'medium',
  theme: 'history',
  // Many questions in one: it comes up a little more often.
  weight: 1.5,
  async make(ctx) {
    const open = FIRSTS.filter((f) => !ctx.seen(`first:${f.type}:${f.id}`));
    if (!open.length) return null;
    const first = pick(ctx.rng, open);
    const tx = await firstEver(first.type);
    if (!tx || typeof tx.blockHeight !== 'number') return null;
    const answer = await first.answer(tx);
    if (!answer) return null;
    const start = stretchOf(tx.blockHeight);
    const where =
      start === 1
        ? 'in Qortal’s first 10,000 blocks'
        : `in the 10,000 blocks from block ${count(start)}`;
    const label = txTypeLabel(first.type);
    const more = first.more ? await first.more(tx).catch(() => null) : null;
    return {
      key: `first:${first.type}:${first.id}`,
      parts: [text(`The very first ${first.noun} on Qortal came ${where}. ${first.question}`)],
      answer,
      placeholder: first.placeholder,
      hint: 'Transactions on Qortal: pick the type, then From a block, and Oldest first.',
      how: `Transactions on Qortal → ${label} → From block ${count(start)}, 10,000 blocks, Oldest first: the first row.`,
      fact: [
        `Block ${count(tx.blockHeight)}, ${day(tx.timestamp)}: ${count(daysAgo(tx.timestamp))} days ago.`,
        more,
      ]
        .filter(Boolean)
        .join(' '),
      link: globalLink(first.type, start, 10000, { order: 'oldest' }),
      linkLabel: 'Show it, oldest first',
      subjects: [],
    };
  },
};

export const HISTORY_TEMPLATES: readonly QuizTemplate[] = [firstEverTemplate];
