import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import type { SelectChangeEvent } from "@mui/material";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import PersonOffOutlinedIcon from "@mui/icons-material/PersonOffOutlined";
import { ThemePicker } from "../../hub-theme";
import { RootState } from "../../state/store";
import { setPreferredCoin } from "../../state/features/storeSlice";
import { CoinFilter } from "../../pages/Store/Store/Store";
import { BlockedNamesModal } from "../../components/common/BlockedNamesModal/BlockedNamesModal";
import { ChangelogDialog } from "../../components/common/ChangelogDialog";
import { APP_VERSION } from "../../constants/changelog";

const Page = styled("main")(({ theme }) => ({
  width: "100%",
  maxWidth: 760,
  margin: "0 auto",
  padding: theme.spacing(2, 2, 6),
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(3),
}));

const SectionTitle = styled("h2")(({ theme }) => ({
  margin: 0,
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: theme.palette.text.secondary,
  marginBottom: theme.spacing(1),
}));

const Card = styled("section")(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(2),
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(1.5),
}));

const Row = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: theme.spacing(2),
  flexWrap: "wrap",
}));

export function SettingsPage() {
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);
  const preferredCoin = useSelector((state: RootState) => state.store.preferredCoin);
  const [blockedOpen, setBlockedOpen] = useState(false);
  const [changelogOpen, setChangelogOpen] = useState(false);

  const onCoinChange = (event: SelectChangeEvent) => {
    dispatch(setPreferredCoin(event.target.value as CoinFilter));
  };

  return (
    <Page>
      <Typography component="h1" variant="h2" sx={{ mt: 1 }}>
        Settings
      </Typography>

      <Box>
        <SectionTitle>Account</SectionTitle>
        <Card aria-label="Account">
          {user?.name ? (
            <>
              <Row>
                <Typography color="text.secondary">Qortal name</Typography>
                <Typography sx={{ fontWeight: 600 }}>{user.name}</Typography>
              </Row>
              <Row>
                <Typography color="text.secondary">Address</Typography>
                <Typography sx={{ fontFamily: "monospace", fontSize: 14, wordBreak: "break-all" }}>
                  {user.address}
                </Typography>
              </Row>
            </>
          ) : (
            <Typography color="text.secondary">
              Not signed in. Use Authenticate in the top bar to load your Qortal name.
            </Typography>
          )}
        </Card>
      </Box>

      <Box>
        <SectionTitle>Appearance</SectionTitle>
        <Card aria-label="Appearance">
          <Typography variant="body2" color="text.secondary">
            Hub 3.0 and Q-Shop Classic follow Hub&apos;s light or dark mode. Black and White set their own.
          </Typography>
          <ThemePicker />
        </Card>
      </Box>

      <Box>
        <SectionTitle>Shop</SectionTitle>
        <Card aria-label="Shop">
          <Row>
            <Box>
              <Typography>Preferred coin</Typography>
              <Typography variant="body2" color="text.secondary">
                Prices show in this coin where a shop accepts it.
              </Typography>
            </Box>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel id="preferred-coin-label">Coin</InputLabel>
              <Select
                labelId="preferred-coin-label"
                id="preferred-coin"
                label="Coin"
                value={preferredCoin}
                onChange={onCoinChange}
              >
                <MenuItem value={CoinFilter.qort}>QORT</MenuItem>
                <MenuItem value={CoinFilter.arrr}>ARRR</MenuItem>
              </Select>
            </FormControl>
          </Row>
          <Row>
            <Box>
              <Typography>Blocked names</Typography>
              <Typography variant="body2" color="text.secondary">
                Shops and reviews from blocked names are hidden.
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
        </Card>
      </Box>

      <Box>
        <SectionTitle>About</SectionTitle>
        <Card aria-label="About">
          <Row>
            <Box>
              <Typography>Q-Shop+ {APP_VERSION}</Typography>
              <Typography variant="body2" color="text.secondary">
                A faster, Hub 3.0 styled Q-Shop that shares its data with the original.
              </Typography>
            </Box>
            <Button
              variant="outlined"
              startIcon={<HistoryOutlinedIcon />}
              onClick={() => setChangelogOpen(true)}
            >
              What&apos;s new
            </Button>
          </Row>
          <Row sx={{ justifyContent: "flex-start" }}>
            <Button component="a" href="qortal://APP/Q-Shop" size="small">
              Open the original Q-Shop
            </Button>
            <Button component="a" href="qortal://APP/Q-Mail+" size="small">
              Open Q-Mail+
            </Button>
          </Row>
          <Typography variant="body2" color="text.secondary">
            Source: github.com/SJQortal/Q-Apps-Plus · Upstream: github.com/Qortal/q-shop
          </Typography>
        </Card>
      </Box>

      {blockedOpen && <BlockedNamesModal open={blockedOpen} onClose={() => setBlockedOpen(false)} />}
      <ChangelogDialog open={changelogOpen} onClose={() => setChangelogOpen(false)} />
    </Page>
  );
}

export default SettingsPage;
