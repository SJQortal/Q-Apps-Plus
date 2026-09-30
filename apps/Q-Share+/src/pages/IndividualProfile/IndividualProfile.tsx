import { useState } from "react";
import { Avatar, Box, IconButton, Tab, Tabs, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate, useParams } from "react-router-dom";
import { usePhoneLayout } from "../../hooks/usePhoneLayout";
import { FileListComponentLevel } from "../Home/FileListComponentLevel.tsx";
import { FollowButton } from "../../components/common/FollowButton.tsx";
import { CopyLinkButton } from "../../components/common/CopyLinkButton.tsx";
import { avatarUrl, decodeParam, profileLink } from "../../utils/qortalLinks";
import { ProfileCollections } from "./ProfileCollections";

type ProfileTab = "shares" | "collections";

export const IndividualProfile = () => {
  const { name: paramName } = useParams();
  const name = decodeParam(paramName);
  const phone = usePhoneLayout();
  const [tab, setTab] = useState<ProfileTab>("shares");
  const navigate = useNavigate();
  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate("/"));

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
        {phone && (
          <IconButton aria-label="Back" onClick={goBack} sx={{ minWidth: 44, minHeight: 44 }}>
            <ArrowBackIcon />
          </IconButton>
        )}
        <Avatar src={avatarUrl(name)} alt="" sx={{ width: 56, height: 56 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, wordBreak: "break-word" }}>
            {name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Shares published under this Qortal name
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: { xs: "100%", sm: "auto" }, "& .MuiButton-root": { minHeight: 44 } }}>
          <FollowButton followerName={name} />
          <CopyLinkButton link={profileLink(name)} tooltipTitle="Copy profile link" />
        </Box>
      </Box>
      <Tabs
        value={tab}
        onChange={(_, value: ProfileTab) => setTab(value)}
        variant={phone ? "fullWidth" : "standard"}
        aria-label="What to show for this name"
      >
        <Tab value="shares" label="Shares" sx={{ minHeight: 48 }} />
        <Tab value="collections" label="Collections" sx={{ minHeight: 48 }} />
      </Tabs>
      {tab === "shares" ? <FileListComponentLevel key={name} /> : <ProfileCollections key={name} name={name} />}
    </Box>
  );
};
