import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { mockAllIsIntersecting } from "react-intersection-observer/test-utils";
import { useLocation } from "react-router-dom";
import { fetchCallsMatching, mockFetch } from "../../../test/setup";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { store } from "../../../state/store";
import { addUser } from "../../../state/features/authSlice";
import { writeSettings, DEFAULT_SETTINGS } from "../../../utils/settings";
import { resetQdnSearchCache } from "../../../utils/qdnSearch";
import { resetActivity } from "../../../utils/notifications/activity";
import {
  readNotifications,
  resetNotificationStore,
  writeNotifications,
  EMPTY_STATE,
  type AppNotification,
} from "../../../utils/notifications/store";
import { findCommentShare } from "../../../pages/CommentLink/CommentLink";
import { NotificationsButton } from "./NotificationsButton";
import { notificationPath } from "./NotificationList";

vi.mock("../../../hooks/usePhoneLayout", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../hooks/usePhoneLayout")>()),
  usePhoneLayout: () => phone,
}));
let phone = false;

const ADDRESS = "Q9aWbQnCZXmuNNkpg6t4sTCk8CRYoGF7Ce";
const SHARE = { name: "alice", identifier: "qshare_file_docs_abcdef_metadata", title: "Docs" };

const comment: AppNotification = {
  id: "c:bob/qcomment_v1_qshare_def_metadata_base_aaaaaa",
  kind: "comment",
  actor: "bob",
  time: Date.now() - 5 * 60_000,
  read: false,
  share: SHARE,
  comment: { name: "bob", identifier: "qcomment_v1_qshare_def_metadata_base_aaaaaa" },
};
const added: AppNotification = {
  id: "k:carol/qshare_collection_faves_bbbbbb/alice/qshare_file_docs_abcdef_metadata",
  kind: "collection",
  actor: "carol",
  time: Date.now() - 60 * 60_000,
  read: true,
  share: SHARE,
  collection: { name: "carol", identifier: "qshare_collection_faves_bbbbbb", title: "Faves" },
};
const reply: AppNotification = {
  id: "c:dave/qcomment_v1_qshare_xyz_metadata_reply_qq1234_cccccc",
  kind: "reply",
  actor: "dave",
  time: Date.now() - 2 * 60 * 60_000,
  read: true,
  comment: { name: "dave", identifier: "qcomment_v1_qshare_xyz_metadata_reply_qq1234_cccccc" },
};

function Where() {
  const location = useLocation();
  return <p data-testid="where">{location.pathname + location.hash}</p>;
}

const signIn = () =>
  store.dispatch(
    addUser({ address: ADDRESS, publicKey: "k", name: "alice", names: [{ name: "alice", owner: ADDRESS }] })
  );
const seed = (items: AppNotification[], lastCheck = Date.now()) =>
  writeNotifications(ADDRESS, { ...EMPTY_STATE, items, lastCheck });
const bell = () => screen.getByRole("button", { name: /^Notifications/ });
const render = () =>
  renderWithProviders(
    <>
      <NotificationsButton />
      <Where />
    </>,
    { initialEntries: ["/"] }
  );

