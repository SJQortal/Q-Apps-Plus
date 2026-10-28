/**
 * Shown when someone presses Sign in on a web gateway (https), where there
 * is no Hub to sign in with: points to the Qortal download, as the original
 * did. Full-screen on phones.
 */
import { useDispatch } from "react-redux";
import { Box, Button, Typography } from "@mui/material";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import { UAParser } from "ua-parser-js";
import { ResponsiveDialog } from "../common/mobile/ResponsiveDialog";
import QortalLogo from "../../assets/img/Q-AppsLogo.webp";
import { setNotification } from "../../state/features/notificationsSlice";
import { APP_NAME } from "../../constants/plus";

export const DOWNLOADS: [string, string][] = [
  ["Mac", "https://github.com/Qortal/qortal-ui/releases/latest/download/Qortal-Setup-macOS.dmg"],
  ["Windows", "https://github.com/Qortal/qortal-ui/releases/latest/download/Qortal-Setup-win64.exe"],
  ["Linux", "https://github.com/Qortal/qortal-ui/releases/latest/download/Qortal-Setup-amd64.AppImage"],
];

export function DownloadQortalModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dispatch = useDispatch();
  const download = () => {
    const userOS = new UAParser().getOS().name;
    if (userOS?.includes("Android") || userOS?.includes("iOS")) {
      dispatch(
        setNotification({
          msg: "The Qortal download is for desktops and laptops. On a phone, use Qortal GO.",
          alertType: "info",
        })
      );
      return;
    }
    const match = DOWNLOADS.find(([os]) => userOS?.includes(os));
    if (match) {
      window.location.href = match[1];
      dispatch(setNotification({ msg: "Your download should start in a moment.", alertType: "success" }));
    } else {
      dispatch(setNotification({ msg: "Get Qortal for your computer from qortal.org.", alertType: "info" }));
    }
  };
  return (
    <ResponsiveDialog
      open={open}
      onClose={onClose}
      title="Sign in with Qortal"
      maxWidth="xs"
      actions={
        <>
          <Button onClick={onClose} sx={{ minHeight: 44 }}>
            Not now
          </Button>
          <Button variant="contained" startIcon={<DownloadOutlinedIcon />} onClick={download} sx={{ minHeight: 44 }}>
            Download Qortal
          </Button>
        </>
      }
    >
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, textAlign: "center", py: 1 }}>
        <Box component="img" src={QortalLogo} alt="" sx={{ width: 96, height: 96 }} />
        <Typography sx={{ fontWeight: 700, fontSize: 20 }}>Shopping needs Qortal</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: 15, lineHeight: 1.6 }}>
          You are viewing {APP_NAME} on a web gateway. To sign in, buy or sell, install Qortal (Hub on a computer, GO on a
          phone) and open {APP_NAME} there.
        </Typography>
      </Box>
    </ResponsiveDialog>
  );
}
