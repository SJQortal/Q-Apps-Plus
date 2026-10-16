import { describe, expect, it } from 'vitest';
import { NULL_OWNER } from '../../../data/constants';
import { approvalWords, makerOf } from './txPageWords';

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
