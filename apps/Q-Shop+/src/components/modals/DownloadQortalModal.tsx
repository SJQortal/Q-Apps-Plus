/**
 * Shown when someone presses Sign in on a web gateway (https), where there
 * is no Hub to sign in with: points to the Qortal download.
 */
import { useDispatch } from "react-redux";
import { useTheme } from "@mui/material";
import { UAParser } from "ua-parser-js";
import { ReusableModal } from "./ReusableModal";
import {
  DownloadNowButton,
  DownloadQortalCol,
  DownloadQortalFont,
  DownloadQortalSubFont,
  QortalIcon,
} from "../../wrappers/GlobalWrapper-styles";
import QortalLogo from "../../assets/img/Q-AppsLogo.webp";
import { DownloadCircleSVG } from "../../assets/svgs/DownloadCircleSVG";
import { setNotification } from "../../state/features/notificationsSlice";

const DOWNLOADS: [string, string][] = [
  ["Mac", "https://github.com/Qortal/qortal-ui/releases/latest/download/Qortal-Setup-macOS.dmg"],
  ["Windows", "https://github.com/Qortal/qortal-ui/releases/latest/download/Qortal-Setup-win64.exe"],
  ["Linux", "https://github.com/Qortal/qortal-ui/releases/latest/download/Qortal-Setup-amd64.AppImage"],
];

export function DownloadQortalModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dispatch = useDispatch();
  const theme = useTheme();
  const download = () => {
    const userOS = new UAParser().getOS().name;
    if (userOS?.includes("Android") || userOS?.includes("iOS")) {
      dispatch(
        setNotification({
          msg: "Qortal is not available on mobile devices yet. Please download on a desktop or laptop.",
          alertType: "error",
        })
      );
      return;
    }
    const match = DOWNLOADS.find(([os]) => userOS?.includes(os));
    if (match) {
      window.location.href = match[1];
      dispatch(setNotification({ msg: "Download successful!", alertType: "success" }));
    }
  };
  return (
    <ReusableModal
      open={open}
      onClose={onClose}
      customStyles={{
        width: "400px",
        maxWidth: "calc(100vw - 32px)",
        height: "auto",
        backgroundColor: theme.palette.background.paper,
        position: "relative",
        padding: "15px 20px",
        borderRadius: "8px",
        overflowY: "auto",
        overflowX: "hidden",
        maxHeight: "90vh",
      }}
      className="download-qortal-modal"
    >
      <DownloadQortalCol>
        <QortalIcon src={QortalLogo} alt="" />
        <DownloadQortalFont>Download Qortal</DownloadQortalFont>
        <DownloadQortalSubFont>
          Experience a new internet paradigm, and start your Qortal experience today by downloading and installing the
          Qortal software.
        </DownloadQortalSubFont>
        <DownloadNowButton onClick={download}>
          Download Now <DownloadCircleSVG color={theme.palette.text.primary} height="30" width="30" />
        </DownloadNowButton>
      </DownloadQortalCol>
    </ReusableModal>
  );
}
