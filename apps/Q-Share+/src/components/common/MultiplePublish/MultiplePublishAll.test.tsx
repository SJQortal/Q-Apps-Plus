import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { fetchCallsMatching, mockFetch, mockQortalAction, qortalCallsFor } from "../../../test/setup";
import type { MultiplePublishRequest } from "../../../utils/publishPayload";
import { MultiplePublish, PUBLISH_MS_PER_RESOURCE, STOP_WAITING_AFTER_S } from "./MultiplePublishAll";

const file = new File(["x"], "clip.mp4", { type: "video/mp4" });
const FILE_ID = "qshare_file_clip_aaaaaa";
const DOC_ID = "qshare_file_clip_bbbbbb_metadata";
const request: MultiplePublishRequest = {
  action: "PUBLISH_MULTIPLE_QDN_RESOURCES",
  resources: [
    {
      action: "PUBLISH_QDN_RESOURCE",
      name: "alice",
      service: "FILE",
      file,
      title: "Clip",
      description: "**cat:4**",
      identifier: FILE_ID,
      filename: "clip.mp4",
      tag1: "qshare_file_",
    },
    {
      action: "PUBLISH_QDN_RESOURCE",
      name: "alice",
      service: "DOCUMENT",
      data64: "e30=",
      title: "Clip",
      description: "**cat:4**",
      identifier: DOC_ID,
      filename: "video_metadata.json",
      tag1: "qshare_file_",
    },
  ],
};

/** Answer the QDN check: `rows` maps an identifier to its newest timestamp; others are not on QDN. */
function mockQdnCheck(rows: Record<string, number>) {
  mockFetch("/arbitrary/resources/search", (url: URL) => {
    const id = url.searchParams.get("identifier") ?? "";
    return id in rows
      ? [{ name: "alice", service: url.searchParams.get("service"), identifier: id, created: rows[id] }]
      : [];
  });
}

