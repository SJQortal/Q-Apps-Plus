import { describe, expect, it } from 'vitest';
import { fakeAddress, fakeKey } from '../../../e2e/world.mjs';
import { NULL_OWNER } from '../../data/constants';
import type { TxRow } from '../../data/types';
import { shortAddress as s } from '../../utils/format';
import { ALL_TX_TYPES, TX_TYPE_LABELS } from './txFamilies';
import { assetLabel, describeTx, formatAmount, groupWords, partsToPlain } from './txWords';

const A = fakeAddress('words-a');
const B = fakeAddress('words-b');
const C = fakeAddress('words-c');
const D = fakeAddress('words-d');
const AT_ADDR = `A${fakeAddress('words-at').slice(1)}`;
const SIG = fakeKey('words-sig', 64);
const PENDING_SIG = fakeKey('words-pending', 64);
const ORDER = fakeKey('words-order', 64);

function row(type: string, extra: Record<string, unknown> = {}): TxRow {
  return {
    type,
    timestamp: 1_700_000_000_000,
    reference: fakeKey('words-ref', 64),
    fee: '0.01000000',
    signature: SIG,
    txGroupId: 0,
    blockHeight: 2_000_000,
    approvalStatus: 'NOT_REQUIRED',
    creatorAddress: A,
    ...extra,
  } as TxRow;
}

/** The sentence from `viewpoint` (none when left out). */
function say(tx: TxRow, viewpoint?: string, privsRecipient?: string | null) {
  return describeTx(tx, { viewpoint, privsRecipient }).plain;
}
function dir(tx: TxRow, viewpoint?: string, privsRecipient?: string | null) {
  return describeTx(tx, { viewpoint, privsRecipient }).direction;
}
function fields(tx: TxRow, viewpoint?: string) {
  return Object.fromEntries(
    describeTx(tx, { viewpoint }).fields.map((f) => [
      f.label,
      typeof f.value === 'string' ? f.value : partsToPlain([f.value]),
    ])
  );
}

describe('formatting', () => {
  it('strips trailing zeros and groups thousands', () => {
    expect(formatAmount('4.30000000')).toBe('4.3');
    expect(formatAmount('100.00000000')).toBe('100');
    expect(formatAmount('0.00098935')).toBe('0.00098935');
    expect(formatAmount('637557960.49687541')).toBe('637,557,960.49687541');
    expect(formatAmount('0.00000000')).toBe('0');
    expect(formatAmount(undefined)).toBe('0');
  });

  it('names assets and groups', () => {
    expect(assetLabel(0)).toBe('QORT');
    expect(assetLabel(undefined)).toBe('QORT');
    expect(assetLabel(90, 'Valun')).toBe('Valun');
    expect(assetLabel(90)).toBe('asset #90');
    expect(groupWords(694)).toBe('MINTER');
    expect(groupWords(1195)).toBe('group #1195');
  });
});

describe('payments', () => {
  const pay = row('PAYMENT', { recipient: B, amount: '15.00000000' });

  it('PAYMENT from each side', () => {
    expect(say(pay, A)).toBe(`Sent 15 QORT to ${s(B)}`);
    expect(dir(pay, A)).toBe('out');
    expect(say(pay, B)).toBe(`Received 15 QORT from ${s(A)}`);
    expect(dir(pay, B)).toBe('in');
    expect(say(pay)).toBe(`${s(A)} paid ${s(B)} 15 QORT`);
    expect(dir(pay)).toBe('none');
    expect(say(pay, C)).toBe(`${s(A)} paid ${s(B)} 15 QORT`);
    expect(dir(pay, C)).toBe('none');
    const words = describeTx(pay, { viewpoint: A });
    expect(words.title).toBe('Payment');
    expect(words.participants).toEqual([A, B]);
    expect(words.parts).toEqual([
      { kind: 'text', text: 'Sent ' },
      { kind: 'amount', amount: '15', asset: 'QORT' },
      { kind: 'text', text: ' to ' },
      { kind: 'account', address: B },
    ]);
    expect(fields(pay)).toEqual({ Amount: '15 QORT', Recipient: s(B) });
  });

  it('PAYMENT to itself', () => {
    const self = row('PAYMENT', { recipient: A, amount: '1.5' });
    expect(say(self, A)).toBe('Sent 1.5 QORT to itself');
    expect(dir(self, A)).toBe('self');
    expect(say(self)).toBe(`${s(A)} sent 1.5 QORT to itself`);
    expect(describeTx(self).participants).toEqual([A]);
  });

  it('TRANSFER_ASSET in QORT and in another asset', () => {
    const qort = row('TRANSFER_ASSET', { recipient: B, amount: '2.50000000', assetId: 0 });
    expect(say(qort, A)).toBe(`Sent 2.5 QORT to ${s(B)}`);
    expect(say(qort, B)).toBe(`Received 2.5 QORT from ${s(A)}`);
    expect(say(qort)).toBe(`${s(A)} sent 2.5 QORT to ${s(B)}`);
    const valun = row('TRANSFER_ASSET', {
      recipient: B,
      amount: '3.00000000',
      assetId: 90,
      assetName: 'Valun',
    });
    expect(say(valun, A)).toBe(`Sent 3 Valun to ${s(B)}`);
    expect(fields(valun)).toEqual({ Amount: '3 Valun', Asset: '#90', Recipient: s(B) });
    const unnamed = row('TRANSFER_ASSET', { recipient: B, amount: '1', assetId: 7 });
    expect(say(unnamed, B)).toBe(`Received 1 asset #7 from ${s(A)}`);
  });

  it('MULTI_PAYMENT from the payer, a recipient and nobody', () => {
    const multi = row('MULTI_PAYMENT', {
      payments: [
        { recipient: B, assetId: 0, amount: '2.00000000' },
        { recipient: C, assetId: 0, amount: '4.00000000' },
        { recipient: D, assetId: 0, amount: '6.00000000' },
      ],
    });
    expect(say(multi, A)).toBe('Paid 3 accounts 12 QORT in one payment');
    expect(dir(multi, A)).toBe('out');
    expect(say(multi, B)).toBe(`Received 2 QORT from ${s(A)} (one of 3 in a payment)`);
    expect(dir(multi, B)).toBe('in');
    expect(say(multi)).toBe(`${s(A)} paid 3 accounts 12 QORT in one payment`);
    expect(describeTx(multi).participants).toEqual([A, B, C, D]);
    expect(fields(multi)).toEqual({
      '2 QORT to': s(B),
      '4 QORT to': s(C),
      '6 QORT to': s(D),
    });
  });

  it('MULTI_PAYMENT in two assets, to one account', () => {
    const multi = row('MULTI_PAYMENT', {
      payments: [
        { recipient: B, assetId: 0, amount: '0.1' },
        { recipient: B, assetId: 0, amount: '0.2' },
        { recipient: B, assetId: 5, amount: '1' },
      ],
    });
    expect(say(multi, A)).toBe('Paid 1 account 0.3 QORT and 1 asset #5 in one payment');
    expect(say(multi, B)).toBe(`Received 0.3 QORT and 1 asset #5 from ${s(A)}`);
  });
});

