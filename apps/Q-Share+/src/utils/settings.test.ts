import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY, isNameHidden, readSettings, resetSettingsCache, writeSettings } from './settings';

describe('app settings', () => {
  beforeEach(() => {
    localStorage.clear();
    resetSettingsCache();
  });

  it('falls back to defaults on missing or broken storage', () => {
    expect(readSettings()).toEqual(DEFAULT_SETTINGS);
    localStorage.setItem(SETTINGS_STORAGE_KEY, '{not json');
    resetSettingsCache();
    expect(readSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('persists a patch and sanitises it', () => {
    writeSettings({ defaultSort: 'oldest', hiddenNames: [' Bob ', 'bob', '', 'alice'] as string[] });
    resetSettingsCache();
    const s = readSettings();
    expect(s.defaultSort).toBe('oldest');
    expect(s.hiddenNames).toEqual(['Bob', 'bob', 'alice']);
    expect(s.autoPreviewImages).toBe(true);
    expect(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || '{}').defaultSort).toBe('oldest');
  });

  it('matches hidden names case-insensitively', () => {
    writeSettings({ hiddenNames: ['Spammer'] });
    expect(isNameHidden('spammer')).toBe(true);
    expect(isNameHidden('alice')).toBe(false);
    expect(isNameHidden(undefined)).toBe(false);
  });
});
