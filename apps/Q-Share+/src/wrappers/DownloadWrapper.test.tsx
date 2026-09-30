import { useContext } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "../test/renderWithProviders";
import { fetchCallsMatching, mockFetch, mockQortalAction, qortalCallsFor } from "../test/setup";
import { store } from "../state/store";
import { removeDownload } from "../state/features/globalSlice";
import DownloadWrapper, { BUILD_NUDGE_MS, BUILD_TIMEOUT_MS, MyContext, POLL_MS } from "./DownloadWrapper";

const ref = { name: "alice", service: "FILE", identifier: "qshare_file_big_1" };
/** A real publisher whose name q-apps.js puts into the URL unencoded. */
const slashed = { name: "Vallot-/8/", service: "FILE", identifier: "qshare_file_qortal-corei-settingsjson-fail_yaGJk4" };

function StartButton({ target }: { target: typeof ref }) {
  const { downloadVideo } = useContext(MyContext);
  return <button onClick={() => downloadVideo({ ...target, properties: { ...target, filename: "big.iso" } })}>Start</button>;
}

/** Let `ms` of fake time pass, running timers and the promises they start. */
async function wait(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

const buildCalls = () => qortalCallsFor("GET_QDN_RESOURCE_STATUS").filter((c) => c.build === true);
const pollCalls = () => qortalCallsFor("GET_QDN_RESOURCE_STATUS").filter((c) => c.build === undefined);
const statusOf = () => store.getState().global.downloads[ref.identifier]?.status?.status;

function renderAndStart(target = ref) {
  const view = renderWithProviders(
    <DownloadWrapper>
      <StartButton target={target} />
    </DownloadWrapper>
  );
  fireEvent.click(screen.getByRole("button", { name: "Start" }));
  return view;
}

describe("DownloadWrapper", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    store.dispatch(removeDownload(ref.identifier));
    store.dispatch(removeDownload(slashed.identifier));
    mockQortalAction("GET_QDN_RESOURCE_PROPERTIES", { filename: "big.iso", mimeType: "application/octet-stream", size: 1 });
    mockQortalAction("GET_QDN_RESOURCE_STATUS", { status: "DOWNLOADING", percentLoaded: 10 });
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (document as any).visibilityState;
  });

  it("asks the node for the file once and starts polling, with no unused URL call", async () => {
    const { unmount } = renderAndStart();
    expect(qortalCallsFor("GET_QDN_RESOURCE_PROPERTIES").length).toBe(1);
    expect(qortalCallsFor("GET_QDN_RESOURCE_URL").length).toBe(0);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(qortalCallsFor("GET_QDN_RESOURCE_STATUS").length).toBe(1);
    expect(store.getState().global.downloads[ref.identifier].status.percentLoaded).toBe(10);
    unmount();
  });

  it("asks the node to build a DOWNLOADED file with no share page open, then stops at READY", async () => {
    mockQortalAction("GET_QDN_RESOURCE_STATUS", (p: any) =>
      p.build ? { status: "READY", percentLoaded: 100 } : { status: "DOWNLOADED", percentLoaded: 100 }
    );
    const { unmount } = renderAndStart();
    await wait(POLL_MS);
    expect(buildCalls()).toEqual([{ action: "GET_QDN_RESOURCE_STATUS", ...ref, build: true }]);
    expect(statusOf()).toBe("READY");
    const polls = pollCalls().length;
    await wait(POLL_MS * 4);
    expect(pollCalls().length).toBe(polls);
    expect(buildCalls().length).toBe(1);
    unmount();
  });

  it("asks at most every BUILD_NUDGE_MS, one at a time, and only while the tab is visible", async () => {
    let finishBuild: (value: unknown) => void = () => {};
    mockQortalAction("GET_QDN_RESOURCE_STATUS", (p: any) =>
      p.build ? new Promise((resolve) => (finishBuild = resolve)) : { status: "DOWNLOADED", percentLoaded: 100 }
    );
    const { unmount } = renderAndStart();
    await wait(POLL_MS);
    expect(buildCalls().length).toBe(1);
    // Still building: later polls do not ask again.
    await wait(POLL_MS * 3);
    expect(buildCalls().length).toBe(1);
    finishBuild({ status: "DOWNLOADED", percentLoaded: 100 });
    await wait(POLL_MS);
    expect(buildCalls().length).toBe(2);
    finishBuild({ status: "DOWNLOADED", percentLoaded: 100 });
    // The next poll comes sooner than BUILD_NUDGE_MS after that ask.
    expect(POLL_MS).toBeLessThan(BUILD_NUDGE_MS);
    await wait(POLL_MS);
    expect(buildCalls().length).toBe(2);
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    const calls = qortalCallsFor("GET_QDN_RESOURCE_STATUS").length;
    await wait(POLL_MS * 4);
    expect(qortalCallsFor("GET_QDN_RESOURCE_STATUS").length).toBe(calls);
    unmount();
  });

  it("keeps one build ask out for a build that takes minutes, as q-apps.js times requests", async () => {
    // q-apps.js races each request with a timeout: 30 s for a plain status call,
    // the caller's own for qortalRequestWithTimeout.
    const g = globalThis as any;
    const plain = g.qortalRequest;
    const withTimeout = g.qortalRequestWithTimeout;
    const race = (params: unknown, ms: number) =>
      Promise.race([plain(params), new Promise((_, reject) => setTimeout(() => reject("The request timed out"), ms))]);
    g.qortalRequest = (params: unknown) => race(params, 30_000);
    g.qortalRequestWithTimeout = vi.fn((params: unknown, ms: number) => race(params, ms));
    try {
      // Core answers the build ask only once the file is built, three minutes on.
      mockQortalAction("GET_QDN_RESOURCE_STATUS", (p: any) =>
        p.build
          ? new Promise((resolve) => setTimeout(() => resolve({ status: "READY", percentLoaded: 100 }), 3 * 60_000))
          : { status: "DOWNLOADED", percentLoaded: 100 }
      );
      const { unmount } = renderAndStart();
      await wait(POLL_MS);
      expect(buildCalls().length).toBe(1);
      expect(g.qortalRequestWithTimeout).toHaveBeenCalledWith(expect.objectContaining({ build: true }), BUILD_TIMEOUT_MS);
      // Polls keep answering DOWNLOADED well past 30 s, and none asks again.
      await wait(2 * 60_000);
      expect(pollCalls().length).toBeGreaterThan(20);
      expect(buildCalls().length).toBe(1);
      await wait(65_000);
      expect(statusOf()).toBe("READY");
      expect(buildCalls().length).toBe(1);
      unmount();
    } finally {
      g.qortalRequest = plain;
      g.qortalRequestWithTimeout = withTimeout;
    }
  });

  it("keeps READY from a build answer when an older poll answers after it", async () => {
    mockQortalAction("GET_QDN_RESOURCE_STATUS", (p: any) =>
      p.build
        ? new Promise((resolve) => setTimeout(() => resolve({ status: "READY", percentLoaded: 100 }), POLL_MS + 2_000))
        : pollCalls().length === 1
          ? { status: "DOWNLOADED", percentLoaded: 100 }
          : new Promise((resolve) => setTimeout(() => resolve({ status: "DOWNLOADED", percentLoaded: 100 }), 3_000))
    );
    const { unmount } = renderAndStart();
    // Poll 1 at 5 s asks for a build that answers READY at 12 s; poll 2 goes out at
    // 10 s and answers DOWNLOADED at 13 s.
    await wait(POLL_MS * 3);
    expect(statusOf()).toBe("READY");
    unmount();
  });

  it("asks, polls and builds with the name encoded for a name q-apps.js breaks", async () => {
    mockFetch("/arbitrary/resource/properties/", { filename: "guide.pdf", mimeType: "application/pdf", size: 628977 });
    mockFetch("/arbitrary/resource/status/", (url: URL) =>
      url.search === "?build=true" ? { status: "READY", percentLoaded: 100 } : { status: "DOWNLOADED", percentLoaded: 100 }
    );
    const { unmount } = renderAndStart(slashed);
    await wait(POLL_MS);
    const path = "FILE/Vallot-%2F8%2F/qshare_file_qortal-corei-settingsjson-fail_yaGJk4";
    expect(fetchCallsMatching("/arbitrary/resource/")).toEqual([
      `/arbitrary/resource/properties/${path}`,
      `/arbitrary/resource/status/${path}`,
      `/arbitrary/resource/status/${path}?build=true`,
    ]);
    expect(store.getState().global.downloads[slashed.identifier].status.status).toBe("READY");
    expect(qortalCallsFor("GET_QDN_RESOURCE_STATUS")).toEqual([]);
    expect(qortalCallsFor("GET_QDN_RESOURCE_PROPERTIES")).toEqual([]);
    unmount();
  });

  it("counts an error page answered as text as a failure, and stops polling after six", async () => {
    // q-apps.js resolves Jetty's HTML 400 page as a plain string.
    mockQortalAction("GET_QDN_RESOURCE_STATUS", "<h1>Bad Message 400</h1><pre>reason: Ambiguous URI empty segment</pre>");
    const { unmount } = renderAndStart();
    await wait(POLL_MS * 6);
    expect(statusOf()).toBe("REFETCHING");
    const polls = pollCalls().length;
    await wait(POLL_MS * 4);
    expect(pollCalls().length).toBe(polls);
    unmount();
  });
});
