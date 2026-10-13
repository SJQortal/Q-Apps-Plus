import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { useInView } from './useInView';

function Probe() {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const near = useInView(node);
  return <div ref={setNode}>{near ? 'near' : 'far'}</div>;
}

/** A stand-in IntersectionObserver the test can trigger. */
function fakeObserver() {
  const made: { callback: IntersectionObserverCallback; disconnect: ReturnType<typeof vi.fn> }[] = [];
  class FakeObserver {
    disconnect = vi.fn();
    constructor(public callback: IntersectionObserverCallback) {
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
});
