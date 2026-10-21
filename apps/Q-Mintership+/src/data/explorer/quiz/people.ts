/**
 * Quiz questions about accounts themselves: level, names, groups, when
 * first seen, since when in MINTER, the first transaction made, and the
 * head-to-head ones (multiple choice, one go): higher or lower, spot the
 * Minter Admin, odd one out, who owns the most names, who is in the most
 * groups, who came first. Answers that can change with time (a level, how
 * many names) are live: read again when an answer doesn't match.
 */
import { getAccount, getPrimaryName, isAddress } from '../../accounts';
import { getChainNow } from '../../chain';
import { getJson, seg } from '../../core';
import { getAdmins, getGroupInfo } from '../../group';
import { buildTimeline, memberSince, withOwnSubject } from '../../timeline';
import { getAddressHistory } from '../../txs';
import { getFirstSeen, getGroupsOf, getNameData, getNamesOf } from '../account';
import { explorerTxPath } from '../../../routes/paths';
import { txTypeLabel } from '../../../rules/explorer/txFamilies';
import { say } from '../../../rules/explorer/quiz/words';
import {
  accountLink,
  count,
  day,
  members,
  nameP,
  nameSubject,
  person,
  personOption,
  personP,
  randomMember,
  randomMembers,
  randomRows,
  shuffle,
  subjects,
  text,
  wordOption,
  yearOf,
  type Person,
  type QuizTemplate,
} from './shared';

const level: QuizTemplate = {
  id: 'level',
  level: 'easy',
  theme: 'people',
  async make(ctx) {
    const m = await randomMember(ctx);
    const key = `level:${m.address}`;
    if (ctx.seen(key)) return null;
    const info = await getAccount(m.address);
    return {
      key,
      parts: say(ctx.rng, [
        [text('What minting level is '), personP(m), text(' at?')],
        [text('Level check: how high has '), personP(m), text(' climbed?')],
      ]),
      answer: { kind: 'number', value: String(info.level) },
      placeholder: 'A number',
      hint: 'Search for the account: its level is in the page’s header, and in At a glance.',
      how: 'An account’s level is in its header and in Overview → At a glance, with how far it is to the next one.',
      fact: `It has minted ${count(info.blocksMinted)} blocks so far.`,
      link: accountLink(m.address),
      linkLabel: 'Open its Overview',
      live: true,
      args: { address: m.address },
      subjects: [m.address],
    };
  },
  async recheck(args) {
    const info = await getAccount(String(args.address), { force: true });
    return { kind: 'number', value: String(info.level) };
  },
};

const firstSeenBlock: QuizTemplate = {
  id: 'firstSeenBlock',
  level: 'easy',
  theme: 'people',
  async make(ctx) {
    const m = await randomMember(ctx);
    const key = `firstSeen:${m.address}`;
    if (ctx.seen(key)) return null;
    const seen = (await getFirstSeen(m.address)).firstSeen;
    if (!seen) return null;
    return {
      key,
      parts: say(ctx.rng, [
        [text('In which block was '), personP(m), text(' first seen on the chain?')],
        [personP(m), text(' had a first day on Qortal. In which block?')],
      ]),
      answer: { kind: 'number', value: String(seen.height) },
      placeholder: 'A block number',
      hint: 'Overview → At a glance has a fact for exactly this.',
      how: 'Overview → At a glance → First seen gives the date and the block of its first transaction, or of the first one it received.',
      fact: `That was ${day(seen.timestamp)}.`,
      link: accountLink(m.address),
      linkLabel: 'Open its Overview',
      subjects: [m.address],
    };
  },
};

const firstSeenYear: QuizTemplate = {
  id: 'firstSeenYear',
  level: 'easy',
  theme: 'time',
  async make(ctx) {
    const m = await randomMember(ctx);
    const key = `firstSeenYear:${m.address}`;
    if (ctx.seen(key) || ctx.seen(`firstSeen:${m.address}`)) return null;
    const seen = (await getFirstSeen(m.address)).firstSeen;
    if (!seen) return null;
    return {
      key,
      parts: say(ctx.rng, [
        [text('In what year did '), personP(m), text(' first show up on the chain?')],
        [text('Back in time: in which year was '), personP(m), text(' first seen?')],
      ]),
      answer: { kind: 'number', value: String(yearOf(seen.timestamp)) },
      placeholder: 'A year, like 2021',
      hint: 'Overview → At a glance says when it was first seen.',
      how: 'Overview → At a glance → First seen.',
      fact: `Its first trace: block ${count(seen.height)}, ${day(seen.timestamp)}.`,
      link: accountLink(m.address),
      linkLabel: 'Open its Overview',
      subjects: [m.address],
    };
  },
};

