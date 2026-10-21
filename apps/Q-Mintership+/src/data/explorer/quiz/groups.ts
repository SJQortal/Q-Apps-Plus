/**
 * Quiz questions about groups: who removed, banned or promoted whom in a
 * block, which group an account left, who created a group, how many joins
 * a group had in 1,000 blocks, and the level now of the account that
 * removed someone (live: read again when an answer doesn't match).
 */
import { getAccount, isAddress } from '../../accounts';
import type { TxRow } from '../../types';
import { say } from '../../../rules/explorer/quiz/words';
import {
  ACCOUNT_PLACEHOLDER,
  accountLink,
  accountP,
  answerAccount,
  block,
  blockSubject,
  count,
  day,
  globalLink,
  groupName,
  groupP,
  groupSubject,
  nameP,
  person,
  pickRow,
  randomRows,
  subjects,
  text,
  wholeRange,
  type QuizContext,
  type QuizTemplate,
} from './shared';

const str = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value : null;

/** A group transaction of `type` in a random stretch, with its target account in `field`. */
async function groupAct(
  ctx: QuizContext,
  type: string,
  field: 'member' | 'offender' | null,
  from: number
): Promise<{ tx: TxRow; target: string | null; group: string | null } | null> {
  const found = await randomRows(ctx, [type], 10_000, from);
  if (!found) return null;
  const tx = await pickRow(ctx, found.rows, (row) =>
    field ? [row.creatorAddress, str(row[field])] : [row.creatorAddress]
  );
  if (!tx?.creatorAddress || typeof tx.groupId !== 'number' || !tx.blockHeight) return null;
  const target = field ? str(tx[field]) : null;
  if (field && (!isAddress(target) || target === tx.creatorAddress)) return null;
  if (!ctx.fresh(groupSubject(tx.groupId))) return null;
  return { tx, target, group: await groupName(tx.groupId) };
}

const kickedBy: QuizTemplate = {
  id: 'kickedBy',
  level: 'medium',
  theme: 'groups',
  async make(ctx) {
    const found = await groupAct(ctx, 'GROUP_KICK', 'member', 500_000);
    if (!found) return null;
    const { tx, target, group } = found;
    const key = `kick:${tx.signature}`;
    if (ctx.seen(key)) return null;
    const member = await accountP(target as string);
    // An account named like its group makes a muddle of a sentence.
    if (member.kind === 'account' && group && member.name?.toLowerCase() === group.toLowerCase())
      return null;
    const g = groupP(tx.groupId as number, group);
    const at = block(tx.blockHeight as number);
    return {
      key,
      parts: say(ctx.rng, [
        [
          text('In '),
          at,
          text(', '),
          member,
          text(' was removed from the group '),
          g,
          text('. Who removed it?'),
        ],
        [
          text('Drama in '),
          at,
          text(': '),
          member,
          text(' was shown the door of '),
          g,
          text('. Who held it open?'),
        ],
      ]),
      answer: await answerAccount(tx.creatorAddress as string),
      placeholder: ACCOUNT_PLACEHOLDER,
      hint: 'Transactions on Qortal has a type for removals from a group, and can look at one block.',
      how: 'Transactions on Qortal → Removal from a group → From a block, “Just this block”: the row says who removed whom, and from which group.',
      fact: `That was ${day(tx.timestamp)}.`,
      link: globalLink('GROUP_KICK', tx.blockHeight as number, 1),
      linkLabel: 'Show that block’s removals',
      subjects: subjects(tx.creatorAddress, target, groupSubject(tx.groupId as number)),
    };
  },
};

