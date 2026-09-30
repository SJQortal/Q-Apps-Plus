import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Avatar,
  Box,
  Button,
  Chip,
  IconButton,
  MenuItem,
  Select,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PersonOffOutlinedIcon from "@mui/icons-material/PersonOffOutlined";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import CloudDownloadOutlinedIcon from "@mui/icons-material/CloudDownloadOutlined";
import { ThemePicker, headerFill, useHubTheme } from "../../hub-theme";
import { RootState } from "../../state/store";
import { addUser } from "../../state/features/authSlice";
import { BlockedNamesModal } from "../../components/common/BlockedNamesModal/BlockedNamesModal";
import { ChangelogDialog } from "../../components/common/ChangelogDialog";
import { APP_VERSION, PLUS_REPO, UPSTREAM_REPO } from "../../constants/changelog";
import { ShareStats, loadShareStats, readCachedShareStats } from "../../utils/shareStats";
import { useAppSettings, writeSettings } from "../../utils/settings";
import { fetchSettingsFromQdn, publishSettingsToQdn } from "../../utils/settingsQdn";
import { setNotification } from "../../state/features/notificationsSlice";
import { formatDate } from "../../utils/time";
import { useSafeBack } from "../../hooks/useSafeBack";

const Page = styled("div")(({ theme }) => ({
  width: "100%",
  maxWidth: 680,
  margin: "0 auto",
  paddingBottom: theme.spacing(6),
}));

