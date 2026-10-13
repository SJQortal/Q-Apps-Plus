import { afterEach, describe, expect, it, vi } from 'vitest';
import { appLink } from '../utils/links';
import { notifyHubDisplayedPath } from './hubLocation';
import { adminPollPath, decisionPath, legacyDecisionPath, nominationPath, PATHS } from './paths';

describe('a Minter Admin poll’s path', () => {
  it('is /decisions/polls/<id>, copied as a qortal:// link with a literal +', () => {
    expect(adminPollPath('lvl5adm1')).toBe('/decisions/polls/lvl5adm1');
    expect(appLink(adminPollPath('lvl5adm1'))).toBe(
      'qortal://APP/Q-Mintership+/decisions/polls/lvl5adm1'
    );
  });
});

const SIG =
  '4mYb2yQkXvJ1sL9pW3tE7uN5rC8dF6gH2jK4mZ1xA9bV3nQ7wE5rT8yU2io6pL1aS3dF5gH7jK9LZ2xC4vB6nM8';
const ADDRESS = 'QgFT6iVhw2ZsyjGrFVnWQn5JQSzhKk1cnG';

describe('shareable paths', () => {
  it('gives every decision and nomination its own path', () => {
    expect(decisionPath(SIG)).toBe(`/decisions/${SIG}`);
    expect(decisionPath()).toBe(PATHS.decisions);
    expect(nominationPath(ADDRESS)).toBe(`/nominations/${ADDRESS}`);
  });

  it('copies them as qortal://APP/Q-Mintership+/… links, with a literal +', () => {
    expect(appLink(decisionPath(SIG))).toBe(`qortal://APP/Q-Mintership+/decisions/${SIG}`);
    expect(appLink(nominationPath(ADDRESS))).toBe(
      `qortal://APP/Q-Mintership+/nominations/${ADDRESS}`
    );
  });

  it('sends an old /decisions?d=<signature> link to the decision’s own path', () => {
    expect(legacyDecisionPath(`?d=${SIG}`)).toBe(`/decisions/${SIG}`);
    expect(legacyDecisionPath(`?d=${SIG}?theme=dark&lang=en`)).toBe(`/decisions/${SIG}`);
    expect(legacyDecisionPath('?as=admin&d=abc')).toBe('/decisions/abc');
    expect(legacyDecisionPath('')).toBeNull();
    expect(legacyDecisionPath('?d=')).toBeNull();
  });
});

describe('Hub learns the path on screen', () => {
  const original = Object.getOwnPropertyDescriptor(window, 'parent');
  afterEach(() => {
    if (original) Object.defineProperty(window, 'parent', original);
  });

  it('reports a decision’s and a nomination’s path, so Hub’s own Copy link matches', () => {
    const postMessage = vi.fn();
    Object.defineProperty(window, 'parent', { configurable: true, value: { postMessage } });
    notifyHubDisplayedPath(decisionPath(SIG));
    notifyHubDisplayedPath(`${nominationPath(ADDRESS)}?as=admin`);
    expect(postMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        action: 'QDN_RESOURCE_DISPLAYED',
        service: 'APP',
        name: 'Q-Mintership+',
        path: `/decisions/${SIG}`,
      }),
      '*'
    );
    expect(postMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ path: `/nominations/${ADDRESS}` }),
      '*'
    );
  });

  it('reports a Minter Admin poll’s path the same way', () => {
    const postMessage = vi.fn();
    Object.defineProperty(window, 'parent', { configurable: true, value: { postMessage } });
    notifyHubDisplayedPath(`${adminPollPath('lvl5adm1')}?as=admin`);
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'QDN_RESOURCE_DISPLAYED',
        name: 'Q-Mintership+',
        path: '/decisions/polls/lvl5adm1',
      }),
      '*'
    );
  });
});
