import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { FileList } from './FileList';
import { renderWithProviders } from '../../test/renderWithProviders';
import { fetchCalls, mockQortalAction, qortalCalls, qortalCallsFor } from '../../test/setup';
import { store } from '../../state/store';
import { addUser } from '../../state/features/authSlice';
import { addToHashMap, markUnavailable, type Video } from '../../state/features/fileSlice';
import { setNotification } from '../../state/features/notificationsSlice';
import { getIconsFromObject } from '../../constants/Categories/CategoryFunctions';
import { resetSettingsCache, writeSettings } from '../../utils/settings';
import { ListViewToggle } from '../../components/common/ListViewToggle';
import { useTheme, type Theme } from '@mui/material/styles';
import { THEME_STORAGE_KEY } from '../../theme/qplus-theme';

// Counts row renders: every row computes its icon once per render.
vi.mock('../../constants/Categories/CategoryFunctions.ts', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../constants/Categories/CategoryFunctions.ts')>();
  return { ...original, getIconsFromObject: vi.fn(original.getIconsFromObject) };
});

const share = (id: string, user = 'bob'): Video => ({ id, user, title: `Title ${id}`, description: '', created: 1, service: 'DOCUMENT' });
const alerts = () => store.getState().notifications.alertTypes;

beforeEach(() => {
  store.dispatch(addUser({ address: 'Qabc', publicKey: 'k', name: 'alice', names: [{ name: 'alice', owner: 'Qabc' }] }));
  store.dispatch(setNotification({ msg: '', alertType: 'success' }));
  store.dispatch(setNotification({ msg: '', alertType: 'error' }));
});

afterEach(() => {
  vi.restoreAllMocks();
  store.dispatch(addUser(null));
});