const PageHeader = styled("header")(({ theme }) => ({
  position: "sticky",
  top: 0,
  zIndex: theme.zIndex.appBar + 1,
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
  const goBack = useSafeBack("/");
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);
  const [blockedOpen, setBlockedOpen] = useState(false);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const settings = useAppSettings();
  const [hiddenInput, setHiddenInput] = useState("");
  const addHidden = () => {
    const names = hiddenInput.split(",").map((n) => n.trim()).filter(Boolean);
    if (names.length) writeSettings({ hiddenNames: [...settings.hiddenNames, ...names] });
    setHiddenInput("");
  };
  // Settings sync to QDN: explicit Save and Restore, nothing automatic.
  const { uiTheme, setUiTheme } = useHubTheme();
  const [syncBusy, setSyncBusy] = useState<"save" | "restore" | null>(null);
  const [syncNote, setSyncNote] = useState<string | null>(null);
  const saveToQdn = async () => {
    if (!user?.name) return;
    setSyncBusy("save");
    try {
      const snap = await publishSettingsToQdn(user.name, settings, uiTheme);
      setSyncNote(`Saved to QDN ${formatDate(snap.updatedAt)}.`);
      dispatch(setNotification({ msg: "Settings saved to QDN", alertType: "success" }));
    } catch (error: any) {
      const declined = error?.error === "User declined request";
      setSyncNote(declined ? "Save cancelled in Hub." : "The save failed; try again in a moment.");
      if (!declined) dispatch(setNotification({ msg: "Could not save settings to QDN", alertType: "error" }));
    } finally {
      setSyncBusy(null);
    }
  };
  const restoreFromQdn = async () => {
    if (!user?.name) return;
    setSyncBusy("restore");
    try {
      const result = await fetchSettingsFromQdn(user.name);
      if (result.kind === "none") {
        setSyncNote(`No settings saved on QDN for ${user.name} yet.`);
        return;
      }
      if (result.kind === "not-local") {
        setSyncNote("Your saved settings haven't reached this node yet. Try Restore again in a minute.");
        return;
      }
      if (result.kind === "error") {
        setSyncNote("Couldn't reach your node. Try again in a moment.");
        return;
      }
      const snap = result.snapshot;
      writeSettings({
        autoPreviewImages: snap.autoPreviewImages,
        defaultSort: snap.defaultSort,
        hiddenNames: snap.hiddenNames,
        followingFeed: snap.followingFeed,
      });
      if (snap.uiTheme) setUiTheme(snap.uiTheme);
      setSyncNote(snap.updatedAt ? `Restored the settings saved ${formatDate(snap.updatedAt)}.` : "Settings restored.");
      dispatch(setNotification({ msg: "Settings restored from QDN", alertType: "success" }));
    } finally {
      setSyncBusy(null);
    }
  };

  const [stats, setStats] = useState<ShareStats | null>(() => readCachedShareStats());
  const [statsBusy, setStatsBusy] = useState(false);
  const [statsError, setStatsError] = useState(false);

  const refreshStats = async () => {
    setStatsBusy(true);
    setStatsError(false);
    try {
      setStats(await loadShareStats(true));
    } catch {
      setStatsError(true);
    } finally {
      setStatsBusy(false);
    }
  };
  const names = (user?.names ?? []).filter((n) => n.name);

  return (
    <Page>
      <PageHeader>
        <IconButton aria-label="Back" onClick={goBack} sx={{ minWidth: 44, minHeight: 44 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography component="h1" variant="h6" sx={{ fontWeight: 700 }}>
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
            <Typography sx={{ fontWeight: 700 }}>Preview images automatically</Typography>
            <Typography variant="body2" color="text.secondary">
              Show image attachments up to 5 MB on a share page without a click. Off saves data on slow nodes.
            </Typography>
          </Box>
          <Switch
            checked={settings.autoPreviewImages}
            onChange={(e) => writeSettings({ autoPreviewImages: e.target.checked })}
            slotProps={{ input: { "aria-label": "Preview images automatically" } }}
          />
        </Row>
        <Row>
          <Box>
            <Typography sx={{ fontWeight: 700 }}>Following feed</Typography>
            <Typography variant="body2" color="text.secondary">
              A Following chip on Home that lists shares from names you follow.
            </Typography>
          </Box>
          <Switch
            checked={settings.followingFeed}
            onChange={(e) => writeSettings({ followingFeed: e.target.checked })}
            slotProps={{ input: { "aria-label": "Following feed" } }}
          />
        </Row>
        <Row>
          <Box>
            <Typography sx={{ fontWeight: 700 }}>Default sort</Typography>
            <Typography variant="body2" color="text.secondary">How Home is sorted when it opens.</Typography>
          </Box>
          <Select
            size="small"
            value={settings.defaultSort}
            onChange={(e) => writeSettings({ defaultSort: e.target.value as "newest" | "oldest" })}
            inputProps={{ "aria-label": "Default sort" }}
          >
            <MenuItem value="newest">Newest first</MenuItem>
            <MenuItem value="oldest">Oldest first</MenuItem>
          </Select>
        </Row>
        <Box sx={{ py: 1 }}>
          <Typography sx={{ fontWeight: 700 }}>Hidden names</Typography>
          <Typography variant="body2" color="text.secondary">
            Hide these names' shares and comments in Q-Share+ only. This is not a Qortal block; use Blocked names for that.
          </Typography>
          <Box sx={{ display: "flex", gap: 1, mt: 1.5, flexWrap: "wrap" }}>
            <TextField
              size="small"
              label="Add a name"
              value={hiddenInput}
              onChange={(e) => setHiddenInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addHidden();
                }
              }}
              helperText="Separate several names with commas"
              sx={{ flex: "1 1 220px" }}
            />
            <Button variant="outlined" onClick={addHidden} disabled={!hiddenInput.trim()} sx={{ alignSelf: "flex-start" }}>
              Hide
            </Button>
          </Box>
          {settings.hiddenNames.length > 0 ? (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1 }}>
              {settings.hiddenNames.map((name) => (
                <Chip
                  key={name}
                  label={name}
                  onDelete={() => writeSettings({ hiddenNames: settings.hiddenNames.filter((n) => n !== name) })}
                />
              ))}
            </Box>
          ) : (
            <Typography variant="caption" color="text.secondary">
              No hidden names.
            </Typography>
          )}
        </Box>
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

      <Section>
        <SectionTitle>Network</SectionTitle>
        <Row>
          <Box>
            <Typography sx={{ fontWeight: 700 }}>Share statistics</Typography>
            <Typography variant="body2" color="text.secondary">
              {stats
                ? `${stats.shares}${stats.complete ? "" : "+"} shares by ${stats.publishers}${stats.complete ? "" : "+"} publishers, counted ${new Date(stats.at).toLocaleString()}`
                : "Counts every share on QDN in pages, so it is loaded only when you ask."}
              {statsError ? " The count failed; try again." : ""}
            </Typography>
          </Box>
          <Button variant="outlined" onClick={refreshStats} disabled={statsBusy}>
            {statsBusy ? "Counting…" : stats ? "Recount" : "Load stats"}
          </Button>
        </Row>
      </Section>

      <Section>
        <SectionTitle>Sync</SectionTitle>
        <Row>
          <Box>
            <Typography sx={{ fontWeight: 700 }}>Settings on QDN</Typography>
            <Typography variant="body2" color="text.secondary">
              Save these settings and your theme under your name, so another device can restore them. Saving
              publishes a small document: Hub asks you to confirm, and the usual fee applies.
            </Typography>
            {syncNote ? (
              <Typography variant="body2" sx={{ mt: 0.5 }} role="status">
                {syncNote}
              </Typography>
            ) : null}
          </Box>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", "& .MuiButton-root": { minHeight: 44 } }}>
            <Button
              variant="outlined"
              startIcon={<CloudDownloadOutlinedIcon />}
              onClick={restoreFromQdn}
              disabled={!user?.name || syncBusy !== null}
            >
              {syncBusy === "restore" ? "Restoring…" : "Restore"}
            </Button>
            <Button
              variant="contained"
              startIcon={<CloudUploadOutlinedIcon />}
              onClick={saveToQdn}
              disabled={!user?.name || syncBusy !== null}
            >
              {syncBusy === "save" ? "Saving…" : "Save to QDN"}
            </Button>
          </Box>
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
