import { describe, expect, it } from 'vitest';
import { appLink, openApp } from './openApp';
import { NoQortalError } from './request';
import { installQortalMock } from '../test/setup';

describe('appLink', () => {
  it('encodes the + in app names', () => {
    expect(appLink('Q-Mail+')).toBe('qortal://APP/Q-Mail%2B');
    expect(appLink('Q-Tube+', '/video/abc')).toBe('qortal://APP/Q-Tube%2B/video/abc');
    expect(appLink('names', 'forsale')).toBe('qortal://APP/names/forsale');
  });
});

describe('openApp', () => {
  it('asks Hub to open the encoded link in a new tab', async () => {
    const fn = installQortalMock({ OPEN_NEW_TAB: () => true });
    await openApp('Q-Shop+');
    expect(fn).toHaveBeenCalledWith({ action: 'OPEN_NEW_TAB', qortalLink: 'qortal://APP/Q-Shop%2B' });
  });

  it('rejects with NoQortalError outside Hub', async () => {
    await expect(openApp('Q-Shop+')).rejects.toBeInstanceOf(NoQortalError);
  });
});
