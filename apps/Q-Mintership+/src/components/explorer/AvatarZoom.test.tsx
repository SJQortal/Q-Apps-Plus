import { afterEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HubThemeProvider } from '../../hub-theme';
import { themeConfig, THEME_STORAGE_KEY } from '../../theme/qplus-theme';
import { resetAvatars } from '../../data/avatars';
import { AvatarZoom } from './AvatarZoom';

const url = (name: string) =>
  `/arbitrary/THUMBNAIL/${encodeURIComponent(name)}/qortal_avatar?async=true`;

function show(name: string | null) {
  return render(
    <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
      <AvatarZoom name={name} size={36} phoneSize={32} />
    </HubThemeProvider>
  );
}

/** Let the in-view stub and React settle. */
async function flush() {
  for (let i = 0; i < 5; i++) await act(async () => {});
}

afterEach(() => resetAvatars());

describe('an avatar that opens bigger', () => {
  it('is the plain avatar until its image has loaded, then a button that opens it bigger', async () => {
    const user = userEvent.setup();
    show('Ada Avatar');
    await flush();
    // Its letter, and nothing to press yet.
    expect(screen.queryByRole('button')).toBeNull();
    const img = document.querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe(url('Ada Avatar'));
    fireEvent.load(img);
    const button = await screen.findByRole('button', { name: 'Show Ada Avatar’s avatar bigger' });
    expect(button).toHaveAttribute('aria-haspopup', 'dialog');
    await user.click(button);
    const dialog = await screen.findByRole('dialog', { name: 'Ada Avatar' });
    // The whole image the avatar loaded: no other request.
    expect(within(dialog).getByRole('img', { name: 'Ada Avatar’s avatar' })).toHaveAttribute(
      'src',
      url('Ada Avatar')
    );
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    // Focus back on the avatar that opened it.
    expect(button).toHaveFocus();
  });

  it('stays the plain avatar for an account without a name', async () => {
    show(null);
    await flush();
    expect(screen.queryByRole('button')).toBeNull();
    expect(document.querySelector('img')).toBeNull();
  });
});
