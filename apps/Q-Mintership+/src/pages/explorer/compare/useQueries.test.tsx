import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { fetchQuery, invalidate, resetQueries } from '../../../data/query';
import { useQueries } from './useQueries';

function Reads({
  keys,
  load,
}: {
  keys: Array<string | null>;
  load: (key: string) => Promise<string>;
}) {
  const results = useQueries(
    keys.map((key) =>
      key ? { key, load: (force: boolean) => fetchQuery(key, () => load(key), { force }) } : null
    )
  );
  return (
    <ul>
      {results.map((r, i) => (
        <li key={i}>{r.data ?? (r.isLoading ? 'loading' : 'none')}</li>
      ))}
    </ul>
  );
}

beforeEach(() => resetQueries());

describe('useQueries', () => {
  it('reads each key once, nothing for a null entry, and again once per invalidation', async () => {
    const load = vi.fn(async (key: string) => `value of ${key}`);
    const { rerender } = render(<Reads keys={['xa:1', null, 'xa:2']} load={load} />);
    await waitFor(() =>
      expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
        'value of xa:1',
        'none',
        'value of xa:2',
      ])
    );
    expect(load.mock.calls.map(([key]) => key).sort()).toEqual(['xa:1', 'xa:2']);
    // Re-rendering asks for nothing new.
    rerender(<Reads keys={['xa:1', null, 'xa:2']} load={load} />);
    expect(load).toHaveBeenCalledTimes(2);
    // A stale key reloads once; the other stays.
    act(() => invalidate('xa:2'));
    await waitFor(() => expect(load).toHaveBeenCalledTimes(3));
    expect(load.mock.calls[2][0]).toBe('xa:2');
    // A new key is read when it appears.
    rerender(<Reads keys={['xa:1', 'xa:3', 'xa:2']} load={load} />);
    await waitFor(() =>
      expect(screen.getAllByRole('listitem')[1]).toHaveTextContent('value of xa:3')
    );
    expect(load).toHaveBeenCalledTimes(4);
  });

  it('a failed read stays failed until asked again (no loop)', async () => {
    const load = vi.fn(async () => {
      throw new Error('down');
    });
    render(<Reads keys={['xb:1']} load={load} />);
    await waitFor(() => expect(screen.getByRole('listitem')).toHaveTextContent('none'));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(load).toHaveBeenCalledTimes(1);
  });
});
