import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Countdown } from './Countdown';

const T = 1_791_830_000_000;
const now = (height: number) => ({ height, timestamp: T, msPerBlock: 60_000, estimated: false });

afterEach(() => vi.useRealTimers());

describe('Countdown', () => {
  it('counts time down to the block, with the blocks in its label', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(T + 60_000);
    const { container } = render(<Countdown now={now(100)} height={160} suffix="left to sign" />);
    expect(screen.getByText('59m')).toBeInTheDocument();
    // Read as text (no aria-label on a plain span): the blocks and the date included.
    const clock = container.firstElementChild as HTMLElement;
    expect(clock).not.toHaveAttribute('aria-label');
    expect(clock).toHaveTextContent(/^59m left to sign, 60 blocks\. Block 160, about /);
  });

  it('can show the block and date as a line, for touch and keyboard users', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(T + 60_000);
    render(
      <Countdown
        now={now(100)}
        height={160}
        suffix="left to sign"
        blockLabel="Last block a signature counts in:"
        detailVisible
      />
    );
    expect(screen.getByText(/^Last block a signature counts in: 160, about /)).toBeVisible();
  });

  it('shows the blocks still to go when the time estimate runs out before the chain does', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(T + 10 * 60_000);
    render(
      <Countdown
        now={now(100)}
        height={102}
        suffix="left to sign"
        doneText="Signing time is over"
      />
    );
    expect(screen.getByText('2 blocks')).toBeInTheDocument();
    expect(screen.queryByText('Signing time is over')).toBeNull();
  });

  it('says it is over once the chain reaches the block', () => {
    render(<Countdown now={now(102)} height={102} doneText="Signing time is over" />);
    expect(screen.getByText('Signing time is over')).toBeInTheDocument();
  });
});