describe('FileList row actions', () => {
  it('shows the link for a manual copy when copying is blocked outright', async () => {
    const row = share('qshare_file_nocopy_Nc1234_metadata', 'Simon James');
    store.dispatch(addToHashMap({ ...row, files: [], isValid: true }));
    Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    Object.defineProperty(document, 'execCommand', { value: vi.fn().mockReturnValue(false), configurable: true });

    renderWithProviders(<FileList files={[row]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));

    await screen.findByRole('dialog', { name: 'Copy link' });
    expect(screen.getByDisplayValue('qortal://APP/Q-Share+/share/Simon%20James/qshare_file_nocopy_Nc1234_metadata')).toBeInTheDocument();
    expect(alerts().alertError).toBe('');
  });

  it('copies a link on a plain-http node, where navigator.clipboard is missing', async () => {
    const row = share('qshare_file_copy_Cp1234_metadata');
    store.dispatch(addToHashMap({ ...row, files: [], isValid: true }));
    Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    const exec = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', { value: exec, configurable: true });

    renderWithProviders(<FileList files={[row]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));

    await waitFor(() => expect(alerts().alertSuccess).toBe('Link copied'));
    expect(exec).toHaveBeenCalledWith('copy');
    expect(alerts().alertError).toBe('');
  });

  it('stays quiet when Block is declined in Hub, and reports a real failure', async () => {
    const row = share('qshare_file_block_Bk1234_metadata');
    store.dispatch(addToHashMap({ ...row, files: [], isValid: true }));
    mockQortalAction('ADD_LIST_ITEMS', () => {
      throw { error: 'Benutzer hat die Anfrage abgelehnt', message: 'Benutzer hat die Anfrage abgelehnt' };
    });

    renderWithProviders(<FileList files={[row]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Block bob' }));
    await waitFor(() => expect(qortalCallsFor('ADD_LIST_ITEMS').length).toBe(1));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(alerts().alertError).toBe('');

    mockQortalAction('ADD_LIST_ITEMS', () => {
      throw { error: 1003, message: 'no action public node' };
    });
    fireEvent.click(screen.getByRole('button', { name: 'Block bob' }));
    await waitFor(() => expect(alerts().alertError).toBe('Could not block bob'));
  });
});

describe('FileList rendering', () => {
  it('a body landing re-renders only its own row', () => {
    const rows = [1, 2, 3, 4].map((n) => share(`qshare_file_render-${n}_Rn000${n}_metadata`));
    renderWithProviders(<FileList files={rows} />);
    const renders = vi.mocked(getIconsFromObject);
    expect(renders).toHaveBeenCalledTimes(4);

    renders.mockClear();
    act(() => {
      store.dispatch(addToHashMap({ ...rows[2], title: 'Third, loaded', files: [], isValid: true }));
    });
    expect(screen.getByText('Third, loaded')).toBeInTheDocument();
    expect(renders).toHaveBeenCalledTimes(1);
  });
});

describe('FileList rows without a body', () => {
  it('shows an unavailable row that still opens the share, and a deleted one with nothing to open', () => {
    const missing = { ...share('qshare_file_gone-away_Mi1234_metadata'), title: '' };
    const deleted = { ...share('qshare_file_torq-test_De1234_metadata'), title: 'deleted' };
    store.dispatch(markUnavailable(missing));
    store.dispatch(addToHashMap({ ...deleted, isValid: false, deleted: true }));

    renderWithProviders(<FileList files={[missing, deleted]} />);

    expect(screen.getByRole('button', { name: 'Open Gone away' })).toBeInTheDocument();
    expect(screen.getByText('Not available on your node right now')).toBeInTheDocument();
    expect(screen.getByText('Deleted by its publisher')).toBeInTheDocument();
    expect(screen.getByText('Torq test')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open Torq test' })).not.toBeInTheDocument();
  });

  it('keeps two names under one identifier apart: each row shows its own body and state', () => {
    const id = 'qshare_file_same-id_Si1234_metadata';
    const own = { ...share(id, 'alice'), title: 'Holiday' };
    const other = { ...share(id, 'mallory'), title: 'Holiday' };
    const third = { ...share(id, 'carol'), title: 'Holiday' };
    store.dispatch(addToHashMap({ ...other, isValid: false, deleted: true }));
    store.dispatch(addToHashMap({ ...own, title: 'Holiday pics', files: [{ size: 2048 }], isValid: true }));
    store.dispatch(markUnavailable(third));

    renderWithProviders(<FileList files={[other, own, third]} />);

    expect(screen.getByText('Deleted by its publisher')).toBeInTheDocument();
    expect(screen.getByText('Holiday pics')).toBeInTheDocument();
    expect(screen.getByText(/1 file · 2 KB/)).toBeInTheDocument();
    // The owner can edit, as the body is there.
    expect(screen.getByRole('button', { name: 'Edit share' })).toBeInTheDocument();
    expect(screen.getAllByText('Not available on your node right now')).toHaveLength(1);
    store.dispatch({ type: 'file/removeFromHashMap', payload: id });
  });
});

describe('FileList grid', () => {
  beforeEach(() => {
    writeSettings({ listView: 'grid' });
  });
  afterEach(() => {
    resetSettingsCache();
  });

  const cards = (root: HTMLElement = document.body) => Array.from(root.querySelectorAll<HTMLElement>('li.share-card'));

  it('renders a card per share with the row actions, and makes no Qortal call of its own', () => {
    const own = { ...share('qshare_file_grid-own_Gr0001_metadata', 'alice'), title: 'My notes' };
    const other = { ...share('qshare_file_grid-other_Gr0002_metadata', 'bob'), title: 'Bob tools' };
    store.dispatch(addToHashMap({ ...own, category: '1', files: [{ size: 1024 }, { size: 1024 }], isValid: true }));
    store.dispatch(addToHashMap({ ...other, files: [{ size: 3 * 1024 * 1024 }], isValid: true }));

    const { container } = renderWithProviders(<FileList files={[own, other]} />);

    expect(cards(container)).toHaveLength(2);
    const [mine, bobs] = cards(container);
    // Same accessible names as the rows: "Open <title>", the publisher link and each action.
    expect(within(mine).getByRole('button', { name: 'Open My notes' })).toHaveClass('row-main');
    expect(within(mine).getByText(/2 files · 2 KB/)).toBeInTheDocument();
    expect(within(mine).getByRole('button', { name: 'Shares by alice' })).toBeInTheDocument();
    expect(within(mine).getByRole('button', { name: 'Copy link' })).toBeInTheDocument();
    expect(within(mine).getByRole('button', { name: 'Add to collection' })).toBeInTheDocument();
    expect(within(mine).getByRole('button', { name: 'Edit share' })).toBeInTheDocument();
    expect(within(mine).queryByRole('button', { name: /^Block/ })).not.toBeInTheDocument();
    expect(within(bobs).getByRole('button', { name: 'Open Bob tools' })).toBeInTheDocument();
    expect(within(bobs).getByText(/1 file · 3 MB/)).toBeInTheDocument();
    expect(within(bobs).getByRole('button', { name: 'Block bob' })).toBeInTheDocument();
    // The art is the bundled category icon, and every image waits until it scrolls into view.
    const images = Array.from(container.querySelectorAll('img'));
    expect(images.length).toBeGreaterThan(0);
    for (const img of images) expect(img).toHaveAttribute('loading', 'lazy');
    expect(images.some((img) => /software/.test(img.getAttribute('src') || ''))).toBe(true);
    expect(images.every((img) => !/\/arbitrary\/(FILE|DOCUMENT)\//.test(img.getAttribute('src') || ''))).toBe(true);
    expect(qortalCalls).toHaveLength(0);
    expect(fetchCalls).toHaveLength(0);
  });

  it('keeps every row state: pending, unavailable, deleted and unreadable', () => {
    const pending = { ...share('qshare_file_on-its-way_Pe1234_metadata'), title: 'On its way' };
    const missing = { ...share('qshare_file_gone-away_Gm1234_metadata'), title: '' };
    const deleted = { ...share('qshare_file_torq-test_Gd1234_metadata'), title: 'deleted' };
    const broken = { ...share('qshare_file_broken_Gb1234_metadata'), title: 'Broken' };
    store.dispatch(markUnavailable(missing));
    store.dispatch(addToHashMap({ ...deleted, isValid: false, deleted: true }));
    store.dispatch(addToHashMap({ ...broken, isValid: false }));

    const { container } = renderWithProviders(<FileList files={[pending, missing, deleted, broken]} />);
    const [pendingCard, missingCard, deletedCard, brokenCard] = cards(container);

    // Pending: the search's title at once, the meta line still loading.
    expect(pendingCard).toHaveAttribute('aria-busy', 'true');
    expect(within(pendingCard).getByRole('button', { name: 'Open On its way' })).toBeInTheDocument();
    expect(pendingCard.querySelector('.MuiSkeleton-root')).not.toBeNull();
    // Unavailable: readable, and still opens the share page (it has Retry).
    expect(missingCard).not.toHaveAttribute('aria-busy');
    expect(within(missingCard).getByRole('button', { name: 'Open Gone away' })).toBeInTheDocument();
    expect(within(missingCard).getByText('Not available on your node right now')).toBeInTheDocument();
    // Deleted and unreadable: nothing to open, no actions, the publisher still links.
    expect(within(deletedCard).getByText('Deleted by its publisher')).toBeInTheDocument();
    expect(within(deletedCard).getByText('Torq test')).toBeInTheDocument();
    expect(within(deletedCard).queryByRole('button', { name: /^Open/ })).not.toBeInTheDocument();
    expect(within(deletedCard).queryByRole('button', { name: 'Copy link' })).not.toBeInTheDocument();
    expect(within(deletedCard).getByRole('button', { name: 'Shares by bob' })).toBeInTheDocument();
    expect(within(brokenCard).getByText("This share can't be read")).toBeInTheDocument();
    store.dispatch({ type: 'file/removeFromHashMap', payload: deleted.id });
    store.dispatch({ type: 'file/removeFromHashMap', payload: broken.id });
  });

  it('a body landing re-renders only its own card', () => {
    const rows = [1, 2, 3, 4].map((n) => share(`qshare_file_grid-render-${n}_Gn000${n}_metadata`));
    renderWithProviders(<FileList files={rows} />);
    const renders = vi.mocked(getIconsFromObject);
    expect(renders).toHaveBeenCalledTimes(4);

    renders.mockClear();
    act(() => {
      store.dispatch(addToHashMap({ ...rows[1], title: 'Second, loaded', files: [], isValid: true }));
    });
    expect(screen.getByText('Second, loaded')).toBeInTheDocument();
    expect(renders).toHaveBeenCalledTimes(1);
  });

  it('hides the publisher on a profile page, as rows do', () => {
    const row = { ...share('qshare_file_profile-card_Pc1234_metadata'), title: 'Profile card' };
    store.dispatch(addToHashMap({ ...row, files: [], isValid: true }));
    renderWithProviders(<FileList files={[row]} showPublisher={false} />);
    expect(screen.getByRole('button', { name: 'Open Profile card' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Shares by bob' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeInTheDocument();
  });

  it('fits the whole category icon in the art, and keeps the art low on a phone in landscape', () => {
    /** The declarations of the stylesheet rules that match `el`, keyed by media query without spaces ("" for none). */
    const rulesFor = (el: Element) => {
      const found: Record<string, string> = {};
      const walk = (list: CSSRuleList, media: string) => {
        for (const rule of Array.from(list) as any[]) {
          if (rule.cssRules && rule.media) walk(rule.cssRules, rule.media.mediaText.replace(/\s+/g, ''));
          else if (rule.selectorText && /^\.[\w-]+$/.test(rule.selectorText) && el.matches(rule.selectorText))
            found[media] = `${found[media] ?? ''}${rule.style.cssText}`;
        }
      };
      for (const sheet of Array.from(document.styleSheets)) walk(sheet.cssRules, '');
      return found;
    };
    // Video's icon is wider than tall (484 × 285): a square cover crop cut off its lens.
    const row = { ...share('qshare_file_wide-icon_Wi1234_metadata'), title: 'Wide icon' };
    store.dispatch(addToHashMap({ ...row, category: '4', files: [], isValid: true }));
    const { container } = renderWithProviders(<FileList files={[row]} />);

    const img = cards(container)[0].querySelector('img')!;
    expect(img.getAttribute('src')).toMatch(/video/);
    const icon = rulesFor(img);
    const landscape = '(pointer:coarse)and(max-height:500px)';
    expect(icon['']).toMatch(/object-fit: contain/);
    expect(icon['']).not.toMatch(/object-fit: cover/);
    expect(icon['']).toMatch(/width: 96px;.*height: 64px/);
    expect(icon[landscape]).toMatch(/width: 54px;.*height: 36px/);
    const art = rulesFor(img.parentElement!);
    expect(art['']).toMatch(/height: 96px/);
    expect(art[landscape]).toMatch(/height: 48px/);
  });

  it('shows the manual-copy dialog from a card when copying is blocked', async () => {
    const row = share('qshare_file_grid-copy_Gc1234_metadata', 'Simon James');
    store.dispatch(addToHashMap({ ...row, files: [], isValid: true }));
    Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    Object.defineProperty(document, 'execCommand', { value: vi.fn().mockReturnValue(false), configurable: true });

    renderWithProviders(<FileList files={[row]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    await screen.findByRole('dialog', { name: 'Copy link' });
    expect(screen.getByDisplayValue('qortal://APP/Q-Share+/share/Simon%20James/qshare_file_grid-copy_Gc1234_metadata')).toBeInTheDocument();
  });

  it('lays cards out in ~220 px columns, two on phones and one below 350 px, none wider than its column', () => {
    /** The declarations of every stylesheet rule that matches `el`, keyed by media query ("" for none). */
    const rulesFor = (el: Element) => {
      const found: Record<string, string> = {};
      const matches = (selector: string) => {
        try {
          return el.matches(selector);
        } catch {
          return false; // a selector jsdom can't parse, such as MUI's ::-moz-focus-inner
        }
      };
      const walk = (list: CSSRuleList, media: string) => {
        for (const rule of Array.from(list) as any[]) {
          if (rule.cssRules && rule.media) walk(rule.cssRules, rule.media.mediaText.replace(/\s+/g, ''));
          else if (rule.selectorText && matches(rule.selectorText)) found[media] = `${found[media] ?? ''}${rule.style.cssText}`;
        }
      };
      for (const sheet of Array.from(document.styleSheets)) walk(sheet.cssRules, '');
      return found;
    };
    const row = { ...share('qshare_file_columns_Co1234_metadata', 'a-very-long-publisher-name-that-goes-on'), title: 'Columns' };
    store.dispatch(addToHashMap({ ...row, files: [], isValid: true }));
    const { container } = renderWithProviders(<FileList files={[row]} />);

    const grid = rulesFor(container.querySelector('ul')!);
    expect(grid['']).toMatch(/grid-template-columns: repeat\(auto-fill, minmax\(220px, 1fr\)\)/);
    expect(grid['(max-width:599.95px)']).toMatch(/grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
    // Below 350 px two columns can't hold three 44 px actions a card: one column.
    expect(grid['(max-width:349.95px)']).toMatch(/grid-template-columns: minmax\(0, 1fr\)/);
    // Gaps come from the theme's spacing (8 px units).
    expect(grid['']).toMatch(/gap: 12px/);
    expect(grid['(max-width:599.95px)']).toMatch(/gap: 8px/);
    // A card, and the publisher in it, shrink to the column: a long name ends in an ellipsis.
    const [card] = cards(container);
    expect(rulesFor(card)['']).toMatch(/min-width: 0/);
    const publisher = rulesFor(within(card).getByRole('button', { name: /^Shares by/ }))[''];
    expect(publisher).toMatch(/max-width: 100%/);
    expect(publisher).toMatch(/min-width: 0/);
    // The actions wrap rather than clip if a pane is narrower still.
    const actions = rulesFor(within(card).getByRole('button', { name: 'Copy link' }).closest('.row-actions')!)[''];
    expect(actions).toMatch(/max-width: 100%/);
    expect(actions).toMatch(/flex-wrap: wrap/);
  });

  it.each(['hub30', 'hub20', 'black', 'white'] as const)('takes every card colour from the %s theme', (id) => {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(id));
    let theme!: Theme;
    const Probe = () => {
      theme = useTheme();
      return null;
    };
    const row = { ...share(`qshare_file_theme-${id}_Th0${id.length}00_metadata`), title: `Theme ${id}` };
    store.dispatch(addToHashMap({ ...row, category: '1', files: [], isValid: true }));
    const { container } = renderWithProviders(
      <>
        <Probe />
        <FileList files={[row]} />
      </>
    );
    expect(theme.qplus.id).toBe(id);
    // jsdom spells colours its own way: compare through an element's style.
    const css = (value: string) => {
      const probe = document.createElement('span');
      probe.style.color = value;
      expect(probe.style.color).not.toBe('');
      return probe.style.color;
    };
    const [card] = cards(container);
    expect(getComputedStyle(card).backgroundColor).toBe(css(theme.palette.background.paper));
    expect(getComputedStyle(card).borderTopColor || getComputedStyle(card).border).toContain(css(theme.palette.divider));
    const art = card.querySelector('img')!.parentElement!;
    expect(getComputedStyle(art).backgroundColor).toBe(css(theme.qplus.primarySoft));
    expect(getComputedStyle(within(card).getByText(`Theme ${id}`)).color).toBe(css(theme.palette.text.primary));
  });

  it('switches every list on the page between cards and rows from the toggle', () => {
    writeSettings({ listView: 'list' });
    const a = { ...share('qshare_file_toggle-a_Ta1234_metadata'), title: 'Toggle A' };
    const b = { ...share('qshare_file_toggle-b_Tb1234_metadata', 'carol'), title: 'Toggle B' };
    const { container } = renderWithProviders(
      <>
        <ListViewToggle />
        <FileList files={[a]} />
        <FileList files={[b]} showPublisher={false} />
      </>
    );
    expect(cards(container)).toHaveLength(0);
    expect(container.querySelectorAll('button.row-main')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Grid' }));
    expect(cards(container)).toHaveLength(2);
    expect(container.querySelectorAll('button.row-main')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'List' }));
    expect(cards(container)).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Open Toggle A' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Toggle B' })).toBeInTheDocument();
  });
});
