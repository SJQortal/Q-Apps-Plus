/**
 * Each coin's colour on the Trades tab, so a coin is the same colour in
 * every bar, chart and key: Litecoin blue, Bitcoin orange, DigiByte aqua,
 * Dogecoin yellow, Ravencoin magenta, Pirate Chain green. A categorical
 * palette checked for colour blindness, likeness and contrast (the dataviz
 * palette validator) on all four themes' surfaces, stepped for the theme's
 * light and dark modes, and written as OKLCH: lightness, chroma, hue. Parts
 * of a bar go in TRADE_CHAINS order, the order it was checked in, so
 * neighbours stay apart. Text never wears these colours: a key beside them
 * names each coin.
 */
import type { Theme } from '@mui/material/styles';
import type { TradeChain } from '../../rules/explorer/portalTrades';

type Oklch = readonly [lightness: number, chroma: number, hue: number];

const SLOTS: Record<TradeChain, { light: Oklch; dark: Oklch }> = {
  LITECOIN: { light: [0.575, 0.163, 255.5], dark: [0.622, 0.161, 255.1] },
  BITCOIN: { light: [0.671, 0.175, 40.6], dark: [0.622, 0.173, 40.1] },
  DIGIBYTE: { light: [0.669, 0.141, 162.1], dark: [0.621, 0.128, 163.1] },
  DOGECOIN: { light: [0.764, 0.161, 75.1], dark: [0.67, 0.143, 73.2] },
  RAVENCOIN: { light: [0.716, 0.141, 357.4], dark: [0.622, 0.171, 0.8] },
  PIRATECHAIN: { light: [0.529, 0.18, 142.5], dark: [0.529, 0.18, 142.5] },
};

const toSrgb = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

/** OKLCH to sRGB channels (0–1), or null outside sRGB. */
function toRgb([l, c, h]: Oklch): [number, number, number] | null {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const lms = [
    (l + 0.3963377774 * a + 0.2158037573 * b) ** 3,
    (l - 0.1055613458 * a - 0.0638541728 * b) ** 3,
    (l - 0.0894841775 * a - 1.291485548 * b) ** 3,
  ];
  const rgb = [
    4.0767416621 * lms[0] - 3.3077115913 * lms[1] + 0.2309699292 * lms[2],
    -1.2684380046 * lms[0] + 2.6097574011 * lms[1] - 0.3413193965 * lms[2],
    -0.0041960863 * lms[0] - 0.7034186147 * lms[1] + 1.707614701 * lms[2],
  ].map(toSrgb) as [number, number, number];
  return rgb.every((v) => v >= -0.001 && v <= 1.001) ? rgb : null;
}

/** As an `rgb()` colour, its chroma eased until it fits sRGB. */
function rgbOf([l, c, h]: Oklch): string {
  for (let chroma = c; chroma > 0; chroma -= 0.005) {
    const rgb = toRgb([l, chroma, h]);
    if (rgb) {
      const [r, g, b] = rgb.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255));
      return `rgb(${r}, ${g}, ${b})`;
    }
  }
  const grey = Math.round(Math.min(1, Math.max(0, toSrgb(l ** 3))) * 255);
  return `rgb(${grey}, ${grey}, ${grey})`;
}

const cache = new Map<string, string>();

export function coinAccent(theme: Theme, chain: TradeChain): string {
  const mode = theme.palette.mode === 'dark' ? 'dark' : 'light';
  const key = `${mode}:${chain}`;
  let colour = cache.get(key);
  if (!colour) {
    colour = rgbOf(SLOTS[chain][mode]);
    cache.set(key, colour);
  }
  return colour;
}
