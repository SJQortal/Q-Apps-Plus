import type { AppEntry } from '../apps/manifest';

/** Client route for an app's page. Names contain `+`, so they are encoded. */
export function detailPath(app: Pick<AppEntry, 'name'>): string {
  return `/app/${encodeURIComponent(app.name)}`;
}