async function primaryNameOf(address: string): Promise<string | null> {
  const body = await getJson<{ name?: string }>(`/names/primary/${seg(address)}`);
  return typeof body?.name === 'string' && body.name ? body.name : null;
}

const primaryName: QuizTemplate = {
  id: 'primaryName',
  level: 'easy',
  theme: 'names',
  async make(ctx) {
    const m = await randomMember(ctx);
    if (!m.name) return null;
    const key = `primaryName:${m.address}`;
    if (ctx.seen(key)) return null;
    const bare = { address: m.address, name: null };
    return {
      key,
      parts: say(ctx.rng, [
        [text('Which name does the account '), personP(bare), text(' go by?')],
        [text('Unmask this address: '), personP(bare), text('. What is its primary name?')],
      ]),
      answer: { kind: 'text', accepted: [m.name], shown: m.name },
      placeholder: 'A name',
      hint: 'Copy the address into the Explorer’s search.',
      how: 'An address typed or pasted into the search opens its account, with its primary name at the top.',
      link: accountLink(m.address),
      linkLabel: 'Open the account',
      live: true,
      args: { address: m.address },
      subjects: [m.address],
    };
  },
  async recheck(args) {
    const name = await primaryNameOf(String(args.address));
    return name ? { kind: 'text', accepted: [name], shown: name } : null;
  },
};

const namesCount: QuizTemplate = {
  id: 'namesCount',
  level: 'easy',
  theme: 'names',
  async make(ctx) {
    const m = await randomMember(ctx);
    const key = `namesCount:${m.address}`;
    if (ctx.seen(key)) return null;
    const names = await getNamesOf(m.address);
    if (names.truncated) return null;
    return {
      key,
      parts: say(ctx.rng, [
        [text('How many names does '), personP(m), text(' own?')],
        [text('Name collector check: how many names does '), personP(m), text(' hold?')],
      ]),
      answer: { kind: 'number', value: String(names.names.length) },
      placeholder: 'A number',
      hint: 'An account has a tab just for its names, and Overview’s first line counts them.',
      how: 'The Names tab lists every name the account owns now; Overview’s summary counts them.',
      link: accountLink(m.address, 'names'),
      linkLabel: 'Open its Names',
      live: true,
      args: { address: m.address },
      subjects: [m.address],
    };
  },
  async recheck(args) {
    const names = await getNamesOf(String(args.address), { force: true });
    return names.truncated ? null : { kind: 'number', value: String(names.names.length) };
  },
};

const groupsCount: QuizTemplate = {
  id: 'groupsCount',
  level: 'easy',
  theme: 'groups',
  async make(ctx) {
    const m = await randomMember(ctx);
    const key = `groupsCount:${m.address}`;
    if (ctx.seen(key)) return null;
    const groups = await getGroupsOf(m.address);
    // MINTER alone makes a dull answer.
    if (groups.length < 2) return null;
    return {
      key,
      parts: say(ctx.rng, [
        [text('How many groups is '), personP(m), text(' a member of?')],
        [personP(m), text(' gets around. How many groups is it in?')],
      ]),
      answer: { kind: 'number', value: String(groups.length) },
      placeholder: 'A number',
      hint: 'Overview → At a glance counts them; the Groups section lists them.',
      how: 'Overview → At a glance → Groups counts the groups it is in, MINTER included.',
      link: accountLink(m.address),
      linkLabel: 'Open its Overview',
      live: true,
      args: { address: m.address },
      subjects: [m.address],
    };
  },
  async recheck(args) {
    const groups = await getGroupsOf(String(args.address), { force: true });
    return { kind: 'number', value: String(groups.length) };
  },
};

