import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "@testing-library/react";
import { renderWithProviders } from "../test/renderWithProviders";
import { store } from "../state/store";
import { addUser } from "../state/features/authSlice";
import { DEFAULT_SETTINGS, writeSettings } from "../utils/settings";
import { resetNotificationStore, writeNotifications, EMPTY_STATE } from "../utils/notifications/store";
import {
  CHECK_INTERVAL_MS,
  FIRST_CHECK_DELAY_MS,
  MAX_CHECK_INTERVAL_MS,
  requestNotificationCheck,
  useNotificationChecks,
} from "./useNotificationChecks";

const checkNotifications = vi.fn(async (_account: unknown, _options: unknown) => 0);
vi.mock("../utils/notifications/check", () => ({
  checkNotifications: (account: unknown, options: unknown) => checkNotifications(account, options),
}));

const ADDRESS = "Q9aWbQnCZXmuNNkpg6t4sTCk8CRYoGF7Ce";

function Host() {
  useNotificationChecks();
  return null;
}

let hidden = false;
const setHidden = (value: boolean) => {
  hidden = value;
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
};
const advance = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

describe("useNotificationChecks", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: 1_800_000_000_000 });
    Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
    hidden = false;
    localStorage.clear();
    resetNotificationStore();
    writeSettings(DEFAULT_SETTINGS);
    checkNotifications.mockReset().mockResolvedValue(0);
    // The check writes lastCheck; the mock does it by hand.
    checkNotifications.mockImplementation(async () => {
      writeNotifications(ADDRESS, { ...EMPTY_STATE, lastCheck: Date.now() });
      return 0;
    });
    store.dispatch(
      addUser({
        address: ADDRESS,
        publicKey: "k",
        name: "alice",
        names: [
          { name: "alice", owner: ADDRESS },
          { name: "Alice Two", owner: ADDRESS },
        ],
      })
    );
  });
  afterEach(() => {
    vi.useRealTimers();
    store.dispatch(addUser(null));
  });

  it("checks after the first screen for every name, then backs off while nothing turns up", async () => {
    renderWithProviders(<Host />);
    await advance(FIRST_CHECK_DELAY_MS);
    expect(checkNotifications).toHaveBeenCalledTimes(1);
    expect(checkNotifications.mock.calls[0][0]).toEqual({ address: ADDRESS, names: ["alice", "Alice Two"] });
    expect(checkNotifications.mock.calls[0][1]).toEqual({ comments: true, collections: true, hiddenNames: [] });

    await advance(2 * CHECK_INTERVAL_MS);
    expect(checkNotifications).toHaveBeenCalledTimes(2);
    await advance(4 * CHECK_INTERVAL_MS);
    expect(checkNotifications).toHaveBeenCalledTimes(3);
    // Capped at 15 minutes.
    await advance(MAX_CHECK_INTERVAL_MS);
    expect(checkNotifications).toHaveBeenCalledTimes(4);
    await advance(MAX_CHECK_INTERVAL_MS);
    expect(checkNotifications).toHaveBeenCalledTimes(5);
  });

  it("stops while hidden and checks on return when the last check is old", async () => {
    renderWithProviders(<Host />);
    await advance(FIRST_CHECK_DELAY_MS);
    setHidden(true);
    await advance(60 * 60_000);
    expect(checkNotifications).toHaveBeenCalledTimes(1);
    setHidden(false);
    await advance(0);
    expect(checkNotifications).toHaveBeenCalledTimes(2);
  });

  it("checks at once when the list opens, unless it just did", async () => {
    renderWithProviders(<Host />);
    await advance(FIRST_CHECK_DELAY_MS);
    act(() => requestNotificationCheck());
    await advance(0);
    expect(checkNotifications).toHaveBeenCalledTimes(1);
    await advance(30_000);
    act(() => requestNotificationCheck());
    await advance(0);
    expect(checkNotifications).toHaveBeenCalledTimes(2);
  });

  it("does nothing when both kinds are off or nobody is signed in", async () => {
    writeSettings({ notifyComments: false, notifyCollections: false });
    renderWithProviders(<Host />);
    await advance(MAX_CHECK_INTERVAL_MS);
    act(() => {
      writeSettings({ notifyComments: true });
      store.dispatch(addUser(null));
    });
    await advance(MAX_CHECK_INTERVAL_MS);
    expect(checkNotifications).not.toHaveBeenCalled();
  });
});
