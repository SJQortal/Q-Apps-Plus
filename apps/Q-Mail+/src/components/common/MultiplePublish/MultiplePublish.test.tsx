import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { fetchedUrls, mockFetchRoute, mockQortalAction, qortalCalls } from "../../../test/setup";
import { MultiplePublish, readPublishStatus, resourceLabel } from "./MultiplePublish";

const publishes = {
  action: "PUBLISH_MULTIPLE_QDN_RESOURCES",
  encrypt: true,
  publicKeys: ["recipientKey", "bccKey"],
  resources: [
    {
      action: "PUBLISH_QDN_RESOURCE",
      name: "alice",
      service: "ATTACHMENT_PRIVATE",
      identifier: "attachments_qmail_a1_b2",
      filename: "a1.png",
      originalFilename: "cat.png",
      data64: "QUJD",
    },
    {
      action: "PUBLISH_QDN_RESOURCE",
      name: "alice",
      service: "MAIL_PRIVATE",
      identifier: "_mail_qortal_qmail_bob_abcdef_mail_x1y2z3",
      data64: "REVG",
    },
  ],
};

const HUB_TIMEOUT = {
  error: "Request timed out after 1800000 ms (action: PUBLISH_MULTIPLE_QDN_RESOURCES)",
  message: "Request timed out after 1800000 ms (action: PUBLISH_MULTIPLE_QDN_RESOURCES)",
};

const qdnRows = (ids: string[]) => ids.map((identifier) => ({ name: "alice", service: "x", identifier, created: 1 }));

function mount(props: Partial<{ onSubmit: () => void; onError: (m?: string, d?: any) => void }> = {}) {
  const onSubmit = props.onSubmit ?? vi.fn();
  const onError = props.onError ?? vi.fn();
  render(<MultiplePublish publishes={publishes} isOpen onSubmit={onSubmit} onError={onError} />);
  return { onSubmit, onError };
}

const stateOf = (label: string) =>
  screen.getByText(label).closest("li")?.querySelector("[data-state]")?.getAttribute("data-state");