const adminGroups: QuizTemplate = {
  id: 'adminGroups',
  level: 'medium',
  theme: 'groups',
  async make(ctx) {
    // Most members run no group: try a few.
    let m: Person | null = null;
    let groups: Awaited<ReturnType<typeof getGroupsOf>> = [];
    for (let i = 0; i < 4 && !m; i += 1) {
      const candidate = await randomMember(ctx);
      if (ctx.seen(`adminGroups:${candidate.address}`)) continue;
      const list = await getGroupsOf(candidate.address);
      if (list.length >= 3 && list.some((g) => g.isAdmin)) {
        m = candidate;
        groups = list;
      }
    }
    if (!m) return null;
    const key = `adminGroups:${m.address}`;
    const admin = groups.filter((g) => g.isAdmin).length;
    return {
      key,
      parts: say(ctx.rng, [
        [
          text('Of the groups '),
          personP(m),
          text(' is in, how many is it an admin of (owner included)?'),
        ],
        [
          text('In how many of its groups does '),
          personP(m),
          text(' hold the keys (owner or admin)?'),
        ],
      ]),
      answer: { kind: 'number', value: String(admin) },
      placeholder: 'A number',
      hint: 'Overview → Groups marks Owner and Admin, and can sort them first.',
      how: 'Overview → Groups: each group it owns or runs carries an Owner or Admin mark; Sort → “Owner and admin first” puts them on top.',
      fact: `It is in ${count(groups.length)} groups in all.`,
      link: accountLink(m.address),
      linkLabel: 'Open its Overview',
      live: true,
      args: { address: m.address },
      subjects: [m.address],
    };
  },
  async recheck(args) {
    const groups = await getGroupsOf(String(args.address), { force: true });
    return { kind: 'number', value: String(groups.filter((g) => g.isAdmin).length) };
  },
};

/** When `address`'s current MINTER membership began, as its Overview works it out. */
async function minterSince(address: string): Promise<number | null> {
  const [history, chain, group] = await Promise.all([
    getAddressHistory(address),
    getChainNow(),
    getGroupInfo(),
  ]);
  const events = buildTimeline(withOwnSubject(history.rows, address), {
    msPerBlock: chain.msPerBlock,
    maximumBlockDelay: group.maximumBlockDelay ?? 10_080,
  });
  return memberSince(events, address);
}

const memberSinceYear: QuizTemplate = {
  id: 'memberSinceYear',
  level: 'medium',
  theme: 'minting',
  async make(ctx) {
    const list = await members();
    const named = list.filter((m) => m.primaryName && ctx.fresh(m.member));
    const row = named[Math.floor(ctx.rng() * named.length)];
    if (!row) return null;
    const key = `memberSince:${row.member}`;
    if (ctx.seen(key)) return null;
    const since = await minterSince(row.member).catch(() => null);
    const years = [
      ...new Set(
        [since, row.joined].filter((t): t is number => typeof t === 'number' && t > 0).map(yearOf)
      ),
    ];
    if (!years.length) return null;
    const m = { address: row.member, name: row.primaryName ?? null };
    return {
      key,
      parts: say(ctx.rng, [
        [text('In what year did '), personP(m), text(' join the MINTER group?')],
        [text('Since which year has '), personP(m), text(' been in MINTER?')],
      ]),
      answer: { kind: 'text', accepted: years.map(String), shown: String(years[0]) },
      placeholder: 'A year, like 2023',
      hint: 'The first line of its Overview says since when it is in MINTER.',
      how: 'Overview’s summary says “in MINTER since …”; the Mintership tab has the date.',
      link: accountLink(m.address),
      linkLabel: 'Open its Overview',
      subjects: [m.address],
    };
  },
};

