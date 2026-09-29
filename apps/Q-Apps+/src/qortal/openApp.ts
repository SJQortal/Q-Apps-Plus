import { qortalCall } from './request';

/** Deep link to an app. Names contain `+`, so they are always encoded. */
export function appLink(name: string, path = ''): string {
  const clean = path && !path.startsWith('/') ? `/${path}` : path;
  return `qortal://APP/${encodeURIComponent(name)}${clean}`;
}

/**
 * Ask Hub/GO to open an app in a new tab. Rejects with NoQortalError outside
 * Hub, so the UI can explain instead of doing nothing.
 */
export async function openApp(name: string, path = ''): Promise<void> {
  await qortalCall({ action: 'OPEN_NEW_TAB', qortalLink: appLink(name, path) });
}
