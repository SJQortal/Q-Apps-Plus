import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Availability } from '../interfaces';
import { fetchCallsFor, mockFetchRoute } from '../test/setup';
import {
  checkNameAvailability,
  nameLengthProblem,
  useNameAvailability,
} from './useNameAvailability';

const unknown = { error: 401, message: 'name unknown' };

describe('name availability', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("applies Core's 3 to 40 character limits before asking the node", () => {
    expect(nameLengthProblem('ab')).toBe('short');
    expect(nameLengthProblem('a'.repeat(41))).toBe('long');
    expect(nameLengthProblem('abc')).toBeNull();
    expect(nameLengthProblem('a'.repeat(40))).toBeNull();
    expect(nameLengthProblem('   ')).toBeNull();
  });

  it('URL-encodes the name and reads "name unknown" as available', async () => {
    mockFetchRoute('/names/', (url) =>
      url.pathname.endsWith('/taken') ? { name: 'taken', owner: 'Q1' } : unknown
    );
    await expect(checkNameAvailability('taken')).resolves.toBe(Availability.NOT_AVAILABLE);
    await expect(checkNameAvailability('free name')).resolves.toBe(Availability.AVAILABLE);
    expect(fetchCallsFor('/names/')).toEqual(['/names/taken', '/names/free%20name']);
  });

  it('is INVALID for a too short name without any request', () => {
    const { result } = renderHook(() => useNameAvailability('ab'));
    expect(result.current).toBe(Availability.INVALID);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(fetchCallsFor('/names/')).toEqual([]);
  });

  it('debounces, and ignores a late answer for an earlier name', async () => {
    const resolvers = new Map<string, (value: unknown) => void>();
    mockFetchRoute(
      '/names/',
      (url) =>
        new Promise((resolve) => {
          resolvers.set(decodeURIComponent(url.pathname.slice('/names/'.length)), resolve);
        })
    );
    const { result, rerender } = renderHook(({ name }) => useNameAvailability(name), {
      initialProps: { name: 'alice' },
    });
    expect(result.current).toBe(Availability.LOADING);
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    rerender({ name: 'alicia' });
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(fetchCallsFor('/names/')).toEqual(['/names/alice', '/names/alicia']);

    // The newer name is free; the older answer arrives last and says taken.
    await act(async () => {
      resolvers.get('alicia')!(unknown);
    });
    expect(result.current).toBe(Availability.AVAILABLE);
    await act(async () => {
      resolvers.get('alice')!({ name: 'alice', owner: 'Q1' });
    });
    expect(result.current).toBe(Availability.AVAILABLE);
  });
});