const bannedBy: QuizTemplate = {
  id: 'bannedBy',
  level: 'medium',
  theme: 'groups',
  async make(ctx) {
    const found = await groupAct(ctx, 'GROUP_BAN', 'offender', 300_000);
    if (!found) return null;
    const { tx, target, group } = found;
    const key = `ban:${tx.signature}`;
    if (ctx.seen(key)) return null;
    const offender = await accountP(target as string);
    const g = groupP(tx.groupId as number, group);
    const at = block(tx.blockHeight as number);
    return {
      key,
      parts: say(ctx.rng, [
        [
          text('In '),
          at,
          text(', '),
          offender,
          text(' was banned from the group '),
          g,
          text('. Who banned it?'),
        ],
        [
          text('Who swung the ban hammer on '),
          offender,
          text(' in '),
          g,
          text(', in '),
          at,
          text('?'),
        ],
      ]),
      answer: await answerAccount(tx.creatorAddress as string),
      placeholder: ACCOUNT_PLACEHOLDER,
      hint: 'Group bans are a type of their own in Transactions on Qortal.',
      how: 'Transactions on Qortal → Group ban → From a block, “Just this block”: “… banned … from …”.',
      fact: `That was ${day(tx.timestamp)}.`,
      link: globalLink('GROUP_BAN', tx.blockHeight as number, 1),
      linkLabel: 'Show that block’s bans',
      subjects: subjects(tx.creatorAddress, target, groupSubject(tx.groupId as number)),
    };
  },
};

const adminAddedBy: QuizTemplate = {
  id: 'adminAddedBy',
  level: 'medium',
  theme: 'groups',
  async make(ctx) {
    const found = await groupAct(ctx, 'ADD_GROUP_ADMIN', 'member', 100_000);
    if (!found) return null;
    const { tx, target, group } = found;
    const key = `adminAdded:${tx.signature}`;
    if (ctx.seen(key)) return null;
    const admin = await accountP(target as string);
    const g = groupP(tx.groupId as number, group);
    const at = block(tx.blockHeight as number);
    return {
      key,
      parts: say(ctx.rng, [
        [
          text('In '),
          at,
          text(', '),
          admin,
          text(' became an admin of the group '),
          g,
          text('. Who made it one?'),
        ],
        [
          text('Promotion day: '),
          admin,
          text(' became an admin of '),
          g,
          text(' in '),
          at,
          text('. Who promoted it?'),
        ],
      ]),
      answer: await answerAccount(tx.creatorAddress as string),
      placeholder: ACCOUNT_PLACEHOLDER,
      hint: 'Transactions on Qortal has a type for group admins added.',
      how: 'Transactions on Qortal → Group admin added → From a block, “Just this block”: “… made … an admin of …”.',
      fact: `That was ${day(tx.timestamp)}.`,
      link: globalLink('ADD_GROUP_ADMIN', tx.blockHeight as number, 1),
      linkLabel: 'Show that block’s new admins',
      subjects: subjects(tx.creatorAddress, target, groupSubject(tx.groupId as number)),
    };
  },
};

const groupLeft: QuizTemplate = {
  id: 'groupLeft',
  level: 'medium',
  theme: 'groups',
  async make(ctx) {
    const found = await groupAct(ctx, 'LEAVE_GROUP', null, 100_000);
    if (!found) return null;
    const { tx, group } = found;
    const key = `left:${tx.signature}`;
    if (ctx.seen(key)) return null;
    const id = tx.groupId as number;
    const who = await accountP(tx.creatorAddress as string);
    const at = block(tx.blockHeight as number);
    return {
      key,
      parts: say(ctx.rng, [
        [text('In '), at, text(', '), who, text(' left a group. Which one?')],
        [who, text(' walked out of a group in '), at, text('. Which group?')],
      ]),
      answer: {
        kind: 'text',
        accepted: [group ?? '', `#${id}`, String(id)].filter(Boolean),
        shown: group ? `${group} (#${id})` : `#${id}`,
      },
      placeholder: 'A group’s name or number',
      hint: 'Transactions on Qortal has a type for leaving a group.',
      how: 'Transactions on Qortal → Leaving a group → From a block, “Just this block”: “… left …”.',
      link: globalLink('LEAVE_GROUP', tx.blockHeight as number, 1),
      linkLabel: 'Show that block',
      subjects: subjects(tx.creatorAddress, groupSubject(id)),
    };
  },
};

