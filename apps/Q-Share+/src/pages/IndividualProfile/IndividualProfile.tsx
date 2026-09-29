import { Avatar, Box, Typography } from "@mui/material";
import { useParams } from "react-router-dom";
import { FileListComponentLevel } from "../Home/FileListComponentLevel.tsx";
import { FollowButton } from "../../components/common/FollowButton.tsx";
import { CopyLinkButton } from "../../components/common/CopyLinkButton.tsx";
import { avatarUrl, profileLink } from "../../utils/qortalLinks";

export const IndividualProfile = () => {
  const { name: paramName } = useParams();
  const name = paramName ? decodeURIComponent(paramName) : "";

  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: 900,
        margin: "0 auto",
        padding: { xs: "12px 16px", md: "20px 24px" },
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          flexWrap: "wrap",
          padding: 2,
          border: 1,
          borderColor: "divider",
          borderRadius: 2,
          bgcolor: "background.paper",
        }}
      >
        <Avatar src={avatarUrl(name)} alt="" sx={{ width: 56, height: 56 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, wordBreak: "break-word" }}>
            {name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Shares published under this Qortal name
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <FollowButton followerName={name} />
          <CopyLinkButton link={profileLink(name)} tooltipTitle="Copy profile link" />
        </Box>
      </Box>
      <FileListComponentLevel />
    </Box>
  );
};
