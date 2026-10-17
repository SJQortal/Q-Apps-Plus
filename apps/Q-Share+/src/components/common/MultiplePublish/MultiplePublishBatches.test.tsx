import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, configure, fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { fetchCallsMatching, mockFetch, mockQortalAction, qortalCallsFor } from "../../../test/setup";
import { store } from "../../../state/store";
import { addUser } from "../../../state/features/authSlice";
import { resetPublishUnitFee, roomTiming } from "../../../utils/publishBatches";
import type { MultiplePublishRequest, PublishResource } from "../../../utils/publishPayload";
import { MultiplePublish, resetHubApproval } from "./MultiplePublishAll";

// Each dialog renders dozens of rows; give the waits room on a busy machine.
configure({ asyncUtilTimeout: 5_000 });

const DOC_ID = "qshare_file_album_dddddd_metadata";

function share(fileCount: number): MultiplePublishRequest {
  const files: PublishResource[] = Array.from({ length: fileCount }, (_, i) => ({
    action: "PUBLISH_QDN_RESOURCE",
    name: "alice",
    service: "FILE",
    file: new File(["x"], `track${i + 1}.mp3`, { type: "audio/mpeg" }),
    title: "Album",
    description: "**cat:2**",
    identifier: `qshare_file_album_f${i}`,
    filename: `track${i + 1}.mp3`,
    tag1: "qshare_file_",
  }));
  return {
    action: "PUBLISH_MULTIPLE_QDN_RESOURCES",
    resources: [
      ...files,
      {
        action: "PUBLISH_QDN_RESOURCE",
        name: "alice",
        service: "DOCUMENT",
        data64: "e30=",
        title: "Album",
        description: "**cat:2**",
        identifier: DOC_ID,
        filename: "video_metadata.json",
        tag1: "qshare_file_",
      },
    ],
  };
}

const sentSizes = () => (qortalCallsFor("PUBLISH_MULTIPLE_QDN_RESOURCES") as any[]).map((c) => c.resources.length);

/** The node's unconfirmed list: right after each batch the batch is still waiting for a block, then it is confirmed. */
function mockBlocks() {
  let seen = 0;
  mockFetch("/transactions/unconfirmed", () => {
    const sent = qortalCallsFor("PUBLISH_MULTIPLE_QDN_RESOURCES").length;
    if (sent > seen) {
      seen = sent;
      return Array.from({ length: 21 }, () => ({ type: "ARBITRARY" }));
    }
    return [{ type: "CHAT" }];
  });
}

beforeEach(() => {
  roomTiming.visibleMs = 5;
  store.dispatch(addUser({ address: "QAlice", publicKey: "alicePublicKey", name: "alice" }));
  mockFetch("/transactions/unitfee", "1000000");
});

afterEach(() => {
  roomTiming.visibleMs = 10_000;
  store.dispatch(addUser(null));
  resetPublishUnitFee();
  resetHubApproval();
});

