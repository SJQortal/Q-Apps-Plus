import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { installQortalMock } from "../../../test/qortalMock";
import { BLOCKED_NAMES_LIST, BlockedNamesModal, PUBLIC_NODE_TEXT, RECHECK_AFTER_TIMEOUT_MS, isPublicNodeRefusal } from "./BlockedNamesModal";

const PUBLIC_NODE = {
  error: "This action cannot be done through a public node",
  message: "This action cannot be done through a public node",
};

describe("BlockedNamesModal", () => {
  it("lists the shared blockedNames_q-blog list and unblocks a name with DELETE_LIST_ITEM", async () => {
    const q = installQortalMock({
      GET_LIST_ITEMS: async () => ["bob", "eve"],
      DELETE_LIST_ITEM: async () => true,
    });
    renderWithProviders(<BlockedNamesModal open onClose={() => {}} />);
    expect(await screen.findByText("bob")).toBeInTheDocument();
    expect(BLOCKED_NAMES_LIST).toBe("blockedNames_q-blog");
    expect(q.callsFor("GET_LIST_ITEMS")).toEqual([{ action: "GET_LIST_ITEMS", list_name: "blockedNames_q-blog" }]);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Unblock bob" }));
    });
    await waitFor(() => expect(screen.queryByText("bob")).toBeNull());
    expect(q.callsFor("DELETE_LIST_ITEM")).toEqual([
      { action: "DELETE_LIST_ITEM", list_name: "blockedNames_q-blog", item: "bob" },
    ]);
    expect(screen.getByText("eve")).toBeInTheDocument();
  });

  it("says when the list is empty", async () => {
    installQortalMock({ GET_LIST_ITEMS: async () => [] });
    renderWithProviders(<BlockedNamesModal open onClose={() => {}} />);
    expect(await screen.findByText("No blocked names")).toBeInTheDocument();
  });

  it("is quiet about Hub's public-node refusal, in any language", async () => {
    expect(isPublicNodeRefusal(PUBLIC_NODE)).toBe(true);
    expect(isPublicNodeRefusal({ error: "Diese Aktion kann nicht über einen öffentlichen Node ausgeführt werden" })).toBe(true);
    expect(isPublicNodeRefusal("user declined to share list")).toBe(false);

    installQortalMock({
      GET_LIST_ITEMS: async () => {
        throw PUBLIC_NODE;
      },
    });
    const { store } = renderWithProviders(<BlockedNamesModal open onClose={() => {}} />);
    expect(await screen.findByText(new RegExp(PUBLIC_NODE_TEXT))).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /retry/i })).toBeNull();
    expect(store.getState().notifications.alertTypes.alertError).toBe("");
  });

  it("treats a declined access dialog as a cancel with Try again", async () => {
    let calls = 0;
    installQortalMock({
      GET_LIST_ITEMS: async () => {
        calls += 1;
        if (calls === 1) throw "user declined to share list";
        return ["bob"];
      },
    });
    renderWithProviders(<BlockedNamesModal open onClose={() => {}} />);
    expect(await screen.findByText("Access not granted")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("bob")).toBeInTheDocument();
  });

  it("shows a real failure with Retry, and a failed unblock as a message", async () => {
    let fail = true;
    installQortalMock({
      GET_LIST_ITEMS: async () => {
        if (fail) throw new Error("failed to fetch the list");
        return ["bob"];
      },
      DELETE_LIST_ITEM: async () => {
        throw { error: 500, message: "Core error" };
      },
    });
    const { store } = renderWithProviders(<BlockedNamesModal open onClose={() => {}} />);
    expect(await screen.findByText("The block list could not be loaded")).toBeInTheDocument();
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("bob")).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Unblock bob" }));
    });
    expect(store.getState().notifications.alertTypes.alertError).toMatch(/Could not unblock bob/);
    expect(screen.getByText("bob")).toBeInTheDocument();
  });

  it("keeps the name when the unblock is declined, and reads the list again after Hub's timeout", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      let answer: () => unknown = () => {
        throw "user declined delete from list";
      };
      const q = installQortalMock({
        GET_LIST_ITEMS: async () => ["bob"],
        DELETE_LIST_ITEM: async () => answer(),
      });
      const { store } = renderWithProviders(<BlockedNamesModal open onClose={() => {}} />);
      expect(await screen.findByText("bob")).toBeInTheDocument();
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Unblock bob" }));
      });
      expect(screen.getByText("bob")).toBeInTheDocument();
      expect(store.getState().notifications.alertTypes.alertError).toBe("");

      answer = () => {
        throw "The request timed out";
      };
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Unblock bob" }));
      });
      expect(q.callsFor("GET_LIST_ITEMS")).toHaveLength(1);
      await act(async () => {
        vi.advanceTimersByTime(RECHECK_AFTER_TIMEOUT_MS + 10);
      });
      expect(q.callsFor("GET_LIST_ITEMS")).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
