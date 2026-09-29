import { useContext, useState } from "react";
import { styled } from "@mui/material/styles";
import { Avatar, Box, IconButton, Tooltip, Typography } from "@mui/material";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import OpenInNewOutlinedIcon from "@mui/icons-material/OpenInNewOutlined";
import { ThemePicker } from "../hub-theme";
import gameContext from "../contexts/gameContext";
import { PageHeader } from "../components/layout/PageHeader";
import { PageBody } from "../components/layout/PageBody";
import { ChangelogDialog } from "../components/Settings/ChangelogDialog";
import { TermsDialog } from "../components/Terms";
import { Settings as FeeSettings } from "../components/sell/Settings";
import { QTRADE_PLUS_VERSION, SOURCE_REPO, UPSTREAM_REPO } from "../constants/changelog";
import { cropAddress } from "../utils/cropAddress";

const Section = styled("section")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(1),
}));

const SectionTitle = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  padding: theme.spacing(0, 0.5),
}));

const Card = styled("div")(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  overflow: "hidden",
}));

const Row = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1.5),
  minHeight: 56,
  padding: theme.spacing(1.25, 2),
  "& + &": { borderTop: `1px solid ${theme.palette.divider}` },
}));

const LinkRow = styled("button")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(1.5),
  width: "100%",
  minHeight: 56,
  padding: theme.spacing(1.25, 2),
  border: 0,
  background: "none",
  color: "inherit",
  cursor: "pointer",
  font: "inherit",
  textAlign: "left",
  transition: "background-color 160ms ease",
  "&:hover": { backgroundColor: theme.palette.action.hover },
  "&:focus-visible": {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: -2,
  },
  "& + &, ${Row} + &": { borderTop: `1px solid ${theme.palette.divider}` },
}));

const Copy = styled("div")({ flex: 1, minWidth: 0 });

export const SettingsPage = () => {
  const { userInfo, isUsingGateway } = useContext(gameContext);
  const address: string = userInfo?.address ?? "";
  const name: string = userInfo?.name ?? "";
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be unavailable inside some webviews; the address is still shown.
    }
  };

  const nodeLabel =
    isUsingGateway === null
      ? "Checking which node you are using…"
      : isUsingGateway
        ? "Gateway (public) node"
        : "Local or custom node";

  return (
    <>
      <PageHeader title="Settings" />
      <PageBody $maxWidth={720}>
        <Section>
          <SectionTitle>Account</SectionTitle>
          <Card>
            <Row>
              <Avatar
                sx={{ width: 44, height: 44 }}
                src={
                  name
                    ? `/arbitrary/THUMBNAIL/${encodeURIComponent(name)}/qortal_avatar?async=true`
                    : undefined
                }
                alt={name}
              >
                {(name || address).charAt(0).toUpperCase()}
              </Avatar>
              <Copy>
                <Typography sx={{ fontWeight: 700 }} noWrap>
                  {name || (address ? "No registered name" : "Not signed in")}
                </Typography>
                {address ? (
                  <Typography variant="body2" color="text.secondary" noWrap>
                    {cropAddress(address, 7)}
                  </Typography>
                ) : (
                  <Typography variant="body2" color="text.secondary" noWrap>
                    Open Q-Trade+ inside Qortal Hub or GO to sign in.
                  </Typography>
                )}
              </Copy>
              {address ? (
                <Tooltip title={copied ? "Copied" : "Copy address"}>
                  <IconButton aria-label="Copy address" onClick={copyAddress}>
                    <ContentCopyOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              ) : null}
            </Row>
            <Row>
              <Copy>
                <Typography sx={{ fontWeight: 700 }}>Node</Typography>
                <Typography variant="body2" color="text.secondary">
                  {nodeLabel}
                </Typography>
              </Copy>
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: "right" }}>
                Change it at the authentication page
              </Typography>
            </Row>
          </Card>
          {isUsingGateway ? (
            <Typography variant="body2" color="text.secondary" sx={{ px: 0.5 }}>
              On a gateway node you can buy, but selling and fee changes need a local or custom node.
            </Typography>
          ) : null}
        </Section>

        <Section>
          <SectionTitle>Appearance</SectionTitle>
          <ThemePicker />
        </Section>

        {isUsingGateway ? null : (
          <Section>
            <SectionTitle>Fees</SectionTitle>
            <Card>
              <FeeSettings
                renderTrigger={(open) => (
                  <LinkRow type="button" onClick={open}>
                    <Copy>
                      <Typography sx={{ fontWeight: 700 }}>Locking fee and fee publisher</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Custom locking fee per coin, and whose recommended fees to use
                      </Typography>
                    </Copy>
                    <ArrowForwardIosIcon sx={{ fontSize: 16, opacity: 0.6 }} />
                  </LinkRow>
                )}
              />
            </Card>
          </Section>
        )}

        <Section>
          <SectionTitle>About</SectionTitle>
          <Card>
            <LinkRow type="button" onClick={() => setChangelogOpen(true)}>
              <Copy>
                <Typography sx={{ fontWeight: 700 }}>Q-Trade+ {QTRADE_PLUS_VERSION}</Typography>
                <Typography variant="body2" color="text.secondary">
                  What&apos;s new
                </Typography>
              </Copy>
              <ArrowForwardIosIcon sx={{ fontSize: 16, opacity: 0.6 }} />
            </LinkRow>
            <LinkRow type="button" onClick={() => setTermsOpen(true)}>
              <Copy>
                <Typography sx={{ fontWeight: 700 }}>Terms and conditions</Typography>
                <Typography variant="body2" color="text.secondary">
                  How the gateway and local node options handle your keys
                </Typography>
              </Copy>
              <ArrowForwardIosIcon sx={{ fontSize: 16, opacity: 0.6 }} />
            </LinkRow>
            <LinkRow type="button" onClick={() => window.open(UPSTREAM_REPO, "_blank", "noopener")}>
              <Copy>
                <Typography sx={{ fontWeight: 700 }}>Original app</Typography>
                <Typography variant="body2" color="text.secondary" noWrap>
                  {UPSTREAM_REPO}
                </Typography>
              </Copy>
              <OpenInNewOutlinedIcon sx={{ fontSize: 18, opacity: 0.6 }} />
            </LinkRow>
            <LinkRow type="button" onClick={() => window.open(SOURCE_REPO, "_blank", "noopener")}>
              <Copy>
                <Typography sx={{ fontWeight: 700 }}>Q-Trade+ source</Typography>
                <Typography variant="body2" color="text.secondary" noWrap>
                  {SOURCE_REPO}
                </Typography>
              </Copy>
              <OpenInNewOutlinedIcon sx={{ fontSize: 18, opacity: 0.6 }} />
            </LinkRow>
          </Card>
          <Box sx={{ px: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              Q-Trade+ is the + version of Qortal&apos;s Q-Trade. It reads and writes the same trade
              data, so orders placed here show up in the original app and the other way round.
            </Typography>
          </Box>
        </Section>
      </PageBody>
      <ChangelogDialog open={changelogOpen} onClose={() => setChangelogOpen(false)} />
      <TermsDialog open={termsOpen} onClose={() => setTermsOpen(false)} />
    </>
  );
};

export default SettingsPage;
