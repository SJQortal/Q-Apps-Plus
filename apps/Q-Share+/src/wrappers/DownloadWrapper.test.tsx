import { useContext } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "../test/renderWithProviders";
import { mockQortalAction, qortalCallsFor } from "../test/setup";
import { store } from "../state/store";
import { removeDownload } from "../state/features/globalSlice";
import DownloadWrapper, { MyContext } from "./DownloadWrapper";

const ref = { name: "alice", service: "FILE", identifier: "qshare_file_big_1" };

function StartButton() {
  const { downloadVideo } = useContext(MyContext);
  return <button onClick={() => downloadVideo({ ...ref, properties: { ...ref, filename: "big.iso" } })}>Start</button>;
}

function renderAndStart() {
  const view = renderWithProviders(
    <DownloadWrapper>
      <StartButton />
    </DownloadWrapper>
  );
  fireEvent.click(screen.getByRole("button", { name: "Start" }));
  return view;
}

describe("DownloadWrapper", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    store.dispatch(removeDownload(ref.identifier));
    mockQortalAction("GET_QDN_RESOURCE_PROPERTIES", { filename: "big.iso", mimeType: "application/octet-stream", size: 1 });
    mockQortalAction("GET_QDN_RESOURCE_STATUS", { status: "DOWNLOADING", percentLoaded: 10 });
  });

  afterEach(() => {
    vi.useRealTimers();
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
});
