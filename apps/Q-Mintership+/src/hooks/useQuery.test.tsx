import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { fetchQuery, invalidate, resetQueries } from '../data/query';
import { useQuery } from './useQuery';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

function Counter({ load }: { load: (force: boolean) => Promise<number> }) {
  const q = useQuery('t:count', load);
  return <p>{q.data === undefined ? 'loading' : `value ${q.data}`}</p>;
}

describe('useQuery and invalidate()', () => {
  beforeEach(() => resetQueries());

  it('reloads a mounted view after invalidate(), keeping the old value meanwhile', async () => {
    let calls = 0;
    const load = (force: boolean) => fetchQuery('t:count', async () => ++calls, { force });
    render(<Counter load={load} />);
    expect(await screen.findByText('value 1')).toBeInTheDocument();

    act(() => invalidate('t:'));
    expect(await screen.findByText('value 2')).toBeInTheDocument();
    expect(calls).toBe(2);

    // A second invalidation reloads again; nothing reloads without one.
    act(() => invalidate('t:count'));
    expect(await screen.findByText('value 3')).toBeInTheDocument();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(calls).toBe(3);
  });

  it('does not let a load that started before the invalidation clear it', async () => {
    const first = deferred<string>();
    const answers = [first.promise, Promise.resolve('after the write')];
    const load = () => answers.shift() as Promise<string>;
    const early = fetchQuery('t:race', load);
    invalidate('t:race');
    // The write's invalidation arrives while the early read is running: a new load replaces it.
    const late = fetchQuery('t:race', load, { force: true });
    first.resolve('before the write');
    expect(await early).toBe('before the write');
    expect(await late).toBe('after the write');
    expect(await fetchQuery('t:race', load)).toBe('after the write');
  });

  it('does not retry in a loop when the reload after an invalidation fails', async () => {
    let calls = 0;
    const load = (force: boolean) =>
      fetchQuery(
        't:count',
        async () => {
          calls++;
          if (calls > 1) throw new Error('down');
          return calls;
        },
        { force }
      );
    render(<Counter load={load} />);
    expect(await screen.findByText('value 1')).toBeInTheDocument();
    act(() => invalidate('t:'));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(calls).toBe(2);
    expect(screen.getByText('value 1')).toBeInTheDocument();
  });
});
