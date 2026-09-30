import { Button, ButtonProps } from "@mui/material";
import PersonAddAlt1OutlinedIcon from "@mui/icons-material/PersonAddAlt1Outlined";
import PersonRemoveOutlinedIcon from "@mui/icons-material/PersonRemoveOutlined";
import Tooltip, { TooltipProps, tooltipClasses } from "@mui/material/Tooltip";
import { MouseEvent, useEffect, useState } from "react";
import { styled } from "@mui/material/styles";
import { useSelector } from "react-redux";
import { RootState } from "../../state/store";
import { usePhoneLayout } from "../../hooks/usePhoneLayout";
import { formatBytes } from "../../utils/formatBytes";

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
let followedNamesPromise: Promise<string[]> | null = null;

/** Followed names are read once per session and updated locally on follow/unfollow. */
function readFollowedNames(): Promise<string[]> {
  if (!followedNamesPromise) {
    followedNamesPromise = qortalRequest({ action: "GET_LIST_ITEMS", list_name: "followedNames" })
      .then((list) => (Array.isArray(list) ? list : []))
      .catch(() => {
        followedNamesPromise = null;
        return [];
      });
  }
  return followedNamesPromise;
}

/** Sum of a name's publishes, read in bounded pages instead of one unlimited list. */
function readPublishSize(name: string) {
  const cached = sizeCache.get(name);
  if (cached) return cached;
  const request = (async () => {
    let bytes = 0;
    let items = 0;
    let complete = false;
    for (let page = 0; page < SIZE_MAX_PAGES; page++) {
      const rows = await qortalRequest({
        action: "LIST_QDN_RESOURCES",
        name,
        limit: SIZE_PAGE,
        offset: page * SIZE_PAGE,
        includeMetadata: false,
      });
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
  followedNamesPromise = null;
};

/**
 * Follow / Unfollow a publisher (Qortal's followedNames list). Hidden when the
 * name is the signed-in user's own. The tooltip explains what following does
 * and loads the name's total size only when it opens.
 */
export const FollowButton = ({ followerName, compact = false, sx, ...props }: FollowButtonProps) => {
  const phone = usePhoneLayout();
  const username = useSelector((state: RootState) => state.auth.user?.name);
  const [followingList, setFollowingList] = useState<string[]>([]);
  const [size, setSize] = useState<{ bytes: number; items: number; complete: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!followerName) return;
    let active = true;
    readFollowedNames().then((list) => {
      if (active) setFollowingList(list);
    });
    return () => {
      active = false;
    };
  }, [followerName]);

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
    followedNamesPromise = Promise.resolve(next);
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
    followedNamesPromise = Promise.resolve(next);
  };

  const manageFollow = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      if (following) await unfollowName();
      else await followName();
    } catch {
      /* Hub shows its own error; the button keeps its state */
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
