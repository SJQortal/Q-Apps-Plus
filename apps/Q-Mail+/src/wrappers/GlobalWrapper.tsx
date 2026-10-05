import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getAccountNames,
  getPrimaryAccountName,
} from "../utils/qortalRequestFunctions";
import { useDispatch, useSelector } from "react-redux";

import { addUser } from "../state/features/authSlice";
import { RootState } from "../state/store";

import PageLoader from "../components/common/PageLoader";

import ConsentModal from "../components/modals/ConsentModal";
import { setPrivateGroups } from "../state/features/globalSlice";
import { LoaderBar } from "../components/common/LoaderBar";
import {
  addAllHashMapSubject,
  clearMessages,
} from "../state/features/mailSlice";
import { applyQAppTextSize } from "@qortal/qapp-lib/typography";
import { useQMailAppShell } from "../app-shell/useQMailAppShell";
import {
  AppShellContext,
  type MailSyncState,
} from "../app-shell/AppShellContext";
import { subscribeToEvent, unsubscribeFromEvent } from "../utils/events";
import { useMailLocalState } from "../hooks/useMailLocalState";
import { usePolling } from "../hooks/usePolling";
import { HUB_DIALOG_GRACE_MS, isAccountRefusal, isHubDecline, isHubTimeout } from "../utils/hubErrors";
import { getAvatarUrl } from "../utils/avatarCache";
interface Props {
  children: React.ReactNode;
}
interface DataEntry {
  timestamp: number;
  [key: string]: any; // Allows for additional fields of various types
}

interface DataObject {
  [identifier: string]: DataEntry;
}

