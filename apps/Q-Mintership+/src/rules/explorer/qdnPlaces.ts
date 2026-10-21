/**
 * Where a QDN publish belongs (Simon, 2026-10-19: "when going into the
 * specific transactions, could we have it so that The transaction it
 * answers links to the website or q-app or whatever that transaction refers
 * to, link Q-Tube comment, or like on Torq"): which Q-App shows it and the
 * `qortal://APP/<App>/<route>` link that opens it there, from its service,
 * name and identifier alone. Pure; data/explorer/qdnPlace.ts does the reads
 * some kinds need (what a reply, a comment or a like answers).
 *
 * After MA Helper's portfolio links (Simon: "Minter Helper had some of the
 * links capability"), checked against each app's routes and identifiers
 * (docs/apps/Q-Mintership+.md → item 127):
 *
 * - Q-Tube: a video's DOCUMENT `qtube_vid_…_metadata` (its VIDEO is the same
 *   id less `_metadata`), PLAYLIST `qtube_playlist_…`, the channel's
 *   `qtube_channel_description`; a super like BLOG_COMMENT `qtube_superlike_…`
 *   names its video in its body; a comment BLOG_COMMENT `qc_v1_qtube_<hash>_…`
 *   and a like CHAIN_COMMENT only hash the video's id: found by hashing the
 *   videos published before it.
 * - Torq (Quitter's data, Torq's routes): qapp-core identifiers
 *   `MhNiRYdzkaP9dz-<entity>-…-v1` (post, reply, repost, rev, rev reply),
 *   likes `x9qg7nNIUHvVit<hash>`, follows `gY.TWOeB25Co.7<hash>`, super likes
 *   `2pHHSwGK1Ncwcd…`. A reply names its post in its body, as a repost and a
 *   follow do; a like hashes the post's id.
 * - Q-Share (Simon, 2026-10-19: "for q-share links its not q-share+ but just
 *   q-share"): shares, files (their share is searched), comments (their share
 *   is searched); a collection, which only Q-Share+ has a page for, opens its
 *   publisher's channel.
 * - Q-Fund (crowdfunds, updates, comments), Q-Support (issues, comments),
 *   Q-Shop (stores, catalogues, reviews), Q-Blog, Q-Music, Ear-Bump.
 * - A website or a Q-App itself (its default identifier).
 * - Q-Mintership's own records open their page here: a nomination, its
 *   support and votes, a comment, a card of the original app.
 *
 * Encrypted resources never get here (the Explorer doesn't look inside
 * them). Anything else gets no place: its Open File stays.
 */
import { isAddress } from '../../data/accounts';
import { commentPath, legacyCardPath, nominationPath, personPath } from '../../routes/paths';
import { APP_NAME, ORIGINAL_APP_NAME, ORIGINAL_WORDS } from '../../constants/plus';

/** The apps linked to, by their QDN names: the original apps (Simon, 2026-10-19). */
export const QAPP = {
  qtube: 'Q-Tube',
  torq: 'Torq',
  qshare: 'Q-Share',
  qfund: 'Q-Fund',
  qsupport: 'Q-Support',
  qshop: 'Q-Shop',
  qblog: 'Q-Blog',
  qmusic: 'Q-Music',
  earbump: 'Ear-Bump',
} as const;

/**
 * `qortal://APP/<app>/<segments…>`: the app's name as written (Hub never
 * decodes it, so a + app would keep its `+`), each segment encoded.
 */
export function qappLink(app: string, ...segments: string[]): string {
  const path = segments.map((segment) => encodeURIComponent(segment)).join('/');
  return `qortal://APP/${app}${path ? `/${path}` : ''}`;
}

/** What a place's read finds: the thing a reply, a comment or a like is about. */
export type PlaceRead =
  | 'torqReply'
  | 'torqRepost'
  | 'torqFollow'
  | 'torqLike'
  | 'qtubeSuperlike'
  | 'qtubeComment'
  | 'qtubeLike'
  | 'qmusicComment'
  | 'qshareFile'
  | 'qshareComment'
  | 'qfundComment'
  | 'qfundUpdate'
  | 'qsupportComment'
  | 'qshopReview';

