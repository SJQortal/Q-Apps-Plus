import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { addUser } from "../state/features/authSlice";
import { getAccountNames, getPrimaryAccountName } from "../utils/qortalRequestFunctions";
import { errorMessage, isHubDecline, isHubTimeout } from "../utils/hubErrors";

/**
 * Hub answers GET_USER_ACCOUNT with "Request timed out" after 30 s, but its
 * Authenticate dialog stays up for 60 s and a late Accept still grants the
 * session. Asking once more after the dialog has gone signs the user in
 * without a second prompt.
 */
export const ACCOUNT_RETRY_MS = 35_000;

/**
 * Hub answers every failed GET_USER_ACCOUNT, a declined Authenticate dialog
 * included, with this one string (qortal-requests.ts). It says no more than a
 * decline does, so it is not logged as an error either.
 */
const ACCOUNT_REFUSED = /unable to get user account/i;

/**
 * Asks Hub for the signed-in account on mount and puts it, with its names and
 * primary name, in the store. Returns `authenticate` to ask again (the header's
 * Sign in button) and whether a request is in flight.
 */
export function useUserAccount(): { authenticate: () => void; authenticating: boolean } {
  const dispatch = useDispatch();
  const retryTimer = useRef<number | undefined>(undefined);
  // True from the start: the first request goes out on mount.
  const [authenticating, setAuthenticating] = useState(true);

  const loadAccount = useCallback(async () => {
    try {
      const account = await qortalRequest({ action: "GET_USER_ACCOUNT" });
      const names = await getAccountNames(account.address);
      const primary = await getPrimaryAccountName(account.address);
      dispatch(addUser({ ...account, name: primary, names }));
    } finally {
      setAuthenticating(false);
    }
  }, [dispatch]);

  const request = useCallback(async () => {
    window.clearTimeout(retryTimer.current);
    retryTimer.current = undefined;
    try {
      await loadAccount();
    } catch (error) {
      if (isHubTimeout(error)) {
        // Once only: if nobody answered, the retry's own dialog is the last one.
        retryTimer.current = window.setTimeout(() => {
          retryTimer.current = undefined;
          setAuthenticating(true);
          loadAccount().catch(() => {});
        }, ACCOUNT_RETRY_MS);
      } else if (!isHubDecline(error) && !ACCOUNT_REFUSED.test(errorMessage(error, ""))) {
        console.error(error);
      }
    }
  }, [loadAccount]);

  useEffect(() => {
    request();
    return () => window.clearTimeout(retryTimer.current);
  }, [request]);

  const authenticate = useCallback(() => {
    setAuthenticating(true);
    request();
  }, [request]);

  return { authenticate, authenticating };
}
