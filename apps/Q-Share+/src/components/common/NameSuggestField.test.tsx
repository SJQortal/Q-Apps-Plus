import { useState } from 'react';
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import { optionText } from '../../test/options';
import { fetchCallsMatching, mockFetch } from '../../test/setup';
import { resetNameSearchCache } from '../../utils/nameSearch';
import { NameSuggestField, suggestionListOffset } from './NameSuggestField';

const record = (name: string) => ({ name, owner: 'Qowner' });

function Field({ seen = [], onPick = () => {} }: { seen?: string[]; onPick?: (name: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <NameSuggestField
      label="Publisher"
      value={value}
      onChange={setValue}
      onPick={(name) => {
        setValue(name);
        onPick(name);
      }}
      seenNames={seen}
      listLabel="Suggested publishers"
    />
  );
}

const input = () => screen.getByRole('combobox', { name: 'Publisher' });
const type = (text: string) => fireEvent.change(input(), { target: { value: text } });
const options = () => screen.queryAllByRole('option');
const optionNames = () => options().map(optionText);
const queries = () => fetchCallsMatching('/names/search').map((u) => new URL(u, 'http://localhost').searchParams.get('query'));
const sleep = (ms: number) => act(() => new Promise((resolve) => setTimeout(resolve, ms)));

/**
 * An IntersectionObserver that reports nothing until the test scrolls
 * elements into view, as a browser would for rows below a popup's fold.
 */
function scrollableObserver() {
  const original = globalThis.IntersectionObserver;
  const watched: { target: Element; root: Element | Document | null; observer: ScrollObserver }[] = [];
  class ScrollObserver {
    readonly root: Element | Document | null;
    readonly rootMargin = '0px';
    readonly thresholds = [0];
    constructor(
      readonly callback: IntersectionObserverCallback,
      options: IntersectionObserverInit = {}
    ) {
      this.root = options.root ?? null;
    }
    observe(target: Element) {
      watched.push({ target, root: this.root, observer: this });
    }
    unobserve(target: Element) {
      this.drop((w) => w.target === target);
    }
    disconnect() {
      this.drop(() => true);
    }
    takeRecords() {
      return [];
    }
    private drop(test: (w: (typeof watched)[number]) => boolean) {
      for (let i = watched.length - 1; i >= 0; i--) if (watched[i].observer === this && test(watched[i])) watched.splice(i, 1);
    }
  }
  Object.defineProperty(globalThis, 'IntersectionObserver', { value: ScrollObserver, writable: true, configurable: true });
  onTestFinished(() => {
    Object.defineProperty(globalThis, 'IntersectionObserver', { value: original, writable: true, configurable: true });
  });
  return {
    roots: () => watched.map((w) => w.root),
    /** Everything inside `elements` scrolls into its root's view. */
    reveal: (elements: Element[]) =>
      act(() => {
        for (const w of [...watched]) {
          if (!elements.some((el) => el.contains(w.target))) continue;
          const entry = { target: w.target, isIntersecting: true, intersectionRatio: 1 } as unknown as IntersectionObserverEntry;
          w.observer.callback([entry], w.observer as unknown as IntersectionObserver);
        }
      }),
  };
}

const avatar = (option: Element) => option.querySelector('img');

describe('NameSuggestField', () => {
  beforeEach(() => resetNameSearchCache());

  it('waits for a pause in typing, then searches once for the last text', async () => {
    mockFetch('/names/search', (url) =>
      url.searchParams.get('prefix') === 'true' ? [record('Simon'), record('Simona')] : [record('Asimov'), record('Simon')]
    );
    renderWithProviders(<Field />);
    type('s');
    type('si');
    type('sim');
    await sleep(120);
    expect(queries()).toEqual([]);
    await waitFor(() => expect(optionNames()).toEqual(['Simon', 'Simona', 'Asimov']));
    expect(queries()).toEqual(['sim', 'sim']);
    expect(input()).toHaveAttribute('aria-expanded', 'true');
    expect(input()).toHaveAttribute('aria-controls', screen.getByRole('listbox', { name: 'Suggested publishers' }).id);
    expect(await screen.findByText('3 names suggested')).toBeInTheDocument();
  });

  it('shows each name with its avatar and the typed part highlighted, publishers seen in the list first after prefixes', async () => {
    mockFetch('/names/search', (url) =>
      url.searchParams.get('prefix') === 'true' ? [record('Simon James')] : [record('Simon James'), record('Qsimple'), record('Big Sims')]
    );
    renderWithProviders(<Field seen={['Big Sims', 'Other']} />);
    type('SIM');
    await waitFor(() => expect(options()).toHaveLength(3));
    expect(optionNames()).toEqual(['Simon James', 'Big SimsIn this list', 'Qsimple']);
    const first = options()[0];
    expect(first.querySelector('mark')).toHaveTextContent('Sim');
    // The initial shows until the avatar loads; it isn't part of the option's name.
    expect(screen.getByRole('option', { name: 'Simon James' })).toBe(first);
    expect(within(first).getByText('S')).toBeInTheDocument();
  });

  it('asks for an avatar only when its row scrolls into the list, async, and not again soon after a 404', async () => {
    const io = scrollableObserver();
    const names = ['Simon', 'Simona', 'Simone', 'Simba', 'Simeon', 'Simcha', 'Asimov', 'Big Sims'];
    mockFetch('/names/search', names.map(record));
    renderWithProviders(<Field />);
    type('sim');
    await waitFor(() => expect(options()).toHaveLength(8));
    const scroller = screen.getByRole('listbox').closest('.MuiPaper-root');

    // Nothing has scrolled into view yet: no avatar is asked for, only initials show.
    expect(options().map(avatar)).toEqual(Array(8).fill(null));
    // Each row watches the popup's own scrolling box, not the page.
    await waitFor(() => expect(io.roots()).toHaveLength(8));
    expect(io.roots().every((root) => root === scroller)).toBe(true);

    // The first three rows are in the list's view; the rest are below its fold.
    expect(optionNames()).toEqual(['Simba', 'Simon', 'Simcha', 'Simeon', 'Simona', 'Simone', 'Asimov', 'Big Sims']);
    io.reveal(options().slice(0, 3));
    expect(options().map((o) => avatar(o)?.getAttribute('src') ?? null)).toEqual([
      '/arbitrary/THUMBNAIL/Simba/qortal_avatar?async=true',
      '/arbitrary/THUMBNAIL/Simon/qortal_avatar?async=true',
      '/arbitrary/THUMBNAIL/Simcha/qortal_avatar?async=true',
      null,
      null,
      null,
      null,
      null,
    ]);

    // Loaded, the avatar covers the initial; a 404 leaves the initial.
    fireEvent.load(avatar(options()[0])!);
    expect(within(options()[0]).queryByText('S')).not.toBeInTheDocument();
    fireEvent.error(avatar(options()[1])!);
    expect(avatar(options()[1])).toBeNull();
    expect(within(options()[1]).getByText('S')).toBeInTheDocument();

    // Closed and opened again (new rows), everything in view: Simon's missing avatar isn't asked for again.
    fireEvent.keyDown(input(), { key: 'Escape' });
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    await waitFor(() => expect(io.roots()).toHaveLength(7));
    io.reveal(options());
    expect(avatar(screen.getByRole('option', { name: 'Simon' }))).toBeNull();
    expect(options().filter((o) => avatar(o) !== null)).toHaveLength(7);
  });

  it('moves with the arrow keys, picks with Enter, and Escape closes only the list', async () => {
    mockFetch('/names/search', [record('Alice'), record('Alicia'), record('Malice')]);
    const onPick = vi.fn();
    const outer = vi.fn();
    renderWithProviders(
      <div onKeyDown={(e) => outer(e.key)}>
        <Field onPick={onPick} />
      </div>
    );
    type('ali');
    await waitFor(() => expect(options()).toHaveLength(3));

    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    expect(input()).toHaveAttribute('aria-activedescendant', options()[1].id);
    expect(options()[1]).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(input(), { key: 'ArrowUp' });
    fireEvent.keyDown(input(), { key: 'ArrowUp' });
    // Back on the text as typed.
    expect(input()).not.toHaveAttribute('aria-activedescendant');

    // Escape closes the list and stops there (a sheet around the field stays open).
    fireEvent.keyDown(input(), { key: 'Escape' });
    expect(options()).toHaveLength(0);
    expect(input()).toHaveAttribute('aria-expanded', 'false');
    expect(outer).not.toHaveBeenCalledWith('Escape');
    fireEvent.keyDown(input(), { key: 'Escape' });
    expect(outer).toHaveBeenCalledWith('Escape');

    // Down opens it again from the cache, without a search.
    const searches = fetchCallsMatching('/names/search').length;
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    expect(options()).toHaveLength(3);
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    // Enter on a highlighted name picks it, and is not left to the form.
    const notPrevented = fireEvent.keyDown(input(), { key: 'Enter' });
    expect(notPrevented).toBe(false);
    expect(onPick).toHaveBeenCalledWith('Alicia');
    expect(input()).toHaveValue('Alicia');
    expect(options()).toHaveLength(0);
    expect(fetchCallsMatching('/names/search').length).toBe(searches);
  });

  it('leaves Enter to the form when no name is highlighted', async () => {
    mockFetch('/names/search', [record('Alice')]);
    const onPick = vi.fn();
    renderWithProviders(<Field onPick={onPick} />);
    type('ali');
    await waitFor(() => expect(options()).toHaveLength(1));
    expect(fireEvent.keyDown(input(), { key: 'Enter' })).toBe(true);
    expect(onPick).not.toHaveBeenCalled();
    expect(options()).toHaveLength(0);
  });

  it('picks a name on click or tap, keeping focus in the field', async () => {
    mockFetch('/names/search', [record('Bob'), record('Bobby')]);
    const onPick = vi.fn();
    renderWithProviders(<Field onPick={onPick} />);
    input().focus();
    type('bo');
    await waitFor(() => expect(options()).toHaveLength(2));
    const bobby = screen.getByRole('option', { name: 'Bobby' });
    // The list's mousedown is cancelled, so the field never blurs (and a phone keeps its keyboard).
    expect(fireEvent.mouseDown(bobby)).toBe(false);
    fireEvent.click(bobby);
    expect(onPick).toHaveBeenCalledWith('Bobby');
    expect(input()).toHaveValue('Bobby');
    expect(document.activeElement).toBe(input());
  });

  it('shows a clear button only with text, which empties the field, closes the list and keeps focus', async () => {
    mockFetch('/names/search', [record('Alice')]);
    renderWithProviders(<Field onPick={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Clear the name' })).toBeNull();
    input().focus();
    type('ali');
    await waitFor(() => expect(options()).toHaveLength(1));
    const clear = screen.getByRole('button', { name: 'Clear the name' });
    expect(fireEvent.mouseDown(clear)).toBe(false);
    fireEvent.click(clear);
    expect(input()).toHaveValue('');
    expect(options()).toHaveLength(0);
    expect(document.activeElement).toBe(input());
    expect(screen.queryByRole('button', { name: 'Clear the name' })).toBeNull();
  });

  it("drops an answer to text that was changed before it came", async () => {
    // Both of the "ab" searches (prefix and contains) wait until the test releases them.
    const releaseAb: ((names: unknown) => void)[] = [];
    mockFetch('/names/search', (url) => {
      if (url.searchParams.get('query') === 'ab') return new Promise((resolve) => releaseAb.push(resolve));
      return [record('abcd')];
    });
    renderWithProviders(<Field />);
    type('ab');
    await waitFor(() => expect(releaseAb).toHaveLength(2));
    type('abc');
    await waitFor(() => expect(optionNames()).toEqual(['abcd']));
    // The slow answer for "ab" lands last; one of its names would still match "abc".
    await act(async () => releaseAb.forEach((release) => release([record('abc-late')])));
    await sleep(20);
    expect(optionNames()).toEqual(['abcd']);
  });

  it('asks Core once per query for the session', async () => {
    mockFetch('/names/search', [record('Carol')]);
    renderWithProviders(<Field />);
    type('car');
    await waitFor(() => expect(optionNames()).toEqual(['Carol']));
    type('');
    type('CAR');
    // From the cache: at once, and no new search.
    expect(optionNames()).toEqual(['Carol']);
    await sleep(260);
    expect(queries()).toEqual(['car', 'car']);
  });

  it("sends names with '+', '&' and '#' to Core as typed", async () => {
    mockFetch('/names/search', [record('Q-Share+')]);
    renderWithProviders(<Field />);
    type('Q+&#');
    await waitFor(() => expect(queries()).toEqual(['Q+&#', 'Q+&#']));
    expect(fetchCallsMatching('/names/search')[0]).toContain('query=Q%2B%26%23');
  });

  it('with nothing typed, offers the publishers seen in the list without a search', async () => {
    mockFetch('/names/search', []);
    renderWithProviders(<Field seen={['Carol', 'dave']} />);
    fireEvent.click(input());
    expect(optionNames()).toEqual(['Carol', 'dave']);
    expect(screen.getByText('In this list')).toBeInTheDocument();
    await sleep(260);
    expect(queries()).toEqual([]);
  });

  it('keeps the list clear of the floating label when it opens above the field', () => {
    expect(suggestionListOffset({ placement: 'bottom-start' })).toEqual([0, 4]);
    // The outlined label sits about 10 px above the field's box.
    expect(suggestionListOffset({ placement: 'top-start' })[1]).toBeGreaterThanOrEqual(12);
  });

  it('says when no names match, and when the node could not be asked', async () => {
    let down = false;
    mockFetch('/names/search', () => {
      if (down) throw new Error('node down');
      return [];
    });
    renderWithProviders(<Field />);
    type('zzz');
    expect(await screen.findByText('Searching names…')).toBeInTheDocument();
    // In the popup, and read out by the status line.
    await waitFor(() => expect(screen.getAllByText('No names match')).toHaveLength(2));
    expect(screen.getByRole('status')).toHaveTextContent('No names match');
    expect(input()).toHaveAttribute('aria-expanded', 'false');
    down = true;
    type('zzzz');
    const failed = "Couldn't search names. Check that your node is running.";
    await waitFor(() => expect(screen.getAllByText(failed)).toHaveLength(2));
    // Blur closes it.
    fireEvent.blur(input());
    expect(screen.queryByText(failed)).not.toBeInTheDocument();
  });
});
