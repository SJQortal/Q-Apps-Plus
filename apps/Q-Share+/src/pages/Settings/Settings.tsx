import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  Avatar,
  Box,
  Button,
  IconButton,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PersonOffOutlinedIcon from "@mui/icons-material/PersonOffOutlined";
import { ThemePicker, headerFill } from "../../hub-theme";
import { RootState } from "../../state/store";
import { addUser } from "../../state/features/authSlice";
import { BlockedNamesModal } from "../../components/common/BlockedNamesModal/BlockedNamesModal";
import { ChangelogDialog } from "../../components/common/ChangelogDialog";
import { APP_VERSION, PLUS_REPO, UPSTREAM_REPO } from "../../constants/changelog";

const Page = styled("div")(({ theme }) => ({
  width: "100%",
  maxWidth: 680,
  margin: "0 auto",
  paddingBottom: theme.spacing(6),
}));

const PageHeader = styled("header")(({ theme }) => ({
  position: "sticky",
  top: 0,
  zIndex: 10,
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1),
  padding: theme.spacing(1.5, 2),
  background: headerFill(theme),
  backdropFilter: "blur(20px) saturate(180%)",
  borderBottom: `1px solid ${theme.palette.divider}`,
}));

const Section = styled("section")(({ theme }) => ({
  padding: theme.spacing(2),
  borderBottom: `1px solid ${theme.palette.divider}`,
}));

const SectionTitle = styled(Typography)(({ theme }) => ({
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  color: theme.palette.text.secondary,
  marginBottom: theme.spacing(1.5),
}));

const Row = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: theme.spacing(2),
  padding: theme.spacing(1, 0),
  flexWrap: "wrap",
}));

export const Settings = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);
  const [blockedOpen, setBlockedOpen] = useState(false);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const names = (user?.names ?? []).filter((n) => n.name);

  return (
    <Page>
      <PageHeader>
        <IconButton aria-label="Back" onClick={() => navigate(-1)} size="small">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Settings
        </Typography>
      </PageHeader>

      <Section>
        <SectionTitle>Account</SectionTitle>
        {user?.name ? (
          <Row>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
              <Avatar
                src={`/arbitrary/THUMBNAIL/${encodeURIComponent(user.name)}/qortal_avatar`}
                alt=""
                sx={{ width: 40, height: 40 }}
              />
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700 }} noWrap>
                  {user.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Active Qortal name
                </Typography>
              </Box>
            </Box>
            {names.length > 1 && (
              <Select
                size="small"
                value={user.name}
                onChange={(e) => dispatch(addUser({ ...user, name: e.target.value }))}
                inputProps={{ "aria-label": "Switch active name" }}
              >
                {names.map((n) => (
                  <MenuItem key={n.name} value={n.name}>
                    {n.name}
                  </MenuItem>
                ))}
              </Select>
            )}
          </Row>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Not signed in with a Qortal name. You can browse and download; publishing and comments need a name.
          </Typography>
        )}
      </Section>

      <Section>
        <SectionTitle>Appearance</SectionTitle>
        <Typography sx={{ fontWeight: 700 }}>Theme</Typography>
        <Typography variant="body2" color="text.secondary">
          Hub 3.0 and Q-Share Classic follow Hub's light or dark mode. The choice is saved on this device.
        </Typography>
        <ThemePicker />
      </Section>

      <Section>
        <SectionTitle>Content</SectionTitle>
        <Row>
          <Box>
            <Typography sx={{ fontWeight: 700 }}>Blocked names</Typography>
            <Typography variant="body2" color="text.secondary">
              Names on your Qortal block list are hidden from every list here.
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<PersonOffOutlinedIcon />}
            onClick={() => setBlockedOpen(true)}
            disabled={!user?.name}
          >
            Manage
          </Button>
        </Row>
      </Section>

      <Section sx={{ borderBottom: 0 }}>
        <SectionTitle>About</SectionTitle>
        <Row>
          <Box>
            <Typography sx={{ fontWeight: 700 }}>Q-Share+ {APP_VERSION}</Typography>
            <Typography variant="body2" color="text.secondary">
              Simon's version of Qortal's Q-Share. It reads and writes the same QDN data.
            </Typography>
          </Box>
          <Button variant="outlined" onClick={() => setChangelogOpen(true)}>
            What's new
          </Button>
        </Row>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, wordBreak: "break-all" }}>
          Source: {PLUS_REPO}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ wordBreak: "break-all" }}>
          Upstream: {UPSTREAM_REPO}
        </Typography>
      </Section>

      {blockedOpen && <BlockedNamesModal open={blockedOpen} onClose={() => setBlockedOpen(false)} />}
      <ChangelogDialog open={changelogOpen} onClose={() => setChangelogOpen(false)} />
    </Page>
  );
};
