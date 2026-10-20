/** What a reply, a comment or a like answers: one body, one search, or a scan by hash. */
import { describe, expect, it } from 'vitest';
import { fetchCallsFor, mockFetchRoute } from '../../test/setup';
import { qappHash } from '../../utils/sha256';
import { QUITTER_SALT, TORQ_ID } from '../../rules/explorer/qdnPlaces';
import { findPlace, type PlaceSource } from './qdnPlace';

const TORQ = TORQ_ID.app;
const at = 1_790_000_000_000;
const source = (service: string, name: string, identifier: string): PlaceSource => ({
  service,
  name,
  identifier,
  version: `sig-${identifier}`,
  created: at,
});

/** `n` Q-Tube videos (newest first), rows of a page. */
const videos = (from: number, n: number) =>
  Array.from({ length: n }, (_, i) => ({
    name: `Channel ${from + i}`,
    service: 'DOCUMENT',
    identifier: `qtube_vid_clip_${from + i}_metadata`,
    created: at - (from + i) * 60_000,
  }));

describe('what a QDN publish answers', () => {
  it('reads a Torq reply’s post from its body', async () => {
    const reply = `${TORQ}-Tj2WBN-hashhashhashha-abc123def456ghi-v1`;
    mockFetchRoute(`/arbitrary/DOCUMENT/Bo/${reply}`, {
      text: 'Agreed',
      location: {
        name: 'Ada Lovelace',
        identifier: `${TORQ}-kX47dT-root-1-v1`,
        service: 'DOCUMENT',
      },
    });
    expect(await findPlace('torqReply', source('DOCUMENT', 'Bo', reply))).toEqual({
      link: `qortal://APP/Torq/post/Ada%20Lovelace/${TORQ}-kX47dT-root-1-v1`,
      label: 'Open the post it answers in Torq',
    });
  });

  it('reads a Q-Tube super like’s video from its body', async () => {
    mockFetchRoute('/arbitrary/BLOG_COMMENT/Bo/qtube_superlike_x_1', {
      comment: 'Great!',
      notificationInformation: { name: 'Ada', identifier: 'qtube_vid_trip_a1_metadata' },
    });
    expect(
      await findPlace('qtubeSuperlike', source('BLOG_COMMENT', 'Bo', 'qtube_superlike_x_1'))
    ).toEqual({
      link: 'qortal://APP/Q-Tube/video/Ada/qtube_vid_trip_a1_metadata',
      label: 'Open the video in Q-Tube',
    });
  });

  it('finds a Q-Tube comment’s video by hashing the videos published before it', async () => {
    const all = [...videos(0, 100), ...videos(100, 100)];
    const target = all[137];
    const comment = `qc_v1_qtube_${qappHash(target.identifier, 20)}_base_abc1234`;
    mockFetchRoute('/arbitrary/resources/searchsimple', (url: URL) => {
      const offset = Number(url.searchParams.get('offset'));
      expect(url.searchParams.get('before')).toBe(String(at));
      expect(url.searchParams.get('identifier')).toBe('qtube_vid_');
      return all.slice(offset, offset + 100);
    });
    expect(await findPlace('qtubeComment', source('BLOG_COMMENT', 'Bo', comment))).toEqual({
      link: `qortal://APP/Q-Tube/video/${encodeURIComponent(target.name)}/${target.identifier}`,
      label: 'Open the video in Q-Tube',
    });
    // It stopped at the page that had it.
    expect(fetchCallsFor('/arbitrary/resources/searchsimple')).toHaveLength(2);
  });

  it('finds a Q-Tube like’s video from its id and channel, and a Torq like’s post', async () => {
    const all = videos(0, 30);
    const liked = all[12];
    mockFetchRoute('/arbitrary/resources/searchsimple', (url: URL) =>
      url.searchParams.get('identifier') === 'qtube_vid_'
        ? all
        : [
            { name: 'Ada', identifier: `${TORQ}-kX47dT-root-1-v1`, created: at - 1 },
            { name: 'Cy', identifier: `${TORQ}-kX47dT-root-2-v1`, created: at - 2 },
          ]
    );
    const like = qappHash(liked.identifier + liked.name, 20);
    expect(await findPlace('qtubeLike', source('CHAIN_COMMENT', 'Bo', like))).toMatchObject({
      link: `qortal://APP/Q-Tube/video/${encodeURIComponent(liked.name)}/${liked.identifier}`,
    });
    const torqLike = `${TORQ_ID.like}${qappHash(`${TORQ}-kX47dT-root-2-v1`, 14, QUITTER_SALT)}`;
    expect(await findPlace('torqLike', source('DOCUMENT', 'Bo', torqLike))).toEqual({
      link: `qortal://APP/Torq/post/Cy/${TORQ}-kX47dT-root-2-v1`,
      label: 'Open the liked post in Torq',
    });
  });

  it('says nothing was found after the newest 1,000', async () => {
    let pages = 0;
    mockFetchRoute('/arbitrary/resources/searchsimple', () => {
      pages++;
      return videos(pages * 100, 100);
    });
    const comment = 'qc_v1_qtube_AAAAAAAAAAAAAAAAAAAA_base_abc1234';
    expect(await findPlace('qtubeComment', source('BLOG_COMMENT', 'Bo', comment))).toBeNull();
    expect(pages).toBe(10);
  });

  it('finds the share a Q-Share comment is on by the key it ends in', async () => {
    mockFetchRoute('/arbitrary/resources/search', (url: URL) => {
      expect(url.searchParams.get('identifier')).toBe('a1b_metadata');
      expect(url.searchParams.get('prefix')).toBeNull();
      return [
        { name: 'X', identifier: 'other_thing_a1b_metadata', created: 2 },
        { name: 'Ada', identifier: 'qshare_file_notes_a1b_metadata', created: 1 },
      ];
    });
    expect(
      await findPlace(
        'qshareComment',
        source('BLOG_COMMENT', 'Bo', 'qcomment_v1_qshare_a1b_metadata_base_xyz')
      )
    ).toEqual({
      link: 'qortal://APP/Q-Share/share/Ada/qshare_file_notes_a1b_metadata',
      label: 'Open the share in Q-Share',
    });
  });

  it('finds the store a review is of', async () => {
    mockFetchRoute('/arbitrary/resources/search', [
      { name: 'Shopkeeper', identifier: 'q-store-general-abc', created: 1 },
    ]);
    expect(
      await findPlace('qshopReview', source('DOCUMENT', 'Bo', 'q-store-review-abc-uid-45'))
    ).toEqual({
      link: 'qortal://APP/Q-Shop/Shopkeeper/q-store-general-abc',
      label: 'Open the store in Q-Shop',
    });
  });
});
