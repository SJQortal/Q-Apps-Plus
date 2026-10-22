/**
 * Copies text; call it from a click handler. `navigator.clipboard` needs a
 * secure context, and the app frame runs on the node's origin, which is plain
 * http for a node on the LAN (GO rewrites private-network nodes to http). So
 * fall back to a hidden textarea and `execCommand("copy")`. Resolves false
 * when both fail, so the caller can show the text for a manual copy.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (window.isSecureContext && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall back below
  }
  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.top = "0";
    el.style.left = "0";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    el.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    el.remove();
    return ok;
  } catch {
    return false;
  }
}
