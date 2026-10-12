type TextSize = 'small' | 'medium' | 'large'

/** Sets the text-size attribute that --qapp-text-scale (src/styles/lexendIllinoisTypography.ts) keys off. */
export function applyQAppTextSize(root: HTMLElement, textSize: TextSize): void {
  root.setAttribute('data-qapp-text-size', textSize)
}
