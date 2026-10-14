import { useMemo, type ReactNode } from 'react';
import { alpha, createTheme, ThemeProvider, useTheme } from '@mui/material/styles';

/**
 * Q-Tube's components read four palette keys MUI does not have:
 * `background.paper2`, `background.unSelected`, `text.tertiary` and
 * `superlike.main`. Q-Tube Classic defines them itself; for Hub 3.0, Black
 * and White this fills them in from the kit's palette, so every screen works
 * in all four themes without touching the kit (theme kit follow-up: let apps
 * pass extra palette keys to the shared themes).
 */
export function PaletteExtender({ children }: { children: ReactNode }) {
  const base = useTheme();
  const theme = useMemo(() => {
    const p = base.palette;
    const complete =
      p.background.paper2 && p.background.unSelected && p.text.tertiary && p.superlike?.main;
    if (complete) return base;
    const dark = p.mode === 'dark';
    return createTheme(base, {
      palette: {
        background: {
          paper2: p.background.paper2 ?? p.background.surface ?? p.background.paper,
          unSelected: p.background.unSelected ?? p.background.elevated ?? p.background.paper,
        },
        text: { tertiary: p.text.tertiary ?? alpha(p.text.secondary, 0.72) },
        // Super likes are gold in every theme; the shade follows the mode.
        superlike: p.superlike ?? { main: dark ? '#FFD700' : '#B8860B' },
      },
    });
  }, [base]);
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}