const firstOwnType: QuizTemplate = {
  id: 'firstOwnType',
  level: 'tricky',
  theme: 'time',
  async make(ctx) {
    const m = await randomMember(ctx);
    const key = `firstOwn:${m.address}`;
    if (ctx.seen(key)) return null;
    const own = (await getFirstSeen(m.address)).firstOwn;
    if (!own) return null;
    const label = txTypeLabel(own.type);
    return {
      key,
      parts: say(ctx.rng, [
        [
          text('What type was the very first transaction '),
          personP(m),
          text(' made itself (not one it received)?'),
        ],
        [
          personP(m),
          text('’s first move on the chain, made by itself: what type of transaction was it?'),
        ],
      ]),
      answer: {
        kind: 'text',
        accepted: [label, own.type, own.type.replace(/_/g, ' ')],
        shown: `${label} (${own.type})`,
      },
      placeholder: 'A type, like Payment',
      hint: 'Its Transactions tab can list oldest first; skip what it received.',
      how: `Transactions tab, Oldest first: the first row it made itself was a ${label.toLowerCase()} in block ${count(own.height)}.`,
      fact: `That was ${day(own.timestamp)}.`,
      link: explorerTxPath(own.signature),
      linkLabel: 'Open that transaction',
      subjects: [m.address],
    };
  },
};

// ---- head to head (multiple choice, one go) -------------------------------------

const higherLower: QuizTemplate = {
  id: 'higherLower',
  level: 'easy',
  theme: 'people',
  async make(ctx) {
    const [a, b] = await randomMembers(ctx, 2);
    if (!a || !b) return null;
    const key = `higherLower:${[a.address, b.address].sort().join(':')}`;
    if (ctx.seen(key)) return null;
    const [la, lb] = await Promise.all([getAccount(a.address), getAccount(b.address)]);
    const options = ['Higher', 'Lower', 'The same'].map(wordOption);
    const correct = lb.level > la.level ? 0 : lb.level < la.level ? 1 : 2;
    return {
      key,
      kicker: 'Higher or lower',
      parts: say(ctx.rng, [
        [
          personP(a),
          text(` is level ${la.level}. Is `),
          personP(b),
          text('’s level higher, lower, or the same?'),
        ],
        [
          text('Higher, lower, or twins? '),
          personP(a),
          text(` is level ${la.level}. What about `),
          personP(b),
          text('?'),
        ],
      ]),
      answer: { kind: 'choice', options, correct },
      placeholder: '',
      hint: 'An account’s level is in its page’s header.',
      how: 'Each account’s level is in its header and in Overview → At a glance.',
      fact: `${b.name ?? b.address} is level ${lb.level}.`,
      link: accountLink(b.address),
      linkLabel: 'Open its Overview',
      subjects: [a.address, b.address],
    };
  },
};

/** Up to `n` named members that pass `test`, in random order. */
async function namedMembers(
  ctx: Parameters<QuizTemplate['make']>[0],
  test: (address: string) => boolean,
  n: number
): Promise<Person[]> {
  const list = (await members()).filter(
    (m) => m.primaryName && ctx.fresh(m.member) && test(m.member)
  );
  return shuffle(ctx.rng, list)
    .slice(0, n)
    .map((m) => ({ address: m.member, name: m.primaryName ?? null }));
}

const whoIsAdmin: QuizTemplate = {
  id: 'whoIsAdmin',
  level: 'easy',
  theme: 'people',
  async make(ctx) {
    const admins = new Set((await getAdmins()).signers.map((row) => row.member));
    const [admin] = await namedMembers(ctx, (a) => admins.has(a), 1);
    const others = await namedMembers(ctx, (a) => !admins.has(a), 3);
    if (!admin || others.length < 3) return null;
    const key = `whoIsAdmin:${admin.address}`;
    if (ctx.seen(key)) return null;
    const options = shuffle(ctx.rng, [admin, ...others]);
    return {
      key,
      kicker: 'Spot the admin',
      parts: say(ctx.rng, [
        [text('Exactly one of these four is a Minter Admin. Which one?')],
        [text('Only one of these four signs MINTER’s decisions as a Minter Admin. Which one?')],
      ]),
      answer: {
        kind: 'choice',
        options: options.map(personOption),
        correct: options.indexOf(admin),
      },
      placeholder: '',
      hint: 'An account’s header says where it stands in MINTER.',
      how: 'A Minter Admin’s header carries a violet “Minter Admin” mark.',
      link: accountLink(admin.address),
      linkLabel: 'Open the Minter Admin',
      subjects: options.map((p) => p.address),
    };
  },
};

