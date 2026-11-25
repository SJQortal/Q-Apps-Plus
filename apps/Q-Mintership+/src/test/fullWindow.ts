/**
 * The max width Full window gives an element, from its media rule (FULL_WINDOW_MEDIA): jsdom
 * doesn't apply media queries itself. Null when no such rule matches it.
 */
export function fullWindowMaxWidth(el: Element): string | null {
  for (const sheet of Array.from(document.styleSheets)) {
    for (const rule of Array.from(sheet.cssRules)) {
      if (!('media' in rule) || (rule as CSSMediaRule).media.mediaText !== '(min-height: 501px)')
        continue;
      for (const inner of Array.from((rule as CSSMediaRule).cssRules)) {
        const style = inner as CSSStyleRule;
        if (style.selectorText && el.matches(style.selectorText) && style.style.maxWidth)
          return style.style.maxWidth;
      }
    }
  }
  return null;
}
