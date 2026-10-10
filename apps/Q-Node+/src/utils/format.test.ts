import { describe, expect, it } from 'vitest';
import { formatCoreVersion, secondsToDhms } from './format';

describe('secondsToDhms', () => {
  it('formats days, hours, minutes and seconds', () => {
    expect(secondsToDhms(93784)).toBe('1d 2h 3m 4s');
  });

  it('leaves out zero parts', () => {
    expect(secondsToDhms(3600)).toBe('1h');
    expect(secondsToDhms(61)).toBe('1m 1s');
  });

  it('is empty for zero, negative, NaN and undefined', () => {
    expect(secondsToDhms(0)).toBe('');
    expect(secondsToDhms(-5)).toBe('');
    expect(secondsToDhms(Number.NaN)).toBe('');
    expect(secondsToDhms(undefined)).toBe('');
  });

  it('accepts fractional seconds from uptime in milliseconds', () => {
    expect(secondsToDhms(90.9)).toBe('1m 30s');
  });
});

describe('formatCoreVersion', () => {
  it('turns the build version into a short v-number', () => {
    expect(formatCoreVersion('qortal-5.0.2')).toBe('v5.0.2');
    expect(formatCoreVersion('5.0.2')).toBe('5.0.2');
    expect(formatCoreVersion(undefined)).toBe('');
  });
});
