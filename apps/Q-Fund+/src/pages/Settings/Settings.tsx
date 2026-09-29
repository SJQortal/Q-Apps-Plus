import { useState } from "react";
import { Box, Button, Link, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import { useSelector } from "react-redux";
import { RootState } from "../../state/store";
import { ThemePicker } from "../../hub-theme";
import { ChangelogDialog } from "../../components/common/ChangelogDialog";
import { APP_VERSION, SOURCE_URL, UPSTREAM_URL } from "../../constants/changelog";

const Page = styled("main")(({ theme }) => ({
  maxWidth: 720,
  margin: "0 auto",
  padding: theme.spacing(2, 2, 6),
  width: "100%",
}));

const Section = styled("section")(({ theme }) => ({
  padding: theme.spacing(2, 0),
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
  const user = useSelector((state: RootState) => state.auth.user);
  const avatars = useSelector((state: RootState) => state.global.userAvatarHash);
  const [changelogOpen, setChangelogOpen] = useState(false);

  return (
    <Page>
      <Typography variant="h2" component="h1" sx={{ mb: 1 }}>
        Settings
      </Typography>

      <Section>
        <SectionTitle>Account</SectionTitle>
        <Row>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
            {user?.name && avatars[user.name] ? (
              <img
                src={avatars[user.name]}
                alt=""
                width={40}
                height={40}
                style={{ borderRadius: "50%", objectFit: "cover" }}
              />
            ) : null}
            <div>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                {user?.name || "Not signed in"}
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary", wordBreak: "break-all" }}>
                {user?.address || "Open Q-Fund+ inside Qortal Hub or GO to use your name."}
              </Typography>
            </div>
          </Box>
        </Row>
      </Section>

      <Section>
        <SectionTitle>Appearance</SectionTitle>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Hub 3.0 and Q-Fund Classic follow Hub's light or dark mode. Black is always dark and
          White is always light.
        </Typography>
        <ThemePicker />
      </Section>

      <Section>
        <SectionTitle>About</SectionTitle>
        <Row>
          <div>
            <Typography variant="body1" sx={{ fontWeight: 600 }}>
              Q-Fund+ {APP_VERSION}
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Simon's + version of the official Q-Fund app.
            </Typography>
          </div>
          <Button variant="outlined" size="small" onClick={() => setChangelogOpen(true)}>
            What's new
          </Button>
        </Row>
        <Row>
          <Typography variant="body2">
            Upstream:{" "}
            <Link href={UPSTREAM_URL} target="_blank" rel="noreferrer">
              Qortal/q-fund-v2
            </Link>
          </Typography>
          <Typography variant="body2">
            Source:{" "}
            <Link href={SOURCE_URL} target="_blank" rel="noreferrer">
              SJQortal/Q-Apps-Plus
            </Link>
          </Typography>
        </Row>
      </Section>

      <ChangelogDialog open={changelogOpen} onClose={() => setChangelogOpen(false)} />
    </Page>
  );
};