describe("MultiplePublish", () => {
  it("shows the resources by name while publishing and reports success once", async () => {
    // Hub answers only when the whole batch is done; hold the answer to see the in-progress state.
    let finish: (value: unknown) => void = () => {};
    mockQortalAction("PUBLISH_MULTIPLE_QDN_RESOURCES", () => new Promise((resolve) => (finish = resolve)));
    const onSubmit = vi.fn();
    const onError = vi.fn();
    renderWithProviders(<MultiplePublish isOpen publishes={request} onSubmit={onSubmit} onError={onError} />);

    expect(await screen.findByText("clip.mp4")).toBeInTheDocument();
    expect(screen.getByText("Share details")).toBeInTheDocument();
    expect(screen.getByText(/Publishing 2 resources/)).toBeInTheDocument();
    expect(screen.getAllByText("Waiting", { selector: "p" }).length).toBe(2);
    // As long as Hub itself allows: 30 minutes per resource.
    expect(globalThis.qortalRequestWithTimeout).toHaveBeenCalledWith(request, 2 * PUBLISH_MS_PER_RESOURCE);
    expect(PUBLISH_MS_PER_RESOURCE).toBe(30 * 60 * 1000);
    finish(true);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onError).not.toHaveBeenCalled();
    expect(qortalCallsFor("PUBLISH_MULTIPLE_QDN_RESOURCES").length).toBe(1);
  });

  it("marks the failed resource, sums up, and retries only that one", async () => {
    let attempt = 0;
    mockQortalAction("PUBLISH_MULTIPLE_QDN_RESOURCES", () => {
      attempt += 1;
      if (attempt === 1) throw { error: { unsuccessfulPublishes: [{ identifier: DOC_ID }] } };
      return true;
    });
    const onSubmit = vi.fn();
    const onError = vi.fn();
    renderWithProviders(<MultiplePublish isOpen publishes={request} onSubmit={onSubmit} onError={onError} />);

    expect(await screen.findByText("1 of 2 published")).toBeInTheDocument();
    // The row text; the state icon carries the same word as its title.
    expect(screen.getByText("Published", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText("Failed", { selector: "p" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Check again" })).not.toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
    // Hub named the failure, so there is nothing to ask QDN.
    expect(fetchCallsMatching("/arbitrary/resources/search").length).toBe(0);

    fireEvent.click(screen.getByRole("button", { name: "Retry failed" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const calls = qortalCallsFor("PUBLISH_MULTIPLE_QDN_RESOURCES") as any[];
    expect(calls.length).toBe(2);
    expect(calls[1].resources.map((r: any) => r.identifier)).toEqual([DOC_ID]);
  });

  it("closes quietly on a decline and on Hub's Cancel", async () => {
    mockQortalAction("PUBLISH_MULTIPLE_QDN_RESOURCES", () => {
      throw { error: "User declined request", message: "User declined request" };
    });
    const onDecline = vi.fn();
    const { unmount } = renderWithProviders(
      <MultiplePublish isOpen publishes={request} onSubmit={vi.fn()} onError={onDecline} />
    );
    await waitFor(() => expect(onDecline).toHaveBeenCalledWith(undefined, [], { uncertain: false }));
    unmount();

    mockQortalAction("PUBLISH_MULTIPLE_QDN_RESOURCES", () => {
      throw {
        error: { cancelled: true, unsuccessfulPublishes: [{ identifier: FILE_ID, reason: "Publish cancelled" }] },
        message: "Publish cancelled",
      };
    });
    const onCancel = vi.fn();
    renderWithProviders(<MultiplePublish isOpen publishes={request} onSubmit={vi.fn()} onError={onCancel} />);
    await waitFor(() => expect(onCancel).toHaveBeenCalledWith(undefined, [], { uncertain: false }));
    expect(screen.queryByText("Publish incomplete")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Retry/ })).not.toBeInTheDocument();
  });

  it("treats a decline in another Hub language as a decline, also on a retry", async () => {
    // Hub localises its decline: this is the German user_declined_request.
    const german = "Benutzer hat die Anfrage abgelehnt";
    mockQortalAction("PUBLISH_MULTIPLE_QDN_RESOURCES", () => {
      throw { error: german, message: german };
    });
    const onDecline = vi.fn();
    const { unmount } = renderWithProviders(
      <MultiplePublish isOpen publishes={request} onSubmit={vi.fn()} onError={onDecline} />
    );
    await waitFor(() => expect(onDecline).toHaveBeenCalledWith(undefined, [], { uncertain: false }));
    expect(screen.queryByText(german)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Retry/ })).not.toBeInTheDocument();
    expect(fetchCallsMatching("/arbitrary/resources/search").length).toBe(0);
    unmount();

    // Declining the retry of a partial publish hands back what did land.
    let attempt = 0;
    mockQortalAction("PUBLISH_MULTIPLE_QDN_RESOURCES", () => {
      attempt += 1;
      if (attempt === 1) throw { error: { unsuccessfulPublishes: [{ identifier: DOC_ID }] }, message: "x" };
      throw { error: "用户拒绝请求", message: "用户拒绝请求" };
    });
    const onRetryDecline = vi.fn();
    renderWithProviders(<MultiplePublish isOpen publishes={request} onSubmit={vi.fn()} onError={onRetryDecline} />);
    fireEvent.click(await screen.findByRole("button", { name: "Retry failed" }));
    await waitFor(() => expect(onRetryDecline).toHaveBeenCalledWith(undefined, [FILE_ID], { uncertain: false }));
  });

  it("after a timeout asks QDN, and finishes when everything landed", async () => {
    // qortalRequestWithTimeout rejects with a bare string, not { error }.
    mockQortalAction("PUBLISH_MULTIPLE_QDN_RESOURCES", () => {
      throw "The request timed out";
    });
    mockQdnCheck({ [FILE_ID]: Date.now(), [DOC_ID]: Date.now() });
    const onSubmit = vi.fn();
    const onError = vi.fn();
    renderWithProviders(<MultiplePublish isOpen publishes={request} onSubmit={onSubmit} onError={onError} />);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onError).not.toHaveBeenCalled();
    const searches = fetchCallsMatching("/arbitrary/resources/search");
    expect(searches.length).toBe(2);
    const fileSearch = new URL(searches.find((u) => u.includes("service=FILE"))!, "http://localhost").searchParams;
    expect(fileSearch.get("identifier")).toBe(FILE_ID);
    expect(fileSearch.get("name")).toBe("alice");
    expect(fileSearch.get("exactmatchnames")).toBe("true");
    expect(fileSearch.get("limit")).toBe("1");
    expect(qortalCallsFor("PUBLISH_MULTIPLE_QDN_RESOURCES").length).toBe(1);
  });

  it("after a timeout counts a replaced resource only when QDN has a newer version", async () => {
    let attempt = 0;
    mockQortalAction("PUBLISH_MULTIPLE_QDN_RESOURCES", () => {
      attempt += 1;
      if (attempt === 1) throw "The request timed out";
      return true;
    });
    // An update reuses the details identifier. Its old version is from a
    // minute ago, well inside any clock allowance, so only its time can tell.
    const previous = Date.now() - 60_000;
    mockQdnCheck({ [FILE_ID]: Date.now(), [DOC_ID]: previous });
    const onSubmit = vi.fn();
    const onError = vi.fn();
    renderWithProviders(
      <MultiplePublish isOpen publishes={request} replaces={{ [DOC_ID]: previous }} onSubmit={onSubmit} onError={onError} />
    );

    expect(await screen.findByText("1 of 2 published")).toBeInTheDocument();
    expect(screen.getByText("Publish incomplete")).toBeInTheDocument();
    expect(screen.getByText("Not on QDN yet", { selector: "p" })).toBeInTheDocument();
    expect(screen.queryByText("Failed", { selector: "p" })).not.toBeInTheDocument();
    expect(screen.queryByText("The request timed out")).not.toBeInTheDocument();
    expect(screen.getByText(/Hub may still be publishing them/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check again" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry missing" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const calls = qortalCallsFor("PUBLISH_MULTIPLE_QDN_RESOURCES") as any[];
    expect(calls[1].resources.map((r: any) => r.identifier)).toEqual([DOC_ID]);
    expect(onError).not.toHaveBeenCalled();
  });

  it("counts a new identifier once it is on QDN, whatever time the node gave it", async () => {
    mockQortalAction("PUBLISH_MULTIPLE_QDN_RESOURCES", () => {
      throw "The request timed out";
    });
    // A device clock well ahead of the node's makes this publish look old.
    const nodeTime = Date.now() - 10 * 60 * 1000;
    mockQdnCheck({ [FILE_ID]: nodeTime, [DOC_ID]: nodeTime });
    const onSubmit = vi.fn();
    renderWithProviders(<MultiplePublish isOpen publishes={request} onSubmit={onSubmit} onError={vi.fn()} />);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  });

  it("never counts a replaced resource whose old version's time is unknown", async () => {
    mockQortalAction("PUBLISH_MULTIPLE_QDN_RESOURCES", () => {
      throw "The request timed out";
    });
    mockQdnCheck({ [FILE_ID]: Date.now(), [DOC_ID]: Date.now() });
    const onSubmit = vi.fn();
    renderWithProviders(
      <MultiplePublish isOpen publishes={request} replaces={{ [DOC_ID]: undefined }} onSubmit={onSubmit} onError={vi.fn()} />
    );
    expect(await screen.findByText("1 of 2 published")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("offers no Retry when QDN cannot be checked, and can check again", async () => {
    mockQortalAction("PUBLISH_MULTIPLE_QDN_RESOURCES", () => {
      throw { error: "Request timed out after 3600000 ms (action: PUBLISH_MULTIPLE_QDN_RESOURCES)" };
    });
    // No search handler yet: the check fails.
    const onSubmit = vi.fn();
    const onError = vi.fn();
    renderWithProviders(<MultiplePublish isOpen publishes={request} onSubmit={onSubmit} onError={onError} />);

    expect(await screen.findByText("Publish not confirmed")).toBeInTheDocument();
    expect(screen.getAllByText("Not confirmed", { selector: "p" }).length).toBe(2);
    expect(screen.getByText(/look in My shares before you publish again/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Retry/ })).not.toBeInTheDocument();

    mockQdnCheck({ [FILE_ID]: Date.now(), [DOC_ID]: Date.now() });
    fireEvent.click(screen.getByRole("button", { name: "Check again" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(qortalCallsFor("PUBLISH_MULTIPLE_QDN_RESOURCES").length).toBe(1);
  });

  it("takes an error without a list as Hub's answer: nothing published, no QDN check", async () => {
    // Hub throws without a list only from its checks before the first publish.
    const balance = "Your QORT balance is insufficient";
    let attempt = 0;
    mockQortalAction("PUBLISH_MULTIPLE_QDN_RESOURCES", () => {
      attempt += 1;
      if (attempt === 1) throw { error: { unsuccessfulPublishes: [{ identifier: DOC_ID }] }, message: "x" };
      throw { error: balance, message: balance };
    });
    const onError = vi.fn();
    renderWithProviders(<MultiplePublish isOpen publishes={request} onSubmit={vi.fn()} onError={onError} />);
    fireEvent.click(await screen.findByRole("button", { name: "Retry failed" }));

    expect(await screen.findByText(balance)).toBeInTheDocument();
    expect(await screen.findByText("1 of 2 published")).toBeInTheDocument();
    expect(screen.getByText("Failed", { selector: "p" })).toBeInTheDocument();
    expect(screen.queryByText(/Hub may still be publishing/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Check again" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry failed" })).toBeInTheDocument();
    expect(fetchCallsMatching("/arbitrary/resources/search").length).toBe(0);
    // The action bar's Close; the title bar's X does the same.
    fireEvent.click(screen.getAllByRole("button", { name: "Close" }).at(-1)!);
    expect(onError).toHaveBeenCalledWith(undefined, [FILE_ID], { uncertain: false });
  });

  it("says a publish failed when nothing landed", async () => {
    mockQortalAction("PUBLISH_MULTIPLE_QDN_RESOURCES", () => {
      throw new Error("Node unreachable");
    });
    renderWithProviders(<MultiplePublish isOpen publishes={request} onSubmit={vi.fn()} onError={vi.fn()} />);
    expect(await screen.findByText("Publish failed")).toBeInTheDocument();
    expect(screen.getByText("Node unreachable")).toBeInTheDocument();
    expect(screen.getAllByText("Failed", { selector: "p" }).length).toBe(2);
    expect(fetchCallsMatching("/arbitrary/resources/search").length).toBe(0);
  });

  it("offers Stop waiting after a minute, and the title bar's X does the same at any time", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    try {
      mockQortalAction("PUBLISH_MULTIPLE_QDN_RESOURCES", () => new Promise(() => {}));
      mockQdnCheck({ [FILE_ID]: Date.now() });
      renderWithProviders(<MultiplePublish isOpen publishes={request} onSubmit={vi.fn()} onError={vi.fn()} />);
      expect(await screen.findByText(/Publishing 2 resources/)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Stop waiting" })).not.toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(STOP_WAITING_AFTER_S * 1000 + 1000);
      });
      expect(screen.getByRole("button", { name: "Stop waiting" })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Stop waiting" }));
      expect(await screen.findByText("1 of 2 published")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops waiting from the title bar, keeps Hub's answer coming, and completes when it lands", async () => {
    let answer: (value: unknown) => void = () => {};
    mockQortalAction("PUBLISH_MULTIPLE_QDN_RESOURCES", () => new Promise((resolve) => (answer = resolve)));
    mockQdnCheck({ [FILE_ID]: Date.now() });
    const onSubmit = vi.fn();
    const onError = vi.fn();
    renderWithProviders(<MultiplePublish isOpen publishes={request} onSubmit={onSubmit} onError={onError} />);
    expect(await screen.findByText(/Publishing 2 resources/)).toBeInTheDocument();

    // The X is never a dead control: while Hub publishes it stops the wait.
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(await screen.findByText("1 of 2 published")).toBeInTheDocument();
    expect(onError).not.toHaveBeenCalled();
    expect(screen.getByText(/Hub may still be publishing them/)).toBeInTheDocument();

    // Hub finishes after all.
    await act(async () => answer(true));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(qortalCallsFor("PUBLISH_MULTIPLE_QDN_RESOURCES").length).toBe(1);
  });

  it("tells the caller the outcome is uncertain when closed after it stopped waiting", async () => {
    mockQortalAction("PUBLISH_MULTIPLE_QDN_RESOURCES", () => new Promise(() => {}));
    mockQdnCheck({});
    const onError = vi.fn();
    renderWithProviders(<MultiplePublish isOpen publishes={request} onSubmit={vi.fn()} onError={onError} />);
    expect(await screen.findByText(/Publishing 2 resources/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(await screen.findByText("0 of 2 published")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Close" }).at(-1)!);
    expect(onError).toHaveBeenCalledWith(undefined, [], { uncertain: true });
  });
});
