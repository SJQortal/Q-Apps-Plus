import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { SmoothReveal } from './SmoothReveal';

afterEach(() => vi.useRealTimers());

describe('SmoothReveal', () => {
  it('mounts on opening, keeps the content out of reach while closing, then unmounts it', () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <SmoothReveal open={false}>
        <button>Inside</button>
      </SmoothReveal>
    );
    expect(screen.queryByRole('button', { name: 'Inside' })).toBeNull();

    rerender(
      <SmoothReveal open>
        <button>Inside</button>
      </SmoothReveal>
    );
    const button = screen.getByRole('button', { name: 'Inside' });
    expect(button.closest('[inert]')).toBeNull();

    rerender(
      <SmoothReveal open={false}>
        <button>Inside</button>
      </SmoothReveal>
    );
    // Still there while it closes, but not reachable.
    expect(screen.getByText('Inside').closest('[inert]')).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.queryByText('Inside')).toBeNull();
  });

  it('shows what is open from the start at its natural height, without fading it in', () => {
    render(
      <SmoothReveal open>
        <p>Already open</p>
      </SmoothReveal>
    );
    const outer = screen.getByText('Already open').parentElement?.parentElement as HTMLElement;
    expect(outer.style.height).toBe('auto');
  });
});
