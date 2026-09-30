import { Button, ButtonProps } from "@mui/material";
import PersonAddAlt1OutlinedIcon from "@mui/icons-material/PersonAddAlt1Outlined";
import PersonRemoveOutlinedIcon from "@mui/icons-material/PersonRemoveOutlined";
import Tooltip, { TooltipProps, tooltipClasses } from "@mui/material/Tooltip";
import { MouseEvent, useEffect, useState } from "react";
import { styled } from "@mui/material/styles";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../state/store";
import { setNotification } from "../../state/features/notificationsSlice";
import { usePhoneLayout } from "../../hooks/usePhoneLayout";
import { formatBytes } from "../../utils/formatBytes";
import { isHubDecline } from "../../utils/hubErrors";

interface FollowButtonProps extends ButtonProps {
  followerName: string;
  /** Icon over label, no minimum width: the share page's phone action row. */
  compact?: boolean;
}

const TooltipLine = styled("div")({
  fontSize: 15,
  lineHeight: 1.4,
});

const CustomWidthTooltipStyles = styled(({ className, ...props }: TooltipProps) => (
  <Tooltip {...props} classes={{ popper: className }} />
))({
  [`& .${tooltipClasses.tooltip}`]: {
    maxWidth: 420,
  },
});

const SIZE_PAGE = 100;
const SIZE_MAX_PAGES = 10;
const sizeCache = new Map<string, Promise<{ bytes: number; items: number; complete: boolean }>>();
let followedNames: { address: string; list: Promise<string[]> } | null = null;

/**
 * The signed-in account's followedNames, read once per session and updated
 * locally on follow/unfollow. The list belongs to the account, not to one of
 * its names, so it is keyed by address: an account with no name has one too,
 * and switching names doesn't read it again. Callers read it only once
 * signed in: accepting GET_USER_ACCOUNT lets Hub answer list reads silently,
 * while before that every read is a permission dialog. A decline (or any
 * failure) counts as an empty list for the rest of the session, so it isn't
 * asked again.
 */
function readFollowedNames(address: string): Promise<string[]> {
  if (!followedNames || followedNames.address !== address) {
    const list = qortalRequest({ action: "GET_LIST_ITEMS", list_name: "followedNames" })
      .then((items) => (Array.isArray(items) ? items : []))
      .catch(() => [] as string[]);
    followedNames = { address, list };
  }
  return followedNames.list;
}

function rememberFollowedNames(address: string | undefined, list: string[]) {
  if (address) followedNames = { address, list: Promise.resolve(list) };
}

/**
 * Sum of a name's publishes, read in bounded pages instead of one unlimited
 * list. Read from Core directly: q-apps.js's LIST_QDN_RESOURCES puts the
 * name into the URL unencoded, so "+" arrives as a space and "&" cuts the
 * query (a name like "POS+" read as 0 files).
 */
function readPublishSize(name: string) {
  const cached = sizeCache.get(name);
  if (cached) return cached;
  const request = (async () => {
    let bytes = 0;
    let items = 0;
    let complete = false;
    for (let page = 0; page < SIZE_MAX_PAGES; page++) {
      const params = new URLSearchParams({
        name,
        includemetadata: "false",
        limit: String(SIZE_PAGE),
        offset: String(page * SIZE_PAGE),
      });
      const response = await fetch(`/arbitrary/resources?${params.toString()}`);
      if (!response.ok) throw new Error(`List failed (${response.status})`);
      const rows = await response.json();
      const list = Array.isArray(rows) ? rows : [];
      for (const publish of list) {
        bytes += Number(publish?.size) || 0;
        items++;
      }
      if (list.length < SIZE_PAGE) {
        complete = true;
        break;
      }
    }
    return { bytes, items, complete };
  })();
  sizeCache.set(name, request);
  request.catch(() => sizeCache.delete(name));
  return request;
}

export const resetFollowCaches = () => {
  sizeCache.clear();
  followedNames = null;
};

/**
 * Follow / Unfollow a publisher (Qortal's followedNames list). Hidden when the
 * name is the signed-in user's own. The tooltip explains what following does
 * and loads the name's total size only when it opens.
 */
export const FollowButton = ({ followerName, compact = false, sx, ...props }: FollowButtonProps) => {
  const phone = usePhoneLayout();
  const dispatch = useDispatch();
  const username = useSelector((state: RootState) => state.auth.user?.name);
  const address = useSelector((state: RootState) => state.auth.user?.address);
  const [followingList, setFollowingList] = useState<string[]>([]);
  const [size, setSize] = useState<{ bytes: number; items: number; complete: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  // Signed out, the list stays unread (reading it would be a Hub dialog).
  useEffect(() => {
    if (!followerName || !address) return;
    let active = true;
    readFollowedNames(address).then((list) => {
      if (active) setFollowingList(list);
    });
    return () => {
      active = false;
    };
  }, [followerName, address]);

  if (!followerName || followerName === username) return null;

  const loadSize = () => {
    if (size) return;
    readPublishSize(followerName)
      .then(setSize)
      .catch(() => {});
  };

  const following = followingList.includes(followerName);
  const compactIcon = following ? <PersonRemoveOutlinedIcon /> : <PersonAddAlt1OutlinedIcon />;

  const followName = async () => {
    const response: boolean = await qortalRequest({
      action: "ADD_LIST_ITEMS",
      list_name: "followedNames",
      items: [followerName],
    });
    if (response === false) return;
    const next = [...followingList, followerName];
    setFollowingList(next);
    rememberFollowedNames(address, next);
  };

  const unfollowName = async () => {
    const response: boolean = await qortalRequest({
      action: "DELETE_LIST_ITEM",
      list_name: "followedNames",
      item: followerName,
    });
    if (response === false) return;
    const next = followingList.filter((item) => followerName !== item);
    setFollowingList(next);
    rememberFollowedNames(address, next);
  };

  const manageFollow = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      if (following) await unfollowName();
      else await followName();
    } catch (error) {
      // Saying no in Hub's dialog is not an error; the button keeps its state either way.
      if (!isHubDecline(error)) {
        const msg = `Could not ${following ? "unfollow" : "follow"} ${followerName}`;
        dispatch(setNotification({ msg, alertType: "error" }));
      }
    } finally {
      setBusy(false);
    }
  };

  const tooltipTitle = (
    <>
      <TooltipLine>
        Following a name downloads all of its content to your node. The more followers a name has, the faster its
        content downloads for everyone.
      </TooltipLine>
      <br />
      {size ? (
        <>
          <TooltipLine>{`${followerName}'s current download size: ${formatBytes(size.bytes)}${size.complete ? "" : "+"}`}</TooltipLine>
          <TooltipLine>{`Number of files: ${size.items}${size.complete ? "" : "+"}`}</TooltipLine>
        </>
      ) : (
        <TooltipLine>Working out the download size…</TooltipLine>
      )}
    </>
  );

  return (
    <CustomWidthTooltipStyles title={tooltipTitle} placement="top" arrow onOpen={loadSize}>
      <Button
        {...props}
        variant={following ? "outlined" : "contained"}
        startIcon={compact ? compactIcon : props.startIcon}
        onClick={manageFollow}
        disabled={busy || props.disabled}
        aria-pressed={following}
        aria-label={`${following ? "Unfollow" : "Follow"} ${followerName}`}
        sx={[
          compact
            ? { fontWeight: 700, minHeight: 44 }
            : { fontWeight: 700, minWidth: 96, minHeight: phone ? 44 : 36, px: 2 },
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
      >
        {following ? "Unfollow" : "Follow"}
      </Button>
    </CustomWidthTooltipStyles>
  );
};
