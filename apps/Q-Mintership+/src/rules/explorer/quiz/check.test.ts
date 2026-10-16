import { describe, expect, it, vi } from 'vitest';
import {
  answerWords,
  checkAnswer,
  cleanAnswer,
  numberMatches,
  parseNumber,
  prefixMatches,
  textMatches,
} from './check';

const RAVENSTONE = 'QLmZhiKfx6dtf87YXDeCRt7tJYpDTtVnX6';

describe('checking an Explorer Quiz answer', () => {
  it('reads numbers however they are typed', () => {
    expect(parseNumber('1,234.50 QORT')).toBe('1234.50');
    expect(parseNumber('block 2,401,221')).toBe('2401221');
    expect(parseNumber('#823')).toBe('823');
    expect(parseNumber('about 5')).toBeNull();
  });

  it('wants whole numbers exact, and lets amounts be rounded to 2 decimals or more', () => {
    expect(numberMatches('2', '2')).toBe(true);
    expect(numberMatches('2.0', '2')).toBe(true);
    expect(numberMatches('3', '2')).toBe(false);
    expect(numberMatches('5.6789', '5.67890000')).toBe(true);
    expect(numberMatches('5.68', '5.67890000')).toBe(true);
    expect(numberMatches('5.67', '5.67890000')).toBe(false);
    expect(numberMatches('5.7', '5.67890000')).toBe(false);
    expect(numberMatches('6', '5.67890000')).toBe(false);
    expect(numberMatches('12.3457', '12.34567891')).toBe(true);
    expect(numberMatches('850', '850.00000000')).toBe(true);
    expect(numberMatches('0.5', '0.50000000')).toBe(true);
    expect(numberMatches('.5', '0.5')).toBe(true);
  });

  it('matches words ignoring case, spaces and punctuation', () => {
    const accepted = ['Name registration', 'REGISTER_NAME'];
    expect(textMatches('name registration', accepted)).toBe(true);
    expect(textMatches('register_name', accepted)).toBe(true);
    expect(textMatches('Register name', accepted)).toBe(true);
    expect(textMatches('Payment', accepted)).toBe(false);
    expect(textMatches('  ', accepted)).toBe(false);
  });

  it('takes the start of a signature, at least as long as asked', () => {
    const sig = '3kxVE6Nqy8hC1yD7qKKT4nAQLy1fqDhyx6hmLSdh';
    expect(prefixMatches('3kxVE6Nq', sig, 8)).toBe(true);
    expect(prefixMatches('3kxVE6Nq…', sig, 8)).toBe(true);
    expect(prefixMatches(sig, sig, 8)).toBe(true);
    expect(prefixMatches('3kxVE6', sig, 8)).toBe(false);
    expect(prefixMatches('3KXVE6NQ', sig, 8)).toBe(false);
  });

  it('takes an account by its address, the name asked by, or any name it owns', async () => {
    const answer = { kind: 'account', address: RAVENSTONE, name: 'Ravenstone' } as const;
    const ownerOf = vi.fn(async (name: string) => (name === 'attention' ? RAVENSTONE : null));
    expect(await checkAnswer(answer, RAVENSTONE, ownerOf)).toBe(true);
    expect(await checkAnswer(answer, '@ravenstone', ownerOf)).toBe(true);
    expect(await checkAnswer(answer, '“Ravenstone”', ownerOf)).toBe(true);
    expect(ownerOf).not.toHaveBeenCalled();
    expect(await checkAnswer(answer, 'attention', ownerOf)).toBe(true);
    expect(await checkAnswer(answer, 'Stonecrow', ownerOf)).toBe(false);
    expect(await checkAnswer(answer, 'QdtAQm1EGNgM7QDSaC2qvV9WdpRHwpApUT', ownerOf)).toBe(false);
    expect(await checkAnswer(answer, '   ', ownerOf)).toBe(false);
  });

  it('says the answer plainly', () => {
    expect(answerWords({ answer: { kind: 'number', value: '1234.50000000', unit: 'QORT' } })).toBe(
      '1,234.5 QORT'
    );
    expect(
      answerWords({ answer: { kind: 'account', address: RAVENSTONE, name: 'Ravenstone' } })
    ).toBe(`Ravenstone (${RAVENSTONE})`);
    expect(cleanAnswer('  "kitty"  ')).toBe('kitty');
  });
});