describe('names', () => {
  it('REGISTER_NAME', () => {
    const tx = row('REGISTER_NAME', { name: 'Qmeme', data: 'Registered Name on the Qortal Chain' });
    expect(say(tx, A)).toBe('Registered the name “Qmeme”');
    expect(dir(tx, A)).toBe('self');
    expect(say(tx)).toBe(`${s(A)} registered the name “Qmeme”`);
    expect(dir(tx, B)).toBe('none');
    expect(fields(tx)).toEqual({ Name: '“Qmeme”', Data: 'Registered Name on the Qortal Chain' });
    expect(describeTx(tx).parts[1]).toEqual({ kind: 'text', text: ' registered the name ' });
    expect(describeTx(tx).parts[2]).toEqual({ kind: 'name', name: 'Qmeme' });
  });

  it('UPDATE_NAME: a rename, or new details', () => {
    const rename = row('UPDATE_NAME', { name: 'foo', newName: 'bar', newData: '' });
    expect(say(rename, A)).toBe('Renamed “foo” to “bar”');
    expect(say(rename)).toBe(`${s(A)} renamed “foo” to “bar”`);
    expect(fields(rename)).toEqual({ Name: '“foo”', 'New name': '“bar”' });
    const details = row('UPDATE_NAME', { name: 'foo', newName: '', newData: '{"a":1}' });
    expect(say(details, A)).toBe("Updated the name “foo”'s details");
    expect(say(details)).toBe(`${s(A)} updated the name “foo”'s details`);
    expect(fields(details)).toEqual({ Name: '“foo”', 'New data': '{"a":1}' });
    const same = row('UPDATE_NAME', { name: 'foo', newName: 'foo' });
    expect(say(same, A)).toBe("Updated the name “foo”'s details");
  });

  it('SELL_NAME and CANCEL_SELL_NAME', () => {
    const sell = row('SELL_NAME', { name: 'foo', amount: '5.00000000' });
    expect(say(sell, A)).toBe('Listed the name “foo” for sale at 5 QORT');
    expect(say(sell)).toBe(`${s(A)} listed the name “foo” for sale at 5 QORT`);
    expect(dir(sell, A)).toBe('self');
    expect(fields(sell)).toEqual({ Name: '“foo”', Price: '5 QORT' });
    const cancel = row('CANCEL_SELL_NAME', { name: 'foo' });
    expect(say(cancel, A)).toBe('Took the name “foo” off sale');
    expect(say(cancel)).toBe(`${s(A)} took the name “foo” off sale`);
  });

  it('BUY_NAME from the buyer, the seller and nobody', () => {
    const buy = row('BUY_NAME', { name: 'foo', amount: '1.00000000', seller: B });
    expect(say(buy, A)).toBe(`Bought the name “foo” from ${s(B)} for 1 QORT`);
    expect(dir(buy, A)).toBe('out');
    expect(say(buy, B)).toBe(`Sold the name “foo” to ${s(A)} for 1 QORT`);
    expect(dir(buy, B)).toBe('in');
    expect(say(buy)).toBe(`${s(A)} bought the name “foo” from ${s(B)} for 1 QORT`);
    expect(describeTx(buy).participants).toEqual([A, B]);
    expect(fields(buy)).toEqual({ Name: '“foo”', Price: '1 QORT', Seller: s(B) });
  });

  it('shows invisible characters in the plain text', () => {
    const tx = row('REGISTER_NAME', { name: `a${String.fromCharCode(0x200b)}b` });
    expect(say(tx, A)).toBe('Registered the name “a·b”');
  });
});