describe("MultiplePublish in batches", () => {
  it("says what a big share takes, then sends 20 files per batch once the network has room", async () => {
    mockQortalAction("PUBLISH_MULTIPLE_QDN_RESOURCES", true);
    mockBlocks();
    const onSubmit = vi.fn();
    renderWithProviders(<MultiplePublish isOpen publishes={share(45)} onSubmit={onSubmit} onError={vi.fn()} />);

    expect(await screen.findByText("Publish in 3 batches")).toBeInTheDocument();
    expect(await screen.findByText(/46 publishes in 3 batches of up to 20 files .*0\.46 QORT in fees/)).toBeInTheDocument();
    expect(screen.getAllByText("Queued", { selector: "p" }).length).toBe(46);
    // Nothing goes to Hub before Start.
    expect(qortalCallsFor("PUBLISH_MULTIPLE_QDN_RESOURCES").length).toBe(0);

    fireEvent.click(screen.getByRole("button", { name: "Start publishing" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(sentSizes()).toEqual([20, 20, 6]);
    const last = (qortalCallsFor("PUBLISH_MULTIPLE_QDN_RESOURCES") as any[])[2].resources;
    expect(last.at(-1).identifier).toBe(DOC_ID);
    // Asked before each batch, and again while a batch was still unconfirmed.
    const checks = fetchCallsMatching("/transactions/unconfirmed");
    expect(checks.length).toBe(5);
    expect(checks[0]).toBe("/transactions/unconfirmed?creator=alicePublicKey&limit=100");
    expect(qortalCallsFor("SESSION_PERMISSIONS").length).toBe(0);
  });

  it("shows the wait between batches, and Pause then Continue sends the rest", async () => {
    mockQortalAction("PUBLISH_MULTIPLE_QDN_RESOURCES", true);
    // After the first batch the network never confirms: the dialog waits.
    mockFetch("/transactions/unconfirmed", () =>
      qortalCallsFor("PUBLISH_MULTIPLE_QDN_RESOURCES").length > 0 ? Array.from({ length: 20 }, () => ({ type: "ARBITRARY" })) : []
    );
    const onSubmit = vi.fn();
    renderWithProviders(<MultiplePublish isOpen publishes={share(25)} onSubmit={onSubmit} onError={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Start publishing" }));

    expect(await screen.findByText("Waiting for the network")).toBeInTheDocument();
    expect(await screen.findByText(/20 still unconfirmed/)).toBeInTheDocument();
    expect(screen.getByText(/Batch 1 of 2 is published/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));

    expect(await screen.findByText("Publish paused")).toBeInTheDocument();
    expect(screen.getByText("20 of 26 published")).toBeInTheDocument();
    expect(screen.getByText(/6 resources haven't been sent yet/)).toBeInTheDocument();
    expect(sentSizes()).toEqual([20]);

    mockFetch("/transactions/unconfirmed", []);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(sentSizes()).toEqual([20, 6]);
  });

  it("pauses on a decline once earlier batches are on QDN, and hands them back on close", async () => {
    let call = 0;
    mockQortalAction("PUBLISH_MULTIPLE_QDN_RESOURCES", () => {
      call += 1;
      if (call === 2) throw { error: "User declined request", message: "User declined request" };
      return true;
    });
    mockFetch("/transactions/unconfirmed", []);
    const onError = vi.fn();
    const request = share(30);
    renderWithProviders(<MultiplePublish isOpen publishes={request} onSubmit={vi.fn()} onError={onError} />);
    fireEvent.click(await screen.findByRole("button", { name: "Start publishing" }));

    expect(await screen.findByText("Publish paused")).toBeInTheDocument();
    expect(screen.getByText("20 of 31 published")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
    expect(onError).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole("button", { name: "Close" }).at(-1)!);
    expect(onError).toHaveBeenCalledWith(
      undefined,
      request.resources.slice(0, 20).map((r) => r.identifier),
      { uncertain: false }
    );
  });

  it("closes on a decline of the first batch, as a small share does", async () => {
    mockQortalAction("PUBLISH_MULTIPLE_QDN_RESOURCES", () => {
      throw { error: "User declined request", message: "User declined request" };
    });
    mockFetch("/transactions/unconfirmed", []);
    const onError = vi.fn();
    renderWithProviders(<MultiplePublish isOpen publishes={share(30)} onSubmit={vi.fn()} onError={onError} />);
    fireEvent.click(await screen.findByRole("button", { name: "Start publishing" }));
    await waitFor(() => expect(onError).toHaveBeenCalledWith(undefined, [], { uncertain: false }));
  });

  it("goes on past files Hub couldn't publish, and holds the share details back until they land", async () => {
    let call = 0;
    mockQortalAction("PUBLISH_MULTIPLE_QDN_RESOURCES", (params) => {
      call += 1;
      if (call === 1) throw { error: { unsuccessfulPublishes: [{ identifier: "qshare_file_album_f3" }] }, message: "x" };
      return (params.resources as unknown[]).length > 0;
    });
    mockFetch("/transactions/unconfirmed", []);
    const onSubmit = vi.fn();
    const onError = vi.fn();
    const { unmount } = renderWithProviders(
      <MultiplePublish isOpen publishes={share(30)} onSubmit={onSubmit} onError={onError} />
    );
    fireEvent.click(await screen.findByRole("button", { name: "Start publishing" }));

    expect(await screen.findByText("29 of 31 published")).toBeInTheDocument();
    // Batch 2 went without the details: the share doesn't exist yet.
    expect(sentSizes()).toEqual([20, 10]);
    expect((qortalCallsFor("PUBLISH_MULTIPLE_QDN_RESOURCES") as any[])[1].resources.some((r: any) => r.service === "DOCUMENT")).toBe(false);
    expect(screen.getByText("1 resource hasn't been sent yet. Continue sends it, waiting for the network between batches.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect((qortalCallsFor("PUBLISH_MULTIPLE_QDN_RESOURCES") as any[])[2].resources.map((r: any) => r.identifier)).toEqual([
      "qshare_file_album_f3",
      DOC_ID,
    ]);
    unmount();

    // Closed instead: the landed files go back to the caller, and no share was made.
    call = 0;
    renderWithProviders(<MultiplePublish isOpen publishes={share(30)} onSubmit={vi.fn()} onError={onError} />);
    fireEvent.click(await screen.findByRole("button", { name: "Start publishing" }));
    expect(await screen.findByText("29 of 31 published")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Close" }).at(-1)!);
    const [, landed] = onError.mock.calls.at(-1)!;
    expect(landed).toHaveLength(29);
    expect(landed).not.toContain(DOC_ID);
  });

  it("asks Hub once for the session when the user chooses, and goes on per batch when Hub says no", async () => {
    mockQortalAction("PUBLISH_MULTIPLE_QDN_RESOURCES", true);
    mockFetch("/transactions/unconfirmed", []);
    mockQortalAction("SESSION_PERMISSIONS", () => {
      throw { error: "User declined request", message: "User declined request" };
    });
    const onSubmit = vi.fn();
    const { unmount } = renderWithProviders(
      <MultiplePublish isOpen publishes={share(21)} onSubmit={onSubmit} onError={vi.fn()} />
    );
    fireEvent.click(await screen.findByRole("switch", { name: "Approve every batch at once" }));
    fireEvent.click(screen.getByRole("button", { name: "Start publishing" }));
    expect(await screen.findByText(/Hub didn't grant it/)).toBeInTheDocument();
    expect(qortalCallsFor("SESSION_PERMISSIONS")).toEqual([
      { action: "SESSION_PERMISSIONS", permissions: ["PUBLISH_MULTIPLE_QDN_RESOURCES"] },
    ]);
    expect(screen.getByRole("switch", { name: "Approve every batch at once" })).not.toBeChecked();
    expect(qortalCallsFor("PUBLISH_MULTIPLE_QDN_RESOURCES").length).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: "Start publishing" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(sentSizes()).toEqual([20, 2]);
    unmount();

    // Granted: the next big share doesn't ask again.
    mockQortalAction("SESSION_PERMISSIONS", true);
    const first = vi.fn();
    const view = renderWithProviders(<MultiplePublish isOpen publishes={share(21)} onSubmit={first} onError={vi.fn()} />);
    fireEvent.click(await screen.findByRole("switch", { name: "Approve every batch at once" }));
    fireEvent.click(screen.getByRole("button", { name: "Start publishing" }));
    await waitFor(() => expect(first).toHaveBeenCalledTimes(1));
    view.unmount();
    const second = vi.fn();
    renderWithProviders(<MultiplePublish isOpen publishes={share(21)} onSubmit={second} onError={vi.fn()} />);
    expect(await screen.findByText(/Hub approves Q-Share\+'s publishes for this session/)).toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start publishing" }));
    await waitFor(() => expect(second).toHaveBeenCalledTimes(1));
    expect(qortalCallsFor("SESSION_PERMISSIONS").length).toBe(2);
  });

  it("checks for room before one batch bigger than the old 11-resource publish, and not before a small one", async () => {
    mockQortalAction("PUBLISH_MULTIPLE_QDN_RESOURCES", true);
    mockFetch("/transactions/unconfirmed", []);
    const onSubmit = vi.fn();
    const { unmount } = renderWithProviders(
      <MultiplePublish isOpen publishes={share(15)} onSubmit={onSubmit} onError={vi.fn()} />
    );
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(fetchCallsMatching("/transactions/unconfirmed").length).toBe(1);
    expect(screen.queryByText(/batches/)).not.toBeInTheDocument();
    unmount();

    const small = vi.fn();
    renderWithProviders(<MultiplePublish isOpen publishes={share(10)} onSubmit={small} onError={vi.fn()} />);
    await waitFor(() => expect(small).toHaveBeenCalledTimes(1));
    expect(fetchCallsMatching("/transactions/unconfirmed").length).toBe(1);
  });

  it("offers no Continue while Hub is still at a batch the app stopped waiting for", async () => {
    let answer: (value: unknown) => void = () => {};
    let call = 0;
    mockQortalAction("PUBLISH_MULTIPLE_QDN_RESOURCES", () => {
      call += 1;
      return call === 1 ? new Promise((resolve) => (answer = resolve)) : true;
    });
    mockFetch("/transactions/unconfirmed", []);
    mockFetch("/arbitrary/resources/search", []);
    const onSubmit = vi.fn();
    renderWithProviders(<MultiplePublish isOpen publishes={share(45)} onSubmit={onSubmit} onError={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Start publishing" }));
    expect(await screen.findByText("Publishing batch 1 of 3")).toBeInTheDocument();

    // The title bar's X stops waiting; Hub is still at batch 1.
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(await screen.findByText(/Continue comes back once Hub answers/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Continue" })).not.toBeInTheDocument();
    expect(sentSizes()).toEqual([20]);

    // Hub answers: now Continue sends the rest.
    await act(async () => answer(true));
    fireEvent.click(await screen.findByRole("button", { name: "Continue" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(sentSizes()).toEqual([20, 20, 6]);
  });

  it("stops after a batch where nothing landed, and keeps the rest queued", async () => {
    mockQortalAction("PUBLISH_MULTIPLE_QDN_RESOURCES", (params) => {
      throw {
        error: { unsuccessfulPublishes: (params.resources as any[]).map((r) => ({ identifier: r.identifier, reason: "Too many unconfirmed" })) },
        message: "x",
      };
    });
    mockFetch("/transactions/unconfirmed", []);
    renderWithProviders(<MultiplePublish isOpen publishes={share(45)} onSubmit={vi.fn()} onError={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Start publishing" }));
    expect(await screen.findByText("0 of 46 published")).toBeInTheDocument();
    expect(sentSizes()).toEqual([20]);
    expect(screen.getAllByText("Failed", { selector: "p" })).toHaveLength(20);
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
  });

  it("stops waiting by checking only the batch Hub hasn't answered, so earlier failures stay certain", async () => {
    let call = 0;
    mockQortalAction("PUBLISH_MULTIPLE_QDN_RESOURCES", () => {
      call += 1;
      if (call === 1) throw { error: { unsuccessfulPublishes: [{ identifier: "qshare_file_album_f3" }] }, message: "x" };
      return new Promise(() => {});
    });
    mockFetch("/transactions/unconfirmed", []);
    mockFetch("/arbitrary/resources/search", []);
    const onError = vi.fn();
    renderWithProviders(<MultiplePublish isOpen publishes={share(30)} onSubmit={vi.fn()} onError={onError} />);
    fireEvent.click(await screen.findByRole("button", { name: "Start publishing" }));
    expect(await screen.findByText("Publishing batch 2 of 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(await screen.findByText("19 of 31 published")).toBeInTheDocument();

    // Only batch 2's files were looked up on QDN, not batch 1's failure.
    const looked = fetchCallsMatching("/arbitrary/resources/search").map((u) => new URL(u, "http://x").searchParams.get("identifier"));
    expect(looked).toHaveLength(10);
    expect(looked).not.toContain("qshare_file_album_f3");
    expect(screen.getByText("Failed", { selector: "p" })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Close" }).at(-1)!);
    // Batch 2 is still out with Hub: uncertain because of it, as before.
    expect(onError.mock.calls.at(-1)![2]).toEqual({ uncertain: true });
  });
});
