import { describe, expect, it } from 'vitest';
import { appLink, linkLabel, linkName } from './links';

describe('a qortal:// link in a record', () => {
  it('reads without its scheme, decoded', () => {
    expect(linkLabel('qortal://APP/Torq/user/The%20Empress')).toBe('APP/Torq/user/The Empress');
    expect(linkLabel('qortal://WEBSITE/bob%2Bbuilder')).toBe('WEBSITE/bob+builder');
    expect(linkLabel('qortal://APP/bad%E0%A4%A')).toBe('APP/bad%E0%A4%A');
  });

  it('names the app or website it opens, for its avatar', () => {
    expect(linkName('qortal://APP/Torq/user/The%20Empress')).toBe('Torq');
    expect(linkName('qortal://WEBSITE/Qortal%20Wiki')).toBe('Qortal Wiki');
    expect(linkName('qortal://APP/Q-Tube?video=1')).toBe('Q-Tube');
    expect(linkName('QORTAL://VIDEO/Ada/qtube_vid_1')).toBe('Ada');
  });

  it('names nothing for links that open no name', () => {
    expect(linkName('qortal://use-group/action-join/groupid-694')).toBeNull();
    expect(linkName('qortal://APP')).toBeNull();
    expect(linkName('qortal://APP/')).toBeNull();
  });
});

describe('a link to share', () => {
  it('keeps the + literal, encodes each segment and keeps the query as it is', () => {
    expect(appLink('/')).toBe('qortal://APP/Q-Mintership+');
    expect(appLink('/explorer/account/Nora Nominator')).toBe(
      'qortal://APP/Q-Mintership+/explorer/account/Nora%20Nominator'
    );
    expect(appLink('/explorer/account/Q1/transactions?kind=names&q=ada+b')).toBe(
      'qortal://APP/Q-Mintership+/explorer/account/Q1/transactions?kind=names&q=ada+b'
    );
  });
});