describe("NotificationsButton", () => {
  beforeEach(() => {
    phone = false;
    localStorage.clear();
    resetNotificationStore();
    writeSettings(DEFAULT_SETTINGS);
    mockFetch("/arbitrary/BLOG_COMMENT/", "Nice files, thanks!");
    signIn();
  });
  afterEach(() => store.dispatch(addUser(null)));

  it("is not there when signed out", () => {
    store.dispatch(addUser(null));
    render();
    expect(screen.queryByRole("button", { name: /^Notifications/ })).toBeNull();
  });

  it("shows the unread count, lists every kind, and reads a comment's opening words", async () => {
    seed([comment, added, reply]);
    render();
    expect(bell()).toHaveAccessibleName("Notifications, 1 new");
    fireEvent.click(bell());
    const dialog = screen.getByRole("dialog", { name: "Notifications" });
    const rows = within(dialog)
      .getAllByRole("button")
      .filter((b) => b.closest("li"));
    expect(rows.map((r) => r.textContent?.replace(/\s+/g, " "))).toEqual([
      expect.stringContaining("bob commented on Docs, new"),
      expect.stringContaining("carol added Docs to Faves"),
      expect.stringContaining("dave replied to your comment"),
    ]);
    expect(rows[0]).toHaveTextContent("5 minutes ago");
    mockAllIsIntersecting(true);
    expect(await within(rows[0]).findByText("“Nice files, thanks!”")).toBeInTheDocument();
    expect(fetchCallsMatching("/arbitrary/BLOG_COMMENT/bob/")).toHaveLength(1);
  });

  it("opens the share at its comments and marks everything read", async () => {
    seed([comment, added]);
    render();
    fireEvent.click(bell());
    fireEvent.click(screen.getByRole("button", { name: /bob commented on Docs/ }));
    expect(screen.getByTestId("where")).toHaveTextContent("/share/alice/qshare_file_docs_abcdef_metadata#comments");
    expect(readNotifications(ADDRESS).items.every((i) => i.read)).toBe(true);
    await waitFor(() => expect(bell()).toHaveAccessibleName("Notifications"));
  });

  it("says when there is nothing yet, or when notifications are off, with a way to Settings", () => {
    seed([]);
    render();
    fireEvent.click(bell());
    expect(screen.getByText("Nothing yet")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Notification settings" }));
    expect(screen.getByTestId("where")).toHaveTextContent("/settings#notifications");

    act(() => writeSettings({ notifyComments: false, notifyCollections: false }));
    fireEvent.click(bell());
    expect(screen.getByText("Notifications are off")).toBeInTheDocument();
  });

  it("says when checks fail instead of waiting forever, with a way to try again", () => {
    writeNotifications(ADDRESS, { ...EMPTY_STATE, lastError: Date.now() });
    const tries = vi.fn();
    window.addEventListener("qshareplus:check-notifications", tries);
    render();
    fireEvent.click(bell());
    expect(screen.queryByText("Checking for notifications…")).toBeNull();
    expect(screen.getByText(/Couldn't check for new ones/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    // Opening the list asked once, Try again once more.
    expect(tries).toHaveBeenCalledTimes(2);
    window.removeEventListener("qshareplus:check-notifications", tries);
  });

  it("uses a bottom sheet on phones", () => {
    phone = true;
    seed([comment]);
    render();
    fireEvent.click(bell());
    expect(screen.getByRole("dialog", { name: "Notifications" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /bob commented on Docs/ })).toBeInTheDocument();
  });
});

describe("where a notification leads", () => {
  it("goes to the share's comments, the collection, or the comment's share once found", () => {
    expect(notificationPath(comment)).toBe("/share/alice/qshare_file_docs_abcdef_metadata#comments");
    expect(notificationPath(added)).toBe("/collection/carol/qshare_collection_faves_bbbbbb");
    expect(notificationPath(reply)).toBe("/comment/dave/qcomment_v1_qshare_xyz_metadata_reply_qq1234_cccccc");
  });

  it("finds a comment's share among your own, then by the end of its identifier", async () => {
    resetActivity();
    resetQdnSearchCache();
    mockFetch("/arbitrary/resources/search", (url: URL) => {
      const q = url.searchParams;
      if (q.getAll("name").includes("alice") && q.get("service") === "DOCUMENT")
        return [{ name: "alice", service: "DOCUMENT", identifier: SHARE.identifier }];
      if (q.get("identifier") === "xyz_metadata")
        return [
          { name: "erin", service: "DOCUMENT", identifier: "qshare_file_other_xyz_metadata_extra" },
          { name: "bob", service: "DOCUMENT", identifier: "qshare_file_trip_abcxyz_metadata" },
        ];
      return [];
    });
    expect(await findCommentShare("qcomment_v1_qshare_def_metadata_base_aaaaaa", ["alice"])).toEqual({
      name: "alice",
      identifier: SHARE.identifier,
    });
    expect(await findCommentShare(reply.comment!.identifier, ["alice"])).toEqual({
      name: "bob",
      identifier: "qshare_file_trip_abcxyz_metadata",
    });
    expect(await findCommentShare("not a comment", ["alice"])).toBeNull();
  });
});
