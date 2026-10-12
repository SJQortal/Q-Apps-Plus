import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { mockFetch, mockQortalAction, qortalCalls, qortalCallsFor } from "../../test/setup";
import { renderWithProviders } from "../../test/renderWithProviders";
import { store } from "../../state/store";
import { addUser } from "../../state/features/authSlice";
import { HubAlertsSetting } from "../../components/common/Notifications/HubAlertsSetting";
import { resetQdnSearchCache } from "../qdnSearch";
import { HUB_DIALOG_GRACE_MS } from "../hubErrors";
import { resetActivity, type Activity } from "./activity";
import {
  HUB_REPLY_RULES,
  HUB_SHARE_RULES,
  buildHubRules,
  disableHubAlerts,
  enableHubAlerts,
  hubAlertsAvailable,
  markHubAlertsSeen,
  readHubAlerts,
  syncHubAlerts,
} from "./hubAlerts";

const ADDRESS = "Q9aWbQnCZXmuNNkpg6t4sTCk8CRYoGF7Ce";

function activity(shares: number, comments: number): Activity {
  const a: Activity = { shares: new Map(), comments: new Map(), complete: true };
  for (let i = 0; i < shares; i++) {
    const identifier = `qshare_file_s${i}_abc${String(i).padStart(3, "0")}_metadata`;
    a.shares.set(identifier.slice(-12), {
      name: i === 0 ? "Simon James" : "alice",
      identifier,
      title: i === 0 ? "A very long title for a share that goes on and on past sixty characters" : `Share ${i}`,
      created: i,
    });
  }
  for (let i = 0; i < comments; i++) {
    const identifier = `qcomment_v1_qshare_xyz_metadata_base_cm${String(i).padStart(4, "0")}`;
    a.comments.set(identifier.slice(-6), { name: "alice", identifier, created: i });
  }
  return a;
}

const reset = () => {
  localStorage.clear();
  qortalCalls.length = 0;
};

