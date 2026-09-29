import React, { useEffect, useRef, useState } from "react";
import {
  getAccountNames,
  getPrimaryAccountName,
} from "../utils/qortalRequestFunctions";
import { useDispatch, useSelector } from "react-redux";

import { addUser } from "../state/features/authSlice";
import { RootState } from "../state/store";

import NavBar from "../components/layout/Navbar/Navbar";
import PageLoader from "../components/common/PageLoader";

import localForage from "localforage";
import ConsentModal from "../components/modals/ConsentModal";
import { AudioPlayer } from "../components/common/AudioPlayer";
import { setPrivateGroups } from "../state/features/globalSlice";
import { LoaderBar } from "../components/common/LoaderBar";
import {
  addAllHashMapSubject,
  clearMessages,
} from "../state/features/mailSlice";
import { applyQAppTextSize } from "@qortal/qapp-lib/typography";
import { useQMailAppShell } from "../app-shell/useQMailAppShell";
interface Props {
  children: React.ReactNode;
  setTheme: (val: "light" | "dark") => void;
}
interface DataEntry {
  timestamp: number;
  [key: string]: any; // Allows for additional fields of various types
}

interface DataObject {
  [identifier: string]: DataEntry;
}

const GlobalWrapper: React.FC<Props> = ({ children, setTheme }) => {
  const dispatch = useDispatch();

  const [userAvatar, setUserAvatar] = useState<string>("");

  const { user } = useSelector((state: RootState) => state.auth);
  const { audios, currAudio } = useSelector((state: RootState) => state.global);
  const favoritesLocalRef = useRef<any>(null);
  useEffect(() => {
    if (!user?.name) return;
    const dynamicInstanceName = `q-blog-favorites-${user.name}`; // Replace this with your dynamic value
    favoritesLocalRef.current = localForage.createInstance({
      name: dynamicInstanceName,
    });
    getAvatar();
  }, [user?.name]);

  useEffect(() => {
    qortalRequest({
      action: "NOTIFICATION_MARK_SEEN",
      notificationIds: ["q-mail-notification"],
    }).catch(error => {
      console.log({ error });
    });
  }, []);

  const getAvatar = async () => {
    try {
      let url = await qortalRequest({
        action: "GET_QDN_RESOURCE_URL",
        name: user?.name,
        service: "THUMBNAIL",
        identifier: "qortal_avatar",
      });

      if (url === "Resource does not exist") return;

      setUserAvatar(url);
    } catch (error) {
      console.error(error);
    }
  };

  const isLoadingGlobal = useSelector(
    (state: RootState) => state.global.isLoadingGlobal
  );
  const isLoadingCustom = useSelector(
    (state: RootState) => state.global.isLoadingCustom
  );

  const getGroups = React.useCallback(
    async (address: string) => {
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
        dispatch(setPrivateGroups(groups));
      } catch (error) {
        console.log({ error });
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
  const interval = useRef<any>(null);

  const getLocalSubjects = async (name?: string) => {
    try {
      const subjects = JSON.parse(
        localStorage.getItem(`qmail_persistance_${name}`) || "{}"
      );
      // Convert to an array of objects with identifier and all fields
      let dataArray = Object.entries(subjects).map(([identifier, value]) => ({
        identifier,
        ...(value as DataEntry),
      }));

      // Sort the array based on timestamp in descending order
      dataArray.sort((a, b) => b.timestamp - a.timestamp);

      // Slice the array to keep only the first 500 elements
      let latest500 = dataArray.slice(0, 500);

      // Convert back to the original object format
      let latest500Data: DataObject = {};
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
  };

  const checkGroupMembers = React.useCallback(
    (address: string) => {
      if (interval.current) {
        clearInterval(interval.current);
      }
      let isCalling = false;
      interval.current = setInterval(async () => {
        if (isCalling) return;
        isCalling = true;
        await getGroups(address);
        isCalling = false;
      }, 600000);
    },
    [getGroups]
  );

  const askForAccountInformation = React.useCallback(async () => {
    try {
      let account = await qortalRequest({
        action: "GET_USER_ACCOUNT",
      });

      const names = await getAccountNames(account.address);
      const primary = await getPrimaryAccountName(account.address);
      dispatch(addUser({ ...account, name: primary, names }));
    } catch (error) {
      console.error(error);
    }
  }, [dispatch]);

  React.useEffect(() => {
    if (!user?.address) {
      return;
    }

    void getGroups(user.address);
    checkGroupMembers(user.address);

    return () => {
      if (interval.current) {
        clearInterval(interval.current);
      }
    };
  }, [checkGroupMembers, getGroups, user?.address]);

  React.useEffect(() => {
    if (!user?.name) {
      return;
    }
    void getLocalSubjects(user.name);
  }, [user?.name]);

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
      onThemeChange: setTheme,
    });

  useEffect(() => {
    applyQAppTextSize(
      document.documentElement,
      appShellState.settings.textSize
    );
  }, [appShellState.settings.textSize]);

  return (
    <>
      {isLoadingGlobal && <PageLoader />}
      {isLoadingCustom && <LoaderBar message={isLoadingCustom} />}
      <NavBar
        isAuthenticated={!!user}
        userName={user?.name || ""}
        accountNames={user?.names || []}
        setActiveName={(name: string) => {
          dispatch(clearMessages());
          dispatch(addUser({ ...user, name }));
          void getLocalSubjects(name);
        }}
        userAvatar={userAvatar}
        appShellController={appShellController}
        appShellState={appShellState}
      />
      <ConsentModal />
      {children}

      {audios && audios.length > 0 && (
        <AudioPlayer currAudio={currAudio} playlist={audios} />
      )}
    </>
  );
};

export default GlobalWrapper;