describe('minting', () => {
  it('REWARD_SHARE: a self-share started and removed', () => {
    const start = row('REWARD_SHARE', { recipient: A, sharePercent: '0.00' });
    expect(say(start, A)).toBe('Started minting (a self-share)');
    expect(dir(start, A)).toBe('self');
    expect(say(start)).toBe(`${s(A)} started minting (a self-share)`);
    expect(describeTx(start).participants).toEqual([A]);
    const stop = row('REWARD_SHARE', { recipient: A, sharePercent: '-1.00' });
    expect(say(stop, A)).toBe('Stopped minting (removed its self-share)');
    expect(say(stop)).toBe(`${s(A)} stopped minting (removed its self-share)`);
    expect(fields(stop)).toEqual({ Share: 'Removed' });
  });

  it('REWARD_SHARE with another account, from each side', () => {
    const share = row('REWARD_SHARE', { recipient: B, sharePercent: '0.00' });
    expect(say(share, A)).toBe(`Started a reward share with ${s(B)} at 0 %`);
    expect(dir(share, A)).toBe('out');
    expect(say(share, B)).toBe(`${s(A)} started a reward share with this account at 0 %`);
    expect(dir(share, B)).toBe('in');
    expect(say(share)).toBe(`${s(A)} started a reward share with ${s(B)} at 0 %`);
    expect(fields(share)).toEqual({ Recipient: s(B), Share: '0 %' });
    const half = row('REWARD_SHARE', { recipient: B, sharePercent: '5.50' });
    expect(say(half, A)).toBe(`Started a reward share with ${s(B)} at 5.5 %`);
    const removed = row('REWARD_SHARE', { recipient: B, sharePercent: '-1000000.00' });
    expect(say(removed, A)).toBe(`Removed the reward share with ${s(B)}`);
    expect(say(removed, B)).toBe(`${s(A)} removed its reward share with this account`);
    expect(say(removed)).toBe(`${s(A)} removed the reward share with ${s(B)}`);
  });

  it('TRANSFER_PRIVS with the recipient read from the raw bytes', () => {
    const move = row('TRANSFER_PRIVS', { fee: '0.01000000' });
    expect(say(move, A, C)).toBe(`Moved its minting level to ${s(C)}`);
    expect(dir(move, A, C)).toBe('out');
    expect(say(move, C, C)).toBe(`Got its minting level from ${s(A)}`);
    expect(dir(move, C, C)).toBe('in');
    expect(say(move, undefined, C)).toBe(`${s(A)} moved its minting level to ${s(C)}`);
    expect(describeTx(move, { privsRecipient: C }).participants).toEqual([A, C]);
    expect(describeTx(move, { privsRecipient: C }).fields).toEqual([
      { label: 'Moved to', value: { kind: 'account', address: C } },
    ]);
  });

  it('TRANSFER_PRIVS before the recipient is known', () => {
    const move = row('TRANSFER_PRIVS');
    expect(say(move, A)).toBe('Moved its minting level to another account');
    expect(dir(move, A)).toBe('out');
    expect(say(move, A, null)).toBe('Moved its minting level to another account');
    expect(say(move)).toBe(`${s(A)} moved its minting level to another account`);
    expect(describeTx(move).participants).toEqual([A]);
    expect(describeTx(move).fields).toEqual([]);
  });

  it('ACCOUNT_FLAGS and ACCOUNT_LEVEL in the genesis block', () => {
    const flags = row('ACCOUNT_FLAGS', {
      creatorAddress: NULL_OWNER,
      blockHeight: 1,
      target: B,
      andMask: -1,
      orMask: 1,
      xorMask: 0,
    });
    expect(say(flags, B)).toBe('Its account flags were set in the genesis block');
    expect(dir(flags, B)).toBe('in');
    expect(say(flags)).toBe(`The account flags of ${s(B)} were set in the genesis block`);
    expect(describeTx(flags).participants).toEqual([B]);
    expect(fields(flags)).toEqual({ Account: s(B), Change: 'and -1, or 1, xor 0' });
    const level = row('ACCOUNT_LEVEL', {
      creatorAddress: NULL_OWNER,
      blockHeight: 1,
      target: B,
      level: 5,
    });
    expect(say(level, B)).toBe('Its level was set to 5 in the genesis block');
    expect(say(level)).toBe(`The level of ${s(B)} was set to 5 in the genesis block`);
    expect(describeTx(level).participants).toEqual([B]);
    expect(fields(level)).toEqual({ Account: s(B), Level: '5' });
  });

  it('ACCOUNT_FLAGS and ACCOUNT_LEVEL made by an account', () => {
    const flags = row('ACCOUNT_FLAGS', { target: B, andMask: -1, orMask: 0, xorMask: 0 });
    expect(say(flags, A)).toBe(`Set the account flags of ${s(B)}`);
    expect(say(flags, B)).toBe(`${s(A)} set the account flags of this account`);
    const level = row('ACCOUNT_LEVEL', { target: B, level: 3 });
    expect(say(level, A)).toBe(`Set the level of ${s(B)} to 3`);
    expect(say(level)).toBe(`${s(A)} set the level of ${s(B)} to 3`);
  });

  it('ENABLE_FORGING', () => {
    const tx = row('ENABLE_FORGING', { target: B });
    expect(say(tx, A)).toBe(`Enabled forging for ${s(B)}`);
    expect(say(tx, B)).toBe(`${s(A)} enabled forging for this account`);
    expect(say(row('ENABLE_FORGING'))).toBe(`${s(A)} enabled forging`);
  });
});

