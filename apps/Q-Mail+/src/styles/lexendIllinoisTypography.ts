// Q-Mail Classic's Roboto: Latin + Latin Extended subsets in WOFF2, the two
// weights the theme uses (fonts/LICENSE-Roboto.txt). 57 kB instead of the
// 337 kB TTF pair.
import robotoRegularWoff2Url from './fonts/Roboto-Regular.woff2'
import robotoMediumWoff2Url from './fonts/Roboto-Medium.woff2'

/** What the subsets cover; text outside it falls back to the system stack. */
const ROBOTO_UNICODE_RANGE = 'U+0000-024F, U+2000-206F, U+20AC, U+2122'

type TextSize = 'small' | 'medium' | 'large'

interface EnsureTypographyStyleOptions {
  id?: string
  textSizeScale?: Partial<Record<TextSize, number>>
  includeTtfFallback?: boolean
  fontDisplay?: 'auto' | 'block' | 'swap' | 'fallback' | 'optional'
}

const DEFAULT_TEXT_SIZE_SCALE: Record<TextSize, number> = {
  small: 0.92,
  medium: 1,
  large: 1.08,
}

const FONT_STACKS = {
  sans: "'Roboto', system-ui, -apple-system, 'Segoe UI', Arial, sans-serif",
  mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
}

function buildLexendIllinoisTypographyCss(
  options: EnsureTypographyStyleOptions = {}
): string {
  const {
    fontDisplay = 'swap',
    textSizeScale = {},
  } = options

  const scale = {
    ...DEFAULT_TEXT_SIZE_SCALE,
    ...textSizeScale,
  }

  return `
@font-face {
  font-family: 'Roboto';
  src: url('${robotoRegularWoff2Url}') format('woff2');
  font-display: ${fontDisplay};
  font-weight: 400;
  font-style: normal;
  unicode-range: ${ROBOTO_UNICODE_RANGE};
}

@font-face {
  font-family: 'Roboto';
  src: url('${robotoMediumWoff2Url}') format('woff2');
  font-display: ${fontDisplay};
  font-weight: 500;
  font-style: normal;
  unicode-range: ${ROBOTO_UNICODE_RANGE};
}

:root {
  --qapp-font-sans: ${FONT_STACKS.sans};
  --qapp-font-mono: ${FONT_STACKS.mono};
  --qapp-text-scale: ${scale.medium};
}

[data-qapp-text-size='small'] {
  --qapp-text-scale: ${scale.small};
}

[data-qapp-text-size='medium'] {
  --qapp-text-scale: ${scale.medium};
}

[data-qapp-text-size='large'] {
  --qapp-text-scale: ${scale.large};
}
`.trim()
}

export function ensureLexendIllinoisTypographyStyle(
  options: EnsureTypographyStyleOptions = {}
): HTMLStyleElement {
  const doc = globalThis.document
  if (!doc?.head) {
    throw new Error('No document/head available for typography style injection.')
  }

  const id = options.id ?? 'qmail-lexend-illinois'
  const css = buildLexendIllinoisTypographyCss(options)
  const existing = doc.getElementById(id)
  if (existing instanceof HTMLStyleElement) {
    existing.textContent = css
    return existing
  }

  const style = doc.createElement('style')
  style.id = id
  style.setAttribute('data-qmail-style', 'lexend-illinois-typography')
  style.textContent = css
  doc.head.appendChild(style)
  return style
}
