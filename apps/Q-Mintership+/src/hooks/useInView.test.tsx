import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { useInView } from './useInView';

function Probe() {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const near = useInView(node);
  return <div ref={setNode}>{near ? 'near' : 'far'}</div>;
}

/**
 * A stand-in IntersectionObserver the test can trigger. With `noDocumentRoot`
 * it refuses a document as its root, as some engines do.
 */
function fakeObserver({ noDocumentRoot = false } = {}) {
  const made: {
    callback: IntersectionObserverCallback;
    options?: IntersectionObserverInit;
    disconnect: ReturnType<typeof vi.fn>;
  }[] = [];
  class FakeObserver {
    disconnect = vi.fn();
    constructor(
      public callback: IntersectionObserverCallback,
      public options?: IntersectionObserverInit
    ) {
      if (noDocumentRoot && options?.root instanceof Document)
        throw new TypeError("Failed to construct 'IntersectionObserver'");
      made.push(this);
    }
    observe() {}
    unobserve() {}
    takeRecords() {
      return [];
    }
  }
  vi.stubGlobal('IntersectionObserver', FakeObserver);
  return made;
}

afterEach(() => vi.unstubAllGlobals());

describe('useInView', () => {
  it('is true at once without IntersectionObserver', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    render(<Probe />);
    expect(screen.getByText('near')).toBeInTheDocument();
  });

  it('turns true once the node comes near the screen, and stays true', () => {
    const made = fakeObserver();
    render(<Probe />);
    expect(screen.getByText('far')).toBeInTheDocument();
    const observer = made.at(-1)!;
    act(() => observer.callback([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver));
    expect(screen.getByText('far')).toBeInTheDocument();
    act(() => observer.callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
    expect(screen.getByText('near')).toBeInTheDocument();
    expect(observer.disconnect).toHaveBeenCalled();
  });

  it('measures against the app’s own document, so the margin works inside a frame', () => {
    const made = fakeObserver();
    render(<Probe />);
    expect(made).toHaveLength(1);
    expect(made[0].options).toEqual({ root: document, rootMargin: '300px' });
  });

  it('falls back to the viewport where a document can’t be the root', () => {
    const made = fakeObserver({ noDocumentRoot: true });
    render(<Probe />);
    expect(made).toHaveLength(1);
    expect(made[0].options).toEqual({ rootMargin: '300px' });
    act(() =>
      made[0].callback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver
      )
    );
    expect(screen.getByText('near')).toBeInTheDocument();
  });
});
