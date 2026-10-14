import { afterEach, describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { isTypingIn, useKeyboardOpen } from './hubFrame';

function Probe() {
  return (
    <>
      <input aria-label="Search" />
      <input type="checkbox" aria-label="Hide" />
      <p>{useKeyboardOpen() ? 'keyboard' : 'no keyboard'}</p>
    </>
  );
}

const size = (width: number, height: number) =>
  act(() => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
    window.dispatchEvent(new Event('resize'));
  });

afterEach(() => size(1024, 768));

describe('useKeyboardOpen', () => {
  it('is open only while a text field has focus and the frame shrank well below its tallest', async () => {
    await size(392, 832);
    render(<Probe />);
    // GO's own bars come back: 832 to 717 is no keyboard.
    await size(392, 717);
    act(() => screen.getByLabelText('Search').focus());
    expect(screen.getByText('no keyboard')).toBeInTheDocument();
    // The keyboard opens: GO resizes the frame to 505.
    await size(392, 505);
    expect(screen.getByText('keyboard')).toBeInTheDocument();
    // A checkbox brings up no keyboard.
    act(() => screen.getByLabelText('Hide').focus());
    expect(screen.getByText('no keyboard')).toBeInTheDocument();
    act(() => screen.getByLabelText('Search').focus());
    expect(screen.getByText('keyboard')).toBeInTheDocument();
    // Closed again.
    await size(392, 832);
    expect(screen.getByText('no keyboard')).toBeInTheDocument();
  });

  it('starts again from the new size when the width changes (the phone turned)', async () => {
    await size(392, 832);
    render(<Probe />);
    act(() => screen.getByLabelText('Search').focus());
    await size(844, 390);
    expect(screen.getByText('no keyboard')).toBeInTheDocument();
  });
});

describe('isTypingIn', () => {
  it('knows which fields bring up a keyboard', () => {
    const make = (html: string) => {
      const box = document.createElement('div');
      box.innerHTML = html;
      return box.firstElementChild;
    };
    expect(isTypingIn(make('<input>'))).toBe(true);
    expect(isTypingIn(make('<input type="search">'))).toBe(true);
    expect(isTypingIn(make('<textarea></textarea>'))).toBe(true);
    expect(isTypingIn(make('<input type="checkbox">'))).toBe(false);
    expect(isTypingIn(make('<button>Go</button>'))).toBe(false);
    expect(isTypingIn(null)).toBe(false);
  });
});
