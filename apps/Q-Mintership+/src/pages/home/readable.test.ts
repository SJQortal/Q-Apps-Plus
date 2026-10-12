import { describe, expect, it } from 'vitest';
import { createTheme, getContrastRatio } from '@mui/material/styles';
import { readablePrimary, readableSuccess } from './readable';

describe('readable accents', () => {
  it('keeps an accent that already reads well on the card', () => {
    const theme = createTheme({
      palette: { background: { paper: '#ffffff' }, primary: { main: '#0b57d0' } },
    });
    expect(readablePrimary(theme)).toBe('#0b57d0');
  });

  it('falls back to a darker shade, then to the text colour, below 4.5:1', () => {
    const teal = createTheme({
      palette: {
        background: { paper: '#ffffff' },
        primary: { main: '#1f8f82', dark: '#15665d' },
      },
    });
    expect(readablePrimary(teal)).toBe('#15665d');
    const pale = createTheme({
      palette: {
        background: { paper: '#f6f2ea' },
        success: { main: '#5eb049', dark: '#6cbf57' },
        text: { primary: '#1d1f27' },
      },
    });
    expect(readableSuccess(pale)).toBe('#1d1f27');
    expect(getContrastRatio(readableSuccess(pale), '#f6f2ea')).toBeGreaterThanOrEqual(4.5);
  });
});
