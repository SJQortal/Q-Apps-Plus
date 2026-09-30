import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../test/renderWithProviders";
import { fetchCallsMatching, mockFetch, mockQortalAction, qortalCallsFor } from "../test/setup";
import { store } from "../state/store";
import { removeDownload } from "../state/features/globalSlice";
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
      <button onClick={() => void node.ensure()}>Ensure</button>
    </div>
  );
}

function renderProbe(file: NodeFileRef) {
  const downloadVideo = vi.fn();
  const retryDownload = vi.fn();
  renderWithProviders(
    <MyContext.Provider value={{ downloadVideo, retryDownload }}>
      <Probe file={file} />
    </MyContext.Provider>
  );
  fireEvent.click(screen.getByRole("button", { name: "Ensure" }));
  return { downloadVideo, retryDownload };
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
});