const oddOneOut: QuizTemplate = {
  id: 'oddOneOut',
  level: 'medium',
  theme: 'people',
  async make(ctx) {
    const inMinter = new Set((await members()).map((m) => m.member));
    // An outsider: whoever registered a name in a random stretch of blocks, if not in MINTER.
    const found = await randomRows(ctx, ['REGISTER_NAME'], 10_000, 300_000);
    if (!found) return null;
    let outsider: Person | null = null;
    for (const row of shuffle(ctx.rng, found.rows)) {
      const a = row.creatorAddress;
      if (!isAddress(a) || inMinter.has(a) || !ctx.fresh(a)) continue;
      const p = await person(a);
      if (p.name) {
        outsider = p;
        break;
      }
    }
    const insiders = await namedMembers(ctx, () => true, 3);
    if (!outsider || insiders.length < 3) return null;
    const key = `oddOneOut:${outsider.address}`;
    if (ctx.seen(key)) return null;
    const options = shuffle(ctx.rng, [outsider, ...insiders]);
    return {
      key,
      kicker: 'Odd one out',
      parts: [text('Three of these four are in the MINTER group. Which one isn’t?')],
      answer: {
        kind: 'choice',
        options: options.map(personOption),
        correct: options.indexOf(outsider),
      },
      placeholder: '',
      hint: 'An account’s header says whether it is in MINTER.',
      how: 'The header of each account says “MINTER member”, or “Not in MINTER”.',
      link: accountLink(outsider.address),
      linkLabel: 'Open the odd one out',
      subjects: options.map((p) => p.address),
    };
  },
};

/** Four named members and a number each; a question when exactly one has the most. */
async function mostOf(
  ctx: Parameters<QuizTemplate['make']>[0],
  measure: (address: string) => Promise<number | null>
): Promise<{ people: Person[]; values: number[]; top: number } | null> {
  const people = await randomMembers(ctx, 4);
  if (people.length < 4) return null;
  const values = await Promise.all(people.map((p) => measure(p.address)));
  if (values.some((v) => v === null)) return null;
  const nums = values as number[];
  const max = Math.max(...nums);
  if (nums.filter((v) => v === max).length !== 1) return null;
  return { people, values: nums, top: nums.indexOf(max) };
}

const mostNames: QuizTemplate = {
  id: 'mostNames',
  level: 'medium',
  theme: 'people',
  async make(ctx) {
    const found = await mostOf(ctx, async (a) => {
      const names = await getNamesOf(a);
      return names.truncated ? null : names.names.length;
    });
    if (!found) return null;
    const key = `mostNames:${found.people
      .map((p) => p.address)
      .sort()
      .join(':')}`;
    if (ctx.seen(key)) return null;
    return {
      key,
      kicker: 'Head to head',
      parts: say(ctx.rng, [
        [text('Which of these four owns the most names?')],
        [text('Name collectors: which of these four owns the most names?')],
      ]),
      answer: {
        kind: 'choice',
        options: found.people.map(personOption),
        correct: found.top,
      },
      placeholder: '',
      hint: 'Overview’s first line counts an account’s names; the Names tab lists them.',
      how: 'Each account’s Overview says how many names it owns, and its Names tab lists them.',
      fact: found.people.map((p, i) => `${p.name}: ${count(found.values[i])}`).join(' · '),
      link: accountLink(found.people[found.top].address, 'names'),
      linkLabel: 'Open the winner’s Names',
      subjects: found.people.map((p) => p.address),
    };
  },
};

const mostGroups: QuizTemplate = {
  id: 'mostGroups',
  level: 'medium',
  theme: 'groups',
  async make(ctx) {
    const found = await mostOf(ctx, async (a) => (await getGroupsOf(a)).length);
    if (!found) return null;
    const key = `mostGroups:${found.people
      .map((p) => p.address)
      .sort()
      .join(':')}`;
    if (ctx.seen(key)) return null;
    return {
      key,
      kicker: 'Head to head',
      parts: [text('Which of these four is in the most groups?')],
      answer: {
        kind: 'choice',
        options: found.people.map(personOption),
        correct: found.top,
      },
      placeholder: '',
      hint: 'Overview → At a glance counts an account’s groups.',
      how: 'Each account’s Overview → At a glance → Groups.',
      fact: found.people.map((p, i) => `${p.name}: ${count(found.values[i])}`).join(' · '),
      link: accountLink(found.people[found.top].address),
      linkLabel: 'Open the winner',
      subjects: found.people.map((p) => p.address),
    };
  },
};

