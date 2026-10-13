/**
 * The app's motion rules in index.css, read through jsdom's own cascade:
 * Settings → Motion → Reduce (and the system's reduced motion) cut every
 * animation and transition, delays included.
 *
 * jsdom treats `prefers-reduced-motion` as never matching, so the system
 * path is checked by comparing its rules with Reduce's.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
    const reduceRules = styleRules(rules).filter((r) =>
      r.selectorText.startsWith("html[data-motion='reduce']")
    );
    const systemRules = styleRules((media as CSSMediaRule).cssRules);
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