export interface QdnPlace {
  /** The app that shows it ("Q-Tube"); "Qortal" for a website or a Q-App itself. */
  app: string;
  /** What it is: "A video", "A reply to a post". */
  what: string;
  /** Opens it where it belongs (a qortal:// link), when that is known without a read. */
  link?: string;
  /** The button of its link or path: "Open the video in Q-Tube". */
  label?: string;
  /** A page of this app instead (Q-Mintership's own records). */
  path?: string;
  /** What it answers or belongs to, found with a read (data/explorer/qdnPlace.ts). */
  read?: PlaceRead;
  /** The read looks through many resources: only when asked ("Find the video"). */
  onRequest?: boolean;
  /** What the read finds, for its words: "the video it's on". */
  target?: string;
  /** Where to go when the read finds nothing: the app, a channel. */
  fallback?: { label: string; link: string };
}

const QTUBE_HOME = { label: 'Open Q-Tube', link: qappLink(QAPP.qtube) };

/** Torq's qapp-core identifiers (Quitter's app name and salt): the app's hash and each entity's. */
export const TORQ_ID = {
  app: 'MhNiRYdzkaP9dz',
  post: 'kX47dT',
  reply: 'Tj2WBN',
  repost: 'cEWGCt',
  rev: '03RRBX',
  revReply: '49iuX.',
  like: 'x9qg7nNIUHvVit',
  follow: 'gY.TWOeB25Co.7',
  superlike: '2pHHSwGK1Ncwcd',
} as const;

/** Quitter's public salt, which its likes are hashed with (qapp-core hashWord). */
export const QUITTER_SALT = '6hMqDBxky6j1G2wZEHgIiOeApj3x3CP8LQwg0Ok0RVc=';

/** A Q-Tube comment's prefix; what follows is the 20-character hash of its video's id. */
export const QTUBE_COMMENT_PREFIX = 'qc_v1_qtube_';

/** The video hash in a Q-Tube comment's identifier, or null. */
export function qtubeCommentHash(identifier: string): string | null {
  if (!identifier.startsWith(QTUBE_COMMENT_PREFIX)) return null;
  const hash = identifier.slice(QTUBE_COMMENT_PREFIX.length, QTUBE_COMMENT_PREFIX.length + 20);
  return hash.length === 20 &&
    /_(base|reply)_/.test(identifier.slice(QTUBE_COMMENT_PREFIX.length + 20))
    ? hash
    : null;
}

/** A Q-Tube like (since 2025-10): a bare 20-character qapp-core hash. */
export function isQtubeLikeHash(identifier: string): boolean {
  return /^[A-Za-z0-9.~!]{20}$/.test(identifier);
}

/** `qcomment_v1_<app>_<last 12 of its parent>_(base|reply)_…`: the key, or null. */
export function qcommentKey(identifier: string, app: string): string | null {
  const prefix = `qcomment_v1_${app}_`;
  if (!identifier.startsWith(prefix)) return null;
  const key = identifier.slice(prefix.length, prefix.length + 12);
  return key.length === 12 ? key : null;
}

