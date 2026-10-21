/**
 * What a QDN publish answers or belongs to, when its identifier alone can't
 * say (rules/explorer/qdnPlaces.ts names the read). Read-only, on the
 * transaction's page:
 *
 * - one body: a Torq reply's post (`location`), a repost's original, a
 *   follow's account; a Q-Tube super like's video (`notificationInformation`);
 *   a Q-Music comment's song;
 * - one search (`/arbitrary/resources/search`, 20 rows): the share, crowdfund
 *   or issue a `qcomment_v1_…` comment ends in the key of; a crowdfund's
 *   update's crowdfund; a store's review's store; a Q-Share file's share
 *   (and up to 5 of its shares' bodies);
 * - only when asked, a scan: the videos (or Torq posts) published before a
 *   comment or a like, newest first, 100 a page, at most 10 pages, each id
 *   hashed as the app hashed it until one matches (utils/sha256.ts).
 *
 * Kept for the session, by the resource's version. Null: nothing found.
 */
import { getJson, query } from '../core';
import { fetchQdnJson } from '../qdn';
import { fetchQuery } from '../query';
import type { QdnRow } from '../types';
import {
  QAPP,
  QUITTER_SALT,
  TORQ_ID,
  qappLink,
  qcommentKey,
  qtubeCommentHash,
  type PlaceRead,
} from '../../rules/explorer/qdnPlaces';
import { qappHash } from '../../utils/sha256';

/** What a read found: where to open it. */
export interface PlaceFound {
  link: string;
  /** The button: "Open the post it answers in Torq". */
  label: string;
}

export interface PlaceSource {
  service: string;
  name: string;
  identifier: string;
  /** The transaction's signature: the body's version. */
  version: string;
  /** When it was published (ms): a scan looks before it. */
  created: number;
}

/** A scan reads at most this many pages of 100. */
export const SCAN_PAGES = 10;
const PAGE = 100;

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

function search(params: Record<string, string | number | boolean>): Promise<QdnRow[]> {
  return getJson<unknown>(
    `/arbitrary/resources/search?${query({ mode: 'ALL', reverse: true, ...params })}`
  ).then((body) => (Array.isArray(body) ? (body as QdnRow[]) : []));
}

/**
 * The newest resource a `qcomment_v1_…` comment's key ends: the comments of
 * Q-Share, Q-Fund and Q-Support carry the last 12 characters of what they're
 * on (as the apps themselves find it).
 */
async function byKey(
  key: string,
  start: string,
  options: { name?: string } = {}
): Promise<QdnRow | null> {
  const rows = await search({
    service: 'DOCUMENT',
    identifier: key,
    limit: 20,
    ...(options.name ? { name: options.name, exactmatchnames: true } : {}),
  });
  return (
    rows.find((row) => row.identifier.startsWith(start) && row.identifier.endsWith(key)) ?? null
  );
}

/** Pages of `prefix` resources published before `before`, until `match` finds one. */
async function scan(
  service: string,
  prefix: string,
  before: number,
  match: (row: QdnRow) => boolean
): Promise<QdnRow | null> {
  for (let page = 0; page < SCAN_PAGES; page++) {
    const rows = await getJson<unknown>(
      `/arbitrary/resources/searchsimple?${query({
        service,
        identifier: prefix,
        prefix: true,
        before,
        limit: PAGE,
        offset: page * PAGE,
        reverse: true,
      })}`
    ).then((body) => (Array.isArray(body) ? (body as QdnRow[]) : []));
    const hit = rows.find(match);
    if (hit) return hit;
    if (rows.length < PAGE) break;
  }
  return null;
}

const torqPost = (name: string, identifier: string, label: string): PlaceFound => ({
  link: qappLink(QAPP.torq, 'post', name, identifier),
  label,
});
const video = (row: { name: string; identifier: string }): PlaceFound => ({
  link: qappLink(QAPP.qtube, 'video', row.name, row.identifier),
  label: 'Open the video in Q-Tube',
});

