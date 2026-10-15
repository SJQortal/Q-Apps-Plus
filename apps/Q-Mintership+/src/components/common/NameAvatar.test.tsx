import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { HubThemeProvider } from '../../hub-theme';
import { themeConfig, THEME_STORAGE_KEY } from '../../theme/qplus-theme';
import { fetchCallsFor, mockFetchRoute } from '../../test/setup';
import { AVATAR_RETRY_DELAYS_MS, resetAvatars } from '../../data/avatars';
import { NameAvatar } from './NameAvatar';

const STATUS = '/arbitrary/resource/status/THUMBNAIL/';
const url = (name: string, retry = 0) =>
  `/arbitrary/THUMBNAIL/${encodeURIComponent(name)}/qortal_avatar?async=true${retry ? `&retry=${retry}` : ''}`;

function show(...names: string[]) {
  return render(
    <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
      {names.map((name, i) => (
        <span key={i} data-testid={`avatar-${i}`}>
          <NameAvatar name={name} />
        </span>
      ))}
    </HubThemeProvider>
  );
}

const images = () => [...document.querySelectorAll('img')];

/** Let the in-view stub, the status read and React settle. */
async function flush() {
  for (let i = 0; i < 5; i++) await act(async () => {});
}

async function wait(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
  await flush();
}

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => (hidden ? 'hidden' : 'visible'),
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});

afterEach(() => {
  resetAvatars();
  setHidden(false);
  vi.useRealTimers();
});

describe('NameAvatar: avatars come in without a refresh', () => {
  it('shows the letter while loading, then the image once it has loaded', async () => {
    show('Ada');
    await flush();
    expect(screen.getByText('A')).toBeInTheDocument();
    const [img] = images();
    expect(img).toHaveAttribute('src', url('Ada'));
    fireEvent.load(img);
    await flush();
    expect(screen.queryByText('A')).toBeNull();
    expect(fetchCallsFor(STATUS)).toEqual([]);
  });

  it('tries again while Core is still fetching the avatar, until it loads', async () => {
    mockFetchRoute(`${STATUS}Ada`, { status: 'DOWNLOADING' });
    show('Ada');
    await flush();
    fireEvent.error(images()[0]);
    await flush();
    expect(fetchCallsFor(STATUS)).toEqual([`${STATUS}Ada/qortal_avatar`]);
    expect(images()).toEqual([]);
    expect(screen.getByText('A')).toBeInTheDocument();

    await wait(AVATAR_RETRY_DELAYS_MS[0]);
    expect(images()[0]).toHaveAttribute('src', url('Ada', 1));
    fireEvent.error(images()[0]);
    await flush();
    await wait(AVATAR_RETRY_DELAYS_MS[1]);
    expect(images()[0]).toHaveAttribute('src', url('Ada', 2));
    fireEvent.load(images()[0]);
    await flush();
    expect(screen.queryByText('A')).toBeNull();
    expect(fetchCallsFor(STATUS)).toHaveLength(1);
  });

  it('keeps the letter for a name that never published an avatar, and never asks again', async () => {
    mockFetchRoute(`${STATUS}Bo`, { status: 'NOT_PUBLISHED' });
    show('Bo');
    await flush();
    fireEvent.error(images()[0]);
    await flush();
    await wait(10 * 60_000);
    expect(images()).toEqual([]);
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(fetchCallsFor(STATUS)).toHaveLength(1);
  });

  it('shares one try between every place showing the same name', async () => {
    mockFetchRoute(`${STATUS}Cy`, { status: 'BUILDING' });
    show('Cy', 'Cy', 'Cy');
    await flush();
    expect(images()).toHaveLength(3);
    for (const img of images()) fireEvent.error(img);
    await flush();
    expect(fetchCallsFor(STATUS)).toHaveLength(1);
    await wait(AVATAR_RETRY_DELAYS_MS[0]);
    expect(images().map((img) => img.getAttribute('src'))).toEqual([
      url('Cy', 1),
      url('Cy', 1),
      url('Cy', 1),
    ]);
    fireEvent.load(images()[0]);
    await flush();
    expect(screen.queryAllByText('C')).toEqual([]);
  });

  it('waits while the tab is hidden, and tries when it shows again', async () => {
    mockFetchRoute(`${STATUS}Di`, { status: 'MISSING_DATA' });
    show('Di');
    await flush();
    fireEvent.error(images()[0]);
    await flush();
    setHidden(true);
    await wait(AVATAR_RETRY_DELAYS_MS[0] * 10);
    expect(images()).toEqual([]);
    await act(async () => setHidden(false));
    await flush();
    expect(images()[0]).toHaveAttribute('src', url('Di', 1));
  });

  it('still tries again when the status can’t be read, and stops when the tries run out', async () => {
    mockFetchRoute(`${STATUS}Ed`, () => new Response('', { status: 500 }));
    show('Ed');
    await flush();
    fireEvent.error(images()[0]);
    await flush();
    for (const delay of AVATAR_RETRY_DELAYS_MS) {
      await wait(delay);
      expect(images()).toHaveLength(1);
      fireEvent.error(images()[0]);
      await flush();
    }
    await wait(10 * 60_000);
    expect(images()).toEqual([]);
    expect(screen.getByText('E')).toBeInTheDocument();
    expect(fetchCallsFor(STATUS)).toHaveLength(1);
  });
});
