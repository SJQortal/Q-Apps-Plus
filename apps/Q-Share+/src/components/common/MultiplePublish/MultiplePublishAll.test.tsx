import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { mockQortalAction, qortalCallsFor } from "../../../test/setup";
import type { MultiplePublishRequest } from "../../../utils/publishPayload";
import { MultiplePublish } from "./MultiplePublishAll";

const file = new File(["x"], "clip.mp4", { type: "video/mp4" });
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
      identifier: "qshare_file_clip_aaaaaa",
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
      identifier: "qshare_file_clip_bbbbbb_metadata",
      filename: "video_metadata.json",
      tag1: "qshare_file_",
    },
  ],
};

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
    finish(true);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onError).not.toHaveBeenCalled();
    expect(qortalCallsFor("PUBLISH_MULTIPLE_QDN_RESOURCES").length).toBe(1);
  });

  it("marks the failed resource, sums up, and retries only that one", async () => {
    let attempt = 0;
    mockQortalAction("PUBLISH_MULTIPLE_QDN_RESOURCES", () => {
      attempt += 1;
      if (attempt === 1) throw { error: { unsuccessfulPublishes: [{ identifier: "qshare_file_clip_bbbbbb_metadata" }] } };
      return true;
    });
    const onSubmit = vi.fn();
    const onError = vi.fn();
    renderWithProviders(<MultiplePublish isOpen publishes={request} onSubmit={onSubmit} onError={onError} />);

    expect(await screen.findByText("1 of 2 published")).toBeInTheDocument();
    // The row text; the state icon carries the same word as its title.
    expect(screen.getByText("Published", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText("Failed", { selector: "p" })).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Retry failed" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const calls = qortalCallsFor("PUBLISH_MULTIPLE_QDN_RESOURCES") as any[];
    expect(calls.length).toBe(2);
    expect(calls[1].resources.map((r: any) => r.identifier)).toEqual(["qshare_file_clip_bbbbbb_metadata"]);
  });

  it("hands a decline and a timeout back to the caller", async () => {
    mockQortalAction("PUBLISH_MULTIPLE_QDN_RESOURCES", () => {
      throw { error: "User declined request" };
    });
    const onError = vi.fn();
    const { unmount } = renderWithProviders(
      <MultiplePublish isOpen publishes={request} onSubmit={vi.fn()} onError={onError} />
    );
    await waitFor(() => expect(onError).toHaveBeenCalledWith());
    unmount();

    mockQortalAction("PUBLISH_MULTIPLE_QDN_RESOURCES", () => {
      throw { error: "The request timed out" };
    });
    const onTimeout = vi.fn();
    renderWithProviders(<MultiplePublish isOpen publishes={request} onSubmit={vi.fn()} onError={onTimeout} />);
    await waitFor(() => expect(onTimeout).toHaveBeenCalledWith("The request timed out"));
  });

  it("lets the user cancel after an unknown failure", async () => {
    mockQortalAction("PUBLISH_MULTIPLE_QDN_RESOURCES", () => {
      throw new Error("Node unreachable");
    });
    const onError = vi.fn();
    renderWithProviders(<MultiplePublish isOpen publishes={request} onSubmit={vi.fn()} onError={onError} />);
    expect(await screen.findByText("Node unreachable")).toBeInTheDocument();
    expect(screen.getByText("0 of 2 published")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onError).toHaveBeenCalledWith();
  });
});
