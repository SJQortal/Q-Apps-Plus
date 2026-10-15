/**
 * Links out of and into the app.
 *
 * - Copied app links use the app name with a literal `+` (Hub never decodes
 *   it; docs/QORTAL.md → Deep links). Path segments are encoded.
 * - `qortal://` links inside records open through Hub's OPEN_NEW_TAB.
 */
import { qortal } from '../qortal/client';
import { LINK_APP_NAME, ORIGINAL_APP_LINK } from '../constants/plus';

/** `qortal://APP/Q-Mintership+/people/Q…` for sharing. `path` starts with "/". */
export function appLink(path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  const encoded = clean
    .split('/')
    .map((segment, i) => (i === 0 ? segment : encodeURIComponent(decodeSafe(segment))))
    .join('/');
  return `qortal://APP/${LINK_APP_NAME}${encoded === '/' ? '' : encoded}`;
}

function decodeSafe(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** Open a `qortal://` link in a new Hub tab. Resolves false when Hub refused or isn't there. */
export async function openQortalLink(link: string): Promise<boolean> {
  if (!/^qortal:\/\//i.test(link)) return false;
  try {
    await qortal({ action: 'OPEN_NEW_TAB', qortalLink: link });
    return true;
  } catch {
    return false;
  }
}

/** The link without its scheme, decoded for reading (`bob%2Bbuilder` → `bob+builder`). */
export function linkLabel(link: string): string {
  return decodeSafe(link.replace(/^qortal:\/\//i, ''));
}

/**
 * The name a `qortal://SERVICE/<name>/…` link opens (an app's or website's
 * icon is that name's avatar), or null for links without one
 * (`qortal://use-group/…`).
 */
export function linkName(link: string): string | null {
  const [service, name] = link.replace(/^qortal:\/\//i, '').split(/[/?#]/);
  if (!service || !/^[A-Z][A-Z0-9_]*$/.test(service) || !name) return null;
  return decodeSafe(name).trim() || null;
}

export { ORIGINAL_APP_LINK };

/** Copy text; true when it worked. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