describe('QDN', () => {
  it('ARBITRARY: a public resource says what and where', () => {
    const tx = row('ARBITRARY', {
      service: 1000,
      name: 'AA Maps',
      identifier: 'default',
      size: 240,
      method: 'PUT',
      data: 'HASHDATA',
      secret: 'SECRETKEY',
      payments: [],
    });
    expect(say(tx, A)).toBe('Published an app as “AA Maps”');
    expect(dir(tx, A)).toBe('self');
    expect(say(tx)).toBe(`${s(A)} published an app as “AA Maps”`);
    expect(fields(tx)).toEqual({
      Service: 'APP',
      Name: '“AA Maps”',
      Identifier: 'default',
      Size: '240 bytes',
    });
    const json = JSON.stringify(describeTx(tx));
    expect(json).not.toContain('HASHDATA');
    expect(json).not.toContain('SECRETKEY');
    const big = row('ARBITRARY', { service: 500, name: 'v', size: 3_500_000 });
    expect(say(big, A)).toBe('Published a video as “v”');
    expect(fields(big).Size).toBe('3.3 MB');
  });

  it('ARBITRARY: an encrypted resource keeps its identifier to itself', () => {
    const tx = row('ARBITRARY', {
      service: 1901,
      name: 'Avery Admin',
      identifier: 'qortal_qmail_secret_thread',
      size: 4000,
      data: 'HASHDATA',
    });
    expect(say(tx, A)).toBe('Published an encrypted resource as “Avery Admin”');
    expect(say(tx)).toBe(`${s(A)} published an encrypted resource as “Avery Admin”`);
    expect(fields(tx)).toEqual({ Service: 'MAIL_PRIVATE' });
    const json = JSON.stringify(describeTx(tx, { viewpoint: A }));
    expect(json).not.toContain('qortal_qmail');
    expect(json).not.toContain('HASHDATA');
    const mail = row('ARBITRARY', { service: 1900, name: 'n', identifier: 'mail_x' });
    expect(say(mail, A)).toBe('Published an encrypted resource as “n”');
    expect(JSON.stringify(describeTx(mail))).not.toContain('mail_x');
  });

  it('ARBITRARY with a payment, from the recipient', () => {
    const tx = row('ARBITRARY', {
      service: 1110,
      name: 'shop',
      identifier: 'order-1',
      payments: [{ recipient: B, assetId: 0, amount: '1.00000000' }],
    });
    expect(say(tx, B)).toBe(`Received 1 QORT from ${s(A)} with a QDN publish`);
    expect(dir(tx, B)).toBe('in');
    expect(say(tx, A)).toBe('Published JSON data as “shop”');
    expect(dir(tx, A)).toBe('out');
    expect(fields(tx)['1 QORT to']).toBe(s(B));
  });

  it('ARBITRARY without a name or a known service', () => {
    const tx = row('ARBITRARY', { service: 4242 });
    expect(say(tx, A)).toBe('Published a QDN resource');
    expect(fields(tx)).toEqual({ Service: 'SERVICE_4242' });
  });
});

describe('messages', () => {
  const secret = 'meet me at the usual place';

  it('MESSAGE: who to whom, never what it said', () => {
    const tx = row('MESSAGE', {
      recipient: B,
      amount: '0.00000000',
      data: secret,
      isText: true,
      isEncrypted: false,
    });
    expect(say(tx, A)).toBe(`Sent a message to ${s(B)}`);
    expect(dir(tx, A)).toBe('out');
    expect(say(tx, B)).toBe(`Received a message from ${s(A)}`);
    expect(dir(tx, B)).toBe('in');
    expect(say(tx)).toBe(`${s(A)} sent a message to ${s(B)}`);
    expect(fields(tx)).toEqual({ Encrypted: 'No' });
    for (const viewpoint of [A, B, undefined])
      expect(JSON.stringify(describeTx(tx, { viewpoint }))).not.toContain(secret);
  });

  it('MESSAGE with QORT attached, and to an AT', () => {
    const paid = row('MESSAGE', {
      recipient: B,
      amount: '5.00000000',
      assetId: 0,
      isEncrypted: true,
    });
    expect(say(paid, A)).toBe(`Sent a message with 5 QORT to ${s(B)}`);
    expect(say(paid, B)).toBe(`Received a message with 5 QORT from ${s(A)}`);
    expect(fields(paid)).toEqual({ Encrypted: 'Yes' });
    const toAt = row('MESSAGE', { recipient: AT_ADDR, amount: '0', data: secret });
    expect(say(toAt, A)).toBe(`Sent a message to ${s(AT_ADDR)}`);
    expect(describeTx(toAt).participants).toEqual([A, AT_ADDR]);
  });

  it('CHAT: to an account or to a group, never what it said', () => {
    const direct = row('CHAT', { recipient: B, sender: A, data: secret, isEncrypted: true });
    expect(say(direct, A)).toBe(`Sent a chat message to ${s(B)}`);
    expect(say(direct, B)).toBe(`Received a chat message from ${s(A)}`);
    expect(say(direct)).toBe(`${s(A)} sent a chat message to ${s(B)}`);
    expect(fields(direct)).toEqual({ Encrypted: 'Yes' });
    const toGroup = row('CHAT', { sender: A, txGroupId: 4242, data: secret, isEncrypted: false });
    expect(say(toGroup, A)).toBe('Sent a chat message');
    expect(dir(toGroup, A)).toBe('self');
    const json = JSON.stringify(describeTx(toGroup));
    expect(json).not.toContain(secret);
    expect(json).not.toContain('4242');
  });
});

