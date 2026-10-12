import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../test/renderWithProviders";
import { fetchCallsMatching, mockFetch, mockQortalAction, qortalCallsFor } from "../test/setup";
import { store } from "../state/store";
import { removeDownload, setAddToDownloads, updateDownloads } from "../state/features/globalSlice";
import { MyContext } from "../wrappers/DownloadWrapper";
import { useFileOnNode, type NodeFileRef } from "./useFileOnNode";

const plain: NodeFileRef = { name: "alice", service: "FILE", identifier: "qshare_file_talk_1", filename: "talk.mp4" };
/** A real publisher whose name q-apps.js puts into the URL unencoded. */
const slashed: NodeFileRef = {
  name: "Vallot-/8/",
  service: "FILE",
  identifier: "qshare_file_qortal-corei-settingsjson-fail_yaGJk4",
  filename: "guide.pdf",
};

function Probe({ file }: { file: NodeFileRef }) {
  const node = useFileOnNode(file, "qshare_file_talk_metadata");
  return (
    <div>
      <span data-testid="state">{node.state}</span>
      <span data-testid="stopped">{String(node.stopped)}</span>
      <span data-testid="text">{node.statusText}</span>
      <button onClick={() => void node.ensure()}>Ensure</button>
    </div>
  );
}

function renderProbe(file: NodeFileRef, { ensure = true } = {}) {
  const downloadVideo = vi.fn();
  const retryDownload = vi.fn();
  const view = renderWithProviders(
    <MyContext.Provider value={{ downloadVideo, retryDownload }}>
      <Probe file={file} />
    </MyContext.Provider>
  );
  if (ensure) fireEvent.click(screen.getByRole("button", { name: "Ensure" }));
  return { ...view, downloadVideo, retryDownload };
}

const state = () => screen.getByTestId("state").textContent;

describe("useFileOnNode", () => {
  beforeEach(() => {
    store.dispatch(removeDownload(plain.identifier));
    store.dispatch(removeDownload(slashed.identifier));
  });

  it("asks q-apps.js for the status of an ordinary name, and starts a file that isn't local", async () => {
    mockQortalAction("GET_QDN_RESOURCE_STATUS", { status: "MISSING_DATA", percentLoaded: 20 });
    const { downloadVideo } = renderProbe(plain);
    await waitFor(() => expect(state()).toBe("fetching"));
    expect(qortalCallsFor("GET_QDN_RESOURCE_STATUS")).toEqual([
      { action: "GET_QDN_RESOURCE_STATUS", name: "alice", service: "FILE", identifier: plain.identifier },
    ]);
    expect(downloadVideo).toHaveBeenCalledTimes(1);
  });

  it("checks the status with the name encoded for a name q-apps.js breaks", async () => {
    mockFetch("/arbitrary/resource/status/", { status: "PUBLISHED", percentLoaded: 0 });
    const { downloadVideo } = renderProbe(slashed);
    await waitFor(() => expect(state()).toBe("fetching"));
    expect(fetchCallsMatching("/arbitrary/resource/")).toEqual([
      "/arbitrary/resource/status/FILE/Vallot-%2F8%2F/qshare_file_qortal-corei-settingsjson-fail_yaGJk4",
    ]);
    expect(qortalCallsFor("GET_QDN_RESOURCE_STATUS")).toEqual([]);
    expect(downloadVideo).toHaveBeenCalledWith(expect.objectContaining({ name: "Vallot-/8/", identifier: slashed.identifier }));
  });

  /** A download entry as the poller leaves it. */
  function entryAt(status: string) {
    const ref = { name: plain.name, service: "FILE", identifier: plain.identifier };
    store.dispatch(setAddToDownloads({ ...ref, properties: plain }));
    store.dispatch(updateDownloads({ ...ref, status: { status, percentLoaded: 40 } }));
  }

  /** The poller answers (`stopped` false) or gives up after six status errors. */
  function poll(stopped: boolean) {
    const status = stopped ? { status: "REFETCHING", percentLoaded: 40, stopped } : { status: "DOWNLOADING", percentLoaded: 40 };
    act(() => {
      store.dispatch(updateDownloads({ identifier: plain.identifier, status }));
    });
  }

  it("picks up a stalled download, whose poller may have given up, instead of following it", async () => {
    entryAt("REFETCHING");
    const { downloadVideo, retryDownload } = renderProbe(plain);
    await waitFor(() => expect(retryDownload).toHaveBeenCalledTimes(1));
    expect(retryDownload).toHaveBeenCalledWith({ name: "alice", service: "FILE", identifier: plain.identifier });
    expect(downloadVideo).not.toHaveBeenCalled();
    expect(qortalCallsFor("GET_QDN_RESOURCE_STATUS")).toEqual([]);
    expect(state()).toBe("fetching");
  });

  it("restarts a download it waits on once when its poller gives up, then leaves it to Try again", async () => {
    entryAt("DOWNLOADING");
    const { retryDownload } = renderProbe(plain);
    expect(await screen.findByText("fetching")).toBeInTheDocument();
    expect(retryDownload).not.toHaveBeenCalled();

    // The node drops out while Open PDF waits: no new tap needed.
    poll(true);
    expect(retryDownload).toHaveBeenCalledTimes(1);
    expect(retryDownload).toHaveBeenCalledWith({ name: "alice", service: "FILE", identifier: plain.identifier });

    // Still down after that: the reader offers Try again instead of asking again.
    poll(false);
    poll(true);
    expect(retryDownload).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("stopped").textContent).toBe("true");
    expect(screen.getByTestId("text").textContent).toBe("Your node stopped answering at 40%");

    // A tap (ensure again) starts it at once and arms one more restart.
    fireEvent.click(screen.getByRole("button", { name: "Ensure" }));
    expect(retryDownload).toHaveBeenCalledTimes(2);
    poll(false);
    poll(true);
    expect(retryDownload).toHaveBeenCalledTimes(3);
  });

  it("leaves a stopped download to the row when no reader waits on it", async () => {
    entryAt("DOWNLOADING");
    const { retryDownload } = renderProbe(plain, { ensure: false });
    poll(true);
    expect(screen.getByTestId("state").textContent).toBe("fetching");
    expect(retryDownload).not.toHaveBeenCalled();
  });

  it("just follows a download that is still polling", async () => {
    for (const status of ["DOWNLOADING", "MISSING_DATA"]) {
      entryAt(status);
      const { unmount, downloadVideo, retryDownload } = renderProbe(plain);
      expect(await screen.findByText("fetching")).toBeInTheDocument();
      expect(retryDownload).not.toHaveBeenCalled();
      expect(downloadVideo).not.toHaveBeenCalled();
      unmount();
    }
    expect(qortalCallsFor("GET_QDN_RESOURCE_STATUS")).toEqual([]);
  });
});
