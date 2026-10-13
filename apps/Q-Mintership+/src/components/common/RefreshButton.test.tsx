/**
 * RefreshButton: the icon turns while the read a press started runs, at
 * least once a press, and rests on a whole turn; the page's own reads leave
 * it still; reduced motion keeps it still. jsdom runs no animations, so the
 * tests send the animation events a browser would.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getDefaultStore } from 'jotai';
import { HubThemeProvider } from '../../hub-theme';
import { themeConfig, THEME_STORAGE_KEY } from '../../theme/qplus-theme';
import { motionAtom } from '../../state/settings';
import { RefreshButton, RefreshIcon } from './RefreshButton';

afterEach(() => {
  act(() => getDefaultStore().set(motionAtom, 'system'));
});

function show(fetching: boolean, onClick = vi.fn(), label?: string) {
  const ui = (f: boolean) => (
    <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
      <RefreshButton onClick={onClick} fetching={f} label={label} />
    </HubThemeProvider>
  );
  const view = render(ui(fetching));
  return {
    onClick,
    setFetching: (f: boolean) => view.rerender(ui(f)),
    button: () => screen.getByRole('button', { name: label ?? 'Refresh' }),
  };
}

/** The element that turns. */
function icon(): HTMLElement {
  return document.querySelector('[data-turn], button > span[aria-hidden]') as HTMLElement;
}

/**
 * What a browser sends as a step ends. jsdom has no AnimationEvent, so React
 * listens for the prefixed name there; both are sent, React hears one.
 */
function send(el: Element, what: 'AnimationEnd' | 'AnimationIteration') {
  fireEvent(el, new Event(what.toLowerCase(), { bubbles: true }));
  fireEvent(el, new Event(`webkit${what}`, { bubbles: true }));
}

const turn = () => icon().getAttribute('data-turn');
const animation = () => getComputedStyle(icon()).getPropertyValue('animation');
const ended = () => send(icon(), 'AnimationEnd');
const looped = () => send(icon(), 'AnimationIteration');

describe('RefreshButton', () => {
  it('keeps its name, and says nothing more', async () => {
    const r = show(false, vi.fn(), 'Refresh nominations');
    expect(r.button()).toHaveAccessibleName('Refresh nominations');
    expect(r.button()).toHaveTextContent('');
    await userEvent.click(r.button());
    r.setFetching(true);
    expect(r.button()).toHaveAccessibleName('Refresh nominations');
    expect(r.button()).toBeEnabled();
    expect(r.button().querySelector('[role="status"], [aria-live]')).toBeNull();
  });

  it('turns once for a press whose read is instant, and comes to rest', async () => {
    const r = show(false);
    expect(turn()).toBeNull();
    await userEvent.click(r.button());
    expect(r.onClick).toHaveBeenCalledTimes(1);
    expect(turn()).toBe('start');
    ended();
    expect(turn()).toBe('stop');
    ended();
    expect(turn()).toBeNull();
  });

  it('keeps turning while the read runs, then settles on a whole turn', async () => {
    const r = show(false);
    await userEvent.click(r.button());
    // A half turn from rest, eased to meet the loop's speed.
    expect(animation()).toMatch(/ 450ms cubic-bezier\(0\.4, 0, 0\.6, 0\.4\) forwards$/);
    r.setFetching(true);
    ended();
    expect(turn()).toBe('loop');
    expect(animation()).toMatch(/ 600ms linear infinite$/);
    looped();
    looped();
    expect(turn()).toBe('loop');
    r.setFetching(false);
    // Still mid-turn: it finishes the turn it is on.
    expect(turn()).toBe('loop');
    looped();
    expect(turn()).toBe('stop');
    expect(animation()).toMatch(/ 450ms cubic-bezier\(0\.4, 0\.6, 0\.6, 1\) forwards$/);
    ended();
    expect(turn()).toBeNull();
    expect(animation()).toBe('none');
  });

  it("stays still for the page's own reads (its polls), while the reader is idle", () => {
    const r = show(false);
    r.setFetching(true);
    expect(turn()).toBeNull();
    expect(animation()).toBe('none');
    r.setFetching(false);
    expect(turn()).toBeNull();
  });

  it('comes to rest after a press even when a poll starts as it slows down', async () => {
    const r = show(false);
    await userEvent.click(r.button());
    ended();
    expect(turn()).toBe('stop');
    r.setFetching(true);
    ended();
    expect(turn()).toBeNull();
  });

  it('does nothing when pressed while the read runs', async () => {
    const r = show(true);
    await userEvent.click(r.button());
    expect(r.onClick).not.toHaveBeenCalled();
  });

  it('takes a press while the read runs when it reloads more than that read (Home)', async () => {
    const onClick = vi.fn();
    render(
      <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
        <RefreshButton onClick={onClick} fetching pressWhileFetching />
      </HubThemeProvider>
    );
    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    // The press turns it, and the read keeps it turning.
    expect(turn()).toBe('start');
    ended();
    expect(turn()).toBe('loop');
  });

  it('owes a press made while it slows down another turn', async () => {
    const r = show(false);
    await userEvent.click(r.button());
    ended();
    expect(turn()).toBe('stop');
    await userEvent.click(r.button());
    expect(r.onClick).toHaveBeenCalledTimes(2);
    ended();
    expect(turn()).toBe('start');
  });

  it('ignores animations that end inside it', async () => {
    const r = show(false);
    await userEvent.click(r.button());
    send(icon().querySelector('svg') as SVGElement, 'AnimationEnd');
    expect(turn()).toBe('start');
  });

  it("doesn't turn with reduced motion: the icon dims while it reads", async () => {
    act(() => getDefaultStore().set(motionAtom, 'reduce'));
    const r = show(false);
    await userEvent.click(r.button());
    expect(r.onClick).toHaveBeenCalledTimes(1);
    expect(turn()).toBeNull();
    expect(icon()).toHaveStyle({ animation: 'none', opacity: '1' });
    r.setFetching(true);
    expect(turn()).toBeNull();
    expect(icon()).toHaveStyle({ opacity: '0.6' });
    r.setFetching(false);
    expect(icon()).toHaveStyle({ opacity: '1' });
    // A poll, with no press: it stays as it is.
    r.setFetching(true);
    expect(icon()).toHaveStyle({ opacity: '1' });
  });
});

describe('RefreshIcon', () => {
  it('turns inside another button while busy ("Check again")', () => {
    const ui = (busy: boolean) => (
      <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
        <RefreshIcon busy={busy} />
      </HubThemeProvider>
    );
    const view = render(ui(false));
    const el = view.container.querySelector('span[aria-hidden]') as HTMLElement;
    expect(el.getAttribute('data-turn')).toBeNull();
    view.rerender(ui(true));
    expect(el.getAttribute('data-turn')).toBe('start');
    view.rerender(ui(false));
    send(el, 'AnimationEnd');
    send(el, 'AnimationEnd');
    expect(el.getAttribute('data-turn')).toBeNull();
  });
});
