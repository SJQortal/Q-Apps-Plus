import { decomposeColor, getContrastRatio, recomposeColor } from "@mui/material/styles";

/** How strongly a hero takes a colour, strongest first. */
const WASH_STRENGTHS = [0.6, 0.5, 0.4, 0.3, 0.2, 0.12];
const MIN_CONTRAST = 4.5;
/** The canvas a picture is shrunk to for its average: small is enough, and quick. */
const SAMPLE_SIZE = 16;

/** `color` at `amount` over a solid `base`, as one solid colour. */
function mix(color: string, base: string, amount: number): string {
  const c = decomposeColor(color);
  const b = decomposeColor(base);
  const values = [0, 1, 2].map((i) => Math.round(c.values[i] * amount + b.values[i] * (1 - amount)));
  return recomposeColor({ type: "rgb", values: [values[0], values[1], values[2]] });
}

/** A text colour with its own alpha, as it really looks on `base`. */
function onBase(text: string, base: string): string {
  return mix(text, base, decomposeColor(text).values[3] ?? 1);
}

/**
 * The hero's colour: `tint` over the page's `base`, as strong as it can be
 * while every one of `texts` still reads at 4.5:1 on it (or as well as it
 * does on the page, in a theme where it is already lower). Null when even the
 * faintest wash would cost contrast, or a colour can't be read: then the hero
 * has no wash at all.
 */
export function heroWash(tint: string, base: string, texts: string[]): string | null {
  try {
    for (const strength of WASH_STRENGTHS) {
      const wash = mix(tint, base, strength);
      const readable = texts.every((text) => {
        const onPage = getContrastRatio(onBase(text, base), base);
        return getContrastRatio(onBase(text, wash), wash) >= Math.min(MIN_CONTRAST, onPage);
      });
      if (readable) return wash;
    }
  } catch {
    // A colour MUI can't take apart (a CSS variable, say).
  }
  return null;
}

/** The average of RGBA pixels as a CSS colour, leaving out see-through ones; null when there are none. */
export function averageColor(data: ArrayLike<number>): string | null {
  let red = 0;
  let green = 0;
  let blue = 0;
  let count = 0;
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    red += data[i];
    green += data[i + 1];
    blue += data[i + 2];
    count += 1;
  }
  if (count === 0) return null;
  return recomposeColor({ type: "rgb", values: [Math.round(red / count), Math.round(green / count), Math.round(blue / count)] });
}

/**
 * A loaded picture's average colour, from the copy the browser already holds:
 * no request. Null when the canvas refuses it (a picture from another origin).
 */
export function readImageTint(image: HTMLImageElement): string | null {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = SAMPLE_SIZE;
    canvas.height = SAMPLE_SIZE;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(image, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    return averageColor(context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data);
  } catch {
    return null;
  }
}
