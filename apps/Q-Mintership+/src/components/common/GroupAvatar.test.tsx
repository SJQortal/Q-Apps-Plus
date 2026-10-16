import { describe, expect, it } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { HubThemeProvider } from '../../hub-theme';
import { themeConfig, THEME_STORAGE_KEY } from '../../theme/qplus-theme';
import { resetAvatars } from '../../data/avatars';
import { GroupAvatar } from './GroupAvatar';
import { NameAvatar } from './NameAvatar';

function show(ui: React.ReactNode) {
  resetAvatars();
  return render(
    <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
      {ui}
    </HubThemeProvider>
  );
}

describe('GroupAvatar', () => {
  it('loads the THUMBNAIL its owner published for the group, with the group’s letter until then', async () => {
    const { container } = show(
      <GroupAvatar groupId={31} groupName="alt coin investor" ownerName="Jd bit+mac" />
    );
    const avatar = container.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(avatar.textContent).toBe('A');
    await waitFor(() =>
      expect(avatar.querySelector('img')?.getAttribute('src')).toBe(
        '/arbitrary/THUMBNAIL/Jd%20bit%2Bmac/qortal_group_avatar_31?async=true'
      )
    );
  });

  it('a group whose owner has no name (MINTER) keeps its letter and loads nothing', async () => {
    const { container } = show(<GroupAvatar groupId={694} groupName="MINTER" ownerName={null} />);
    const avatar = container.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(avatar.textContent).toBe('M');
    expect(avatar.querySelector('img')).toBeNull();
  });

  it('a person’s avatar is still their qortal_avatar', async () => {
    const { container } = show(<NameAvatar name="Simon James" />);
    await waitFor(() =>
      expect(container.querySelector('img')?.getAttribute('src')).toBe(
        '/arbitrary/THUMBNAIL/Simon%20James/qortal_avatar?async=true'
      )
    );
  });
});