describe('trading and contracts', () => {
  it('AT: an automated contract pays out', () => {
    const tx = row('AT', {
      creatorAddress: NULL_OWNER,
      atAddress: AT_ADDR,
      recipient: B,
      amount: '1.00000000',
      assetId: 0,
    });
    expect(say(tx)).toBe(`${s(AT_ADDR)} paid ${s(B)} 1 QORT`);
    expect(say(tx, B)).toBe(`Received 1 QORT from ${s(AT_ADDR)}`);
    expect(dir(tx, B)).toBe('in');
    expect(say(tx, AT_ADDR)).toBe(`Sent 1 QORT to ${s(B)}`);
    expect(dir(tx, AT_ADDR)).toBe('out');
    expect(describeTx(tx).participants).toEqual([AT_ADDR, B]);
    expect(fields(tx)).toEqual({ 'AT (automated contract)': s(AT_ADDR) });
  });

  it('AT with no payment', () => {
    const tx = row('AT', { creatorAddress: NULL_OWNER, atAddress: AT_ADDR, recipient: B });
    expect(say(tx)).toBe(`${s(AT_ADDR)} sent a message to ${s(B)}`);
    expect(say(tx, B)).toBe(`Received a message from ${s(AT_ADDR)}`);
  });

  it('DEPLOY_AT', () => {
    const tx = row('DEPLOY_AT', {
      name: 'QORT/ARRR ACCT',
      description: 'QORT/ARRR cross-chain trade',
      aTType: 'ACCT',
      tags: 'ACCT QORT ARRR',
      amount: '300.01000000',
      assetId: 0,
      aTAddress: AT_ADDR,
      creationBytes: 'BYTES',
    });
    expect(say(tx, A)).toBe('Created an AT (automated contract)');
    expect(dir(tx, A)).toBe('out');
    expect(say(tx)).toBe(`${s(A)} created an AT (automated contract)`);
    expect(say(tx, AT_ADDR)).toBe(`${s(A)} created this AT (automated contract)`);
    expect(describeTx(tx).participants).toEqual([A, AT_ADDR]);
    expect(fields(tx)).toEqual({
      'AT name': 'QORT/ARRR ACCT',
      Description: 'QORT/ARRR cross-chain trade',
      Kind: 'ACCT',
      Tags: 'ACCT QORT ARRR',
      'AT address': s(AT_ADDR),
      'Funded with': '300.01 QORT',
    });
  });

  it('ISSUE_ASSET, UPDATE_ASSET and asset orders', () => {
    const issue = row('ISSUE_ASSET', {
      assetId: 92,
      assetName: 'Adsensecoin',
      description: 'ADSC',
      quantity: '9999999.00000000',
      isDivisible: true,
    });
    expect(say(issue, A)).toBe('Issued the asset “Adsensecoin”');
    expect(say(issue)).toBe(`${s(A)} issued the asset “Adsensecoin”`);
    expect(fields(issue)).toEqual({
      Asset: '#92',
      Quantity: '9,999,999',
      Divisible: 'Yes',
      Description: 'ADSC',
    });
    const order = row('CREATE_ASSET_ORDER', {
      haveAssetId: 28,
      haveAssetName: 'GBQ',
      wantAssetId: 0,
      wantAssetName: 'QORT',
      amount: '100.00000000',
      price: '55.00000000',
      amountAssetId: 28,
      amountAssetName: 'GBQ',
      pricePair: 'QORT/GBQ',
    });
    expect(say(order, A)).toBe('Placed an order to trade GBQ for QORT');
    expect(say(order)).toBe(`${s(A)} placed an order to trade GBQ for QORT`);
    expect(fields(order)).toEqual({ Amount: '100 GBQ', Price: '55 QORT/GBQ' });
    const cancel = row('CANCEL_ASSET_ORDER', { orderId: ORDER });
    expect(say(cancel, A)).toBe('Cancelled an asset order');
    expect(describeTx(cancel).fields).toEqual([
      { label: 'Order', value: { kind: 'tx', signature: ORDER } },
    ]);
    const update = row('UPDATE_ASSET', { assetId: 28, newOwner: A, newDescription: 'Gold' });
    expect(say(update, A)).toBe('Updated asset #28');
    expect(fields(update)).toEqual({ 'New description': 'Gold' });
    const handover = row('UPDATE_ASSET', { assetId: 28, newOwner: B });
    expect(say(handover, A)).toBe(`Gave asset #28 to ${s(B)}`);
    expect(say(handover, B)).toBe(`${s(A)} gave asset #28 to this account`);
    expect(dir(handover, B)).toBe('in');
  });
});