const GlobalWrapper: React.FC<Props> = ({ children }) => {
  const dispatch = useDispatch();

  // The avatar URL together with the name it belongs to. Right after a name
  // switch the old name's URL must not pass for the new name's: the name
  // switcher primes the avatar cache with it, and POS+ then showed Simon
  // James's picture for the rest of the session.
  const [avatarFor, setAvatarFor] = useState<{ name: string; url: string }>({ name: "", url: "" });
  const [mailSync, setMailSync] = useState<MailSyncState | null>(null);
  const registerMailSync = useCallback((sync: MailSyncState | null) => {
    setMailSync(sync);
  }, []);

  const { user } = useSelector((state: RootState) => state.auth);
  useMailLocalState(user?.address);

  const activeName = user?.name;
  const userAvatar = activeName && avatarFor.name === activeName ? avatarFor.url : "";
  // Through the session avatar cache, so the owned-name loop in Mail.tsx
  // shares this one GET_QDN_RESOURCE_URL instead of asking again.
  useEffect(() => {
    if (!activeName) return;
    let cancelled = false;
    void getAvatarUrl(activeName).then(url => {
      if (!cancelled) setAvatarFor({ name: activeName, url: url || "" });
    });
    return () => {
      cancelled = true;
    };
  }, [activeName]);

  useEffect(() => {
    qortalRequest({
      action: "NOTIFICATION_MARK_SEEN",
      notificationIds: ["q-mail-notification"],
    }).catch(error => {
      console.log({ error });
    });
  }, []);

  const isLoadingGlobal = useSelector(
    (state: RootState) => state.global.isLoadingGlobal
  );
  const isLoadingCustom = useSelector(
    (state: RootState) => state.global.isLoadingCustom
  );

  const lastGroupsJsonRef = useRef<string>("");
  /** Resolves to true when the membership changed (a fresh `privateGroups` object is dispatched only then). */
  const getGroups = React.useCallback(
    async (address: string): Promise<boolean> => {
      try {
        const groups: any = {};
        const response = await fetch(
          "/groups/member/" + encodeURIComponent(address)
        );
        const groupData = await response.json();
        const memberGroups = Array.isArray(groupData) ? groupData : [];
        if (memberGroups.length > 0) {
          for (const group of memberGroups) {
            const groupNumber = group?.groupId;
            if (groupNumber === undefined || groupNumber === null) continue;
            groups[groupNumber] = {
              ...group,
            };
          }
        }
        const groupsJson = JSON.stringify(groups);
        if (groupsJson === lastGroupsJsonRef.current) return false;
        lastGroupsJsonRef.current = groupsJson;
        dispatch(setPrivateGroups(groups));
        return true;
      } catch (error) {
        console.log({ error });
        return false;
      }
    },
    [dispatch]
  );
  // async function getGroups(address: string) {
  //   try {
  //     const groups: any = {};
  //     const response = await fetch("/groups/member/" + address);
  //     const groupData = await response.json();
  //     const filterPrivate = groupData?.filter(
  //       (group: any) => group?.isOpen === false
  //     );
  //     if (filterPrivate?.length > 0) {
  //       for (const group of filterPrivate) {
  //         const groupNumber = group.groupId;
  //         let prevGroupMembers = privateGroupsRef.current?.[groupNumber] || {};
  //         if (prevGroupMembers) {
  //           prevGroupMembers = {
  //             ...(prevGroupMembers?.membersByAddress || {}),
  //           };
  //         }
  //         const response = await fetch(
  //           `/groups/members/${groupNumber}?limit=0`
  //         );
  //         const groupData = await response.json();

  //         let members: any = {};
  //         let membersByAddress: any = {};
  //         if (groupData && Array.isArray(groupData?.members)) {
  //           for (const member of groupData.members) {
  //             if (member.member) {
  //               if (prevGroupMembers[member.member]) {
  //                 delete prevGroupMembers[member.member];
  //                 continue;
  //               }
  //               const res = await getNameInfo(member.member);
  //               const resAddress = await qortalRequest({
  //                 action: "GET_ACCOUNT_DATA",
  //                 address: member.member,
  //               });
  //               const name = res;
  //               const publicKey = resAddress.publicKey;
  //               if (name) {
  //                 members[name] = {
  //                   publicKey,
  //                   address: member.member,
  //                 };
  //                 membersByAddress[member.member] = true;
  //               }
  //             }
  //           }
  //         }

  //         let oldGroup = privateGroupsRef.current?.[groupNumber];
  //         if (oldGroup) {
  //           oldGroup = structuredClone(privateGroupsRef.current[groupNumber]);
  //         }
  //         let remainingMembers: any = {};
  //         let remainingMembersByAddress: any = {};
  //         for (const memberName of Object.keys(oldGroup?.members || {})) {
  //           const member = oldGroup?.members[memberName];
  //           if (member && prevGroupMembers[member.address]) {
  //             continue;
  //           } else if (member) {
  //             remainingMembers[memberName] = member;
  //             remainingMembersByAddress[member.address] = true;
  //           }
  //         }
  //         const addNewMembers = {
  //           ...remainingMembers,
  //           ...members,
  //         };
  //         const addNewMembersByAddress = {
  //           ...membersByAddress,
  //           ...remainingMembersByAddress,
  //         };
  //         groups[groupNumber] = {
  //           ...group,
  //           members: addNewMembers,
  //           membersByAddress: addNewMembersByAddress,
  //         };
  //       }
  //     }
  //     dispatch(setPrivateGroups(groups));
  //   } catch (error) {
  //     console.log({ error });
  //   }
  // }
  const getLocalSubjects = useCallback(async (name?: string) => {
    try {
      const subjects = JSON.parse(
        localStorage.getItem(`qmail_persistance_${name}`) || "{}"
      );
      // Convert to an array of objects with identifier and all fields
      const dataArray = Object.entries(subjects).map(([identifier, value]) => ({
        identifier,
        ...(value as DataEntry),
      }));

      // Sort the array based on timestamp in descending order
      dataArray.sort((a, b) => b.timestamp - a.timestamp);

      // Slice the array to keep only the first 500 elements
      const latest500 = dataArray.slice(0, 500);

      // Convert back to the original object format
      const latest500Data: DataObject = {};
      latest500.forEach(item => {
        const { identifier, ...rest } = item;
        latest500Data[identifier] = rest;
      });
      localStorage.setItem(
        `qmail_persistance_${name}`,
        JSON.stringify(latest500Data)
      );
      dispatch(addAllHashMapSubject(latest500Data));
    } catch (error) {
      localStorage.setItem(`qmail_persistance_${name}`, JSON.stringify({}));
    }
  }, [dispatch]);

  const loadAccount = React.useCallback(async () => {
    const account = await qortalRequest({
      action: "GET_USER_ACCOUNT",
    });
    const names = await getAccountNames(account.address);
    const primary = await getPrimaryAccountName(account.address);
    dispatch(addUser({ ...account, name: primary, names }));
  }, [dispatch]);

  const accountRetryTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(accountRetryTimer.current), []);

  /**
   * Asks Hub for the signed-in account. Hub answers GET_USER_ACCOUNT with a
   * timeout after 30 s (for example while Hub is locked) but leaves its
   * Authenticate dialog up for 60 s and applies a late Accept, so after a
   * timeout the request is made once more when the dialog is gone either way
   * (docs/QORTAL.md pitfall 12). A decline, or Hub's one "Unable to get user
   * account" answer, is the user's choice: the mail page keeps its Sign in
   * prompt and nothing is logged as an error.
   */
  const askForAccountInformation = React.useCallback(async () => {
    window.clearTimeout(accountRetryTimer.current);
    accountRetryTimer.current = undefined;
    const quiet = (error: unknown) => isHubDecline(error) || isAccountRefusal(error);
    try {
      await loadAccount();
    } catch (error) {
      if (isHubTimeout(error)) {
        accountRetryTimer.current = window.setTimeout(() => {
          accountRetryTimer.current = undefined;
          loadAccount().catch(retryError => {
            if (!quiet(retryError) && !isHubTimeout(retryError)) console.error(retryError);
          });
        }, HUB_DIALOG_GRACE_MS);
      } else if (!quiet(error)) {
        console.error(error);
      }
    }
  }, [loadAccount]);

  React.useEffect(() => {
    if (!user?.address) {
      return;
    }
    lastGroupsJsonRef.current = "";
    void getGroups(user.address);
  }, [getGroups, user?.address]);

  // Group membership refresh: every 10 min while visible, backing off to 30 min
  // while nothing changes (the original polled every 10 min, hidden or not).
  usePolling(
    async () => {
      if (!user?.address) return;
      return getGroups(user.address);
    },
    {
      intervalMs: 600000,
      maxIntervalMs: 1800000,
      enabled: Boolean(user?.address),
    }
  );

  React.useEffect(() => {
    if (!user?.name) {
      return;
    }
    void getLocalSubjects(user.name);
  }, [getLocalSubjects, user?.name]);

  const { controller: appShellController, state: appShellState } =
    useQMailAppShell({
      authenticated: Boolean(user?.address || user?.name),
      identity: user
        ? {
            address: user.address,
            name: user.name,
          }
        : null,
      authenticate: askForAccountInformation,
      // Light/dark now comes from Hub through the theme kit (HubThemeProvider).
      onThemeChange: () => {},
    });

  // The mail page's "Authenticate" prompts fire this event.
  useEffect(() => {
    const onAuthenticate = () => {
      void appShellController.authenticate();
    };
    subscribeToEvent("qmail:authenticate", onAuthenticate);
    return () => {
      unsubscribeFromEvent("qmail:authenticate", onAuthenticate);
    };
  }, [appShellController]);

  const setActiveName = useCallback(
    (name: string) => {
      if (!user || name === user.name) return;
      dispatch(clearMessages());
      dispatch(addUser({ ...user, name }));
      void getLocalSubjects(name);
    },
    [dispatch, getLocalSubjects, user]
  );

  const appShellValue = useMemo(
    () => ({
      user,
      userAvatar,
      setActiveName,
      authenticate: askForAccountInformation,
      controller: appShellController,
      state: appShellState,
      mailSync,
      registerMailSync,
    }),
    [
      appShellController,
      appShellState,
      askForAccountInformation,
      mailSync,
      registerMailSync,
      setActiveName,
      user,
      userAvatar,
    ]
  );

  useEffect(() => {
    applyQAppTextSize(
      document.documentElement,
      appShellState.settings.textSize
    );
  }, [appShellState.settings.textSize]);

  return (
    <AppShellContext.Provider value={appShellValue}>
      {isLoadingGlobal && <PageLoader />}
      {isLoadingCustom && <LoaderBar message={isLoadingCustom} />}
      <ConsentModal />
      {children}
    </AppShellContext.Provider>
  );
};

export default GlobalWrapper;
