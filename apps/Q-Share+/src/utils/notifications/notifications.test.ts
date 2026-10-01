import { beforeEach, describe, expect, it } from "vitest";
import { fetchCallsMatching, mockFetch, mockQortalAction, qortalCallsFor } from "../../test/setup";
import { resetCollectionCaches } from "../collections";
import { invalidateQdnSearches, resetQdnSearchCache } from "../qdnSearch";
import { recipientMarker } from "../recipientMarker";
import { loadActivity, parseCommentIdentifier, resetActivity } from "./activity";
import { checkNotifications, FIRST_LOOK_BACK_MS, COMMENT_SLACK_MS } from "./check";
import { markAllRead, readNotifications, resetNotificationStore } from "./store";

const ADDRESS = "Q9aWbQnCZXmuNNkpg6t4sTCk8CRYoGF7Ce";
const ACCOUNT = { address: ADDRESS, names: ["alice", "Alice Two"] };
const ON = { comments: true, collections: true, hiddenNames: [] as string[] };
const DAY = 24 * 60 * 60_000;
const NOW = 1_800_000_000_000;

// alice's share "Docs" (comment key "def_metadata") and her comment on bob's share (reply key "qq1234").
const SHARE = {
  name: "alice",
  service: "DOCUMENT",
  identifier: "qshare_file_docs_abcdef_metadata",
  created: 1,
  metadata: { title: "Docs" },
};
const MY_COMMENT = {
  name: "alice",
  service: "BLOG_COMMENT",
  identifier: "qcomment_v1_qshare_xyz_metadata_base_qq1234",
  created: 2,
};

type Row = Record<string, unknown>;
let comments: Row[];
let collections: Row[];
let bodies: Record<string, unknown>;
/** The node's last block time; comments up to it are indexed. */
let lastBlock: number;

function serve() {
  mockFetch("/arbitrary/resources/search", (url: URL) => {
    const q = url.searchParams;
    const names = q.getAll("name");
    if (q.get("service") === "DOCUMENT" && q.get("identifier") === "qshare_file_")
      return names.includes("alice") ? [SHARE] : [];
    if (q.get("service") === "BLOG_COMMENT" && names.length) return names.includes("alice") ? [MY_COMMENT] : [];
    if (q.get("service") === "BLOG_COMMENT") {
      const after = Number(q.get("after") ?? 0);
      const offset = Number(q.get("offset") ?? 0);
      const ordered = [...comments].sort((a, b) => Number(a.created) - Number(b.created));
      if (q.get("reverse") !== "false") ordered.reverse();
      return ordered.filter((c) => Number(c.created) > after).slice(offset, offset + Number(q.get("limit")));
    }
    if (q.get("service") === "DOCUMENT" && q.get("identifier") === "qshare_collection_") {
      return collections.filter((c) =>
        String((c.metadata as Row)?.description ?? "").includes(q.get("description") ?? "")
      );
    }
    return [];
  });
  mockQortalAction("FETCH_QDN_RESOURCE", (p: Row) => bodies[`${p.name}/${p.identifier}`]);
  mockFetch("/blocks/last", () => ({ height: 1, timestamp: lastBlock }));
}

const comment = (name: string, identifier: string, created: number): Row => ({
  name,
  service: "BLOG_COMMENT",
  identifier,
  created,
});
const check = (now: number, options = ON) => checkNotifications(ACCOUNT, { ...options, now });
const items = () => readNotifications(ADDRESS).items;

describe("parseCommentIdentifier", () => {
  it("reads the share key and, for a reply, the comment it answers", () => {
    expect(parseCommentIdentifier("qcomment_v1_qshare_def_metadata_base_a1b2c3")).toEqual({ key: "def_metadata" });
    expect(parseCommentIdentifier("qcomment_v1_qshare_def_metadata_reply_qq1234_z9y8x7")).toEqual({
      key: "def_metadata",
      parent: "qq1234",
    });
    expect(parseCommentIdentifier("qcomment_v1_qshare_short")).toBeNull();
    expect(parseCommentIdentifier("qshare_file_docs")).toBeNull();
    // Some other client keyed comments by the share's commentsId: not ours to read here.
    expect(parseCommentIdentifier("qcomment_v1_qshare_qshare_file__cm_abc_base_x")).toBeNull();
  });
});

