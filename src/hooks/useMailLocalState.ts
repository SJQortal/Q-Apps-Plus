import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../state/store";
import { setArchivedState, setReadState } from "../state/features/mailSlice";
import {
  readReadStateFromStorage,
  writeReadStateToStorage,
} from "../utils/readState";
import {
  readArchivedFromStorage,
  writeArchivedToStorage,
} from "../utils/archiveState";

/**
 * Loads the per-address local mail state (read/unread, archived) into Redux when the
 * signed-in address changes and writes it back whenever it changes. Mounted
 * once, in GlobalWrapper. Writes are gated on the loaded address so an empty
 * initial store never overwrites another account's saved state.
 */
export function useMailLocalState(address?: string | null): void {
  const dispatch = useDispatch();
  const normalizedAddress =
    typeof address === "string" ? address.trim() : "";
  const readState = useSelector((state: RootState) => state.mail.readState);
  const readStateAddress = useSelector(
    (state: RootState) => state.mail.readStateAddress
  );
  const archived = useSelector((state: RootState) => state.mail.archived);
  const archivedAddress = useSelector(
    (state: RootState) => state.mail.archivedAddress
  );

  useEffect(() => {
    dispatch(
      setReadState({
        address: normalizedAddress,
        entries: normalizedAddress
          ? readReadStateFromStorage(normalizedAddress)
          : {},
      })
    );
    dispatch(
      setArchivedState({
        address: normalizedAddress,
        entries: normalizedAddress
          ? readArchivedFromStorage(normalizedAddress)
          : {},
      })
    );
  }, [dispatch, normalizedAddress]);

  useEffect(() => {
    if (!normalizedAddress || readStateAddress !== normalizedAddress) return;
    writeReadStateToStorage(normalizedAddress, readState);
  }, [normalizedAddress, readState, readStateAddress]);

  useEffect(() => {
    if (!normalizedAddress || archivedAddress !== normalizedAddress) return;
    writeArchivedToStorage(normalizedAddress, archived);
  }, [archived, archivedAddress, normalizedAddress]);
}
