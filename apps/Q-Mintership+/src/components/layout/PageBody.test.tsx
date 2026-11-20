import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { getDefaultStore } from 'jotai';
import { pageWidthAtom } from '../../state/settings';
import { PageBody } from './PageBody';
import { Section } from '../common/Section';
import { CARD_COLUMN, SECTION_COLUMN } from './flowColumns';
import { fullWindowMaxWidth } from '../../test/fullWindow';

const store = getDefaultStore();
afterEach(() => store.set(pageWidthAtom, 'comfortable'));

const styleOf = (testId: string) => getComputedStyle(screen.getByTestId(testId));

const fullOf = (testId: string) => fullWindowMaxWidth(screen.getByTestId(testId));

function Pages() {
  return (
    <>
      <PageBody data-testid="list" />
      <PageBody data-testid="wide" $maxWidth={960} />
      <PageBody data-testid="form" $form />
      <PageBody data-testid="sections" $flow={SECTION_COLUMN} />
    </>
  );
}

describe('PageBody: Page width (crowetic, 2026-10-23)', () => {
  it('Comfortable keeps each page in its centred column', () => {
    render(<Pages />);
    expect(styleOf('list').maxWidth).toBe('760px');
    expect(styleOf('wide').maxWidth).toBe('960px');
    expect(styleOf('form').maxWidth).toBe('680px');
    expect(styleOf('list').marginLeft).toBe('auto');
    expect(fullOf('list')).toBeNull();
    expect(fullOf('wide')).toBeNull();
  });

  it('Full window spans the window, but a form and a phone held sideways keep their width', () => {
    store.set(pageWidthAtom, 'full');
    render(<Pages />);
    expect(fullOf('list')).toBe('none');
    expect(fullOf('wide')).toBe('none');
    expect(fullOf('form')).toBeNull();
    // A phone held sideways (under 500 px tall) keeps its column: the rule is only for taller frames.
    expect(styleOf('list').maxWidth).toBe('760px');
    expect(styleOf('form').maxWidth).toBe('680px');
  });

  it('flows its sections into as many columns as fit, one when only one does', () => {
    render(<Pages />);
    expect(styleOf('sections').display).toBe('grid');
    expect(styleOf('sections').gridTemplateColumns).toBe(
      `repeat(auto-fill, minmax(min(100%, ${SECTION_COLUMN}px), 1fr))`
    );
    // A page without $flow stays the list it was.
    expect(styleOf('list').display).toBe('flex');
  });

  it('a flowing Section puts its cards side by side and spans everything else across', () => {
    render(
      <Section title="Add to MINTER" id="add" flow={CARD_COLUMN}>
        <p data-testid="note">Two waiting.</p>
        <article data-testid="card" aria-label="One" />
        <article aria-label="Two" />
      </Section>
    );
    const section = screen.getByRole('region', { name: 'Add to MINTER' });
    expect(getComputedStyle(section).display).toBe('grid');
    expect(getComputedStyle(section).gridTemplateColumns).toBe(
      `repeat(auto-fill, minmax(min(100%, ${CARD_COLUMN}px), 1fr))`
    );
    expect(styleOf('note').gridColumn.replace(/\s/g, '')).toBe('1/-1');
    expect(styleOf('card').gridColumn).toBe('');
  });
});
