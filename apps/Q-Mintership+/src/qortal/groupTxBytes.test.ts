import { describe, expect, it } from 'vitest';
import { base58Decode, base58Encode } from './base58';
import { CANCEL_GROUP_INVITE_LENGTH, cancelInviteTarget } from './groupTxBytes';

/** A mainnet CANCEL_GROUP_INVITE (signature 4HMnwm…, block 2,474,705), from GET …/raw. */
const MAINNET_RAW =
  '1113sqd9kgcQvgyY5wr5AQFp1dTjSdVfcW2ENzxgjEkhAGCWJPvkh6pM2T12qW2cS1yPJDNQXMee26c9YYmU51WZecpMQimXapEfYZ8GKsUTUrtaWCNUjYXissb3HNpLYi7HefWWNkNdeGQYpvgxVoFQX4LFpRRYSGn5RB8uC8HW9GiEwoXdHEJ77NmHZRUKDriQbzGQF68QT8jMwai4Ttr5E65KYdae3k7G6ZRrcpPzmL6fqdhESSJVZvGJh1jhhjM3gJdZ1YTQpCroPcovHRMewPqSv4fwkt';

describe('cancelInviteTarget', () => {
  it('reads the group and invitee of a mainnet CANCEL_GROUP_INVITE', () => {
    expect(base58Decode(MAINNET_RAW)).toHaveLength(CANCEL_GROUP_INVITE_LENGTH);
    expect(cancelInviteTarget(MAINNET_RAW)).toEqual({
      groupId: 694,
      invitee: 'QjP517QJwWyj7JjpYE2HHhAMcjYV1m7m3X',
    });
  });

  it('refuses bytes of another type or length', () => {
    const bytes = base58Decode(MAINNET_RAW);
    const other = bytes.slice();
    other[3] = 29; // GROUP_INVITE
    expect(() => cancelInviteTarget(base58Encode(other))).toThrow(/type 29/);
    expect(() => cancelInviteTarget(base58Encode(bytes.slice(0, 200)))).toThrow(/200 bytes/);
  });
});
