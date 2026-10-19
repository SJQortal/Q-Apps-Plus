import { describe, expect, it } from 'vitest';
import { ADDR } from '../../test/world';
import { qappLink, qdnPlace, qtubeCommentHash } from './qdnPlaces';

const TORQ = 'MhNiRYdzkaP9dz';

describe('where a QDN publish belongs (Simon, 2026-10-19)', () => {
  it('writes the app’s name as it is, and encodes each segment', () => {
    expect(qappLink('Q-Share+', 'share', 'bob builder', 'a/b')).toBe(
      'qortal://APP/Q-Share+/share/bob%20builder/a%2Fb'
    );
    expect(qappLink('Q-Tube')).toBe('qortal://APP/Q-Tube');
  });

  it('opens a website or a Q-App itself, by its name', () => {
    expect(qdnPlace('WEBSITE', 'Qortal Wiki', null)).toMatchObject({
      app: 'Qortal',
      what: 'A website',
      link: 'qortal://WEBSITE/Qortal Wiki',
    });
    expect(qdnPlace('APP', 'Q-Mintership+', null)?.link).toBe('qortal://APP/Q-Mintership+');
    expect(qdnPlace('WEBSITE', 'a/b', null)).toBeNull();
    expect(qdnPlace('IMAGE', 'Ada', null)).toBeNull();
  });

  it('opens a Q-Tube video, playlist and channel at their routes', () => {
    const doc = 'qtube_vid_my_trip_abc123_metadata';
    expect(qdnPlace('DOCUMENT', 'Ada', doc)).toMatchObject({
      app: 'Q-Tube',
      what: 'A video',
      link: `qortal://APP/Q-Tube/video/Ada/${doc}`,
      label: 'Open the video in Q-Tube',
    });
    // The video file opens its record's page.
    expect(qdnPlace('VIDEO', 'Ada', 'qtube_vid_my_trip_abc123')?.link).toBe(
      `qortal://APP/Q-Tube/video/Ada/${doc}`
    );
    expect(qdnPlace('PLAYLIST', 'Ada', 'qtube_playlist_best_x1')?.link).toBe(
      'qortal://APP/Q-Tube/playlist/Ada/qtube_playlist_best_x1'
    );
    expect(qdnPlace('DOCUMENT', 'Ada', 'qtube_channel_description')?.link).toBe(
      'qortal://APP/Q-Tube/channel/Ada'
    );
  });

  it('finds what a Q-Tube comment, like or super like is about with a read', () => {
    const comment = 'qc_v1_qtube_ABCDEFGHIJ.~KLMNOPQR_base_xyz1234';
    expect(qtubeCommentHash(comment)).toBe('ABCDEFGHIJ.~KLMNOPQR');
    expect(qdnPlace('BLOG_COMMENT', 'Bo', comment)).toMatchObject({
      app: 'Q-Tube',
      what: 'A comment on a video',
      read: 'qtubeComment',
      onRequest: true,
      target: 'the video it’s on',
      fallback: { link: 'qortal://APP/Q-Tube' },
    });
    expect(
      qdnPlace('BLOG_COMMENT', 'Bo', 'qc_v1_qtube_ABCDEFGHIJ.~KLMNOPQR_reply_234abc_qq')?.what
    ).toBe('A reply to a comment on a video');
    expect(qdnPlace('BLOG_COMMENT', 'Bo', 'qtube_superlike_ABCDEFGHIJ_xy')).toMatchObject({
      read: 'qtubeSuperlike',
    });
    expect(
      qdnPlace('BLOG_COMMENT', 'Bo', 'qtube_superlike_ABCDEFGHIJ_xy')?.onRequest
    ).toBeUndefined();
    expect(qdnPlace('CHAIN_COMMENT', 'Bo', 'ABCDEFGHIJ.~KLMNOPQR')).toMatchObject({
      read: 'qtubeLike',
      onRequest: true,
    });
    expect(qdnPlace('CHAIN_COMMENT', 'Bo', 'qtube_like_qtube_vid_x')).toMatchObject({
      read: 'qtubeLike',
    });
  });

  it('opens Torq’s posts, and finds what a reply, a repost, a follow or a like is about', () => {
    const post = `${TORQ}-kX47dT-XrFXaYetyErMdF-abc123def456ghi-v1`;
    expect(qdnPlace('DOCUMENT', 'Ada', post)).toMatchObject({
      app: 'Torq',
      what: 'A post',
      link: `qortal://APP/Torq/post/Ada/${post}`,
    });
    const reply = `${TORQ}-Tj2WBN-hashhashhashha-abc123def456ghi-v1`;
    expect(qdnPlace('DOCUMENT', 'Bo', reply)).toMatchObject({
      what: 'A reply to a post',
      link: `qortal://APP/Torq/post/Bo/${reply}`,
      label: 'Open the reply in Torq',
      read: 'torqReply',
      target: 'the post it answers',
    });
    expect(qdnPlace('DOCUMENT', 'Bo', `${TORQ}-cEWGCt-hashhashhashha-v1`)?.read).toBe('torqRepost');
    expect(qdnPlace('DOCUMENT', 'Bo', `${TORQ}-03RRBX-XrFXaYetyErMdF-abc-v1`)?.link).toMatch(
      /^qortal:\/\/APP\/Torq\/rev\/Bo\//
    );
    expect(qdnPlace('DOCUMENT', 'Bo', `${TORQ}-49iuX.-hashhashhashha-abc-v1`)?.link).toMatch(
      /^qortal:\/\/APP\/Torq\/rev-reply\/Bo\//
    );
    expect(qdnPlace('DOCUMENT', 'Bo', 'x9qg7nNIUHvVitAAAAAAAAAAAAAA')).toMatchObject({
      what: 'A like of a post',
      read: 'torqLike',
      onRequest: true,
      fallback: { link: 'qortal://APP/Torq/user/Bo/likes' },
    });
    expect(qdnPlace('DOCUMENT', 'Bo', 'gY.TWOeB25Co.7AAAAAAAAAAAAAA')?.read).toBe('torqFollow');
    expect(qdnPlace('DOCUMENT', 'Bo', '2pHHSwGK1NcwcdAAAAAAAAAAAAAAzzzzzzzz')?.link).toBe(
      'qortal://APP/Torq/superlike/Bo/2pHHSwGK1NcwcdAAAAAAAAAAAAAAzzzzzzzz'
    );
  });

  it('opens Q-Share+ shares and collections; finds a file’s and a comment’s share', () => {
    expect(qdnPlace('DOCUMENT', 'Ada', 'qshare_file_notes_a1_metadata')?.link).toBe(
      'qortal://APP/Q-Share+/share/Ada/qshare_file_notes_a1_metadata'
    );
    expect(qdnPlace('DOCUMENT', 'Ada', 'qshare_collection_mine_abc123')?.link).toBe(
      'qortal://APP/Q-Share+/collection/Ada/qshare_collection_mine_abc123'
    );
    expect(qdnPlace('FILE', 'Ada', 'qshare_file_notes_b2')).toMatchObject({
      read: 'qshareFile',
      fallback: { link: 'qortal://APP/Q-Share+/channel/Ada' },
    });
    expect(
      qdnPlace('BLOG_COMMENT', 'Bo', 'qcomment_v1_qshare_a1b_metadata_base_xyz')
    ).toMatchObject({ read: 'qshareComment', what: 'A comment on a share' });
  });

  it('opens Q-Fund, Q-Support, Q-Shop, Q-Blog, Q-Music and Ear-Bump at their routes', () => {
    expect(qdnPlace('DOCUMENT', 'Ada', 'q-fund_crowdfund_my_node_abc123')?.link).toBe(
      'qortal://APP/Q-Fund/crowdfund/Ada/q-fund_crowdfund_my_node_abc123'
    );
    expect(qdnPlace('DOCUMENT', 'Ada', 'q-fund_update_crowdfund_node_abc123_x')?.read).toBe(
      'qfundUpdate'
    );
    expect(qdnPlace('BLOG_COMMENT', 'Bo', 'qcomment_v1_q-fund_node_abc123_base_xy')?.read).toBe(
      'qfundComment'
    );
    expect(qdnPlace('DOCUMENT', 'Ada', 'q_support_issue_bug_x1_metadata')?.link).toBe(
      'qortal://APP/Q-Support/issue/Ada/q_support_issue_bug_x1_metadata'
    );
    expect(qdnPlace('STORE', 'Ada', 'q-store-general-abc')?.link).toBe(
      'qortal://APP/Q-Shop/Ada/q-store-general-abc'
    );
    expect(qdnPlace('DOCUMENT', 'Ada', 'q-store-general-abc-datacontainer')?.link).toBe(
      'qortal://APP/Q-Shop/Ada/q-store-general-abc'
    );
    expect(qdnPlace('DOCUMENT', 'Ada', 'q-store-catalogue-abc-uid1')?.link).toBe(
      'qortal://APP/Q-Shop/Ada/q-store-general-abc'
    );
    expect(qdnPlace('DOCUMENT', 'Bo', 'q-store-review-abc-uid-45')?.read).toBe('qshopReview');
    expect(qdnPlace('BLOG_POST', 'Ada', 'q-blog-travel-post-paris-x1')?.link).toBe(
      'qortal://APP/Q-Blog/Ada/travel/paris-x1'
    );
    expect(qdnPlace('BLOG', 'Ada', 'q-blog-travel')?.link).toBe('qortal://APP/Q-Blog/Ada/travel');
    expect(qdnPlace('AUDIO', 'Ada', 'enjoymusic_song_hey_x1')?.link).toBe(
      'qortal://APP/Q-Music/songs/Ada/enjoymusic_song_hey_x1'
    );
    expect(qdnPlace('DOCUMENT', 'Bo', 'enjoymusic_song_comment_x1')?.read).toBe('qmusicComment');
    expect(qdnPlace('PLAYLIST', 'Ada', 'earbump_playlist_mix_x1')?.link).toBe(
      'qortal://APP/Ear-Bump/playlists/Ada/earbump_playlist_mix_x1'
    );
  });

  it('opens Q-Mintership’s own records here', () => {
    expect(qdnPlace('JSON', 'Nora', `qmp-nomination-${ADDR.nominatedWaiting}`)).toMatchObject({
      what: 'A nomination',
      path: `/nominations/${ADDR.nominatedWaiting}`,
      label: 'Open the nomination',
    });
    expect(qdnPlace('JSON', 'Leo', `qmp-vote-${ADDR.nominatedWaiting}-yes-abc123`)?.path).toBe(
      `/nominations/${ADDR.nominatedWaiting}`
    );
    expect(qdnPlace('JSON', 'Zoë', `qmp-comment-${ADDR.nominatedWaiting}-wren03`)?.path).toBe(
      `/comments/Zo%C3%AB/qmp-comment-${ADDR.nominatedWaiting}-wren03`
    );
    expect(qdnPlace('BLOG_POST', 'Ada', 'Minter-board-card-abc')?.path).toBe(
      '/history/card/Minter-board-card-abc'
    );
    expect(qdnPlace('BLOG_POST', 'Bo', 'comment-Minter-board-card-abc-x1y2')?.path).toBe(
      '/history/card/Minter-board-card-abc'
    );
  });

  it('knows nothing about anything else', () => {
    expect(qdnPlace('THUMBNAIL', 'Ada', 'qortal_avatar')).toBeNull();
    expect(qdnPlace('DOCUMENT', 'Ada', 'something_else')).toBeNull();
    expect(qdnPlace('DOCUMENT', ' ', 'qtube_vid_x_metadata')).toBeNull();
  });
});
