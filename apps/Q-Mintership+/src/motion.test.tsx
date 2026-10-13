/**
 * The app's motion rules in index.css, read through jsdom's own cascade:
 * Settings → Motion → Reduce (and the system's reduced motion) cut every
 * animation and transition, delays included; content fades in as it
 * arrives, with nothing that moves the layout.
 *
 * jsdom treats `prefers-reduced-motion` as never matching, so the system
 * path is checked by comparing its rules with Reduce's.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button, Chip, IconButton, Switch, ToggleButton } from '@mui/material';
import { CopyLinkButton } from './components/common/CopyLinkButton';
import { ResponsiveDialog } from './components/common/ResponsiveDialog';
import { Section } from './components/common/Section';
import { AnswerChip, DoneChip } from './components/decision/DecisionParts';
import { EmptyState } from './components/common/states';
import { PageBody } from './components/layout/PageBody';
import css from './index.css?raw';

let sheet: HTMLStyleElement;

beforeEach(() => {
  sheet = document.createElement('style');
  sheet.textContent = css;
  document.head.appendChild(sheet);
});

afterEach(() => {
  sheet.remove();
  document.documentElement.removeAttribute('data-motion');
});

function moving(): HTMLElement {
  const el = document.createElement('div');
  el.style.setProperty('animation-name', 'spin');
  el.style.setProperty('animation-duration', '500ms');
  el.style.setProperty('animation-delay', '90ms');
  el.style.setProperty('transition-duration', '300ms');
  el.style.setProperty('transition-delay', '50ms');
  document.body.appendChild(el);
  return el;
}

function timing(el: Element) {
  const s = getComputedStyle(el);
  return {
    animation: s.getPropertyValue('animation-duration'),
    animationDelay: s.getPropertyValue('animation-delay'),
    transition: s.getPropertyValue('transition-duration'),
    transitionDelay: s.getPropertyValue('transition-delay'),
  };
}

describe('reduced motion', () => {
  it('Motion → Reduce cuts every animation and transition, delays included', () => {
    const el = moving();
    document.documentElement.setAttribute('data-motion', 'reduce');
    expect(timing(el)).toEqual({
      animation: '0.01ms',
      animationDelay: '0s',
      transition: '0.01ms',
      transitionDelay: '0s',
    });
  });

  it('leaves motion alone on Full, and when the system asks for nothing', () => {
    const el = moving();
    const own = {
      animation: '500ms',
      animationDelay: '90ms',
      transition: '300ms',
      transitionDelay: '50ms',
    };
    expect(timing(el)).toEqual(own);
    document.documentElement.setAttribute('data-motion', 'full');
    expect(timing(el)).toEqual(own);
  });

  it('cuts the same things when the system asks for reduced motion', () => {
    const rules = [...(sheet.sheet?.cssRules ?? [])];
    const media = rules.find(
      (r): r is CSSMediaRule =>
        r instanceof CSSMediaRule && r.media.mediaText.includes('prefers-reduced-motion: reduce')
    );
    expect(media).toBeDefined();
    const styleRules = (within: CSSRuleList | CSSRule[]) =>
      [...within].filter((r): r is CSSStyleRule => r instanceof CSSStyleRule);
    // The rules that cut animations (others under the same conditions set variables).
    const cuts = (r: CSSStyleRule) => r.style.getPropertyValue('animation-duration') !== '';
    const reduceRules = styleRules(rules).filter(
      (r) => r.selectorText.startsWith("html[data-motion='reduce']") && cuts(r)
    );
    const systemRules = styleRules((media as CSSMediaRule).cssRules).filter(cuts);
    const reduce = reduceRules[0]?.style.cssText;
    expect(reduce).toMatch(/animation-delay: 0s !important/);
    // Elements, then their ::before and ::after, in both.
    expect(reduceRules.map((r) => r.selectorText)).toEqual([
      expect.stringMatching(/\*$/),
      expect.stringMatching(/::before[^]*::after/),
    ]);
    expect(systemRules.map((r) => r.selectorText)).toEqual([
      expect.stringMatching(/^html:not\(\[data-motion='full'\]\) \*$/),
      expect.stringMatching(/::before[^]*::after/),
    ]);
    for (const rule of [...reduceRules, ...systemRules]) expect(rule.style.cssText).toBe(reduce);
  });
});

function animation(el: Element) {
  const s = getComputedStyle(el);
  return {
    name: s.getPropertyValue('animation-name'),
    duration: s.getPropertyValue('animation-duration'),
    delay: s.getPropertyValue('animation-delay'),
  };
}

function page() {
  const rows = Array.from({ length: 8 }, (_, i) => <li key={i}>Row {i + 1}</li>);
  return render(
    <PageBody>
      <p>A block</p>
      <Section title="Open nominations" id="open">
        <ul aria-label="Rows">{rows}</ul>
      </Section>
    </PageBody>
  );
}

describe('content arriving', () => {
  it('fades a page’s blocks in with a 4 px rise, and a section’s content with a fade', () => {
    page();
    expect(animation(screen.getByText('A block'))).toMatchObject({
      name: 'qmp-rise-in',
      duration: '240ms',
    });
    expect(animation(screen.getByRole('list', { name: 'Rows' }))).toMatchObject({
      name: 'qmp-fade-in',
      duration: '200ms',
    });
    // The section rises with the page; its title row, list and rows only fade.
    expect(animation(screen.getByRole('region', { name: 'Open nominations' })).name).toBe(
      'qmp-rise-in'
    );
  });

  it('brings a list’s first six rows one after another, and the rest with the list', () => {
    page();
    const rows = screen.getAllByRole('listitem');
    expect(rows.slice(0, 6).map((r) => animation(r).delay)).toEqual([
      '',
      '30ms',
      '60ms',
      '90ms',
      '120ms',
      '150ms',
    ]);
    expect(rows.slice(0, 6).every((r) => animation(r).name === 'qmp-fade-in')).toBe(true);
    expect(rows.slice(6).map((r) => animation(r).name)).toEqual(['none', 'none']);
  });

  it('moves only what is new: a refresh keeps the elements on screen', () => {
    const view = page();
    const block = screen.getByText('A block');
    const row = screen.getAllByRole('listitem')[0];
    view.rerender(
      <PageBody>
        <p>A block</p>
        <Section title="Open nominations" id="open">
          <ul aria-label="Rows">
            {Array.from({ length: 8 }, (_, i) => (
              <li key={i}>Row {i + 1}, refreshed</li>
            ))}
          </ul>
        </Section>
      </PageBody>
    );
    // The same nodes: their animations ran once, when they were inserted.
    expect(screen.getByText('A block')).toBe(block);
    expect(screen.getAllByRole('listitem')[0]).toBe(row);
  });

  it('fades an empty state in where it appears', () => {
    render(<EmptyState title="Nothing here" />);
    expect(animation(screen.getByRole('status')).name).toBe('qmp-fade-in');
  });

  it('is cut by Motion → Reduce, delays included', () => {
    page();
    document.documentElement.setAttribute('data-motion', 'reduce');
    const sixth = screen.getAllByRole('listitem')[5];
    expect(animation(sixth)).toEqual({ name: 'qmp-fade-in', duration: '0.01ms', delay: '0s' });
    expect(animation(screen.getByText('A block')).duration).toBe('0.01ms');
  });

  it('animates only opacity, translate and scale, so nothing shifts the layout', () => {
    const keyframes = [...(sheet.sheet?.cssRules ?? [])].filter(
      (r): r is CSSKeyframesRule => 'name' in r && String(r.name).startsWith('qmp-')
    );
    expect(keyframes.map((k) => k.name)).toEqual([
      'qmp-fade-in',
      'qmp-rise-in',
      'qmp-pop-in',
      'qmp-dialog-in',
      'qmp-sheet-in',
    ]);
    for (const k of keyframes) {
      for (const frame of [...k.cssRules] as CSSKeyframeRule[]) {
        const props = Array.from({ length: frame.style.length }, (_, i) => frame.style.item(i));
        expect(props.every((p) => ['opacity', 'translate', 'scale'].includes(p))).toBe(true);
      }
    }
  });
});

describe('press', () => {
  const press = () =>
    getComputedStyle(document.documentElement).getPropertyValue('--qmp-press').trim();

  it('buttons, icon buttons and clickable chips give a little as they are pressed', () => {
    const rules = [...(sheet.sheet?.cssRules ?? [])].filter(
      (r): r is CSSStyleRule => r instanceof CSSStyleRule && r.selectorText.endsWith(':active')
    );
    expect(rules.map((r) => r.style.getPropertyValue('scale'))).toEqual([
      'var(--qmp-press)',
      'var(--qmp-press-icon)',
    ]);
    expect(press()).toBe('0.98');
    render(
      <>
        <Button>Sign</Button>
        <IconButton aria-label="Back">←</IconButton>
        <Chip label="Open" onClick={() => {}} />
        <Switch slotProps={{ input: { 'aria-label': 'Celebrate' } }} />
        <ToggleButton value="all">All</ToggleButton>
      </>
    );
    const eases = (el: Element) =>
      getComputedStyle(el).getPropertyValue('transition-property').includes('scale');
    expect(eases(screen.getByRole('button', { name: 'Sign' }))).toBe(true);
    expect(eases(screen.getByRole('button', { name: 'Back' }))).toBe(true);
    expect(eases(screen.getByRole('button', { name: 'Open' }))).toBe(true);
    // Switches and toggles keep MUI's own feel.
    expect(eases(screen.getByRole('switch').closest('.MuiButtonBase-root') as Element)).toBe(false);
    expect(eases(screen.getByRole('button', { name: 'All' }))).toBe(false);
  });

  it('stays still with Motion → Reduce, and presses on Full', () => {
    document.documentElement.setAttribute('data-motion', 'reduce');
    expect(press()).toBe('1');
    document.documentElement.setAttribute('data-motion', 'full');
    expect(press()).toBe('0.98');
  });
});

describe('small things that turn up', () => {
  it('pops the Copy link tick in', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    render(<CopyLinkButton path="/decisions" what="the decisions" variant="text" />);
    const button = screen.getByRole('button', { name: 'Copy link to the decisions' });
    expect(animation(button.querySelector('svg') as Element).name).toBe('none');
    await userEvent.click(button);
    const tick = await screen.findByTestId('CheckOutlinedIcon');
    expect(animation(tick)).toMatchObject({ name: 'qmp-pop-in', duration: '180ms' });
    document.documentElement.setAttribute('data-motion', 'reduce');
    expect(animation(tick).duration).toBe('0.01ms');
  });

  it('pops an answer’s chip in, and settles it in place', () => {
    const view = render(<DoneChip label="Signed ✓ (confirming…)" settled={false} />);
    const chip = screen.getByText('Signed ✓ (confirming…)').closest('.MuiChip-root') as Element;
    expect(animation(chip).name).toBe('qmp-pop-in');
    view.rerender(<DoneChip label="Signed ✓" settled />);
    // The same chip, recoloured: it doesn't pop again.
    expect(screen.getByText('Signed ✓').closest('.MuiChip-root')).toBe(chip);
    view.rerender(
      <AnswerChip view={{ shown: 'rejected', settled: false, label: 'Rejected (confirming…)' }} />
    );
    const rejected = screen.getByText('Rejected (confirming…)').closest('.MuiChip-root');
    expect(animation(rejected as Element).name).toBe('qmp-pop-in');
  });
});

describe('dialogs', () => {
  it('ease in as MUI fades them in: a slight rise and growth', async () => {
    render(
      <ResponsiveDialog open title="Sign">
        Body
      </ResponsiveDialog>
    );
    const paper = (await screen.findByRole('dialog', { name: 'Sign' })) as Element;
    expect(animation(paper)).toMatchObject({ name: 'qmp-dialog-in', duration: '225ms' });
  });

  it('rise a little further where they fill the screen (phones)', async () => {
    render(
      <ResponsiveDialog open fullScreen title="Sign">
        Body
      </ResponsiveDialog>
    );
    const paper = (await screen.findByRole('dialog', { name: 'Sign' })) as Element;
    expect(animation(paper).name).toBe('qmp-sheet-in');
    document.documentElement.setAttribute('data-motion', 'reduce');
    expect(animation(paper).duration).toBe('0.01ms');
  });
});
