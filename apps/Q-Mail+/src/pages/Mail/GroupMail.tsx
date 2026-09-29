import React, {
  FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../state/store";
import EditIcon from "@mui/icons-material/Edit";
import {
  Box,
  Button,
  Input,
  Menu,
  MenuItem,
  Typography,
  formLabelClasses,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import LazyLoad from "../../components/common/LazyLoad";
import { removePrefix } from "../../utils/blogIdformats";
import { NewMessage } from "./NewMessage";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import { useFetchMail } from "../../hooks/useFetchMail";
import { ShowMessage } from "./ShowMessage";
import { addToHashMapMail } from "../../state/features/mailSlice";
import MailIcon from "@mui/icons-material/Mail";
import {
  setIsLoadingCustom,
  setIsLoadingGlobal,
  setUserAvatarHash,
} from "../../state/features/globalSlice";
import SimpleTable, { AvatarWrapper } from "./MailTable";
import { MAIL_SERVICE_TYPE, THREAD_SERVICE_TYPE } from "../../constants/mail";
import { BlogPost } from "../../state/features/blogSlice";
import {
  base64ToUint8Array,
  objectToBase64,
  uint8ArrayToObject,
} from "../../utils/toBase64";
import { formatFullTimestamp } from "../../utils/time";
import { Thread } from "./Thread";
import { current } from "@reduxjs/toolkit";
import { delay } from "../../utils/helpers";
import { setNotification } from "../../state/features/notificationsSlice";
import { getNameInfo } from "../../utils/apiCalls";
import BackupIcon from "@mui/icons-material/Backup";
import { AllThreadP, GroupContainer, GroupNameP, SingleThreadParent, ThreadContainer, ThreadContainerFullWidth, ThreadInfoColumn, ThreadInfoColumnNameP, ThreadInfoColumnTime, ThreadInfoColumnbyP, ThreadSingleLastMessageP, ThreadSingleLastMessageSpanP, ThreadSingleTitle } from "./Mail-styles";
import { Spacer } from "../../components/common/Spacer";

const threadFilterOptions = ["Recently active", "Newest", "Oldest"];
interface AliasMailProps {
  groupInfo: any;
  currentThread: any;
  setCurrentThread: React.Dispatch<any>
  setFilterMode: React.Dispatch<any>
  filterMode: string
  onRequestComposeThread?: (groupInfo: any) => void
}
export const GroupMail = ({
  groupInfo,
  setCurrentThread,
  currentThread,
  filterMode,
  setFilterMode,
  onRequestComposeThread
}: AliasMailProps) => {
  const theme = useTheme();
  const { user } = useSelector((state: RootState) => state.auth);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [message, setMessage] = useState<any>(null);
  const [replyTo, setReplyTo] = useState<any>(null);
  const [valueTab, setValueTab] = React.useState(0);
  const [viewedThreads, setViewedThreads] = React.useState<any>({});
 const isMobile = useMediaQuery("(max-width:950px)");

  const [aliasValue, setAliasValue] = useState("");
  const [alias, setAlias] = useState<string[]>([]);
  const [recentThreads, setRecentThreads] = useState<any[]>([]);
  const [allThreads, setAllThreads] = useState<any[]>([]);
  const [members, setMembers] = useState<any>(null);
  const hashMapPosts = useSelector(
    (state: RootState) => state.blog.hashMapPosts
  );
  const [mailMessages, setMailMessages] = useState<any[]>([]);
  const hashMapMailMessages = useSelector(
    (state: RootState) => state.mail.hashMapMailMessages
  );
  const groupIdRef = useRef<any>(null)
  const groupId = useMemo(() => {
    return groupInfo?.id;
  }, [groupInfo]);

  useEffect(()=> {
    if(groupId !== groupIdRef?.current){
      const currentThreadGroupId = String(currentThread?.threadData?.groupId || "")
      const normalizedGroupId = String(groupId || "")
      if (!currentThreadGroupId || currentThreadGroupId !== normalizedGroupId) {
        setCurrentThread(null)
      }
      setRecentThreads([])
      setAllThreads([])
      groupIdRef.current = groupId
    }
  }, [currentThread?.threadData?.groupId, groupId, setCurrentThread])


  const dispatch = useDispatch();
  const navigate = useNavigate();

  const getAvatar = async (user: string) => {
    try {
      let url = await qortalRequest({
        action: 'GET_QDN_RESOURCE_URL',
        name: user,
        service: 'THUMBNAIL',
        identifier: 'qortal_avatar'
      })
      dispatch(
        setUserAvatarHash({
          name: user,
          url
        })
      )
    } catch (error) {}
  }

  const getAllThreads = React.useCallback(
    async (groupId: string, mode: string, isInitial?: boolean) => {
      try {
        const offset = isInitial ? 0 : allThreads.length;
        const isReverse = mode === 'Newest' ? true : false
        if(isInitial){
          dispatch(setIsLoadingCustom("Loading threads"));
        }
        const query = `qortal_qmail_thread_group${groupId}`;
        const params = new URLSearchParams({
          mode: "ALL",
          service: THREAD_SERVICE_TYPE,
          query,
          limit: "20",
          includemetadata: "true",
          offset: String(offset),
          reverse: String(isReverse),
          excludeblocked: "true",
        });
        const url = `/arbitrary/resources/search?${params.toString()}`;
        const response = await fetch(url, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });
        const responseData = await response.json();

        let fullArrayMsg = isInitial ? [] : [...allThreads];
        const getMessageForThreads = responseData.map(async (message: any) => {

     
          let fullObject: any = null
          if (message?.metadata?.description) {
             fullObject = {
              ...message,
              threadData: {
                title: message?.metadata?.description,
                groupId: groupId,
                createdAt: message?.created,
                name: message?.name,
              },
              threadOwner: message?.name,
            };
          } else {
            let threadRes = null
            try {
               threadRes = await Promise.race([
                qortalRequest({
                  action: "FETCH_QDN_RESOURCE",
                  name: message?.name,
                  service: THREAD_SERVICE_TYPE,
                  identifier: message.identifier
                }),
                delay(5000),
              ]);
            } catch (error) {
              
            }
           
           if(threadRes?.title){
             fullObject = {
              ...message,
              threadData: threadRes,
              threadOwner: message?.name,
            };
           }
            
          }
          if(fullObject?.identifier){
            const index = fullArrayMsg.findIndex(
              p => p.identifier === fullObject.identifier
            );
            if (index !== -1) {
              fullArrayMsg[index] = fullObject;
            } else {
              fullArrayMsg.push(fullObject);
            }
          }
           
        
        
      })
        await Promise.all(getMessageForThreads);
        let sorted = fullArrayMsg
        if(isReverse){
          sorted = fullArrayMsg.sort(
            (a: any, b: any) => b.created - a.created
          );
        } else {
           sorted = fullArrayMsg.sort(
            (a: any, b: any) => a.created - b.created
          );
        }
        
        setAllThreads(sorted)
      } catch (error) {
        console.log({error})
      } finally {
        if(isInitial){
        dispatch(setIsLoadingCustom(null));
        }
      }
    },
    [allThreads]
  );
  const getMailMessages = React.useCallback(
    async (groupId: string, members: any) => {
      try {
        const memberNames = Object.keys(members);

        dispatch(setIsLoadingCustom("Loading recent threads"));
        const query = `qortal_qmail_thmsg_group${groupId}`;
        const params = new URLSearchParams({
          mode: "ALL",
          service: MAIL_SERVICE_TYPE,
          query,
          limit: "100",
          includemetadata: "false",
          offset: "0",
          reverse: "true",
          excludeblocked: "true",
        });
        memberNames.forEach((name) => params.append("name", name));
        const url = `/arbitrary/resources/search?${params.toString()}`;
        const response = await fetch(url, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });
        const responseData = await response.json();
        const messagesForThread: any = {};

        for (const message of responseData) {
          let str = message.identifier;
          let parts = str.split("_").reverse();
          let result = parts[1];
          const checkMessage = messagesForThread[result];
          if (!checkMessage) {
            messagesForThread[result] = message;
          }
        }
        const newArray = Object.keys(messagesForThread)
          .map(key => {
            return {
              ...messagesForThread[key],
              threadId: `qortal_qmail_thread_group${groupId}_${key}`,
            };
          })
          .sort((a, b) => b.created - a.created).slice(0, 10)
        let fullThreadArray: any = [];
        const getMessageForThreads = newArray.map(async (message: any) => {
          try {
            const identifierQuery = message.threadId;
            const threadParams = new URLSearchParams({
              mode: "ALL",
              service: THREAD_SERVICE_TYPE,
              identifier: identifierQuery,
              limit: "1",
              includemetadata: "true",
              offset: "0",
              reverse: "true",
              excludeblocked: "true",
            });
            memberNames.forEach((name) => threadParams.append("name", name));
            const url = `/arbitrary/resources/search?${threadParams.toString()}`;
            const response = await fetch(url, {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
              },
            });
            const responseData = await response.json();
            if (responseData.length > 0) {
              const thread = responseData[0];
              if (thread?.metadata?.description) {
                const fullObject = {
                  ...message,
                  threadData: {
                    title: thread?.metadata?.description,
                    groupId: groupId,
                    createdAt: thread?.created,
                    name: thread?.name,
                  },
                  threadOwner: thread?.name,
                };
                fullThreadArray.push(fullObject);
              } else {
                let threadRes = await Promise.race([
                  qortalRequest({
                    action: "FETCH_QDN_RESOURCE",
                    name: thread?.name,
                    service: THREAD_SERVICE_TYPE,
                    identifier: message.threadId
                  }),
                  delay(5000),
                ]);
               if(threadRes?.title){
                const fullObject = {
                  ...message,
                  threadData: threadRes,
                  threadOwner: thread?.name,
                };
                fullThreadArray.push(fullObject);
               }
                
              }
              await getAvatar(thread?.name);
            }
          } catch (error) {
            console.log(error)
          }
          return null;
        });
        await Promise.all(getMessageForThreads);
        const sorted = fullThreadArray.sort(
          (a: any, b: any) => b.created - a.created
        );
        setRecentThreads(sorted);
      } catch (error) {
      } finally {
        dispatch(setIsLoadingCustom(null));
      }
    },
    []
  );
  const getMessages = React.useCallback(async () => {
    if (!user?.name || !groupId) return;
    await getMailMessages(groupId, members);
  }, [getMailMessages, user, groupId, members]);

  const interval = useRef<any>(null);

  const firstMount = useRef(false);
  const filterModeRef = useRef("");
  const [sortAnchorEl, setSortAnchorEl] = useState<null | HTMLElement>(null);
  const isSortMenuOpen = Boolean(sortAnchorEl);

  const handleRequestNewThread = useCallback(() => {
    onRequestComposeThread?.(groupInfo);
  }, [groupInfo, onRequestComposeThread]);

  const openSortMenu = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    setSortAnchorEl(event.currentTarget);
  }, []);

  const closeSortMenu = useCallback(() => {
    setSortAnchorEl(null);
  }, []);

  const handleSelectSortMode = useCallback(
    (mode: string) => {
      setFilterMode(mode);
      setSortAnchorEl(null);
    },
    [setFilterMode]
  );

  useEffect(() => {
    if(filterModeRef.current !== filterMode){
      firstMount.current = false
      filterModeRef.current = filterMode
    }
    if (user?.name && groupId && !firstMount.current && members) {
      if(filterMode === 'Recently active'){
        getMessages();

      } else if(filterMode === 'Newest'){
        getAllThreads(groupId, 'Newest', true);

      } else if(filterMode === 'Oldest'){
        getAllThreads(groupId, 'Oldest', true);

      }
      firstMount.current = true;
    }
  }, [user, groupId, members, filterMode]);

  const closeThread = useCallback(() => {
    setCurrentThread(null);
  }, []);





  const getGroupMembers = useCallback(async (groupNumber: string) => {
    try {
      const response = await fetch(
        `/groups/members/${encodeURIComponent(groupNumber)}?limit=0`
      );
      const groupData = await response.json();

      let members: any = {};
      if (groupData && Array.isArray(groupData?.members)) {
        for (const member of groupData.members) {
          if (member.member) {
            const res = await getNameInfo(member.member);
            const resAddress = await qortalRequest({
              action: "GET_ACCOUNT_DATA",
              address: member.member,
            });
            const name = res;
            const publicKey = resAddress.publicKey;
            if (name) {
              members[name] = {
                publicKey,
                address: member.member,
              };
            }
          }
        }
      }

      setMembers(members);
    } catch (error) {
      console.log({ error });
    }
  }, []);

  useEffect(() => {
    if(groupId){
      getGroupMembers(groupId);
      interval.current = setInterval(async () => {
        getGroupMembers(groupId);
      }, 180000)
    }
    return () => {
      if (interval?.current) {
        clearInterval(interval.current)
      }
    }
  }, [getGroupMembers, groupId]);


  let listOfThreadsToDisplay = recentThreads
  if(filterMode === 'Newest' || filterMode === 'Oldest'){
    listOfThreadsToDisplay = allThreads
  }

  useEffect(()=> {
    if(user?.name){
      const threads = JSON.parse(
        localStorage.getItem(`qmail_threads_viewedtimestamp_${user.name}`) || "{}"
      );
      setViewedThreads(threads)

    }
  }, [user?.name, currentThread])

  


  if (currentThread)
    return (
      <Thread
          currentThread={currentThread}
          groupInfo={groupInfo}
          closeThread={closeThread}
          members={members}
        />
    );



  return (
    <GroupContainer
      sx={{
        position: "relative",
        overflow: 'auto',
        width: '100%'
      }}
    >
      <ThreadContainerFullWidth>
        <ThreadContainer>
          <Spacer height="60px" />
          <GroupNameP>{groupInfo?.name}</GroupNameP>
          <Spacer height="18px" />
          <Box
            sx={{
              display: "flex",
              width: "100%",
              gap: "12px",
              justifyContent: "space-between",
              flexWrap: "wrap",
            }}
          >
            <Button
              variant="outlined"
              onClick={handleRequestNewThread}
              sx={{
                textTransform: "none",
                borderColor: "var(--qmail-shell-border)",
                color: "var(--qmail-thread-text)",
                backgroundColor: "var(--qmail-shell-hover)",
                borderRadius: "10px",
                padding: "8px 14px",
                "&:hover": {
                  borderColor: "var(--qmail-shell-active-strong)",
                  backgroundColor: "var(--qmail-shell-hover-strong)",
                },
              }}
            >
              New Thread
            </Button>
            <Button
              variant="outlined"
              onClick={openSortMenu}
              sx={{
                textTransform: "none",
                borderColor: "var(--qmail-shell-border)",
                color: "var(--qmail-thread-text)",
                backgroundColor: "var(--qmail-shell-hover)",
                borderRadius: "10px",
                padding: "8px 14px",
                "&:hover": {
                  borderColor: "var(--qmail-shell-active-strong)",
                  backgroundColor: "var(--qmail-shell-hover-strong)",
                },
              }}
            >
              Sort by: {filterMode}
            </Button>
            <Menu
              anchorEl={sortAnchorEl}
              open={isSortMenuOpen}
              onClose={closeSortMenu}
              anchorOrigin={{
                vertical: "bottom",
                horizontal: "right",
              }}
              transformOrigin={{
                vertical: "top",
                horizontal: "right",
              }}
              PaperProps={{
                sx: {
                  backgroundColor: "var(--qmail-shell-popover-bg)",
                  color: "var(--qmail-thread-text)",
                  border: "1px solid var(--qmail-shell-border)",
                },
              }}
            >
              {threadFilterOptions.map(option => {
                return (
                  <MenuItem
                    key={option}
                    selected={option === filterMode}
                    onClick={() => {
                      handleSelectSortMode(option);
                    }}
                    sx={{
                      fontSize: "0.95rem",
                      "&.Mui-selected": {
                        backgroundColor: "var(--qmail-shell-active)",
                      },
                      "&.Mui-selected:hover": {
                        backgroundColor: "var(--qmail-shell-active-strong)",
                      },
                    }}
                  >
                    {option}
                  </MenuItem>
                );
              })}
            </Menu>
          </Box>
          <Spacer height="60px" />
          <AllThreadP>All Threads ({filterMode})</AllThreadP>
          <Spacer height="30px" />
          
              {listOfThreadsToDisplay.map(thread => {
                const hasViewedRecent = viewedThreads[`qmail_threads_${thread?.threadData?.groupId}_${thread?.threadId}`]
                const shouldAppearLighter = hasViewedRecent && filterMode === 'Recently active' && thread?.threadData?.createdAt < hasViewedRecent?.timestamp
                if(isMobile){
                  return (
                    <SingleThreadParent
                      onClick={() => {
                        setCurrentThread(thread);
                      }}
                     sx={{
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      height: 'auto'
                     }}
                    >
                      <Box sx={{
                        display: 'flex',
                        gap: '10px',
                        
                      }}>
                      <AvatarWrapper isAlias={false} height="50px" user={thread?.threadData?.name} fallback={thread?.threadData?.name}></AvatarWrapper>
                      <ThreadInfoColumn>
                      <ThreadInfoColumnNameP><ThreadInfoColumnbyP>by </ThreadInfoColumnbyP>{thread?.threadData?.name}</ThreadInfoColumnNameP>
                      <ThreadInfoColumnTime>
                        {formatFullTimestamp(thread?.threadData?.createdAt)}
                      </ThreadInfoColumnTime>
                      </ThreadInfoColumn>
                      </Box>
                     
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "center",
                        }}
                      >
                        <ThreadSingleTitle sx={{
                          fontWeight: shouldAppearLighter && 300
                        }}>{thread?.threadData?.title}</ThreadSingleTitle>
                        {filterMode === 'Recently active' && (
                           <div
                           style={{
                             display: "flex",
                             alignItems: "center",
                           }}
                         >
                           <ThreadSingleLastMessageP
                          
                           >
                             <ThreadSingleLastMessageSpanP>last message: </ThreadSingleLastMessageSpanP>
                             {formatFullTimestamp(thread?.created)}
                           </ThreadSingleLastMessageP>
                         </div>
                        )}
                       
                      </div>
                    </SingleThreadParent>
                  )
                }
            return (
              <SingleThreadParent
                onClick={() => {
                  setCurrentThread(thread);
                }}
               
              >
                 <AvatarWrapper isAlias={false} height="50px" user={thread?.threadData?.name} fallback={thread?.threadData?.name}></AvatarWrapper>
                <ThreadInfoColumn>
                <ThreadInfoColumnNameP><ThreadInfoColumnbyP>by </ThreadInfoColumnbyP>{thread?.threadData?.name}</ThreadInfoColumnNameP>
                <ThreadInfoColumnTime>
                  {formatFullTimestamp(thread?.threadData?.createdAt)}
                </ThreadInfoColumnTime>
                </ThreadInfoColumn>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                  }}
                >
                  <ThreadSingleTitle sx={{
                    fontWeight: shouldAppearLighter && 300
                  }}>{thread?.threadData?.title}</ThreadSingleTitle>
                  {filterMode === 'Recently active' && (
                     <div
                     style={{
                       display: "flex",
                       alignItems: "center",
                     }}
                   >
                     <ThreadSingleLastMessageP
                    
                     >
                       <ThreadSingleLastMessageSpanP>last message: </ThreadSingleLastMessageSpanP>
                       {formatFullTimestamp(thread?.created)}
                     </ThreadSingleLastMessageP>
                   </div>
                  )}
                 
                </div>
              </SingleThreadParent>
            );
          })}
       
          

          <Box
            sx={{
              width: "100%",
              justifyContent: "center",
            }}
          >
             {listOfThreadsToDisplay.length >= 20 && filterMode !== 'Recently active' && (
              <LazyLoad onLoadMore={()=> getAllThreads(groupId, filterMode, false)}></LazyLoad>

      )}
          
          </Box>
        </ThreadContainer>
      </ThreadContainerFullWidth>
    </GroupContainer>
  );
};
