/**
 * A status colour (the palette's warning, success or error) as text that
 * reads at 4.5:1 (DESIGN.md) on the page and on paper, in every theme and
 * mode. The kit sets success and error per theme, but warning is MUI's
 * default orange (3:1 on White's paper), and Hub 3.0 light's green reads at
 * 2.7:1 on its own. So: the palette's colour when it reads, else that colour
 * darkened (light themes) or lightened (dark ones) a step at a time, never
 * a colour of its own.
 */
import { darken, getContrastRatio, lighten, type Theme } from "@mui/material/styles";

export type StatusColor = "warning" | "success" | "error";

export function statusText(theme: Theme, status: StatusColor): string {
  const p = theme.palette;
  const reads = (color: string) => [p.background.default, p.background.paper].every((surface) => getContrastRatio(color, surface) >= 4.5);
  const base = p[status].main;
  for (let step = 0; step <= 10; step++) {
    const color = step === 0 ? base : p.mode === "dark" ? lighten(base, step / 10) : darken(base, step / 10);
    if (reads(color)) return color;
  }
  return p.text.primary;
}