describe('groups', () => {
  const minter = (type: string, extra: Record<string, unknown>) =>
    row(type, { groupId: 694, txGroupId: 694, approvalStatus: 'APPROVED', ...extra });

  it('GROUP_INVITE: who, whom and which group', () => {
    const tx = minter('GROUP_INVITE', { invitee: B, timeToLive: 864_000 });
    expect(say(tx, A)).toBe(`Invited ${s(B)} to MINTER`);
    expect(dir(tx, A)).toBe('out');
    expect(say(tx, B)).toBe(`${s(A)} invited this account to MINTER`);
    expect(dir(tx, B)).toBe('in');
    expect(say(tx)).toBe(`${s(A)} invited ${s(B)} to MINTER`);
    expect(describeTx(tx).parts).toContainEqual({ kind: 'group', groupId: 694 });
    expect(fields(tx)).toEqual({ Group: 'MINTER', Invitee: s(B), 'Group approval': 'Approved' });
    const json = JSON.stringify(describeTx(tx, { viewpoint: B }));
    expect(json).not.toMatch(/864|time ?to ?live|txGroupId/i);
  });

  it('GROUP_INVITE still waiting, rejected or not approved in time', () => {
    const waiting = minter('GROUP_INVITE', { invitee: B, approvalStatus: 'PENDING' });
    expect(say(waiting, A)).toBe(
      `Proposed to invite ${s(B)} to MINTER (waiting for group approval)`
    );
    expect(say(waiting, B)).toBe(
      `${s(A)} proposed to invite this account to MINTER (waiting for group approval)`
    );
    expect(fields(waiting)['Group approval']).toBe('Waiting for approvals');
    const rejected = minter('GROUP_INVITE', { invitee: B, approvalStatus: 'REJECTED' });
    expect(say(rejected)).toBe(
      `${s(A)} proposed to invite ${s(B)} to MINTER (rejected in group approval)`
    );
    const expired = minter('GROUP_INVITE', { invitee: B, approvalStatus: 'EXPIRED' });
    expect(say(expired, A)).toBe(`Proposed to invite ${s(B)} to MINTER (not approved in time)`);
    expect(fields(expired)['Group approval']).toBe('Not approved in time');
  });

  it('CANCEL_GROUP_INVITE with and without what the raw bytes add', () => {
    const bare = row('CANCEL_GROUP_INVITE', { txGroupId: 694, approvalStatus: 'APPROVED' });
    expect(say(bare, A)).toBe('Cancelled a group invite');
    const withGroup = minter('CANCEL_GROUP_INVITE', {});
    expect(say(withGroup, A)).toBe('Cancelled an invite to MINTER');
    const full = minter('CANCEL_GROUP_INVITE', { invitee: B });
    expect(say(full, A)).toBe(`Cancelled the invite to MINTER for ${s(B)}`);
    expect(say(full, B)).toBe(`${s(A)} cancelled the invite to MINTER for this account`);
    expect(say(full)).toBe(`${s(A)} cancelled the invite to MINTER for ${s(B)}`);
    expect(describeTx(full).participants).toEqual([A, B]);
  });

  it('GROUP_KICK with its reason', () => {
    const tx = minter('GROUP_KICK', { member: B, reason: 'Not minting for 6 months' });
    expect(say(tx, A)).toBe(`Removed ${s(B)} from MINTER`);
    expect(say(tx, B)).toBe(`${s(A)} removed this account from MINTER`);
    expect(say(tx)).toBe(`${s(A)} removed ${s(B)} from MINTER`);
    expect(fields(tx)).toEqual({
      Group: 'MINTER',
      Member: s(B),
      Reason: 'Not minting for 6 months',
      'Group approval': 'Approved',
    });
    const pending = minter('GROUP_KICK', { member: B, approvalStatus: 'PENDING' });
    expect(say(pending, A)).toBe(
      `Proposed to remove ${s(B)} from MINTER (waiting for group approval)`
    );
  });

  it('GROUP_BAN: who, whom, which group and the reason', () => {
    const tx = minter('GROUP_BAN', { offender: B, reason: 'Spam', timeToLive: 3600 });
    expect(say(tx, A)).toBe(`Banned ${s(B)} from MINTER`);
    expect(say(tx, B)).toBe(`${s(A)} banned this account from MINTER`);
    expect(say(tx)).toBe(`${s(A)} banned ${s(B)} from MINTER`);
    expect(fields(tx)).toEqual({
      Group: 'MINTER',
      Account: s(B),
      Reason: 'Spam',
      'Group approval': 'Approved',
    });
    const json = JSON.stringify(describeTx(tx));
    expect(json).not.toMatch(/3600|time ?to ?live/i);
  });

  it('CANCEL_GROUP_BAN', () => {
    const tx = minter('CANCEL_GROUP_BAN', { member: B });
    expect(say(tx, A)).toBe(`Lifted ${s(B)}'s ban from MINTER`);
    expect(say(tx, B)).toBe(`${s(A)} lifted this account's ban from MINTER`);
    expect(say(tx)).toBe(`${s(A)} lifted ${s(B)}'s ban from MINTER`);
  });

  it('ADD_GROUP_ADMIN and REMOVE_GROUP_ADMIN, for others and for itself', () => {
    const add = minter('ADD_GROUP_ADMIN', { member: B });
    expect(say(add, A)).toBe(`Made ${s(B)} an admin of MINTER`);
    expect(say(add, B)).toBe(`${s(A)} made this account an admin of MINTER`);
    expect(say(add)).toBe(`${s(A)} made ${s(B)} an admin of MINTER`);
    const own = minter('ADD_GROUP_ADMIN', { member: A });
    expect(say(own, A)).toBe('Became an admin of MINTER');
    expect(dir(own, A)).toBe('self');
    const ownWaiting = minter('ADD_GROUP_ADMIN', { member: A, approvalStatus: 'PENDING' });
    expect(say(ownWaiting)).toBe(
      `${s(A)} proposed to become an admin of MINTER (waiting for group approval)`
    );
    const remove = minter('REMOVE_GROUP_ADMIN', { admin: B });
    expect(say(remove, A)).toBe(`Removed ${s(B)} as an admin of MINTER`);
    expect(say(remove, B)).toBe(`${s(A)} removed this account as an admin of MINTER`);
    expect(say(remove)).toBe(`${s(A)} removed ${s(B)} as an admin of MINTER`);
    const stepDown = minter('REMOVE_GROUP_ADMIN', { admin: A });
    expect(say(stepDown, A)).toBe('Stepped down as an admin of MINTER');
  });

  it('JOIN_GROUP and LEAVE_GROUP', () => {
    const join = row('JOIN_GROUP', { groupId: 694 });
    expect(say(join, A)).toBe('Joined or asked to join MINTER');
    expect(dir(join, A)).toBe('self');
    expect(say(join)).toBe(`${s(A)} joined or asked to join MINTER`);
    expect(fields(join)).toEqual({ Group: 'MINTER' });
    const leave = row('LEAVE_GROUP', { groupId: 31 });
    expect(say(leave, A)).toBe('Left group #31');
    expect(say(leave)).toBe(`${s(A)} left group #31`);
  });

  it('CREATE_GROUP, UPDATE_GROUP and SET_GROUP', () => {
    const create = row('CREATE_GROUP', {
      groupId: 1195,
      groupName: 'Irish freedom cell',
      description: 'Welcome',
      isOpen: true,
      approvalThreshold: 'PCT40',
      minimumBlockDelay: 5,
      maximumBlockDelay: 21600,
    });
    expect(say(create, A)).toBe('Created the group #1195');
    expect(say(create)).toBe(`${s(A)} created the group #1195`);
    expect(fields(create)).toEqual({
      Group: 'group #1195',
      Name: 'Irish freedom cell',
      Description: 'Welcome',
      'Open to anyone': 'Yes',
    });
    const update = row('UPDATE_GROUP', { groupId: 1012, newOwner: A, newDescription: 'New' });
    expect(say(update, A)).toBe('Updated the settings of group #1012');
    expect(dir(update, A)).toBe('self');
    const handover = row('UPDATE_GROUP', { groupId: 1012, newOwner: B });
    expect(say(handover, A)).toBe(`Made ${s(B)} the owner of group #1012`);
    expect(say(handover, B)).toBe(`${s(A)} made this account the owner of group #1012`);
    expect(dir(handover, B)).toBe('in');
    const set = row('SET_GROUP', { defaultGroupId: 694 });
    expect(say(set, A)).toBe('Set its default group to MINTER');
    expect(say(row('SET_GROUP', { defaultGroupId: 0 }))).toBe(`${s(A)} cleared its default group`);
  });

  it('GROUP_APPROVAL points at the transaction it answers', () => {
    const yes = row('GROUP_APPROVAL', { pendingSignature: PENDING_SIG, approval: true });
    expect(say(yes, A)).toBe(`Approved transaction ${PENDING_SIG.slice(0, 8)}…`);
    expect(say(yes)).toBe(`${s(A)} approved transaction ${PENDING_SIG.slice(0, 8)}…`);
    expect(dir(yes, A)).toBe('self');
    expect(describeTx(yes).parts).toContainEqual({ kind: 'tx', signature: PENDING_SIG });
    expect(describeTx(yes).fields.map((f) => f.label)).toEqual(['Answer', 'Transaction']);
    const no = row('GROUP_APPROVAL', { pendingSignature: PENDING_SIG, approval: false });
    expect(say(no, A)).toBe(`Rejected transaction ${PENDING_SIG.slice(0, 8)}…`);
    expect(fields(no).Answer).toBe('Reject');
  });
});

