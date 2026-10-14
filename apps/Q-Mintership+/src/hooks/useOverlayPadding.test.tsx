import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { BOTTOM_BAR_VAR, usePublishOverlay } from './useOverlayPadding';

function Bar({ gap }: { gap: number }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  usePublishOverlay(el, BOTTOM_BAR_VAR, { gap });
  return <div ref={setEl}>Sign 3</div>;
}

const value = () => document.documentElement.style.getPropertyValue(BOTTOM_BAR_VAR);

afterEach(() => vi.restoreAllMocks());

describe('room for the bars over the page', () => {
  it('publishes a sticky bar’s height while it is mounted, and clears it after', () => {
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(70);
    const { unmount } = render(<Bar gap={16} />);
    expect(value()).toBe('86px');
    unmount();
    expect(value()).toBe('');
  });
});
