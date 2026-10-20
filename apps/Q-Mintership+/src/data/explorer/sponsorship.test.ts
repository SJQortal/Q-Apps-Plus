import { beforeEach, describe, expect, it } from 'vitest';
import { fetchCallsFor, mockFetchRoute } from '../../test/setup';
import { peekQuery, resetQueries } from '../query';
import { coreSponsorKey, getCoreSponsor } from './sponsorship';

const KITTY = 'QPeQFg8DfXKEFcRd2eM9ww9uxKSARfJxZH';
const RAVENSTONE = 'QLmZhiKfx6dtf87YXDeCRt7tJYpDTtVnX6';
const FOUNDER = 'QZJc1V32oFm8tufB4bk7fa3aepu4EdkeDU';

beforeEach(() => resetQueries());

describe('the sponsor Core counts', () => {
  it('reads it from Core’s report on the sponsor, once', async () => {
    mockFetchRoute(`/addresses/sponsorship/${KITTY}/sponsor`, {
      address: RAVENSTONE,
      level: 6,
      names: ['kitty'],
    });
    expect(await getCoreSponsor(KITTY)).toBe(RAVENSTONE);
    expect(await getCoreSponsor(KITTY)).toBe(RAVENSTONE);
    expect(fetchCallsFor('/addresses/sponsorship/')).toHaveLength(1);
    expect(peekQuery(coreSponsorKey(KITTY))).toBe(RAVENSTONE);
  });

  it('is none when Core knows no sponsor (its 404)', async () => {
    mockFetchRoute(
      `/addresses/sponsorship/${FOUNDER}/sponsor`,
      () =>
        new Response(JSON.stringify({ error: 124, message: 'account address unknown' }), {
          status: 404,
        })
    );
    expect(await getCoreSponsor(FOUNDER)).toBeNull();
  });
});
