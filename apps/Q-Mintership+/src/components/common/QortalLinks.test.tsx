import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HubThemeProvider } from '../../hub-theme';
import { themeConfig, THEME_STORAGE_KEY } from '../../theme/qplus-theme';
import { mockQortalRequest, qortalCallsFor } from '../../test/setup';
import { QortalLinks } from './QortalLinks';

function show(links: string[]) {
  return render(
    <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
      <QortalLinks links={links} />
    </HubThemeProvider>
  );
}

describe('QortalLinks', () => {
  it('shows each link with the avatar of the app or website it opens', async () => {
    const { container } = show([
      'qortal://APP/Torq/user/The%20Empress',
      'qortal://WEBSITE/Qortal%20Wiki',
    ]);
    const torq = screen.getByRole('button', { name: 'APP/Torq/user/The Empress' });
    expect(screen.getByRole('button', { name: 'WEBSITE/Qortal Wiki' })).toBeInTheDocument();
    await waitFor(() => expect(container.querySelectorAll('img')).toHaveLength(2));
    const images = [...container.querySelectorAll('img')];
    expect(images.map((img) => img.getAttribute('src'))).toEqual([
      '/arbitrary/THUMBNAIL/Torq/qortal_avatar?async=true',
      '/arbitrary/THUMBNAIL/Qortal%20Wiki/qortal_avatar?async=true',
    ]);
    expect(torq.contains(images[0])).toBe(true);
  });

  it('gives a link that opens no name a plain link icon', async () => {
    const { container } = show(['qortal://use-group/action-join/groupid-694']);
    expect(
      screen.getByRole('button', { name: 'use-group/action-join/groupid-694' })
    ).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 0));
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[data-testid="LinkOutlinedIcon"]')).not.toBeNull();
  });

  it('opens the link in a new Hub tab', async () => {
    show(['qortal://APP/Torq/user/The%20Empress']);
    mockQortalRequest('OPEN_NEW_TAB', true);
    await userEvent.click(screen.getByRole('button', { name: 'APP/Torq/user/The Empress' }));
    expect(qortalCallsFor('OPEN_NEW_TAB')[0]).toMatchObject({
      qortalLink: 'qortal://APP/Torq/user/The%20Empress',
    });
  });

  it('shows nothing without links', () => {
    const { container } = show([]);
    expect(container).toBeEmptyDOMElement();
  });
});

