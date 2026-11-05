/**
 * The signed-in name's favourites for components (favorites/myFavorites.ts):
 * read when a name is in, and a toggle that asks the user to sign in, or to
 * register a name, when there is none, and says when saving failed.
 */
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "../state/store";
import { setNotification } from "../state/features/notificationsSlice";
import { useShellActions } from "../components/layout/shellState";
import { favoritesSnapshot, loadFavorites, setFavorite, subscribeFavorites, type FavoritesSnapshot } from "./myFavorites";
import type { Favorite } from "./model";

const NONE: FavoritesSnapshot = { name: "", status: "idle", list: [], ids: new Set() };

/** `enabled` false: nothing is read until it is (a menu that isn't open). */
export function useFavorites(enabled = true) {
  const dispatch = useDispatch();
  const { signIn } = useShellActions();
  const name = useSelector((state: RootState) => state.auth.user?.name) ?? "";
  const address = useSelector((state: RootState) => state.auth.user?.address);
  const snap = useSyncExternalStore(subscribeFavorites, favoritesSnapshot, favoritesSnapshot);
  useEffect(() => {
    if (name && enabled) void loadFavorites(name);
  }, [name, enabled]);
  const mine = name && snap.name === name ? snap : NONE;

  const toggle = useCallback(
    async (fav: Favorite) => {
      if (!name) {
        if (address) dispatch(setNotification({ msg: "Register a Qortal name in Hub to keep favourites.", alertType: "info" }));
        else signIn();
        return;
      }
      const on = !favoritesSnapshot().ids.has(fav.identifier);
      const result = await setFavorite(name, fav, on);
      if (result.kind === "done") dispatch(setNotification({ msg: on ? "Added to your favourites" : "Removed from your favourites", alertType: "success" }));
      else if (result.kind === "failed") dispatch(setNotification({ msg: result.message, alertType: "error" }));
    },
    [name, address, dispatch, signIn]
  );

  return { name, status: mine.status, list: mine.list, isFavorite: (identifier: string) => mine.ids.has(identifier), toggle, reload: () => name && loadFavorites(name, { fresh: true }) };
}
