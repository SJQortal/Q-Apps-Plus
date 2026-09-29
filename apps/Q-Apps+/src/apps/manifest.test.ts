import { describe, expect, it } from 'vitest';
import { allQdnNames, APP_CATEGORIES, APPS, findApp, matchesQuery } from './manifest';

describe('manifest', () => {
  it('lists the ten + apps with unique names, slugs and originals', () => {
    expect(APPS).toHaveLength(10);
    const names = APPS.map((a) => a.name);
    expect(new Set(names).size).toBe(10);
    expect(new Set(APPS.map((a) => a.slug)).size).toBe(10);
    expect(new Set(APPS.map((a) => a.original.name)).size).toBe(10);
    for (const app of APPS) {
      expect(app.name.endsWith('+')).toBe(true);
      expect(APP_CATEGORIES.some((c) => c.id === app.category)).toBe(true);
      expect(app.adds.length).toBeGreaterThan(0);
      expect(app.original.repo).toMatch(/^https:\/\/github\.com\/Qortal\//);
    }
  });

  it('looks up apps by name or slug, case-insensitively', () => {
    expect(findApp('Q-Mail+')?.slug).toBe('q-mail-plus');
    expect(findApp('q-mail-plus')?.name).toBe('Q-Mail+');
    expect(findApp('q-mail+')?.name).toBe('Q-Mail+');
    expect(findApp('Nope')).toBeUndefined();
    expect(findApp(undefined)).toBeUndefined();
  });

  it('collects every QDN name to look up once: the + apps and their originals', () => {
    const names = allQdnNames();
    expect(names).toHaveLength(20);
    expect(names).toContain('Q-Mail+');
    expect(names).toContain('Q-Mail');
    expect(names).toContain('names');
  });

  it('searches names, taglines, keywords and categories', () => {
    const mail = findApp('Q-Mail+')!;
    expect(matchesQuery(mail, '')).toBe(true);
    expect(matchesQuery(mail, 'MAIL')).toBe(true);
    expect(matchesQuery(mail, 'inbox')).toBe(true);
    expect(matchesQuery(mail, 'communication')).toBe(true);
    expect(matchesQuery(mail, 'encrypted mail')).toBe(true);
    expect(matchesQuery(mail, 'video')).toBe(false);
  });
});