describe("Hub alert rules", () => {
  it("watch the newest shares' comments and the newest comments' replies, with path-only links", () => {
    const rules = buildHubRules(activity(40, 30));
    expect(rules.filter((r) => r.notificationId.startsWith("qshare-c-"))).toHaveLength(HUB_SHARE_RULES);
    expect(rules.filter((r) => r.notificationId.startsWith("qshare-r-"))).toHaveLength(HUB_REPLY_RULES);
    // Newest first: share 39 is in, share 0 (the oldest) is not.
    expect(rules[0]).toEqual({
      notificationId: "qshare-c-039_metadata",
      link: "qortal://APP/Q-Share+/share/alice/qshare_file_s39_abc039_metadata/comments",
      image: "/arbitrary/THUMBNAIL/{name}/qortal_avatar?async=true",
      message: { en: "{name} commented on your share “Share 39”" },
      filters: {
        service: "BLOG_COMMENT",
        identifier: "qcomment_v1_qshare_039_metadata_",
        prefix: true,
        excludeBlocked: true,
      },
    });
    expect(rules.find((r) => r.notificationId === "qshare-r-cm0029")).toEqual({
      notificationId: "qshare-r-cm0029",
      link: "qortal://APP/Q-Share+/comment/{name}/{identifier}",
      image: "/arbitrary/THUMBNAIL/{name}/qortal_avatar?async=true",
      message: { en: "{name} replied to your comment" },
      filters: { service: "BLOG_COMMENT", identifier: "_reply_cm0029_", excludeBlocked: true },
    });
    for (const rule of rules) expect(rule.link).not.toMatch(/[#?]/);
  });

  it("encode names in links and shorten long titles", () => {
    const [rule] = buildHubRules(activity(1, 0));
    expect(rule.link).toBe("qortal://APP/Q-Share+/share/Simon%20James/qshare_file_s0_abc000_metadata/comments");
    expect(rule.message.en).toBe(
      "{name} commented on your share “A very long title for a share that goes on and on past sixt…”"
    );
  });
});

describe("Hub alerts on and off", () => {
  beforeEach(reset);

  it("ask Hub's permission, then hand Hub the rules", async () => {
    mockQortalAction("NOTIFICATION_PERMISSION", true);
    mockQortalAction("NOTIFICATION_ADD", true);
    expect(await enableHubAlerts(ADDRESS, activity(2, 1))).toBe(true);
    expect(qortalCalls.map((c) => c.action)).toEqual(["NOTIFICATION_PERMISSION", "NOTIFICATION_ADD"]);
    expect(qortalCallsFor("NOTIFICATION_ADD")[0].notifications).toHaveLength(3);
    expect(readHubAlerts(ADDRESS)).toMatchObject({
      enabled: true,
      registered: expect.arrayContaining(["qshare-r-cm0000"]),
    });
  });

  it("stay off when the user says no", async () => {
    mockQortalAction("NOTIFICATION_PERMISSION", () => {
      throw { error: "User declined request" };
    });
    expect(await enableHubAlerts(ADDRESS, activity(1, 0))).toBe(false);
    expect(qortalCallsFor("NOTIFICATION_ADD")).toHaveLength(0);
    expect(qortalCallsFor("NOTIFICATION_HAS_PERMISSION")).toHaveLength(0);
    expect(readHubAlerts(ADDRESS).enabled).toBe(false);
  });

  it("catch an Allow that came after Hub's 30 s timeout, once the banner is gone", async () => {
    vi.useFakeTimers();
    try {
      mockQortalAction("NOTIFICATION_PERMISSION", () => {
        throw "The request timed out";
      });
      mockQortalAction("NOTIFICATION_HAS_PERMISSION", true);
      mockQortalAction("NOTIFICATION_ADD", true);
      const pending = enableHubAlerts(ADDRESS, activity(1, 0));
      await vi.advanceTimersByTimeAsync(HUB_DIALOG_GRACE_MS - 1);
      expect(qortalCallsFor("NOTIFICATION_HAS_PERMISSION")).toHaveLength(0);
      await vi.advanceTimersByTimeAsync(1);
      expect(await pending).toBe(true);
      expect(qortalCallsFor("NOTIFICATION_ADD")).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("send the rules again only when they change, and take stale ones out", async () => {
    mockQortalAction("NOTIFICATION_PERMISSION", true);
    mockQortalAction("NOTIFICATION_HAS_PERMISSION", true);
    mockQortalAction("NOTIFICATION_ADD", true);
    mockQortalAction("NOTIFICATION_REMOVE", true);
    expect(await syncHubAlerts(ADDRESS, activity(2, 0))).toBe("off");
    await enableHubAlerts(ADDRESS, activity(2, 0));
    qortalCalls.length = 0;
    expect(await syncHubAlerts(ADDRESS, activity(2, 0))).toBe("unchanged");
    expect(qortalCalls).toEqual([]);

    const fewer = activity(2, 0);
    fewer.shares.delete("001_metadata");
    expect(await syncHubAlerts(ADDRESS, fewer)).toBe("sent");
    expect(qortalCallsFor("NOTIFICATION_REMOVE")[0].notificationIds).toEqual(["qshare-c-001_metadata"]);
  });

  it("switch off here when the permission was taken back in Hub, but not when Hub just didn't answer", async () => {
    mockQortalAction("NOTIFICATION_PERMISSION", true);
    mockQortalAction("NOTIFICATION_ADD", true);
    await enableHubAlerts(ADDRESS, activity(1, 0));
    mockQortalAction("NOTIFICATION_HAS_PERMISSION", () => {
      throw "The request timed out";
    });
    expect(await syncHubAlerts(ADDRESS, activity(2, 0))).toBe("unchanged");
    expect(readHubAlerts(ADDRESS).enabled).toBe(true);
    mockQortalAction("NOTIFICATION_HAS_PERMISSION", false);
    expect(await syncHubAlerts(ADDRESS, activity(2, 0))).toBe("off");
    expect(readHubAlerts(ADDRESS).enabled).toBe(false);
  });

  it("keep the rule list when Hub fails to remove them, so turning off can be tried again", async () => {
    mockQortalAction("NOTIFICATION_PERMISSION", true);
    mockQortalAction("NOTIFICATION_ADD", true);
    await enableHubAlerts(ADDRESS, activity(1, 0));
    mockQortalAction("NOTIFICATION_REMOVE", () => {
      throw "The request timed out";
    });
    await expect(disableHubAlerts(ADDRESS)).rejects.toBeDefined();
    expect(readHubAlerts(ADDRESS)).toMatchObject({ enabled: true, registered: ["qshare-c-000_metadata"] });
  });

  it("remove the rules when turned off, and mark Hub's alerts seen with the in-app list", async () => {
    mockQortalAction("NOTIFICATION_PERMISSION", true);
    mockQortalAction("NOTIFICATION_ADD", true);
    mockQortalAction("NOTIFICATION_REMOVE", true);
    mockQortalAction("NOTIFICATION_MARK_SEEN", []);
    await enableHubAlerts(ADDRESS, activity(1, 1));
    await markHubAlertsSeen(ADDRESS);
    expect(qortalCallsFor("NOTIFICATION_MARK_SEEN")[0].notificationIds).toEqual([
      "qshare-c-000_metadata",
      "qshare-r-cm0000",
    ]);
    await disableHubAlerts(ADDRESS);
    expect(qortalCallsFor("NOTIFICATION_REMOVE")[0].notificationIds).toEqual([
      "qshare-c-000_metadata",
      "qshare-r-cm0000",
    ]);
    await markHubAlertsSeen(ADDRESS);
    expect(qortalCallsFor("NOTIFICATION_MARK_SEEN")).toHaveLength(1);
  });

  it("know whether this Hub has app alerts at all", async () => {
    mockQortalAction("NOTIFICATION_HAS_PERMISSION", false);
    expect(await hubAlertsAvailable()).toBe(true);
    mockQortalAction("NOTIFICATION_HAS_PERMISSION", () => {
      throw new Error("timeout");
    });
    expect(await hubAlertsAvailable()).toBe(false);
  });
});

describe("Settings → Alerts while Q-Share+ is closed", () => {
  beforeEach(() => {
    reset();
    resetActivity();
    resetQdnSearchCache();
    mockFetch("/arbitrary/resources/search", []);
    store.dispatch(
      addUser({ address: ADDRESS, publicKey: "k", name: "alice", names: [{ name: "alice", owner: ADDRESS }] })
    );
  });

  it("turns on after Hub's permission and off again", async () => {
    mockQortalAction("NOTIFICATION_HAS_PERMISSION", false);
    mockQortalAction("NOTIFICATION_PERMISSION", true);
    mockQortalAction("NOTIFICATION_REMOVE", true);
    const Row = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
    renderWithProviders(<HubAlertsSetting row={Row} />);
    const toggle = screen.getByRole("switch", { name: "Alerts while Q-Share+ is closed" });
    await waitFor(() => expect(toggle).toBeEnabled());
    expect(toggle).not.toBeChecked();

    fireEvent.click(toggle);
    await waitFor(() => expect(toggle).toBeChecked());
    expect(qortalCallsFor("NOTIFICATION_PERMISSION")).toHaveLength(1);
    expect(readHubAlerts(ADDRESS).enabled).toBe(true);

    fireEvent.click(toggle);
    await waitFor(() => expect(toggle).not.toBeChecked());
    expect(readHubAlerts(ADDRESS).enabled).toBe(false);
  });

  it("explains when this Hub has no app alerts", async () => {
    mockQortalAction("NOTIFICATION_HAS_PERMISSION", () => {
      throw new Error("unknown action");
    });
    const Row = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
    renderWithProviders(<HubAlertsSetting row={Row} />);
    expect(await screen.findByText("This Hub doesn't offer app alerts.")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Alerts while Q-Share+ is closed" })).toBeDisabled();
  });
});