describe('other types', () => {
  it('GENESIS', () => {
    const tx = row('GENESIS', {
      creatorAddress: NULL_OWNER,
      blockHeight: 1,
      recipient: B,
      amount: '1000.00000000',
      assetId: 0,
    });
    expect(say(tx, B)).toBe('Received 1,000 QORT in the genesis block');
    expect(dir(tx, B)).toBe('in');
    expect(say(tx)).toBe(`${s(B)} received 1,000 QORT in the genesis block`);
    expect(describeTx(tx).participants).toEqual([B]);
    expect(describeTx(tx).participants).not.toContain(NULL_OWNER);
  });

  it('CREATE_POLL and VOTE_ON_POLL', () => {
    const poll = row('CREATE_POLL', {
      owner: A,
      pollName: 'Minter-board-card-x-poll',
      description: 'A poll',
      pollOptions: [{ optionName: 'Yes' }, { optionName: 'No' }],
    });
    expect(say(poll, A)).toBe('Created the poll “Minter-board-card-x-poll”');
    expect(say(poll)).toBe(`${s(A)} created the poll “Minter-board-card-x-poll”`);
    expect(fields(poll)).toEqual({
      Poll: 'Minter-board-card-x-poll',
      Description: 'A poll',
      Options: 'Yes, No',
    });
    const forOther = row('CREATE_POLL', { owner: B, pollName: 'p' });
    expect(say(forOther, B)).toBe(`${s(A)} created the poll “p” owned by this account`);
    const vote = row('VOTE_ON_POLL', { pollName: 'p', optionIndex: 0 });
    expect(say(vote, A)).toBe('Voted on the poll “p”');
    expect(say(vote)).toBe(`${s(A)} voted on the poll “p”`);
    expect(fields(vote)).toEqual({ Poll: 'p', Option: 'Option 1' });
  });

  it('PUBLICIZE, AIRDROP and PRESENCE', () => {
    expect(say(row('PUBLICIZE'), A)).toBe('Published its public key (PUBLICIZE)');
    expect(say(row('PUBLICIZE'))).toBe(`${s(A)} published its public key (PUBLICIZE)`);
    expect(say(row('AIRDROP'), A)).toBe('Made an airdrop');
    expect(say(row('PRESENCE', { presenceType: 'TRADE_BOT' }), A)).toBe(
      'Showed it is online (trade bot)'
    );
    expect(say(row('PRESENCE', { presenceType: 'REWARD_SHARE' }))).toBe(
      `${s(A)} showed it is online (minting)`
    );
  });

  it('a type this app does not know', () => {
    const tx = row('NEW_THING');
    expect(describeTx(tx).title).toBe('New thing');
    expect(say(tx, A)).toBe('A NEW_THING transaction');
    expect(say(tx)).toBe(`${s(A)} made a NEW_THING transaction`);
    expect(say(row('ODD_THING'), A)).toBe('An ODD_THING transaction');
  });

  it('a waiting non-group transaction says so', () => {
    const tx = row('REGISTER_NAME', { name: 'example', txGroupId: 694, approvalStatus: 'PENDING' });
    expect(say(tx, A)).toBe('Registered the name “example” (waiting for group approval)');
  });
});

