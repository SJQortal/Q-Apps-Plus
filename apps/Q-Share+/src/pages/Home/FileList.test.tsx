import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { FileList } from './FileList';
import { renderWithProviders } from '../../test/renderWithProviders';
import { mockQortalAction, qortalCallsFor } from '../../test/setup';
import { store } from '../../state/store';
import { addUser } from '../../state/features/authSlice';
import { addToHashMap, markUnavailable, type Video } from '../../state/features/fileSlice';
import { setNotification } from '../../state/features/notificationsSlice';
import { getIconsFromObject } from '../../constants/Categories/CategoryFunctions';

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
    store.dispatch(markUnavailable(missing.id));
    store.dispatch(addToHashMap({ ...deleted, isValid: false, deleted: true }));

    renderWithProviders(<FileList files={[missing, deleted]} />);

    expect(screen.getByRole('button', { name: 'Open Gone away' })).toBeInTheDocument();
    expect(screen.getByText('Not available on your node right now')).toBeInTheDocument();
    expect(screen.getByText('Deleted by its publisher')).toBeInTheDocument();
    expect(screen.getByText('Torq test')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open Torq test' })).not.toBeInTheDocument();
  });
});
