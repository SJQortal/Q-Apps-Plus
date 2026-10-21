import { describe, expect, it } from 'vitest';
import { alpha, decomposeColor, getContrastRatio } from '@mui/material/styles';
import { createAppTheme } from '../../hub-theme';
import { themeConfig } from '../../theme/qplus-theme';
import { DECISION_GROUPS } from './decisionGroups';
import { sectionAccent, withHue, type SectionAccent } from './sectionAccents';

const COLOURED: SectionAccent[] = [
  ...DECISION_GROUPS.map((g) => g.key).filter((k) => k !== 'other'),
  'waiting',
  'polls',
];

/** A colour over a solid background, flattened (as a tinted section paints it). */
function over(colour: string, amount: number, background: string): string {
  const [r, g, b] = decomposeColor(colour).values;
  const [br, bg, bb] = decomposeColor(background).values;
  const mix = (c: number, d: number) => Math.round(c * amount + d * (1 - amount));
  return `rgb(${mix(r, br)}, ${mix(g, bg)}, ${mix(b, bb)})`;
}

describe('Decisions: section accents', () => {
  it('turns a colour to another hue, keeping its saturation and lightness', () => {
    expect(withHue('rgb(255, 0, 0)', 120)).toBe('rgb(0, 255, 0)');
    expect(withHue('#29b6f6', 285)).toMatch(/^rgb\(/);
    // Grey has no hue to turn.
    expect(withHue('rgb(128, 128, 128)', 200)).toBe('rgb(128, 128, 128)');
  });

  it('gives each coloured section its own colour, in every theme and mode', () => {
    for (const id of ['hub30', 'hub20', 'black', 'white'] as const) {
      for (const mode of ['light', 'dark'] as const) {
        const theme = createAppTheme(id, mode, themeConfig);
        const colours = COLOURED.map((key) => sectionAccent(theme, key));
        expect(new Set(colours).size, `${id} ${mode}`).toBe(COLOURED.length);
        // The rest share the theme's secondary text colour.
        expect(sectionAccent(theme, 'neutral')).toBe(theme.palette.text.secondary);
        expect(sectionAccent(theme, 'other')).toBe(theme.palette.text.secondary);
      }
    }
  });

  it('keeps text on a tinted section at 4.5:1', () => {
    for (const id of ['hub30', 'hub20', 'black', 'white'] as const) {
      for (const mode of ['light', 'dark'] as const) {
        const theme = createAppTheme(id, mode, themeConfig);
        const page = theme.palette.background.default;
        for (const key of [...COLOURED, 'neutral'] as SectionAccent[]) {
          const tint = over(sectionAccent(theme, key), mode === 'dark' ? 0.09 : 0.07, page);
          for (const text of [theme.palette.text.primary, theme.palette.text.secondary])
            expect(getContrastRatio(text, tint), `${id} ${mode} ${key}`).toBeGreaterThanOrEqual(
              4.5
            );
        }
      }
    }
    // alpha() parses the accents as colours.
    expect(alpha(withHue('#0288d1', 45), 0.1)).toMatch(/^rgba\(/);
  });
});
