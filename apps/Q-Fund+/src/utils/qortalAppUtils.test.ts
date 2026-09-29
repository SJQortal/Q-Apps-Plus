import { describe, expect, it } from 'vitest';
import { onQortalAction, qortalCalls } from '../test/qortalRequestMock';
import {
  addStringNumbers,
  getAccountNames,
  getUserBalance,
  isAllZerosNum,
  removeTrailingZeros,
  setNumberWithinBounds,
  sigDigitsExceeded,
  truncateNumber,
} from './qortalAppUtils';

describe('number helpers (behaviour copied from qortal-app-utils)', () => {
  it('adds string amounts and strips trailing zeros', () => {
    expect(addStringNumbers('1.50', '2.25')).toBe('3.75');
    expect(removeTrailingZeros('10.500')).toBe('10.5');
    expect(() => addStringNumbers('x', '1')).toThrow(TypeError);
  });

  it('bounds and truncates', () => {
    expect(setNumberWithinBounds(5, 1, 3)).toBe(3);
    expect(setNumberWithinBounds(-2, 1, 3)).toBe(1);
    expect(truncateNumber('12.345', 2)).toBe('12.35');
    expect(truncateNumber(7, 2)).toBe('7.00');
  });

  it('checks significant digits and all-zero input', () => {
    expect(sigDigitsExceeded('1.123456789', 8)).toBe(true);
    expect(sigDigitsExceeded('1.12345678', 8)).toBe(false);
    expect(isAllZerosNum.test('000.00')).toBe(true);
    expect(isAllZerosNum.test('0.01')).toBe(false);
  });
});

describe('qortalRequest wrappers', () => {
  it('getUserBalance asks for the account then its balance', async () => {
    onQortalAction('GET_USER_ACCOUNT', () => ({ address: 'Qaddr', publicKey: 'pk' }));
    onQortalAction('GET_BALANCE', (o) => (o.address === 'Qaddr' ? 12.5 : 0));
    await expect(getUserBalance()).resolves.toBe(12.5);
    expect(qortalCalls('GET_BALANCE')).toHaveLength(1);
  });

  it('getAccountNames fills in a nameless address', async () => {
    onQortalAction('GET_ACCOUNT_NAMES', () => []);
    await expect(getAccountNames('Qx')).resolves.toEqual([{ name: '', owner: 'Qx' }]);
    onQortalAction('GET_ACCOUNT_NAMES', () => [{ name: 'alice', owner: 'Qx' }]);
    await expect(getAccountNames('Qx')).resolves.toEqual([{ name: 'alice', owner: 'Qx' }]);
  });

  it('refuses write actions unless a test registers them', async () => {
    await expect(qortalRequest({ action: 'SEND_COIN', amount: 1 })).rejects.toThrow(/Refusing write action/);
  });
});