const earliestSeen: QuizTemplate = {
  id: 'earliestSeen',
  level: 'tricky',
  theme: 'time',
  async make(ctx) {
    const people = await randomMembers(ctx, 4);
    if (people.length < 4) return null;
    const seen = await Promise.all(people.map((p) => getFirstSeen(p.address)));
    const heights = seen.map((s) => s.firstSeen?.height ?? null);
    if (heights.some((h) => h === null)) return null;
    const hs = heights as number[];
    const min = Math.min(...hs);
    if (hs.filter((h) => h === min).length !== 1) return null;
    const key = `earliestSeen:${people
      .map((p) => p.address)
      .sort()
      .join(':')}`;
    if (ctx.seen(key)) return null;
    const top = hs.indexOf(min);
    return {
      key,
      kicker: 'Who came first?',
      parts: say(ctx.rng, [
        [text('Which of these four was first seen on the chain earliest?')],
        [text('Who’s the veteran? Which of these four was first seen earliest?')],
      ]),
      answer: { kind: 'choice', options: people.map(personOption), correct: top },
      placeholder: '',
      hint: 'Overview → At a glance → First seen, for each of them.',
      how: 'Each account’s Overview → At a glance → First seen gives the block; the lowest wins.',
      fact: people.map((p, i) => `${p.name}: block ${count(hs[i])}`).join(' · '),
      link: accountLink(people[top].address),
      linkLabel: 'Open the veteran',
      subjects: people.map((p) => p.address),
    };
  },
};

const nameOwnerFirstSeen: QuizTemplate = {
  id: 'nameOwnerFirstSeen',
  level: 'tricky',
  theme: 'detective',
  async make(ctx) {
    const found = await randomRows(ctx, ['REGISTER_NAME'], 10_000, 100_000);
    if (!found) return null;
    // An owner known by another name makes the search part of the puzzle: try a few.
    let pickd: { name: string; owner: string; ownerName: string } | null = null;
    for (const row of shuffle(ctx.rng, found.rows).slice(0, 8)) {
      const name = typeof row.name === 'string' ? row.name : null;
      if (!name || !ctx.fresh(nameSubject(name)) || ctx.seen(`nameOwnerSeen:${name.toLowerCase()}`))
        continue;
      const data = await getNameData(name);
      if (!data || data.name !== name) continue;
      const ownerName = await getPrimaryName(data.owner).catch(() => null);
      if (!ownerName || ownerName.toLowerCase() === name.toLowerCase()) continue;
      pickd = { name, owner: data.owner, ownerName };
      break;
    }
    if (!pickd) return null;
    const { name, ownerName } = pickd;
    const data = { owner: pickd.owner };
    const key = `nameOwnerSeen:${name.toLowerCase()}`;
    const seen = (await getFirstSeen(data.owner)).firstSeen;
    if (!seen) return null;
    return {
      key,
      parts: [
        text('Whoever owns the name '),
        nameP(name),
        text(' now: in what year was that account first seen on the chain?'),
      ],
      answer: { kind: 'number', value: String(yearOf(seen.timestamp)) },
      placeholder: 'A year, like 2022',
      hint: 'Search for the name: it opens its owner’s account.',
      how: 'Searching a name opens the account that owns it; Overview → At a glance → First seen.',
      fact: `Its owner: ${ownerName}, first seen in block ${count(seen.height)}.`,
      link: accountLink(data.owner),
      linkLabel: 'Open the owner',
      subjects: subjects(data.owner, nameSubject(name)),
    };
  },
};

export const PEOPLE_TEMPLATES: readonly QuizTemplate[] = [
  level,
  firstSeenBlock,
  firstSeenYear,
  primaryName,
  namesCount,
  groupsCount,
  adminGroups,
  memberSinceYear,
  firstOwnType,
  higherLower,
  whoIsAdmin,
  oddOneOut,
  mostNames,
  mostGroups,
  earliestSeen,
  nameOwnerFirstSeen,
];
