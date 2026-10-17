import { describe, expect, it } from 'vitest';
import type { MyStatus } from '../../../../rules/status';
import {
  balanceWords,
  blocksDetail,
  firstSeenPart,
  groupsWords,
  qdnTxWords,
  lastSentPart,
  levelNextWords,
  minterPart,
  mintingNowOf,
  namesPart,
  otherNotesWords,
  penaltySentence,
  signedCount,
} from './overviewWords';

const A = 'QSeDMkseNfi9b5K5no8aX8jqc3y78vuxr7';
const B = 'QPmsozoP6w3WAgvMyHnUhqauz1JR9FVHeF';
const C = 'Qej12psmZEeWiJ7FARCFk65pz9EkgmiiXz';
const DAY = 86_400_000;
const MAR_2024 = Date.UTC(2024, 2, 15);

const status = (kind: MyStatus['kind'], wasMember = false) => ({ kind, wasMember });

describe('the summary sentence', () => {
  it('says where it stands in MINTER, from the app’s status', () => {
    expect(minterPart(status('member'), MAR_2024)).toBe('in MINTER since Mar 2024');
    expect(minterPart(status('memberNominator'), null)).toBe('in MINTER');
    expect(minterPart(status('admin'), MAR_2024)).toBe('Minter Admin, in MINTER since Mar 2024');
    expect(minterPart(status('formerBanned'), null)).toBe('banned from MINTER');
    expect(minterPart(status('formerLeft'), null)).toBe('former MINTER member');
    expect(minterPart(status('formerKicked', true), null)).toBe('former MINTER member');
    expect(minterPart(status('formerKicked', false), null)).toBe('not in MINTER');
    expect(minterPart(status('nominated'), null)).toBe('nominated for MINTER');
    expect(minterPart(status('approvedInvite'), null)).toBe('approved for MINTER');
    expect(minterPart(status('newcomer'), null)).toBe('not in MINTER');
  });

  it('counts its names, saying when the list was cut', () => {
    expect(namesPart({ names: ['a'], truncated: false })).toBe('owns 1 name');
    expect(namesPart({ names: Array(88).fill('n'), truncated: false })).toBe('owns 88 names');
    expect(namesPart({ names: Array(500).fill('n'), truncated: true })).toBe('owns 500+ names');
    expect(namesPart({ names: [], truncated: false })).toBeNull();
  });

  it('dates its first and last transactions', () => {
    expect(firstSeenPart(MAR_2024)).toBe('first seen Mar 2024');
    const now = MAR_2024 + 400 * DAY;
    expect(lastSentPart(now - 3 * DAY, now)).toBe('last sent a transaction 3 days ago');
    expect(lastSentPart(now - 30_000, now)).toBe('last sent a transaction just now');
    expect(lastSentPart(now - 343 * DAY, now)).toBe('last sent a transaction 11 months ago');
    expect(lastSentPart(now - 400 * DAY, now)).toBe('last sent a transaction 1 year 1 month ago');
  });
});

describe('facts', () => {
  it('writes signed counts with a real minus sign', () => {
    expect(signedCount(12_000)).toBe('+12,000');
    expect(signedCount(-5_000_000)).toBe('−5,000,000');
    expect(signedCount(0)).toBe('0');
    expect(blocksDetail(0, 0)).toBeNull();
    expect(blocksDetail(12_000, -5_000_000)).toBe('Adjustment +12,000 · Penalty −5,000,000');
    expect(blocksDetail(0, -10_000_000)).toBe('Penalty −10,000,000');
  });

  it('rounds a balance for the eye and keeps every decimal for the record', () => {
    expect(balanceWords(6480.54123456)).toEqual({ short: '6,480.54', full: '6,480.54123456' });
    expect(balanceWords(1_234_567)).toEqual({ short: '1,234,567', full: '1,234,567' });
    expect(balanceWords(12.5)).toEqual({ short: '12.5', full: '12.5' });
    expect(balanceWords(0.00123)).toEqual({ short: '0.00123', full: '0.00123' });
    expect(balanceWords(0)).toEqual({ short: '0', full: '0' });
  });

  it('says how far the next level is, and counts groups and members', () => {
    expect(levelNextWords(7, 442_801)).toBe('442,801 blocks to level 8');
    expect(levelNextWords(4, 1)).toBe('1 block to level 5');
    expect(levelNextWords(10, null)).toBe('Top level');
    expect(groupsWords(0)).toBe('In no groups');
    expect(groupsWords(1)).toBe('In 1 group');
    expect(groupsWords(45)).toBe('In 45 groups');
  });

  it('counts every transaction, with the QDN ones below, exactly once all is read', () => {
    expect(qdnTxWords(172, 205, true)).toEqual({ value: '205', detail: '172 of them on QDN.' });
    expect(qdnTxWords(0, 1, true)).toEqual({ value: '1', detail: '0 of them on QDN.' });
    expect(qdnTxWords(860, 1000, false)).toEqual({
      value: '1,000+',
      detail: '860+ of them on QDN. Activity below reads further back.',
    });
  });
});

describe('minting now', () => {
  it('tells its own share apart from a share with another account', () => {
    const online = [
      { minterAddress: A, recipientAddress: A },
      { minterAddress: A, recipientAddress: B },
      { minterAddress: C, recipientAddress: A },
      { minterAddress: B, recipientAddress: C },
    ];
    expect(mintingNowOf(online, A)).toEqual({ self: true, others: [B, C] });
    expect(mintingNowOf(online, B)).toEqual({ self: false, others: [A, C] });
    expect(mintingNowOf([], A)).toBeNull();
  });
});

describe('notes', () => {
  it('states the penalty with its number and no reason', () => {
    expect(penaltySentence(-5_000_000)).toBe(
      'Core recorded a minting penalty of −5,000,000 blocks on this account, set by its self-sponsorship check, which holds it at level 0. Core ran that check over the whole chain in December 2022 and February 2024, looking for patterns from the days when accounts were sponsored into minting: sponsored accounts passing their rewards on to the same few accounts, sponsorships given out in bulk, minting levels moved on to other accounts. The chain doesn’t record which pattern matched.'
    );
  });

  it('counts the other names with notes out of all its other names', () => {
    expect(otherNotesWords(2, 87)).toBe('2 of its 87 other names have notes');
    expect(otherNotesWords(1, 29)).toBe('1 of its 29 other names has notes');
    expect(otherNotesWords(1, 1)).toBe('Its other name has notes');
  });
});
