/** "Since your last visit": snapshots, and what changed for admins and nominees. */
import { describe, expect, it } from 'vitest';
import type { Nomination } from '../data/nominations';
import type { TxRow } from '../data/types';
import { decisionTitle, type Decision } from './decision';
import type { Tally } from './tally';
import {
  MAX_OUTCOME_LOOKUPS,
  MAX_SNAPSHOT_DECISIONS,
  MAX_SNAPSHOT_MADE,
  adminChanges,
  buildSnapshot,
  hasChanges,
  madeBy,
  madeEvents,
  newestNomination,
  nomineeEvents,
  outcomeOf,
  parseSnapshot,
  roundDecision,
  sameRound,
  sinceSummary,
  snapMade,
  snapNomination,
  vanishedDecisions,
  type MadeEvent,
  type SnapMade,
  type SnapNomination,
  type VisitSnapshot,
} from './sinceLastVisit';

const ME = 'QMe111111111111111111111111111111111';
const OTHER = 'QOther1111111111111111111111111111111';
const AT = 1_791_000_000_000;

function tally(signed: number, needed = 8): Tally {
  return {
    approvals: [],
    rejections: [],
    inFlight: [],
    approvalCount: signed,
    rejectionCount: 0,
    projectedApprovalCount: signed,
    needed,
    totalAdmins: 20,
    threshold: 'PCT40',
    met: signed >= needed,
    rejectedMet: false,
  } as Tally;
}

function decision(signature: string, over: Partial<Decision> = {}): Decision {
  return {
    signature,
    kind: 'invite',
    type: 'GROUP_INVITE',
    subject: `Q-subject-${signature}`,
    creatorAddress: OTHER,
    createdAt: AT,
    blockHeight: 1000,
    window: {
      confirmedHeight: 1000,
      earliestDecisionHeight: 1006,
      lastUsefulSignatureHeight: 11_079,
      lastDecisionHeight: 11_080,
      expiresAtHeight: 11_081,
    },
    phase: 'open',
    windowPhase: 'open',
    applyAtHeight: null,
    tally: tally(1),
    unusualRoute: false,
    tx: { type: 'GROUP_INVITE', signature, timestamp: AT } as TxRow,
    ...over,
  };
}

function nomination(over: Partial<Nomination> = {}): Nomination {
  return {
    nominee: ME,
    nomineeName: 'Me',
    source: 'qdn',
    nomination: null,
    supporters: [],
    state: 'waiting',
    publishedAt: AT - 86_400_000,
    waitingEndsAt: null,
    decision: null,
    latestInvite: null,
    hasJoinRequest: false,
    hasStoredInvite: false,
    ...over,
  };
}

const supporter = () => ({}) as Nomination['supporters'][number];

function snapshot(over: Partial<VisitSnapshot> = {}): VisitSnapshot {
  return { v: 1, at: AT, height: 900, ...over };
}