describe('every type', () => {
  /** A row with every field any type reads, so each type has something to say. */
  const everything = (type: string): TxRow =>
    row(type, {
      creatorAddress: type === 'AT' ? NULL_OWNER : A,
      txGroupId: 4242,
      approvalStatus: 'APPROVED',
      groupId: 31,
      recipient: B,
      amount: '1.00000000',
      assetId: 0,
      payments: [{ recipient: B, assetId: 0, amount: '1.00000000' }],
      name: 'foo',
      newName: 'bar',
      seller: B,
      sharePercent: '0.00',
      invitee: B,
      member: B,
      offender: B,
      admin: B,
      newOwner: B,
      target: B,
      owner: A,
      atAddress: AT_ADDR,
      aTAddress: AT_ADDR,
      service: 1000,
      identifier: 'id',
      timeToLive: 864_000,
      reason: 'because',
      pendingSignature: PENDING_SIG,
      approval: true,
      pollName: 'p',
      optionIndex: 1,
      level: 2,
      defaultGroupId: 31,
      orderId: ORDER,
      data: 'PRIVATE CONTENT',
      isEncrypted: false,
    });

  for (const type of ALL_TX_TYPES)
    it(`${type} reads well from every side`, () => {
      const tx = everything(type);
      for (const viewpoint of [A, B, AT_ADDR, C, undefined]) {
        const words = describeTx(tx, { viewpoint, privsRecipient: B });
        expect(words.title).toBe(TX_TYPE_LABELS[type]);
        expect(words.plain.length).toBeGreaterThan(5);
        expect(words.plain[0]).toBe(words.plain[0].toUpperCase());
        expect(words.plain).not.toMatch(/undefined|null|NaN|\[object|\s{2}/);
        expect(words.plain).toBe(partsToPlain(words.parts));
        expect(words.participants).not.toContain(NULL_OWNER);
        expect(new Set(words.participants).size).toBe(words.participants.length);
        for (const f of words.fields) {
          expect(f.label).not.toMatch(/txGroupId|time ?to ?live|expir|duration|admin status/i);
          if (typeof f.value === 'string') expect(f.value).not.toMatch(/undefined|NaN/);
        }
        const json = JSON.stringify(words);
        expect(json).not.toContain('4242'); // txGroupId: raw JSON only
        expect(json).not.toContain('864'); // timeToLive: raw JSON only
        if (type === 'MESSAGE' || type === 'CHAT') expect(json).not.toContain('PRIVATE CONTENT');
        if (viewpoint === undefined || viewpoint === C) expect(words.direction).toBe('none');
      }
    });
});
