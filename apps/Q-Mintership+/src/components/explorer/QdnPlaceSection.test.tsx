/** "Where it belongs" on a QDN publish's page: the app, the link, and what it answers. */
import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderPage } from '../../test/render';
import { mockFetchRoute, mockQortalRequest, qortalCallsFor } from '../../test/setup';
import { ADDR } from '../../test/world';
import type { TxRow } from '../../data/types';
import { qappHash } from '../../utils/sha256';
import { QdnPlaceSection } from './QdnPlaceSection';

const T = { timeout: 4000 };
const TORQ = 'MhNiRYdzkaP9dz';
const publish = (service: number, name: string, identifier: string): TxRow =>
  ({
    type: 'ARBITRARY',
    signature: `sig-${identifier}`,
    timestamp: 1_790_000_000_000,
    creatorAddress: ADDR.learner,
    service,
    name,
    identifier,
  }) as unknown as TxRow;

const region = () => screen.findByRole('region', { name: 'Where it belongs' }, T);

describe('where a QDN publish belongs (Simon, 2026-10-19)', () => {
  it('opens the post a Torq reply answers, and the reply itself, in a new Hub tab', async () => {
    const user = userEvent.setup();
    mockQortalRequest('OPEN_NEW_TAB', true);
    const reply = `${TORQ}-Tj2WBN-hashhashhashha-abc123def456ghi-v1`;
    // DOCUMENT is service 800 in Core's numbering.
    await renderPage(<QdnPlaceSection tx={publish(800, 'Bo', reply)} />, {
      // Newer than the world's own routes: these answer first.
      setup: () =>
        mockFetchRoute(`/arbitrary/DOCUMENT/Bo/${reply}`, {
          location: { name: 'Ada', identifier: `${TORQ}-kX47dT-root-1-v1`, service: 'DOCUMENT' },
        }),
    });
    const place = await region();
    expect(within(place).getByText('A reply to a post in Torq.')).toBeVisible();
    await user.click(
      await within(place).findByRole('button', { name: 'Open the post it answers in Torq' }, T)
    );
    expect(qortalCallsFor('OPEN_NEW_TAB')[0].qortalLink).toBe(
      `qortal://APP/Torq/post/Ada/${TORQ}-kX47dT-root-1-v1`
    );
    await user.click(within(place).getByRole('button', { name: 'Open the reply in Torq' }));
    expect(qortalCallsFor('OPEN_NEW_TAB')[1].qortalLink).toBe(`qortal://APP/Torq/post/Bo/${reply}`);
  });

  it('looks for a Q-Tube comment’s video only when asked', async () => {
    const user = userEvent.setup();
    mockQortalRequest('OPEN_NEW_TAB', true);
    const video = { name: 'Ada', identifier: 'qtube_vid_trip_a1_metadata', created: 1 };
    const comment = `qc_v1_qtube_${qappHash(video.identifier, 20)}_base_abc1234`;
    // BLOG_COMMENT is 778.
    await renderPage(<QdnPlaceSection tx={publish(778, 'Bo', comment)} />, {
      setup: () => mockFetchRoute('/arbitrary/resources/searchsimple', [video]),
    });
    const place = await region();
    expect(within(place).getByText('A comment on a video in Q-Tube.')).toBeVisible();
    expect(
      within(place).getByText(/looks through the newest 1,000 published before it/)
    ).toBeVisible();
    await user.click(within(place).getByRole('button', { name: 'Find the video it’s on' }));
    await user.click(
      await within(place).findByRole('button', { name: 'Open the video in Q-Tube' }, T)
    );
    expect(qortalCallsFor('OPEN_NEW_TAB')[0].qortalLink).toBe(
      'qortal://APP/Q-Tube/video/Ada/qtube_vid_trip_a1_metadata'
    );
    // Q-Tube itself, too.
    expect(within(place).getByRole('button', { name: 'Open Q-Tube' })).toBeVisible();
  });

  it('opens Q-Mintership’s own records here', async () => {
    // JSON is 1110.
    await renderPage(
      <QdnPlaceSection tx={publish(1110, 'Nora', `qmp-nomination-${ADDR.nominatedWaiting}`)} />
    );
    const place = await region();
    expect(within(place).getByText('A nomination.')).toBeVisible();
    expect(within(place).getByRole('link', { name: 'Open the nomination' })).toHaveAttribute(
      'href',
      `/nominations/${ADDR.nominatedWaiting}`
    );
  });
});
