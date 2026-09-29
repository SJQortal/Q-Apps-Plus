type TextSize = 'small' | 'medium' | 'large'

export function ensureLexendIllinoisTypographyStyle(options?: {
  id?: string
  textSizeScale?: Partial<Record<TextSize, number>>
}): HTMLStyleElement {
  const id = options?.id ?? 'qmail-qapp-typography'
  const scale = {
    small: 0.92,
    medium: 1,
    large: 1.08,
    ...(options?.textSizeScale || {}),
  }

  const css = `
:root {
  --qapp-font-sans: 'Roboto', system-ui, -apple-system, 'Segoe UI', Arial, sans-serif;
  --qapp-font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
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

  const existing = document.getElementById(id)
  if (existing instanceof HTMLStyleElement) {
    existing.textContent = css
    return existing
  }

  const style = document.createElement('style')
  style.id = id
  style.textContent = css
  document.head.appendChild(style)
  return style
}

export function applyQAppTextSize(root: HTMLElement, textSize: TextSize): void {
  root.setAttribute('data-qapp-text-size', textSize)
}
