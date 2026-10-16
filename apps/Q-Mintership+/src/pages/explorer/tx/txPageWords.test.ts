import { describe, expect, it } from 'vitest';
import type { TxRow } from '../../../data/types';
import { NULL_OWNER } from '../../../data/constants';
import { approvalWords, makerOf, NOT_SHOWN, rawForDisplay } from './txPageWords';

const A = 'QSeDMkseNfi9b5K5no8aX8jqc3y78vuxr7';
const AT = 'AXkh6WsHiwsSHjAhdnx7ru1zcJb4hePoBj';
const base = { timestamp: 1, signature: 'sig', txGroupId: 0 };

describe('approvalWords', () => {
  it('says where group approval stands, and nothing when none is needed', () => {
    expect(approvalWords('PENDING')).toBe('Waiting for group approval');
    expect(approvalWords('APPROVED')).toBe('Approved by the group');
    expect(approvalWords('REJECTED')).toBe('Rejected');
    expect(approvalWords('EXPIRED')).toBe('Expired');
    expect(approvalWords('NOT_REQUIRED')).toBeNull();
    expect(approvalWords(undefined)).toBeNull();
  });
});

describe('makerOf', () => {
  it('is the creator, an AT for its own transactions, nobody for Core’s own account', () => {
    expect(makerOf({ ...base, type: 'PAYMENT', creatorAddress: A })).toBe(A);
    expect(makerOf({ ...base, type: 'AT', creatorAddress: NULL_OWNER, atAddress: AT })).toBe(AT);
    expect(makerOf({ ...base, type: 'GENESIS', creatorAddress: NULL_OWNER })).toBeNull();
  });
});

describe('rawForDisplay', () => {
  it('leaves out what a message says', () => {
    const tx: TxRow = { ...base, type: 'MESSAGE', data: 'hello there', isText: true };
    expect(rawForDisplay(tx)).toMatchObject({ data: NOT_SHOWN, isText: true });
    expect(JSON.stringify(rawForDisplay({ ...tx, type: 'CHAT' }))).not.toContain('hello');
  });

  it('leaves out what identifies an encrypted resource, keeping the rest', () => {
    const tx: TxRow = {
      ...base,
      type: 'ARBITRARY',
      service: 1901,
      name: 'Avery Two',
      identifier: 'qortal_qmail_x',
      data: 'hash',
      secret: 'key',
    };
    const shown = rawForDisplay(tx);
    expect(shown).toMatchObject({
      identifier: NOT_SHOWN,
      data: NOT_SHOWN,
      secret: NOT_SHOWN,
      name: 'Avery Two',
      service: 1901,
    });
    expect(rawForDisplay({ ...tx, service: 1000 })).toMatchObject({ identifier: 'qortal_qmail_x' });
  });

  it('keeps everything else as Core sent it', () => {
    const tx: TxRow = { ...base, type: 'PAYMENT', amount: '1.5', recipient: A };
    expect(rawForDisplay(tx)).toEqual(tx);
  });
});