describe('snapshots', () => {
  it("keeps an admin's queue and leaves the nomination out", () => {
    const s = buildSnapshot({ at: AT, height: 1200, decisions: [decision('a'), decision('b')] });
    expect(s).toEqual({
      v: 1,
      at: AT,
      height: 1200,
      decisions: [
        { signature: 'a', kind: 'invite', subject: 'Q-subject-a', height: 1000 },
        { signature: 'b', kind: 'invite', subject: 'Q-subject-b', height: 1000 },
      ],
    });
    expect('nomination' in s).toBe(false);
  });

  it("keeps a nominee's newest nomination, or null when there is none", () => {
    const n = nomination({
      state: 'signing',
      decision: decision('inv', { tally: tally(3) }),
      supporters: [supporter(), supporter()],
    });
    expect(buildSnapshot({ at: AT, height: null, nomination: n }).nomination).toEqual({
      decision: 'inv',
      state: 'signing',
      signed: 3,
      needed: 8,
      supporters: 2,
      publishedAt: n.publishedAt,
    });
    expect(buildSnapshot({ at: AT, height: null, nomination: null }).nomination).toBeNull();
    expect('decisions' in buildSnapshot({ at: AT, height: null, nomination: null })).toBe(false);
  });

  it('caps the decisions it keeps', () => {
    const many = Array.from({ length: MAX_SNAPSHOT_DECISIONS + 20 }, (_, i) => decision(`d${i}`));
    expect(buildSnapshot({ at: AT, height: 1, decisions: many }).decisions).toHaveLength(
      MAX_SNAPSHOT_DECISIONS
    );
  });

  it('reads back what it saved, through JSON', () => {
    const s = buildSnapshot({
      at: AT,
      height: 1200,
      decisions: [decision('a', { subject: null, blockHeight: null })],
      nomination: nomination(),
    });
    expect(parseSnapshot(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });

  it('keeps a decline a decline, through JSON, and titles it once it has left the queue', () => {
    const s = buildSnapshot({
      at: AT,
      height: 1200,
      decisions: [
        decision('declined', { kind: 'kick', decline: true }),
        decision('removed', { kind: 'kick' }),
      ],
    });
    const back = parseSnapshot(JSON.parse(JSON.stringify(s)))!;
    expect(back.decisions?.map((d) => d.decline)).toEqual([true, undefined]);
    const changes = adminChanges(back, {
      decisions: [],
      nominations: null,
      me: ME,
      outcomes: new Map([
        ['declined', { approvalStatus: 'APPROVED', approvalHeight: 1300 }],
        ['removed', { approvalStatus: 'APPROVED', approvalHeight: 1290 }],
      ]),
    });
    expect(changes.decided.map((e) => decisionTitle(e))).toEqual([
      'Decline a join request',
      'Remove from MINTER',
    ]);
  });

  it('refuses what it did not write', () => {
    expect(parseSnapshot(null)).toBeNull();
    expect(parseSnapshot('text')).toBeNull();
    expect(parseSnapshot({ v: 2, at: AT, height: 1 })).toBeNull();
    expect(parseSnapshot({ v: 1, at: -1, height: 1 })).toBeNull();
    expect(parseSnapshot({ v: 1, at: 'yesterday', height: 1 })).toBeNull();
    expect(parseSnapshot({ v: 1, at: AT, height: 'tip' })).toBeNull();
    expect(parseSnapshot({ v: 1, at: AT, height: 1, decisions: 'all' })).toBeNull();
  });

  it('drops damaged decisions and a damaged nomination, keeping the rest', () => {
    const parsed = parseSnapshot({
      v: 1,
      at: AT,
      decisions: [
        { signature: 'ok', kind: 'kick', subject: 'Qx', height: 5 },
        { signature: '', kind: 'kick', subject: null, height: 5 },
        { signature: 'k', kind: 'vote', subject: null, height: 5 },
        { signature: 'h', kind: 'ban', subject: null, height: -3 },
        { signature: 's', kind: 'ban', subject: 7, height: null },
        null,
      ],
      nomination: { decision: 'x', state: 'dreaming', signed: 1, needed: 8, supporters: 0 },
    });
    expect(parsed).toEqual({
      v: 1,
      at: AT,
      height: null,
      decisions: [{ signature: 'ok', kind: 'kick', subject: 'Qx', height: 5 }],
    });
    expect(parseSnapshot({ v: 1, at: AT, height: 1, nomination: null })?.nomination).toBeNull();
  });
});

describe('nomination rounds', () => {
  it("names the round's invite: pending, or the decided one once it is over", () => {
    const old = { signature: 'old' } as TxRow;
    expect(roundDecision(nomination({ state: 'signing', decision: decision('p') }))).toBe('p');
    expect(roundDecision(nomination({ state: 'expired', latestInvite: old }))).toBe('old');
    expect(roundDecision(nomination({ state: 'rejected', latestInvite: old }))).toBe('old');
    expect(roundDecision(nomination({ state: 'approved', latestInvite: old }))).toBe('old');
    // A new nomination after an expired round: the old invite isn't this round's.
    expect(roundDecision(nomination({ state: 'waiting', latestInvite: old }))).toBeNull();
    expect(roundDecision(nomination({ state: 'lapsed' }))).toBeNull();
  });

  it('picks the newest nomination', () => {
    const a = nomination({ publishedAt: 1 });
    const b = nomination({ publishedAt: 3 });
    const c = nomination({ publishedAt: 2 });
    expect(newestNomination([a, b, c])).toBe(b);
    expect(newestNomination([])).toBeNull();
  });

  it('matches a round by its invite, else by its record', () => {
    const prev: SnapNomination = {
      decision: 'inv',
      state: 'signing',
      signed: 3,
      needed: 8,
      supporters: 0,
      publishedAt: 100,
    };
    expect(sameRound(prev, nomination({ state: 'signing', decision: decision('inv') }))).toBe(true);
    expect(sameRound(prev, nomination({ state: 'signing', decision: decision('new') }))).toBe(
      false
    );
    const waiting = { ...prev, decision: null };
    expect(sameRound(waiting, nomination({ publishedAt: 100 }))).toBe(true);
    expect(sameRound(waiting, nomination({ publishedAt: 100_000 }))).toBe(false);
    // First signature on the same record.
    expect(
      sameRound(
        waiting,
        nomination({ publishedAt: 100, state: 'signing', decision: decision('x') })
      )
    ).toBe(true);
  });
});

describe('outcomes', () => {
  it("reads Core's approval status", () => {
    expect(outcomeOf({ approvalStatus: 'APPROVED' })).toBe('approved');
    expect(outcomeOf({ approvalStatus: 'REJECTED' })).toBe('rejected');
    expect(outcomeOf({ approvalStatus: 'EXPIRED' })).toBe('expired');
    expect(outcomeOf({ approvalStatus: 'PENDING' })).toBeNull();
    expect(outcomeOf({ approvalStatus: 'INVALID' })).toBeNull();
    expect(outcomeOf({})).toBeNull();
    expect(outcomeOf(null)).toBeNull();
    expect(outcomeOf(undefined)).toBeNull();
  });

  it('looks up the decisions that left the queue, newest first, at most a dozen', () => {
    const prev = snapshot({
      decisions: [
        { signature: 'stays', kind: 'invite', subject: null, height: 10 },
        { signature: 'old', kind: 'kick', subject: null, height: 5 },
        { signature: 'new', kind: 'ban', subject: null, height: 20 },
        { signature: 'unconfirmed', kind: 'ban', subject: null, height: null },
      ],
    });
    expect(vanishedDecisions(prev, [{ signature: 'stays' }]).map((d) => d.signature)).toEqual([
      'unconfirmed',
      'new',
      'old',
    ]);
    expect(vanishedDecisions(snapshot(), [])).toEqual([]);
    const many = snapshot({
      decisions: Array.from({ length: 30 }, (_, i) => ({
        signature: `s${i}`,
        kind: 'invite' as const,
        subject: null,
        height: i,
      })),
    });
    const looked = vanishedDecisions(many, []);
    expect(looked).toHaveLength(MAX_OUTCOME_LOOKUPS);
    expect(looked[0].signature).toBe('s29');
  });
});

describe('adminChanges', () => {
  const prev = snapshot({
    decisions: [
      { signature: 'open', kind: 'invite', subject: 'Qa', height: 800 },
      { signature: 'approved', kind: 'invite', subject: 'Qb', height: 700 },
      { signature: 'rejected', kind: 'kick', subject: 'Qc', height: 600 },
      { signature: 'expired', kind: 'ban', subject: 'Qd', height: 500 },
      { signature: 'unknown', kind: 'ban', subject: 'Qe', height: 400 },
      { signature: 'stillPending', kind: 'cancelBan', subject: 'Qf', height: 300 },
      { signature: 'expiredNow', kind: 'addAdmin', subject: 'Qg', height: 1000 },
    ],
  });
  const outcomes = new Map<string, Pick<TxRow, 'approvalStatus' | 'approvalHeight'> | null>([
    ['approved', { approvalStatus: 'APPROVED', approvalHeight: 950 }],
    ['rejected', { approvalStatus: 'REJECTED', approvalHeight: 960 }],
    ['expired', { approvalStatus: 'EXPIRED', approvalHeight: 970 }],
    ['unknown', null],
    ['stillPending', { approvalStatus: 'PENDING' }],
  ]);
  const current = [
    decision('open'),
    decision('expiredNow', { kind: 'addAdmin', subject: 'Qg', phase: 'expired' }),
    decision('fresh', { kind: 'kick' }),
    decision('mine', { creatorAddress: ME }),
    decision('freshExpired', { phase: 'expired' }),
    decision('otherKind', { kind: 'other' }),
  ];

  it('finds new decisions: not seen before, not your own, not over', () => {
    const changes = adminChanges(prev, { decisions: current, nominations: null, me: ME, outcomes });
    expect(changes.newDecisions.map((d) => d.signature)).toEqual(['fresh']);
  });

  it('finds the decided ones with a known outcome, newest first, and skips the rest', () => {
    const changes = adminChanges(prev, { decisions: current, nominations: null, me: ME, outcomes });
    expect(changes.decided.map((d) => [d.signature, d.outcome, d.height])).toEqual([
      ['expiredNow', 'expired', 11_081],
      ['expired', 'expired', 970],
      ['rejected', 'rejected', 960],
      ['approved', 'approved', 950],
    ]);
    expect(changes.decided.find((d) => d.signature === 'approved')).toMatchObject({
      kind: 'invite',
      subject: 'Qb',
    });
  });

  it("can't tell what is new without an admin snapshot", () => {
    const changes = adminChanges(snapshot(), {
      decisions: current,
      nominations: null,
      me: ME,
      outcomes,
    });
    expect(changes.newDecisions).toEqual([]);
    expect(changes.decided).toEqual([]);
  });

  it('finds nominations published since, still waiting for a first approval', () => {
    const byMe = { publisher: { address: ME } } as Nomination['nomination'];
    const byOther = { publisher: { address: OTHER } } as Nomination['nomination'];
    const list = [
      nomination({ nominee: 'Q1', publishedAt: AT + 1, nomination: byOther }),
      nomination({ nominee: 'Q2', publishedAt: AT - 1, nomination: byOther }),
      nomination({ nominee: 'Q3', publishedAt: AT + 1, nomination: byMe }),
      nomination({ nominee: 'Q4', publishedAt: AT + 1, state: 'signing', nomination: byOther }),
      nomination({ nominee: ME, publishedAt: AT + 1, nomination: byOther }),
      nomination({ nominee: 'Q5', publishedAt: AT + 5, source: 'chain' }),
    ];
    const changes = adminChanges(snapshot(), {
      decisions: [],
      nominations: list,
      me: ME,
      outcomes: new Map(),
    });
    expect(changes.newNominations.map((n) => n.nominee)).toEqual(['Q1', 'Q5']);
  });
});

describe('nomineeEvents', () => {
  const signing = (signed: number, sig = 'inv') =>
    nomination({ state: 'signing', decision: decision(sig, { tally: tally(signed) }) });
  const prevSigning = (signed: number): SnapNomination => ({
    ...(snapNomination(signing(signed)) as SnapNomination),
  });

  it('has nothing to compare without a snapshot of the nomination', () => {
    expect(nomineeEvents(undefined, signing(3))).toEqual([]);
    expect(nomineeEvents(prevSigning(3), null)).toEqual([]);
  });

  it('says you were nominated when there was no nomination before', () => {
    const n = nomination();
    expect(nomineeEvents(null, n)).toEqual([{ kind: 'nominated', nomination: n }]);
    expect(nomineeEvents(null, signing(2))[0].kind).toBe('nominated');
    expect(nomineeEvents(null, nomination({ state: 'approved' }))[0].kind).toBe('nominated');
    // Nothing to announce for a round that is already over, or blocked by a ban.
    expect(nomineeEvents(null, nomination({ state: 'expired' }))).toEqual([]);
    expect(nomineeEvents(null, nomination({ state: 'lapsed' }))).toEqual([]);
    expect(nomineeEvents(null, nomination({ state: 'blocked' }))).toEqual([]);
  });

  it('treats a new round as a new nomination', () => {
    const prev = { ...prevSigning(5), state: 'expired' as const };
    expect(nomineeEvents(prev, nomination({ publishedAt: AT }))[0].kind).toBe('nominated');
    expect(nomineeEvents(prev, signing(1, 'second'))[0].kind).toBe('nominated');
    expect(nomineeEvents(prev, nomination({ publishedAt: AT, state: 'lapsed' }))).toEqual([]);
  });

  it('reports the first approval, with the count', () => {
    const prev = snapNomination(nomination()) as SnapNomination;
    const now = signing(1);
    now.publishedAt = prev.publishedAt;
    expect(nomineeEvents(prev, now)).toEqual([{ kind: 'firstSignature', signed: 1, needed: 8 }]);
  });

  it('reports new approvals, and stays quiet when there are none (or fewer)', () => {
    expect(nomineeEvents(prevSigning(3), signing(5))).toEqual([
      { kind: 'signatures', added: 2, signed: 5, needed: 8 },
    ]);
    expect(nomineeEvents(prevSigning(5), signing(5))).toEqual([]);
    expect(nomineeEvents(prevSigning(5), signing(4))).toEqual([]);
  });

  it('reports each outcome once', () => {
    const decided = { signature: 'inv' } as TxRow;
    const at = (state: Nomination['state']) => nomination({ state, latestInvite: decided });
    expect(nomineeEvents(prevSigning(7), at('approved'))).toEqual([{ kind: 'approved' }]);
    expect(nomineeEvents(prevSigning(5), at('expired'))).toEqual([
      { kind: 'expired', signed: 5, needed: 8 },
    ]);
    expect(nomineeEvents(prevSigning(2), at('rejected'))).toEqual([{ kind: 'rejected' }]);
    const already = { ...prevSigning(5), state: 'expired' as const };
    expect(nomineeEvents(already, at('expired'))).toEqual([]);
  });

  it('reports a nomination that closed without a first approval', () => {
    const prev = snapNomination(nomination()) as SnapNomination;
    expect(nomineeEvents(prev, nomination({ state: 'lapsed' }))).toEqual([{ kind: 'lapsed' }]);
    expect(nomineeEvents({ ...prev, state: 'lapsed' }, nomination({ state: 'lapsed' }))).toEqual(
      []
    );
  });

  it('reports new support on an open nomination only', () => {
    const prev = snapNomination(nomination()) as SnapNomination;
    expect(nomineeEvents(prev, nomination({ supporters: [supporter(), supporter()] }))).toEqual([
      { kind: 'support', added: 2 },
    ]);
    expect(nomineeEvents(prev, nomination({ state: 'lapsed', supporters: [supporter()] }))).toEqual(
      [{ kind: 'lapsed' }]
    );
  });

  it('puts the outcome first, then signatures, then support', () => {
    const prev = prevSigning(3);
    const now = signing(4);
    now.supporters = [supporter()];
    expect(nomineeEvents(prev, now).map((e) => e.kind)).toEqual(['signatures', 'support']);
  });

  it("tells how the last round ended from the history when it isn't listed any more", () => {
    const prev = prevSigning(6);
    const row = (approvalStatus: TxRow['approvalStatus']) => ({ signature: 'inv', approvalStatus });
    // An invite without a nomination record: nothing is listed now.
    expect(nomineeEvents(prev, null, row('APPROVED'))).toEqual([{ kind: 'approved' }]);
    expect(nomineeEvents(prev, null, row('EXPIRED'))).toEqual([
      { kind: 'expired', signed: 6, needed: 8 },
    ]);
    expect(nomineeEvents(prev, null, row('REJECTED'))).toEqual([{ kind: 'rejected' }]);
    // Still pending, another invite, or no history row: nothing to say.
    expect(nomineeEvents(prev, null, row('PENDING'))).toEqual([]);
    expect(nomineeEvents(prev, null, { signature: 'other', approvalStatus: 'EXPIRED' })).toEqual(
      []
    );
    expect(nomineeEvents(prev, null, null)).toEqual([]);
    expect(nomineeEvents(null, null, row('EXPIRED'))).toEqual([]);
    // Already known at the last visit.
    expect(nomineeEvents({ ...prev, state: 'expired' }, null, row('EXPIRED'))).toEqual([]);
  });

  it('reports the end of the last round, then the new nomination', () => {
    const fresh = nomination({ publishedAt: AT });
    expect(
      nomineeEvents(prevSigning(4), fresh, { signature: 'inv', approvalStatus: 'EXPIRED' })
    ).toEqual([
      { kind: 'expired', signed: 4, needed: 8 },
      { kind: 'nominated', nomination: fresh },
    ]);
  });
});

describe('summary', () => {
  const none = { newDecisions: [], decided: [], newNominations: [] };

  it('has nothing to show when nothing changed', () => {
    const changes = { joined: false, admin: none, nominee: [] };
    expect(hasChanges(changes)).toBe(false);
    expect(sinceSummary(changes)).toBeNull();
    expect(hasChanges({ joined: false, admin: null, nominee: [] })).toBe(false);
  });

  it('reads as one sentence', () => {
    const admin = {
      newDecisions: [decision('a'), decision('b'), decision('c')],
      decided: [
        {
          signature: 'd',
          kind: 'invite' as const,
          subject: null,
          creatorAddress: null,
          outcome: 'approved' as const,
          height: 1,
        },
      ],
      newNominations: [nomination()],
    };
    expect(sinceSummary({ joined: false, admin, nominee: [] })).toBe(
      'Since your last visit: 3 new decisions, 1 new nomination, 1 decided.'
    );
    expect(
      sinceSummary({
        joined: false,
        admin: null,
        nominee: [
          { kind: 'signatures', added: 1, signed: 4, needed: 8 },
          { kind: 'support', added: 2 },
        ],
      })
    ).toBe('Since your last visit: 1 new approval on your nomination, 2 new supporters.');
    expect(sinceSummary({ joined: true, admin: null, nominee: [] })).toBe(
      "Since your last visit: you're in."
    );
    expect(hasChanges({ joined: true, admin: null, nominee: [] })).toBe(true);
  });

  it('words every nominee event', () => {
    const kinds: Array<Parameters<typeof sinceSummary>[0]['nominee'][number]> = [
      { kind: 'nominated', nomination: nomination() },
      { kind: 'firstSignature', signed: 1, needed: 8 },
      { kind: 'approved' },
      { kind: 'expired', signed: 2, needed: 8 },
      { kind: 'rejected' },
      { kind: 'lapsed' },
    ];
    expect(sinceSummary({ joined: false, admin: null, nominee: kinds })).toBe(
      "Since your last visit: you've been nominated, a Minter Admin approved your nomination first, your nomination was approved, your nomination expired, your nomination didn't go through this time, your nomination closed without a first approval."
    );
  });
});

describe('nominators: the nominations they made', () => {
  const byMe = { publisher: { address: ME } } as Nomination['nomination'];
  const byOther = { publisher: { address: OTHER } } as Nomination['nomination'];
  /** A later nomination record of mine in someone else's round (it has an identifier). */
  const mineToo = { publisher: { address: ME }, identifier: 'qmp-nomination-Q' } as never;
  /** A support record of mine (no identifier). */
  const mySupport = { publisher: { address: ME } } as never;
  const made = (nominee: string, over: Partial<Nomination> = {}) =>
    nomination({ nominee, nomineeName: `Name ${nominee}`, nomination: byMe, ...over });
  const then = (nominee: string, state: SnapMade['state'], decision: string | null = null) => ({
    nominee,
    decision,
    state,
    publishedAt: AT - 86_400_000,
  });

  it('counts a record published first or later, never a support', () => {
    expect(madeBy(made('Q1'), ME)).toBe(true);
    expect(madeBy(nomination({ nomination: byOther, supporters: [mineToo] }), ME)).toBe(true);
    expect(madeBy(nomination({ nomination: byOther, supporters: [mySupport] }), ME)).toBe(false);
    expect(madeBy(nomination({ nomination: null, source: 'chain' }), ME)).toBe(false);
  });

  it('keeps them in the snapshot: open ones first, then the newest, at most 20', () => {
    const list = [
      made('Q-old-closed', { state: 'expired', publishedAt: AT - 9 }),
      made('Q-open', { state: 'signing', decision: decision('inv'), publishedAt: AT - 50 }),
      made('Q-new-closed', { state: 'lapsed', publishedAt: AT - 1 }),
      nomination({ nominee: 'Q-theirs', nomination: byOther }),
    ];
    const s = buildSnapshot({ at: AT, height: 1, made: { all: list, me: ME } });
    expect(s.made).toEqual([
      { nominee: 'Q-open', decision: 'inv', state: 'signing', publishedAt: AT - 50 },
      { nominee: 'Q-new-closed', decision: null, state: 'lapsed', publishedAt: AT - 1 },
      { nominee: 'Q-old-closed', decision: null, state: 'expired', publishedAt: AT - 9 },
    ]);
    expect(parseSnapshot(JSON.parse(JSON.stringify(s)))).toEqual(s);
    const many = Array.from({ length: MAX_SNAPSHOT_MADE + 5 }, (_, i) => made(`Q${i}`));
    expect(snapMade(many, ME)).toHaveLength(MAX_SNAPSHOT_MADE);
    expect('made' in buildSnapshot({ at: AT, height: 1 })).toBe(false);
  });

  it('still reads a snapshot saved before nominations were kept, and drops damaged ones', () => {
    const older = parseSnapshot({ v: 1, at: AT, height: 1, decisions: [] });
    expect(older).not.toBeNull();
    expect('made' in (older ?? {})).toBe(false);
    expect('made' in (parseSnapshot({ v: 1, at: AT, height: 1, made: 'all' }) ?? {})).toBe(false);
    expect(
      parseSnapshot({
        v: 1,
        at: AT,
        height: 1,
        made: [
          then('Qok', 'waiting'),
          { ...then('Qbad', 'waiting'), state: 'dreaming' },
          then('', 'waiting'),
          { ...then('Qneg', 'waiting'), publishedAt: -1 },
          null,
        ],
      })?.made
    ).toEqual([then('Qok', 'waiting')]);
  });

  it('has nothing to compare without them', () => {
    expect(madeEvents(undefined, [made('Q1', { state: 'expired' })], ME)).toEqual([]);
  });

  it('reports each way one ended, the good news first', () => {
    const old = { signature: 'inv-old' } as TxRow;
    const previous = [
      then('Qjoined', 'signing', 'inv-j'),
      then('Qapproved', 'signing', 'inv-a'),
      then('Qrejected', 'signing', 'inv-old'),
      then('Qexpired', 'signing', 'inv-e'),
      then('Qlapsed', 'waiting'),
    ];
    const all = [
      made('Qlapsed', { state: 'lapsed', publishedAt: AT - 86_400_000 }),
      made('Qexpired', { state: 'expired', latestInvite: { signature: 'inv-e' } as TxRow }),
      made('Qrejected', { state: 'rejected', latestInvite: old }),
      made('Qapproved', { state: 'approved', latestInvite: { signature: 'inv-a' } as TxRow }),
      // In MINTER now: the round's invite isn't named any more, its record still matches.
      made('Qjoined', { state: 'joined', publishedAt: AT - 86_400_000 }),
    ];
    const events = madeEvents(previous, all, ME);
    expect(events.map((e) => [e.kind, e.nominee, e.decision])).toEqual([
      ['joined', 'Qjoined', 'inv-j'],
      ['approved', 'Qapproved', 'inv-a'],
      ['rejected', 'Qrejected', 'inv-old'],
      ['expired', 'Qexpired', 'inv-e'],
      ['lapsed', 'Qlapsed', null],
    ]);
    expect(events[0].nomineeName).toBe('Name Qjoined');
  });

  it('stays quiet when nothing ended, or it was over already, or it is another round', () => {
    const previous = [
      then('Qsigning', 'signing', 'inv-s'),
      then('Qwas-expired', 'expired', 'inv-x'),
      then('Qwas-approved', 'approved', 'inv-ap'),
      then('Qnew-round', 'signing', 'inv-1'),
      then('Qsigned-then-gone', 'signing', 'inv-g'),
    ];
    const all = [
      made('Qsigning', { state: 'signing', decision: decision('inv-s') }),
      made('Qwas-expired', { state: 'expired', latestInvite: { signature: 'inv-x' } as TxRow }),
      // Approved before, still waiting for them to join: not news again.
      made('Qwas-approved', { state: 'approved', latestInvite: { signature: 'inv-ap' } as TxRow }),
      made('Qnew-round', { state: 'expired', latestInvite: { signature: 'inv-2' } as TxRow }),
      // Signing then, past its window now with no invite found: not guessed.
      made('Qsigned-then-gone', { state: 'lapsed', publishedAt: AT - 86_400_000 }),
      // Never in the snapshot.
      made('Qunknown', { state: 'expired' }),
    ];
    expect(madeEvents(previous, all, ME)).toEqual([]);
  });

  it("leaves out someone else's nomination, and what an admin's decided rows already say", () => {
    const previous = [then('Q1', 'signing', 'inv-1'), then('Q2', 'signing', 'inv-2')];
    const all = [
      nomination({
        nominee: 'Q1',
        nomination: byOther,
        state: 'expired',
        latestInvite: { signature: 'inv-1' } as TxRow,
      }),
      made('Q2', { state: 'approved', latestInvite: { signature: 'inv-2' } as TxRow }),
    ];
    expect(madeEvents(previous, all, ME, [{ signature: 'inv-2' }])).toEqual([]);
    expect(madeEvents(previous, all, ME).map((e) => e.nominee)).toEqual(['Q2']);
  });

  it('shows in the panel and reads as part of the sentence', () => {
    const event = (kind: MadeEvent['kind']): MadeEvent => ({
      kind,
      nominee: `Q-${kind}`,
      nomineeName: null,
      decision: null,
    });
    const changes = {
      joined: false,
      admin: null,
      nominee: [],
      made: [event('joined'), event('approved'), event('rejected'), event('lapsed')],
    };
    expect(hasChanges(changes)).toBe(true);
    expect(hasChanges({ ...changes, made: [] })).toBe(false);
    expect(sinceSummary(changes)).toBe(
      'Since your last visit: 2 nominations you made were approved, 1 nomination you made was rejected, 1 nomination you made ran out.'
    );
  });
});
