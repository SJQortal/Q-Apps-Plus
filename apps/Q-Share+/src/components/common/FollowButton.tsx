import { Box, Button, ButtonProps } from "@mui/material";
import Tooltip, { TooltipProps, tooltipClasses } from "@mui/material/Tooltip";

import { MouseEvent, useEffect, useMemo, useState } from "react";
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

export const FollowButton = ({ followerName, ...props }: FollowButtonProps) => {
  const [followingList, setFollowingList] = useState<string[]>([]);
  const [followingSize, setFollowingSize] = useState<string>("");
  const [followingItemCount, setFollowingItemCount] = useState<string>("");
  const followerNameMemo = useMemo<string>(() => followerName, [followerName]);

  useEffect(() => {
    getFollowData();
  }, [followerNameMemo]);

  const getFollowData = async () => {
    if (followerNameMemo) {
      setFollowingList(await getFollowedNames());
      getFollowSize();
    }
  };

  const getFollowedNames = async (): Promise<string[]> => {
    return await qortalRequest({
      action: "GET_LIST_ITEMS",
      list_name: "followedNames",
    });
  };

  const getFollowSize = async () => {
    const publishesList = await qortalRequest({
      action: "LIST_QDN_RESOURCES",
      name: followerName,
      limit: 0,
      includeMetadata: false,
    });

    let totalSize = 0;
    let itemsCount = 0;
    publishesList.map(publish => {
      totalSize += +publish.size;
      itemsCount++;
    });
    setFollowingSize(formatBytes(totalSize));
    setFollowingItemCount(itemsCount.toString());
  };

  const isFollowingName = () => {
    return followingList.includes(followerNameMemo);
  };

  const followName = async () => {
    if (isFollowingName() === false) {
      const response: boolean = await qortalRequest({
        action: "ADD_LIST_ITEMS",
        list_name: "followedNames",
        items: [followerName],
      });
      if (response === false) console.log("followName failed");
      else {
        setFollowingList([...followingList, followerName]);
        console.log("following Name: ", followerName);
      }
    }
  };
  const unfollowName = async () => {
    if (isFollowingName()) {
      const response: boolean = await qortalRequest({
        action: "DELETE_LIST_ITEM",
        list_name: "followedNames",
        items: [followerName],
      });
      if (response === false) console.log("unfollowName failed");
      else {
        const listWithoutName = followingList.filter(
          item => followerName !== item
        );
        setFollowingList(listWithoutName);
        console.log("unfollowing Name: ", followerName);
      }
    }
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
    color: "white",
    width: "96px",
    height: "45px",
    ...props.sx,
  };

  const  formatBytes = (bytes: number, decimals = 2)=> {
    if (!+bytes) return "0 Bytes";

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  }

  const tooltipTitle = followingSize && (
    <>
      <TooltipLine>
        Following a name automatically downloads all of its content to your
        node. The more followers a name has, the faster its content will
        download for everyone.
      </TooltipLine>
      <br />
      <TooltipLine>{`${followerName}'s Current Download Size: ${followingSize}`}</TooltipLine>
      <TooltipLine>{`Number of Files: ${followingItemCount}`}</TooltipLine>
    </>
  );

  return (
    <>
      <CustomTooltip title={tooltipTitle} placement={"top"} arrow>
        <Button
          {...props}
          variant={"contained"}
          color="success"
          sx={buttonStyle}
          onClick={e => manageFollow(e)}
        >
          {isFollowingName() ? "Unfollow" : "Follow"}
        </Button>
      </CustomTooltip>
    </>
  );
};
