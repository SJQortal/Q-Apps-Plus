import { describe, expect, it } from 'vitest';
import { createTheme, decomposeColor, getContrastRatio } from '@mui/material/styles';
import { createAppTheme } from '../hub-theme';
import { themeConfig } from '../theme/qplus-theme';
import { readableColor, readableOn, readableTone, type Tone } from './readable';

const TONES: Tone[] = ['primary', 'secondary', 'success', 'warning', 'error', 'info'];

function surfacesOf(theme: ReturnType<typeof createTheme>) {
  const b = theme.palette.background;
  return [b.paper, b.default, b.surface, b.elevated].filter(Boolean) as string[];
}

describe('readable text colours', () => {
  it('keeps a colour that already reads well', () => {
    const theme = createTheme({
      palette: {
        background: { paper: '#ffffff', default: '#ffffff' },
        primary: { main: '#0b57d0' },
      },
    });
    expect(readableTone(theme, 'primary')).toBe('#0b57d0');
  });

  it('darkens a pale accent on light surfaces, keeping its hue', () => {
    const theme = createTheme({
      palette: { background: { paper: '#f6f2ea', default: '#ddd6ca' } },
    });
    const green = 'rgb(94, 176, 73)';
    const shown = readableColor(theme, green);
    expect(shown).not.toBe(green);
    for (const bg of ['#f6f2ea', '#ddd6ca']) {
      expect(getContrastRatio(shown, bg)).toBeGreaterThanOrEqual(4.5);
    }
    const [r, g, b] = decomposeColor(shown).values;
    expect(g).toBeGreaterThan(r);
    expect(g).toBeGreaterThan(b);
  });

  it('lightens a deep accent on dark surfaces', () => {
    const theme = createTheme({
      palette: { mode: 'dark', background: { paper: '#000000', default: '#000000' } },
    });
    const shown = readableColor(theme, '#9e2b2b');
    expect(getContrastRatio(shown, '#000000')).toBeGreaterThanOrEqual(4.5);
  });

  it('reads at 4.5:1 for every tone in every theme and mode', () => {
    for (const id of ['hub30', 'hub20', 'black', 'white'] as const) {
      for (const mode of ['light', 'dark'] as const) {
        const theme = createAppTheme(id, mode, themeConfig);
        for (const tone of TONES) {
          const shown = readableTone(theme, tone);
          for (const bg of surfacesOf(theme)) {
            expect(
              getContrastRatio(shown, bg),
              `${tone} on ${bg} in ${id}/${mode}`
            ).toBeGreaterThanOrEqual(4.5);
          }
        }
      }
    }
  });
});

describe('readable text on a wash of its own colour (a tinted chip)', () => {
  /** `colour` over `background` at `amount`, as the chip shows it. */
  const over = (background: string, colour: string, amount: number) => {
    const bg = decomposeColor(background).values;
    const fg = decomposeColor(colour).values;
    return `rgb(${[0, 1, 2].map((i) => Math.round(bg[i] * (1 - amount) + fg[i] * amount)).join(', ')})`;
  };

  it('reads at 4.5:1 on the wash over every surface, in every theme', () => {
    for (const id of ['hub30', 'hub20', 'black', 'white'] as const) {
      for (const mode of ['light', 'dark'] as const) {
        const theme = createAppTheme(id, mode, themeConfig);
        for (const tone of TONES) {
          const colour = theme.palette[tone].main;
          for (const wash of [0.12, 0.16, 0.32]) {
            const shown = readableOn(theme, colour, wash);
            for (const bg of surfacesOf(theme))
              expect(getContrastRatio(shown, over(bg, colour, wash))).toBeGreaterThanOrEqual(4.5);
          }
        }
      }
    }
  });
});
