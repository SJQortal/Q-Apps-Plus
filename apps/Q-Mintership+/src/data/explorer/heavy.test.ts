import { beforeEach, describe, expect, it } from 'vitest';
import { getQueryState, resetQueries, setQueryData } from '../query';
import { dropHeavy, heavy, HeavyCancelled, heavyLoad, heavyQuery } from './heavy';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => resetQueries());

describe('heavy', () => {
  it('runs at most two at once, the newest queued first', async () => {
    const order: string[] = [];
    const gates = new Map<string, ReturnType<typeof deferred<void>>>();
    const job = (name: string) => {
      gates.set(name, deferred<void>());
      return heavy('a', async () => {
        order.push(name);
        await gates.get(name)!.promise;
        return name;
      });
    };
    const results = [job('1'), job('2'), job('3'), job('4')];
    await tick();
    expect(order).toEqual(['1', '2']);
    expect(heavyLoad()).toEqual({ running: 2, queued: 2 });
    gates.get('1')!.resolve();
    await tick();
    expect(order).toEqual(['1', '2', '4']);
    gates.get('2')!.resolve();
    gates.get('4')!.resolve();
    await tick();
    gates.get('3')!.resolve();
    await expect(Promise.all(results)).resolves.toEqual(['1', '2', '3', '4']);
    expect(heavyLoad()).toEqual({ running: 0, queued: 0 });
  });

  it('drops a closed view’s queued reads, leaving the running ones', async () => {
    const gate = deferred<void>();
    const running = [heavy('a', () => gate.promise), heavy('a', () => gate.promise)];
    const queued = heavy('b', async () => 'never');
    const other = heavy('c', async () => 'kept');
    await tick();
    dropHeavy('b');
    await expect(queued).rejects.toBeInstanceOf(HeavyCancelled);
    gate.resolve();
    await Promise.all(running);
    await expect(other).resolves.toBe('kept');
  });
});

describe('heavyQuery', () => {
  it('reads a fresh value at once, without waiting for a slot', async () => {
    const gate = deferred<void>();
    const busy = [heavy('x', () => gate.promise), heavy('x', () => gate.promise)];
    setQueryData('xtest:a', 42);
    await expect(heavyQuery('y', 'xtest:a', async () => 0)).resolves.toBe(42);
    gate.resolve();
    await Promise.all(busy);
  });

  it('leaves the store untouched when its queued read is dropped', async () => {
    const gate = deferred<void>();
    const busy = [heavy('x', () => gate.promise), heavy('x', () => gate.promise)];
    const read = heavyQuery('acct', 'xtest:b', async () => 1);
    await tick();
    dropHeavy('acct');
    await expect(read).rejects.toBeInstanceOf(HeavyCancelled);
    expect(getQueryState('xtest:b').status).toBe('idle');
    gate.resolve();
    await Promise.all(busy);
    await expect(heavyQuery('acct', 'xtest:b', async () => 1)).resolves.toBe(1);
  });
});