const nameSafe = (name: string) => !/[/?#]/.test(name);

function qortalSite(service: 'WEBSITE' | 'APP', name: string): QdnPlace | null {
  if (!nameSafe(name)) return null;
  return service === 'WEBSITE'
    ? {
        app: 'Qortal',
        what: 'A website',
        link: `qortal://WEBSITE/${name}`,
        label: 'Open the website',
      }
    : { app: 'Qortal', what: 'A Q-App', link: `qortal://APP/${name}`, label: 'Open the Q-App' };
}

function mintership(identifier: string, name: string): QdnPlace | null {
  const subject = (prefix: string) => {
    if (!identifier.startsWith(prefix)) return null;
    const address = identifier.slice(prefix.length).split('-')[0];
    return isAddress(address) ? address : null;
  };
  const nominee = subject('qmp-nomination-');
  if (nominee)
    return {
      app: APP_NAME,
      what: 'A nomination',
      path: nominationPath(nominee),
      label: 'Open the nomination',
    };
  const supported = subject('qmp-support-');
  if (supported)
    return {
      app: APP_NAME,
      what: 'Support for a nomination',
      path: nominationPath(supported),
      label: 'Open the nomination',
    };
  if (identifier.startsWith('qmp-vote-')) {
    const parts = identifier.slice('qmp-vote-'.length).split('-');
    if (isAddress(parts[0]))
      return {
        app: APP_NAME,
        what: 'A vote on a nomination',
        path: nominationPath(parts[0]),
        label: 'Open the nomination',
      };
    if (['remove', 'ban', 'admin'].includes(parts[0]) && isAddress(parts[1]))
      return {
        app: APP_NAME,
        what: 'A vote on a proposal',
        path: personPath(parts[1]),
        label: 'Open their Minter Profile',
      };
  }
  if (identifier.startsWith('qmp-comment-'))
    return {
      app: APP_NAME,
      what: 'A comment',
      path: commentPath(name, identifier),
      label: 'Open the comment',
    };
  if (identifier.startsWith('Minter-board-card-') || identifier.startsWith('QM-AR-card-'))
    return {
      app: ORIGINAL_APP_NAME,
      what: `A card of ${ORIGINAL_WORDS.named}`,
      path: legacyCardPath(identifier),
      label: 'Open the card',
    };
  const card = /^comment-((?:Minter-board-card|QM-AR-card)-.+)-[^-]+$/.exec(identifier)?.[1];
  if (card)
    return {
      app: ORIGINAL_APP_NAME,
      what: `A comment on a card of ${ORIGINAL_WORDS.named}`,
      path: legacyCardPath(card),
      label: 'Open the card',
    };
  return null;
}

function torq(service: string, name: string, id: string): QdnPlace | null {
  if (service !== 'DOCUMENT') return null;
  const user = { label: 'Open their page in Torq', link: qappLink(QAPP.torq, 'user', name) };
  if (id.startsWith(`${TORQ_ID.app}-`) && id.endsWith('-v1')) {
    const entity = id.split('-')[1];
    const self = (route: string) => qappLink(QAPP.torq, route, name, id);
    switch (entity) {
      case TORQ_ID.post:
        return {
          app: QAPP.torq,
          what: 'A post',
          link: self('post'),
          label: 'Open the post in Torq',
        };
      case TORQ_ID.reply:
        return {
          app: QAPP.torq,
          what: 'A reply to a post',
          // Torq opens a reply in its conversation.
          link: self('post'),
          label: 'Open the reply in Torq',
          read: 'torqReply',
          target: 'the post it answers',
        };
      case TORQ_ID.repost:
        return {
          app: QAPP.torq,
          what: 'A repost',
          read: 'torqRepost',
          target: 'the post it reposts',
          fallback: user,
        };
      case TORQ_ID.rev:
        return { app: QAPP.torq, what: 'A rev', link: self('rev'), label: 'Open the rev in Torq' };
      case TORQ_ID.revReply:
        return {
          app: QAPP.torq,
          what: 'A reply to a rev',
          link: self('rev-reply'),
          label: 'Open the reply in Torq',
        };
      default:
        return { app: QAPP.torq, what: 'A Torq record', fallback: user };
    }
  }
  if (id.startsWith(TORQ_ID.like) && id.length === 28)
    return {
      app: QAPP.torq,
      what: 'A like of a post',
      read: 'torqLike',
      onRequest: true,
      target: 'the post it likes',
      fallback: {
        label: 'Open their likes in Torq',
        link: qappLink(QAPP.torq, 'user', name, 'likes'),
      },
    };
  if (id.startsWith(TORQ_ID.follow))
    return {
      app: QAPP.torq,
      what: 'A follow',
      read: 'torqFollow',
      target: 'who it follows',
      fallback: user,
    };
  if (id.startsWith(TORQ_ID.superlike))
    return {
      app: QAPP.torq,
      what: 'A super like',
      link: qappLink(QAPP.torq, 'superlike', name, id),
      label: 'Open the super like in Torq',
    };
  return null;
}

function qtube(service: string, name: string, id: string): QdnPlace | null {
  const video = (routeId: string): QdnPlace => ({
    app: QAPP.qtube,
    what: 'A video',
    link: qappLink(QAPP.qtube, 'video', name, routeId),
    label: 'Open the video in Q-Tube',
  });
  if (id.startsWith('qtube_vid_')) {
    if (service === 'DOCUMENT' && id.endsWith('_metadata')) return video(id);
    // The video file: its page is its record's, the same id with `_metadata`.
    if (service === 'VIDEO') return video(`${id}_metadata`);
    return null;
  }
  if (service === 'PLAYLIST' && id.startsWith('qtube_playlist_'))
    return {
      app: QAPP.qtube,
      what: 'A playlist',
      link: qappLink(QAPP.qtube, 'playlist', name, id),
      label: 'Open the playlist in Q-Tube',
    };
  if (service === 'DOCUMENT' && id === 'qtube_channel_description')
    return {
      app: QAPP.qtube,
      what: 'A channel’s description',
      link: qappLink(QAPP.qtube, 'channel', name),
      label: 'Open the channel in Q-Tube',
    };
  if (service === 'BLOG_COMMENT' && id.startsWith('qtube_superlike_'))
    return {
      app: QAPP.qtube,
      what: 'A super like',
      read: 'qtubeSuperlike',
      target: 'the video it supports',
      fallback: QTUBE_HOME,
    };
  if (service === 'BLOG_COMMENT' && qtubeCommentHash(id))
    return {
      app: QAPP.qtube,
      what: id.includes('_reply_') ? 'A reply to a comment on a video' : 'A comment on a video',
      read: 'qtubeComment',
      onRequest: true,
      target: 'the video it’s on',
      fallback: QTUBE_HOME,
    };
  if (service === 'BLOG_COMMENT' && id.startsWith('qcomment_v1_qtube_'))
    // The old comments, which Q-Tube no longer shows.
    return { app: QAPP.qtube, what: 'An old Q-Tube comment', fallback: QTUBE_HOME };
  if (service === 'CHAIN_COMMENT' && (id.startsWith('qtube_like_') || isQtubeLikeHash(id)))
    return {
      app: QAPP.qtube,
      what: 'A like (or dislike) of a video',
      read: 'qtubeLike',
      onRequest: true,
      target: 'the video it’s about',
      fallback: QTUBE_HOME,
    };
  return null;
}

function qshare(service: string, name: string, id: string): QdnPlace | null {
  const channel = {
    label: 'Open their channel in Q-Share',
    link: qappLink(QAPP.qshare, 'channel', name),
  };
  if (service === 'DOCUMENT' && id.startsWith('qshare_file_') && id.endsWith('_metadata'))
    return {
      app: QAPP.qshare,
      what: 'A share',
      link: qappLink(QAPP.qshare, 'share', name, id),
      label: 'Open the share in Q-Share',
    };
  if (service === 'FILE' && id.startsWith('qshare_file_'))
    return {
      app: QAPP.qshare,
      what: 'A shared file',
      read: 'qshareFile',
      target: 'its share',
      fallback: channel,
    };
  if (service === 'DOCUMENT' && id.startsWith('qshare_collection_'))
    // Q-Share has no page for one: its publisher's channel.
    return { app: QAPP.qshare, what: 'A collection', fallback: channel };
  if (service === 'BLOG_COMMENT' && qcommentKey(id, 'qshare'))
    return {
      app: QAPP.qshare,
      what: id.includes('_reply_') ? 'A reply to a comment on a share' : 'A comment on a share',
      read: 'qshareComment',
      target: 'the share it’s on',
      fallback: { label: 'Open Q-Share', link: qappLink(QAPP.qshare) },
    };
  return null;
}

function qfund(service: string, name: string, id: string): QdnPlace | null {
  const home = { label: 'Open Q-Fund', link: qappLink(QAPP.qfund) };
  if (service === 'DOCUMENT' && id.startsWith('q-fund_crowdfund_'))
    return {
      app: QAPP.qfund,
      what: 'A crowdfund',
      link: qappLink(QAPP.qfund, 'crowdfund', name, id),
      label: 'Open the crowdfund in Q-Fund',
    };
  if (service === 'DOCUMENT' && id.startsWith('q-fund_update_crowdfund_'))
    return {
      app: QAPP.qfund,
      what: 'An update to a crowdfund',
      read: 'qfundUpdate',
      target: 'its crowdfund',
      fallback: home,
    };
  if (service === 'BLOG_COMMENT' && qcommentKey(id, 'q-fund'))
    return {
      app: QAPP.qfund,
      what: id.includes('_reply_')
        ? 'A reply to a comment on a crowdfund'
        : 'A comment on a crowdfund',
      read: 'qfundComment',
      target: 'the crowdfund it’s on',
      fallback: home,
    };
  return null;
}

function qsupport(service: string, name: string, id: string): QdnPlace | null {
  if (service === 'DOCUMENT' && id.startsWith('q_support_issue_') && id.endsWith('_metadata'))
    return {
      app: QAPP.qsupport,
      what: 'An issue',
      link: qappLink(QAPP.qsupport, 'issue', name, id),
      label: 'Open the issue in Q-Support',
    };
  if (service === 'FILE' && id.startsWith('q_support_issue_'))
    return {
      app: QAPP.qsupport,
      what: 'A file of an issue',
      fallback: {
        label: 'Open their issues in Q-Support',
        link: qappLink(QAPP.qsupport, 'channel', name),
      },
    };
  if (service === 'BLOG_COMMENT' && qcommentKey(id, 'q_support'))
    return {
      app: QAPP.qsupport,
      what: id.includes('_reply_') ? 'A reply to a comment on an issue' : 'A comment on an issue',
      read: 'qsupportComment',
      target: 'the issue it’s on',
      fallback: { label: 'Open Q-Support', link: qappLink(QAPP.qsupport) },
    };
  return null;
}

function qshop(service: string, name: string, id: string): QdnPlace | null {
  const store = (storeId: string, what: string): QdnPlace => ({
    app: QAPP.qshop,
    what,
    link: qappLink(QAPP.qshop, name, storeId),
    label: 'Open the store in Q-Shop',
  });
  if (service === 'STORE' && id.startsWith('q-store-general-')) return store(id, 'A store');
  if (service === 'DOCUMENT' && id.startsWith('q-store-general-') && id.endsWith('-datacontainer'))
    return store(id.slice(0, -'-datacontainer'.length), 'A store’s data');
  if (service === 'DOCUMENT' && id.startsWith('q-store-catalogue-')) {
    const parts = id.slice('q-store-catalogue-'.length).split('-');
    if (parts.length >= 2)
      return store(`q-store-general-${parts.slice(0, -1).join('-')}`, 'A store’s catalogue');
  }
  if (service === 'DOCUMENT' && id.startsWith('q-store-review-'))
    return {
      app: QAPP.qshop,
      what: 'A review of a store',
      read: 'qshopReview',
      target: 'the store it reviews',
      fallback: { label: 'Open Q-Shop', link: qappLink(QAPP.qshop) },
    };
  return null;
}

function qblog(service: string, name: string, id: string): QdnPlace | null {
  if (!id.toLowerCase().startsWith('q-blog-')) return null;
  const rest = id.slice('q-blog-'.length);
  const post = rest.toLowerCase().indexOf('-post-');
  if (service === 'BLOG_POST' && post > 0)
    return {
      app: QAPP.qblog,
      what: 'A blog post',
      link: qappLink(QAPP.qblog, name, rest.slice(0, post), rest.slice(post + '-post-'.length)),
      label: 'Open the post in Q-Blog',
    };
  if (service === 'BLOG' && rest)
    return {
      app: QAPP.qblog,
      what: 'A blog',
      link: qappLink(QAPP.qblog, name, rest),
      label: 'Open the blog in Q-Blog',
    };
  return null;
}

function music(name: string, id: string): QdnPlace | null {
  if (id.startsWith('enjoymusic_song_comment_'))
    return {
      app: QAPP.qmusic,
      what: 'A comment on a song',
      read: 'qmusicComment',
      target: 'the song it’s on',
      fallback: { label: 'Open Q-Music', link: qappLink(QAPP.qmusic) },
    };
  if (id.startsWith('enjoymusic_song_'))
    return {
      app: QAPP.qmusic,
      what: 'A song',
      link: qappLink(QAPP.qmusic, 'songs', name, id),
      label: 'Open the song in Q-Music',
    };
  if (id.startsWith('enjoymusic_playlist_'))
    return {
      app: QAPP.qmusic,
      what: 'A playlist',
      link: qappLink(QAPP.qmusic, 'playlists', name, id),
      label: 'Open the playlist in Q-Music',
    };
  if (id.startsWith('earbump_playlist_'))
    return {
      app: QAPP.earbump,
      what: 'A playlist',
      link: qappLink(QAPP.earbump, 'playlists', name, id),
      label: 'Open the playlist in Ear-Bump',
    };
  if (id.startsWith('earbump_song_'))
    return {
      app: QAPP.earbump,
      what: 'A song',
      fallback: { label: 'Open Ear-Bump', link: qappLink(QAPP.earbump) },
    };
  return null;
}

/**
 * Where a public QDN resource belongs, or null when no app is known for it.
 * `identifier` null: the resource's default.
 */
export function qdnPlace(
  service: string,
  name: string,
  identifier: string | null
): QdnPlace | null {
  if (!name.trim()) return null;
  if (identifier === null)
    return service === 'WEBSITE' || service === 'APP' ? qortalSite(service, name) : null;
  return (
    mintership(identifier, name) ??
    torq(service, name, identifier) ??
    qtube(service, name, identifier) ??
    qshare(service, name, identifier) ??
    qfund(service, name, identifier) ??
    qsupport(service, name, identifier) ??
    qshop(service, name, identifier) ??
    qblog(service, name, identifier) ??
    music(name, identifier)
  );
}