describe("notification checks", () => {
  beforeEach(() => {
    localStorage.clear();
    resetNotificationStore();
    resetActivity();
    resetQdnSearchCache();
    resetCollectionCaches();
    comments = [];
    collections = [];
    bodies = {};
    lastBlock = Number.MAX_SAFE_INTEGER;
    serve();
  });

  it("files the past week as read on the first check, then reports what is new as unread", async () => {
    comments = [
      comment("bob", "qcomment_v1_qshare_def_metadata_base_old111", NOW - 2 * DAY),
      comment("carol", "qcomment_v1_qshare_zzzzzzzzzzzz_base_oth111", NOW - DAY),
    ];
    expect(await check(NOW)).toBe(0);
    expect(items()).toMatchObject([
      {
        kind: "comment",
        actor: "bob",
        read: true,
        share: { name: "alice", identifier: SHARE.identifier, title: "Docs" },
      },
    ]);
    expect(fetchCallsMatching(/service=BLOG_COMMENT.*after=/)[0]).toContain(`after=${NOW - FIRST_LOOK_BACK_MS}`);

    comments.push(comment("dave", "qcomment_v1_qshare_def_metadata_base_new111", NOW + 1000));
    expect(await check(NOW + 120_000)).toBe(1);
    expect(items()[0]).toMatchObject({ kind: "comment", actor: "dave", read: false });
    // The next search starts from the last check, minus the slack for late arrivals.
    expect(fetchCallsMatching(/service=BLOG_COMMENT.*after=/).at(-1)).toContain(`after=${NOW - COMMENT_SLACK_MS}`);
  });

  it("tells you about replies to your comments, but not about your own comments or hidden names", async () => {
    await check(NOW);
    comments = [
      comment("bob", "qcomment_v1_qshare_xyz_metadata_reply_qq1234_r1r1r1", NOW + 1),
      comment("Alice Two", "qcomment_v1_qshare_def_metadata_base_self11", NOW + 2),
      comment("spammer", "qcomment_v1_qshare_def_metadata_base_spam11", NOW + 3),
    ];
    expect(await check(NOW + 60_000, { ...ON, hiddenNames: ["Spammer"] })).toBe(1);
    expect(items()).toHaveLength(1);
    // A reply to your comment on someone else's share: the share is found when it's opened.
    expect(items()[0]).toMatchObject({ kind: "reply", actor: "bob", share: undefined, comment: { name: "bob" } });
  });

  it("never reports the same comment twice", async () => {
    await check(NOW);
    comments = [comment("bob", "qcomment_v1_qshare_def_metadata_base_dup111", NOW + 1)];
    expect(await check(NOW + 60_000)).toBe(1);
    // Inside the slack window it comes back from Core, and is passed over.
    expect(await check(NOW + 120_000)).toBe(0);
    expect(items()).toHaveLength(1);
  });

  it("finds your share in someone's collection through your marker, reading each version once", async () => {
    const coll = {
      name: "bob",
      service: "DOCUMENT",
      identifier: "qshare_collection_faves_aaaaaa",
      created: NOW - 5 * DAY,
      updated: NOW + 10,
      metadata: { title: "Faves", description: `Good stuff ${recipientMarker(ADDRESS)}` },
    };
    bodies["bob/qshare_collection_faves_aaaaaa"] = {
      version: 1,
      title: "Faves",
      description: "Good stuff",
      items: [
        { name: "carol", identifier: "qshare_file_x_cccccc_metadata" },
        { name: "alice", identifier: SHARE.identifier },
      ],
      created: 1,
      updated: 2,
    };
    await check(NOW);
    collections = [coll];
    expect(await check(NOW + 60_000)).toBe(1);
    expect(items()[0]).toMatchObject({
      kind: "collection",
      actor: "bob",
      read: false,
      share: { name: "alice", identifier: SHARE.identifier, title: "Docs" },
      collection: { name: "bob", identifier: coll.identifier, title: "Faves" },
    });
    const markerSearch = fetchCallsMatching(/description=/)[0];
    expect(markerSearch).toContain(new URLSearchParams({ description: recipientMarker(ADDRESS) }).toString());
    // Core's prefix=true would match the description from its start only, and the marker is at the end.
    expect(markerSearch).not.toContain("prefix=true");

    // The same version isn't read again.
    await check(NOW + 120_000);
    expect(qortalCallsFor("FETCH_QDN_RESOURCE")).toHaveLength(1);
  });

  it("reads comments oldest first and moves only as far as the node has indexed", async () => {
    // The node is two hours behind (syncing): the window stops there.
    lastBlock = NOW - 2 * 60 * 60_000;
    await check(NOW);
    expect(fetchCallsMatching(/service=BLOG_COMMENT.*after=/)[0]).toContain("reverse=false");
    // A comment from an hour ago, indexed once the node caught up, is still found.
    comments = [comment("bob", "qcomment_v1_qshare_def_metadata_base_late11", NOW - 60 * 60_000)];
    lastBlock = NOW + 60_000;
    expect(await check(NOW + 60_000)).toBe(1);
    expect(fetchCallsMatching(/service=BLOG_COMMENT.*after=/).at(-1)).toContain(
      `after=${NOW - 2 * 60 * 60_000 - COMMENT_SLACK_MS}`
    );
  });

  it("carries on after the last comment read when a check stops at its page limit", async () => {
    await check(NOW);
    // 230 comments on other shares, then one on alice's: more than four pages of 50.
    comments = Array.from({ length: 230 }, (_, i) =>
      comment("carol", `qcomment_v1_qshare_zzzzzzzzzzzz_base_x${String(i).padStart(5, "0")}`, NOW + 1 + i)
    );
    comments.push(comment("bob", "qcomment_v1_qshare_def_metadata_base_last11", NOW + 500));
    expect(await check(NOW + 60_000)).toBe(0);
    expect(fetchCallsMatching(/service=BLOG_COMMENT.*after=/)).toHaveLength(5);
    // The next check starts after the 200th comment (created NOW + 200) and finds alice's.
    expect(await check(NOW + 120_000)).toBe(1);
    expect(fetchCallsMatching(/service=BLOG_COMMENT.*after=/).at(-1)).toContain(`after=${NOW + 200}`);
  });

  it("gives a kind switched on later its own first look, filed as read", async () => {
    comments = [comment("bob", "qcomment_v1_qshare_def_metadata_base_wk1111", NOW - DAY)];
    await check(NOW, { comments: false, collections: true, hiddenNames: [] });
    expect(await check(NOW + 60_000)).toBe(0);
    expect(fetchCallsMatching(/service=BLOG_COMMENT.*after=/)[0]).toContain(
      `after=${NOW + 60_000 - FIRST_LOOK_BACK_MS}`
    );
    expect(items()).toMatchObject([{ actor: "bob", read: true }]);
  });

  it("notes a failed check, and clears the note when one works", async () => {
    mockFetch("/arbitrary/resources/search", () => {
      throw new Error("node down");
    });
    await expect(check(NOW)).rejects.toThrow();
    expect(readNotifications(ADDRESS)).toMatchObject({ lastError: NOW, lastCheck: 0 });
    serve();
    await check(NOW + 60_000);
    expect(readNotifications(ADDRESS)).toMatchObject({ lastError: 0, lastCheck: NOW + 60_000 });
  });

  it("checks only what Settings asks for", async () => {
    await check(NOW, { comments: false, collections: false, hiddenNames: [] });
    expect(fetchCallsMatching("/arbitrary/resources/search")).toEqual([]);
    await check(NOW + 1, { comments: false, collections: true, hiddenNames: [] });
    expect(fetchCallsMatching(/service=BLOG_COMMENT.*after=/)).toEqual([]);
  });

  it("keeps the read state set while a check was running", async () => {
    await check(NOW);
    comments = [comment("bob", "qcomment_v1_qshare_def_metadata_base_rd1111", NOW + 1)];
    await check(NOW + 60_000);
    const pending = check(NOW + 61_000);
    markAllRead(ADDRESS);
    await pending;
    expect(items().every((i) => i.read)).toBe(true);
  });
});

describe("your shares and comments", () => {
  beforeEach(() => {
    resetActivity();
    resetQdnSearchCache();
    serve();
  });

  it("are looked up once, in pages of 100, and again after a publish", async () => {
    const first = await loadActivity(["alice"], NOW);
    expect([...first.shares.keys()]).toEqual(["def_metadata"]);
    expect([...first.comments.keys()]).toEqual(["qq1234"]);
    await loadActivity(["alice"], NOW + 60_000);
    expect(fetchCallsMatching(/identifier=qshare_file_/)).toHaveLength(1);
    expect(fetchCallsMatching(/identifier=qshare_file_/)[0]).toContain("limit=100");
    invalidateQdnSearches();
    await loadActivity(["alice"], NOW + 61_000);
    expect(fetchCallsMatching(/identifier=qshare_file_/)).toHaveLength(2);
  });
});