async function read(kind: PlaceRead, source: PlaceSource): Promise<PlaceFound | null> {
  const { service, name, identifier: id, version, created } = source;
  const body = () => fetchQdnJson<unknown>(service, name, id, version).then(record);
  switch (kind) {
    case 'torqReply': {
      const location = record((await body()).location);
      const post = { name: text(location.name), identifier: text(location.identifier) };
      return post.name && post.identifier
        ? torqPost(post.name, post.identifier, 'Open the post it answers in Torq')
        : null;
    }
    case 'torqRepost': {
      const original = record((await body()).repostMetadata);
      const post = {
        name: text(original.originalPostName),
        identifier: text(original.originalPostIdentifier),
      };
      return post.name && post.identifier
        ? torqPost(post.name, post.identifier, 'Open the reposted post in Torq')
        : null;
    }
    case 'torqFollow': {
      const followed = text((await body()).followedName);
      return followed
        ? { link: qappLink(QAPP.torq, 'user', followed), label: `Open ${followed} in Torq` }
        : null;
    }
    case 'torqLike': {
      const hash = id.slice(TORQ_ID.like.length);
      const hit = await scan('DOCUMENT', `${TORQ_ID.app}-`, created, (row) =>
        row.identifier.endsWith('-v1') ? qappHash(row.identifier, 14, QUITTER_SALT) === hash : false
      );
      return hit ? torqPost(hit.name, hit.identifier, 'Open the liked post in Torq') : null;
    }
    case 'qtubeSuperlike': {
      const about = record((await body()).notificationInformation);
      const target = { name: text(about.name), identifier: text(about.identifier) };
      return target.name && target.identifier
        ? video({ name: target.name, identifier: target.identifier })
        : null;
    }
    case 'qtubeComment': {
      const hash = qtubeCommentHash(id);
      if (!hash) return null;
      const hit = await scan(
        'DOCUMENT',
        'qtube_vid_',
        created,
        (row) => row.identifier.endsWith('_metadata') && qappHash(row.identifier, 20) === hash
      );
      return hit ? video(hit) : null;
    }
    case 'qtubeLike': {
      if (id.startsWith('qtube_like_')) {
        // The old likes: the first 39 characters of the video's id.
        const start = id.slice('qtube_like_'.length);
        const rows = await search({
          service: 'DOCUMENT',
          identifier: start,
          prefix: true,
          limit: 20,
        });
        const hit = rows.find((row) => row.identifier.endsWith('_metadata'));
        return hit ? video(hit) : null;
      }
      // Since 2025-10: the video's id and its channel's name, hashed.
      const hit = await scan(
        'DOCUMENT',
        'qtube_vid_',
        created,
        (row) =>
          row.identifier.endsWith('_metadata') && qappHash(row.identifier + row.name, 20) === id
      );
      return hit ? video(hit) : null;
    }
    case 'qmusicComment': {
      const about = await body();
      const entity = { id: text(about.entityId), publisher: text(about.entityPublisher) };
      if (!entity.id || !entity.publisher) return null;
      const playlist = String(about.entityType ?? '')
        .toLowerCase()
        .includes('playlist');
      return {
        link: qappLink(QAPP.qmusic, playlist ? 'playlists' : 'songs', entity.publisher, entity.id),
        label: playlist ? 'Open the playlist in Q-Music' : 'Open the song in Q-Music',
      };
    }
    case 'qshareFile': {
      // Its share lists it: the same name's shares from about when it was published.
      const rows = await search({
        service: 'DOCUMENT',
        identifier: 'qshare_file_',
        prefix: true,
        name,
        exactmatchnames: true,
        before: created + 3_600_000,
        limit: 20,
      });
      const shares = rows.filter((row) => row.identifier.endsWith('_metadata')).slice(0, 5);
      for (const share of shares) {
        const files = await fetchQdnJson<unknown>(
          'DOCUMENT',
          share.name,
          share.identifier,
          share.latestSignature ?? share.updated ?? share.created
        )
          .then((value) => record(value).files)
          .catch(() => null);
        if (Array.isArray(files) && files.some((file) => record(file).identifier === id))
          return {
            link: qappLink(QAPP.qshare, 'share', share.name, share.identifier),
            label: 'Open its share in Q-Share',
          };
      }
      return null;
    }
    case 'qshareComment':
    case 'qfundComment':
    case 'qsupportComment': {
      const spec = {
        qshareComment: {
          app: 'qshare',
          start: 'qshare_file_',
          route: 'share',
          label: 'Open the share in Q-Share',
          qapp: QAPP.qshare,
        },
        qfundComment: {
          app: 'q-fund',
          start: 'q-fund_crowdfund_',
          route: 'crowdfund',
          label: 'Open the crowdfund in Q-Fund',
          qapp: QAPP.qfund,
        },
        qsupportComment: {
          app: 'q_support',
          start: 'q_support_issue_',
          route: 'issue',
          label: 'Open the issue in Q-Support',
          qapp: QAPP.qsupport,
        },
      }[kind];
      const key = qcommentKey(id, spec.app);
      const hit = key ? await byKey(key, spec.start) : null;
      return hit
        ? { link: qappLink(spec.qapp, spec.route, hit.name, hit.identifier), label: spec.label }
        : null;
    }
    case 'qfundUpdate': {
      const key = id.slice(
        'q-fund_update_crowdfund_'.length,
        'q-fund_update_crowdfund_'.length + 12
      );
      const hit = key.length === 12 ? await byKey(key, 'q-fund_crowdfund_', { name }) : null;
      return hit
        ? {
            link: qappLink(QAPP.qfund, 'crowdfund', hit.name, hit.identifier),
            label: 'Open the crowdfund in Q-Fund',
          }
        : null;
    }
    case 'qshopReview': {
      const parts = id.slice('q-store-review-'.length).split('-');
      if (parts.length < 3) return null;
      const store = `q-store-general-${parts.slice(0, -2).join('-')}`;
      const rows = await search({ service: 'STORE', identifier: store, prefix: true, limit: 20 });
      const hit = rows.find((row) => row.identifier === store);
      return hit
        ? {
            link: qappLink(QAPP.qshop, hit.name, hit.identifier),
            label: 'Open the store in Q-Shop',
          }
        : null;
    }
  }
}

/** What `source` answers or belongs to. Key `xplace:<read>:<name>:<identifier>:<version>`. */
export function findPlace(
  kind: PlaceRead,
  source: PlaceSource,
  options: { force?: boolean } = {}
): Promise<PlaceFound | null> {
  return fetchQuery(placeKey(kind, source), () => read(kind, source), {
    ttlMs: Number.POSITIVE_INFINITY,
    force: options.force,
  });
}

export function placeKey(kind: PlaceRead, source: PlaceSource): string {
  return `xplace:${kind}:${source.name}:${source.identifier}:${source.version}`;
}