const groupCreator: QuizTemplate = {
  id: 'groupCreator',
  level: 'medium',
  theme: 'groups',
  async make(ctx) {
    const found = await randomRows(ctx, ['CREATE_GROUP'], 10_000, 100_000);
    if (!found) return null;
    const rows = found.rows.filter(
      (row) => str(row.groupName) && row.creatorAddress && row.blockHeight
    );
    const tx = rows[Math.floor(ctx.rng() * rows.length)];
    if (!tx) return null;
    const name = tx.groupName as string;
    const key = `groupCreator:${tx.signature}`;
    if (ctx.seen(key) || !ctx.fresh(tx.creatorAddress as string)) return null;
    const at = block(tx.blockHeight as number);
    return {
      key,
      parts: say(ctx.rng, [
        [text('Who created the group '), nameP(name), text(', in '), at, text('?')],
        [text('The group '), nameP(name), text(' was born in '), at, text('. Who created it?')],
      ]),
      answer: await answerAccount(tx.creatorAddress as string),
      placeholder: ACCOUNT_PLACEHOLDER,
      hint: 'Transactions on Qortal has a type for groups created.',
      how: 'Transactions on Qortal → Group created at that block: “… created the group …”.',
      fact: str(tx.description)
        ? `Its description: “${String(tx.description).slice(0, 120)}”`
        : undefined,
      link: globalLink('CREATE_GROUP', tx.blockHeight as number, 1),
      linkLabel: 'Show that block’s new groups',
      subjects: subjects(tx.creatorAddress),
    };
  },
};

const groupJoins: QuizTemplate = {
  id: 'groupJoins',
  level: 'tricky',
  theme: 'groups',
  async make(ctx) {
    const found = await randomRows(ctx, ['JOIN_GROUP'], 1000, 500_000);
    if (!found) return null;
    const tx = found.rows[Math.floor(ctx.rng() * found.rows.length)];
    if (typeof tx.groupId !== 'number' || !ctx.fresh(groupSubject(tx.groupId))) return null;
    const key = `joins:${found.start}:${tx.groupId}`;
    if (ctx.seen(key)) return null;
    const rows = await wholeRange(['JOIN_GROUP'], found.start, 1000, 5);
    if (!rows) return null;
    const joins = rows.filter((row) => row.groupId === tx.groupId).length;
    if (joins < 2) return null;
    const name = await groupName(tx.groupId);
    return {
      key,
      parts: [
        text('How many “Joining a group” transactions for the group '),
        groupP(tx.groupId, name),
        text(' are there in the 1,000 blocks from '),
        block(found.start),
        text('?'),
      ],
      answer: { kind: 'number', value: String(joins) },
      placeholder: 'A number',
      hint: 'Narrow the rows to the group’s number, and look further until all are read.',
      how: `Transactions on Qortal → Joining a group → From a block, “1,000 blocks”, Only rows with “#${tx.groupId}”, then Look further until the list ends.`,
      fact: `Out of ${count(rows.length)} joins of any group in those blocks.`,
      link: globalLink('JOIN_GROUP', found.start, 1000, { find: `#${tx.groupId}` }),
      linkLabel: 'Show those joins',
      subjects: [groupSubject(tx.groupId), blockSubject(found.start)],
    };
  },
};

const kickerLevel: QuizTemplate = {
  id: 'kickerLevel',
  level: 'expert',
  theme: 'detective',
  async make(ctx) {
    const found = await groupAct(ctx, 'GROUP_KICK', 'member', 500_000);
    if (!found) return null;
    const { tx, target, group } = found;
    const key = `kickerLevel:${tx.signature}`;
    if (ctx.seen(key)) return null;
    const kicker = tx.creatorAddress as string;
    const info = await getAccount(kicker);
    const k = await person(kicker);
    return {
      key,
      parts: [
        text('The account that removed '),
        await accountP(target as string),
        text(' from the group '),
        groupP(tx.groupId as number, group),
        text(' in '),
        block(tx.blockHeight as number),
        text(': what minting level is it at now?'),
      ],
      answer: { kind: 'number', value: String(info.level) },
      placeholder: 'A number',
      hint: 'Two steps: find who removed it in that block, then open that account.',
      how: 'Transactions on Qortal → Removal from a group at that block names who did it; its header shows its level.',
      fact: `It was ${k.name ?? k.address}.`,
      link: accountLink(kicker),
      linkLabel: 'Open that account',
      live: true,
      args: { address: kicker },
      subjects: subjects(kicker, target, groupSubject(tx.groupId as number)),
    };
  },
  async recheck(args) {
    const info = await getAccount(String(args.address), { force: true });
    return { kind: 'number', value: String(info.level) };
  },
};

export const GROUP_TEMPLATES: readonly QuizTemplate[] = [
  kickedBy,
  bannedBy,
  adminAddedBy,
  groupLeft,
  groupCreator,
  groupJoins,
  kickerLevel,
];
