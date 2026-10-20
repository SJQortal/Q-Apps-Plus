import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HubThemeProvider } from '../../hub-theme';
import { themeConfig, THEME_STORAGE_KEY } from '../../theme/qplus-theme';
import { FramedText } from './FramedText';

const REASON = 'Runs a public node, helps newcomers in Q-Chat every day, and wrote the guide.';
const originalMatchMedia = window.matchMedia;
const heights = Object.getOwnPropertyDescriptors(HTMLElement.prototype);

/** A frame `width` px wide (MUI's breakpoint queries), and text `textHeight` px tall. */
function frame(width: number, textHeight: number) {
  window.matchMedia = ((query: string) => {
    const sizes = [...query.matchAll(/\((min|max)-width:\s*([\d.]+)px\)/g)];
    const matches =
      sizes.length > 0 &&
      sizes.every(([, edge, value]) =>
        edge === 'min' ? width >= Number(value) : width <= Number(value)
      );
    return { ...originalMatchMedia(query), matches };
  }) as typeof window.matchMedia;
  // A clamped text is 4 lines (96 px) tall; its whole text is `textHeight`.
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    configurable: true,
    get: () => textHeight,
  });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get: () => Math.min(textHeight, 96),
  });
}

function show(props: Partial<Parameters<typeof FramedText>[0]> = {}) {
  return render(
    <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
      <FramedText text={REASON} moreLabel="Show the whole reason" {...props} />
    </HubThemeProvider>
  );
}

afterEach(() => {
  window.matchMedia = originalMatchMedia;
  for (const key of ['scrollHeight', 'clientHeight'] as const) {
    const original = heights[key];
    if (original) Object.defineProperty(HTMLElement.prototype, key, original);
  }
});

describe('FramedText', () => {
  it('shows the whole reason on a wider screen, with no button', () => {
    frame(1280, 300);
    show();
    expect(screen.getByText(REASON)).toBeVisible();
    expect(screen.queryByRole('button', { name: /whole reason/ })).toBeNull();
  });

  it('on a phone, a long reason shows its first lines with Show the whole reason', async () => {
    const u = userEvent.setup();
    frame(390, 300);
    show();
    const more = await screen.findByRole('button', { name: 'Show the whole reason' });
    expect(more).toHaveAttribute('aria-expanded', 'false');
    await u.click(more);
    const less = screen.getByRole('button', { name: 'Show less' });
    expect(less).toHaveAttribute('aria-expanded', 'true');
    expect(less).toHaveAttribute('aria-controls', screen.getByText(REASON).id);
  });

  it('on a phone, a reason that fits gets no button; nor does a compact card', () => {
    frame(390, 48);
    show();
    expect(screen.queryByRole('button', { name: /whole reason/ })).toBeNull();
    frame(390, 300);
    show({ compact: true });
    expect(screen.queryByRole('button', { name: /whole reason/ })).toBeNull();
  });

  it('says Show more unless told otherwise (a poll’s details)', async () => {
    frame(390, 300);
    render(
      <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
        <FramedText text={REASON} />
      </HubThemeProvider>
    );
    expect(await screen.findByRole('button', { name: 'Show more' })).toBeVisible();
  });
});
