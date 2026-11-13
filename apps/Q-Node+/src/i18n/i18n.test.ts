import { describe, expect, it } from 'vitest';
import i18n, { supportedLanguages } from './i18n';

describe('i18n', () => {
  it('finds every locale folder', () => {
    expect(supportedLanguages).toEqual(
      expect.arrayContaining([
        'ar',
        'de',
        'en',
        'es',
        'et',
        'fr',
        'it',
        'ja',
        'pt',
        'ru',
        'zh',
      ])
    );
  });

  it('translates from the English fallback', async () => {
    await i18n.changeLanguage('en');
    expect(i18n.t('core:header.node')).toBe('node');
    expect(i18n.t('core:widgets.core_version')).toBe('core version');
  });

  it('falls back to English for a key a locale lacks', async () => {
    await i18n.changeLanguage('de');
    expect(i18n.t('core:header.settings')).toBe('Einstellungen');
    expect(i18n.t('core:status.minting')).toBeTruthy();
  });
});