describe("MultiplePublish", () => {
  it("sends the caller's request untouched and reports once when Hub answers", async () => {
    mockQortalAction("PUBLISH_MULTIPLE_QDN_RESOURCES", [{ signature: "s1" }, { signature: "s2" }]);
    const { onSubmit, onError } = mount();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const [request] = qortalCalls("PUBLISH_MULTIPLE_QDN_RESOURCES");
    // Byte-identical: identifiers, data64, encrypt and publicKeys are the caller's (data contract §3).
    expect(request).toEqual(publishes);
    expect(onError).not.toHaveBeenCalled();
    expect(fetchedUrls("/arbitrary/resources/search")).toHaveLength(0);
  });

  it("retries only the items Hub listed as unsuccessful, with the same encrypt and publicKeys", async () => {
    let calls = 0;
    mockQortalAction("PUBLISH_MULTIPLE_QDN_RESOURCES", () => {
      calls += 1;
      if (calls === 1) {
        throw {
          error: { unsuccessfulPublishes: [{ identifier: "_mail_qortal_qmail_bob_abcdef_mail_x1y2z3", reason: "upload failed" }] },
          message: "failed to publish resources",
        };
      }
      return [{ signature: "s2" }];
    });
    const { onSubmit } = mount();
    expect(await screen.findByText("Some items did not publish")).toBeTruthy();
    expect(stateOf("cat.png")).toBe("done");
    expect(stateOf("Message")).toBe("failed");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    });
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const requests = qortalCalls("PUBLISH_MULTIPLE_QDN_RESOURCES");
    expect(requests).toHaveLength(2);
    expect(requests[1]).toEqual({ ...publishes, resources: [publishes.resources[1]] });
  });

  it("after Hub's timeout asks QDN instead of publishing again, and finishes when everything is there", async () => {
    mockQortalAction("PUBLISH_MULTIPLE_QDN_RESOURCES", () => {
      throw HUB_TIMEOUT;
    });
    mockFetchRoute("/arbitrary/resources/search", qdnRows(publishes.resources.map((r) => r.identifier)));
    const { onSubmit, onError } = mount();
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    // One publish, never a second one: the fee is paid once.
    expect(qortalCalls("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(1);
    const searches = fetchedUrls("/arbitrary/resources/search");
    expect(searches).toHaveLength(2);
    expect(searches[0]).toContain("exactmatchnames=true");
    expect(searches[0]).toContain("name=alice");
    expect(onError).not.toHaveBeenCalled();
  });

  it("after a timeout with items missing from QDN, offers Retry missing and says what landed on Close", async () => {
    mockQortalAction("PUBLISH_MULTIPLE_QDN_RESOURCES", () => {
      throw HUB_TIMEOUT;
    });
    mockFetchRoute("/arbitrary/resources/search", qdnRows(["attachments_qmail_a1_b2"]));
    const { onSubmit, onError } = mount();
    expect(await screen.findByText("Some items did not publish")).toBeTruthy();
    expect(stateOf("cat.png")).toBe("done");
    expect(stateOf("Message")).toBe("missing");
    // The row's line and the icon's title both say so.
    expect(screen.getAllByText("Not on QDN yet").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Retry missing" })).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onError).toHaveBeenCalledWith("1 of 2 published; 1 item is not on QDN", {
      states: { attachments_qmail_a1_b2: "done", _mail_qortal_qmail_bob_abcdef_mail_x1y2z3: "missing" },
    });
  });

  it("closes quietly when the user declines in Hub, in any language", async () => {
    mockQortalAction("PUBLISH_MULTIPLE_QDN_RESOURCES", () => {
      throw { error: "Benutzer hat die Anfrage abgelehnt", message: "Benutzer hat die Anfrage abgelehnt" };
    });
    const { onSubmit, onError } = mount();
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(onError).toHaveBeenCalledWith();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("treats Hub's resolved Cancel answer as a decline too", async () => {
    mockQortalAction("PUBLISH_MULTIPLE_QDN_RESOURCES", { message: "Publish cancelled", error: { cancelled: true, unsuccessfulPublishes: [] } });
    const { onSubmit, onError } = mount();
    await waitFor(() => expect(onError).toHaveBeenCalledWith());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows a real failure from Hub's checks before anything was published", async () => {
    mockQortalAction("PUBLISH_MULTIPLE_QDN_RESOURCES", () => {
      throw { error: "Insufficient QORT balance", message: "Insufficient QORT balance" };
    });
    mount();
    expect(await screen.findByText("Insufficient QORT balance")).toBeTruthy();
    expect(screen.getByText("Publish failed")).toBeTruthy();
    expect(stateOf("Message")).toBe("failed");
    expect(fetchedUrls("/arbitrary/resources/search")).toHaveLength(0);
  });

  it("shows Hub's PUBLISH_STATUS progress per item and marks a processed item published", async () => {
    let resolvePublish: (v: unknown) => void = () => {};
    mockQortalAction("PUBLISH_MULTIPLE_QDN_RESOURCES", () => new Promise((resolve) => (resolvePublish = resolve)));
    const { onSubmit } = mount();
    const post = (data: Record<string, unknown>) =>
      act(() => {
        window.dispatchEvent(new MessageEvent("message", { data, source: window }));
      });
    await post({
      action: "PUBLISH_STATUS",
      publishLocation: { name: "alice", identifier: encodeURIComponent("attachments_qmail_a1_b2"), service: "ATTACHMENT_PRIVATE" },
      chunks: 1,
      totalChunks: 3,
      processed: false,
    });
    expect(screen.getByText("Uploading 1 of 3 parts")).toBeTruthy();
    expect(screen.getByLabelText("cat.png upload")).toBeTruthy();
    await post({ action: "PUBLISH_STATUS", publishLocation: { identifier: "attachments_qmail_a1_b2" }, retry: true });
    expect(screen.getByText("Retrying…")).toBeTruthy();
    await post({ action: "PUBLISH_STATUS", publishLocation: { identifier: "attachments_qmail_a1_b2" }, processed: true });
    expect(stateOf("cat.png")).toBe("done");
    expect(onSubmit).not.toHaveBeenCalled();
    await act(async () => {
      resolvePublish([{ signature: "s1" }, { signature: "s2" }]);
    });
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  });

  it("reads Hub's status messages and ignores anything else", () => {
    expect(readPublishStatus({ action: "PUBLISH_STATUS", publishLocation: { identifier: "a%20b" }, chunks: 2, totalChunks: 4 })).toEqual({
      identifier: "a b",
      service: undefined,
      chunks: 2,
      totalChunks: 4,
      processed: false,
      retry: false,
    });
    expect(readPublishStatus({ action: "THEME_CHANGED" })).toBeNull();
    expect(readPublishStatus(null)).toBeNull();
  });

  it("labels items by what they are", () => {
    const all = publishes.resources;
    expect(resourceLabel(all[0], 0, all)).toBe("cat.png");
    expect(resourceLabel(all[1], 1, all)).toBe("Message");
    const copies = [all[1], { ...all[1], identifier: "copy2" }];
    expect(resourceLabel(copies[1], 1, copies)).toBe("Message copy 2");
    expect(resourceLabel({ name: "a", service: "MAIL", identifier: "t" }, 0, [])).toBe("Thread title");
  });
});
