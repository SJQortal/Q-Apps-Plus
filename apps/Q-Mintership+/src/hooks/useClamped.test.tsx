import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useState } from 'react';
import { useClamped } from './useClamped';

function Clamp({ scrollHeight, clientHeight }: { scrollHeight: number; clientHeight: number }) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const clamped = useClamped(node, 'text');
  return (
    <p
      ref={(el) => {
        if (el) {
          Object.defineProperty(el, 'scrollHeight', { configurable: true, value: scrollHeight });
          Object.defineProperty(el, 'clientHeight', { configurable: true, value: clientHeight });
        }
        setNode(el);
      }}
    >
      {clamped ? 'cut off' : 'all shown'}
    </p>
  );
}

describe('useClamped', () => {
  it('is true only when the text is taller than its clamped box', () => {
    const { unmount } = render(<Clamp scrollHeight={96} clientHeight={72} />);
    expect(screen.getByText('cut off')).toBeInTheDocument();
    unmount();
    render(<Clamp scrollHeight={72} clientHeight={72} />);
    expect(screen.getByText('all shown')).toBeInTheDocument();
  });
});
