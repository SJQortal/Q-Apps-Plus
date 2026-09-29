import { Box, Button, ButtonProps } from "@mui/material";
import Tooltip, { TooltipProps, tooltipClasses } from "@mui/material/Tooltip";

import { MouseEvent, useEffect, useState } from "react";
import { styled } from "@mui/material/styles";

interface FollowButtonProps extends ButtonProps {
  followerName: string;
}

const TooltipLine = styled("div")(({ theme }) => ({
  fontSize: "18px",
}));

const CustomWidthTooltipStyles = styled(
  ({ className, ...props }: TooltipProps) => (
    <Tooltip {...props} classes={{ popper: className }} />
  )
)({
  [`& .${tooltipClasses.tooltip}`]: {
    maxWidth: 600,
  },
});

const CustomTooltip = ({ title, ...props }: TooltipProps) => {
  if (typeof title === "string") title = <TooltipLine>{title}</TooltipLine>;

  return <CustomWidthTooltipStyles title={title} {...props} />;
};

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

export const FollowButton = ({ followerName, ...props }: FollowButtonProps) => {
  const [followingList, setFollowingList] = useState<string[]>([]);
  const [size, setSize] = useState<{ bytes: number; items: number; complete: boolean } | null>(null);

  useEffect(() => {
    let active = true;
    readFollowedNames().then((list) => {
      if (active) setFollowingList(list);
    });
    return () => {
      active = false;
    };
  }, [followerName]);

  const loadSize = () => {
    if (!followerName || size) return;
    readPublishSize(followerName)
      .then(setSize)
      .catch(() => {});
  };

  const isFollowingName = () => followingList.includes(followerName);

  const followName = async () => {
    if (isFollowingName()) return;
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
    if (!isFollowingName()) return;
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

  const manageFollow = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    isFollowingName() ? unfollowName() : followName();
  };

  const verticalPadding = "3px";
  const horizontalPadding = "8px";
  const buttonStyle = {
    fontSize: "15px",
    fontWeight: "700",
    paddingTop: verticalPadding,
    paddingBottom: verticalPadding,
    paddingLeft: horizontalPadding,
    paddingRight: horizontalPadding,
    borderRadius: 28,
    width: "96px",
    height: "45px",
    ...props.sx,
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (!+bytes) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };

  const tooltipTitle = (
    <>
      <TooltipLine>
        Following a name automatically downloads all of its content to your
        node. The more followers a name has, the faster its content will
        download for everyone.
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
    <CustomTooltip title={tooltipTitle} placement={"top"} arrow onOpen={loadSize}>
      <Button
        {...props}
        variant={"contained"}
        color="success"
        sx={buttonStyle}
        onClick={(e) => manageFollow(e)}
      >
        {isFollowingName() ? "Unfollow" : "Follow"}
      </Button>
    </CustomTooltip>
  );
};
