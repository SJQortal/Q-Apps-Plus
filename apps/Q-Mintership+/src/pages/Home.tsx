import { Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import HowToVoteOutlinedIcon from '@mui/icons-material/HowToVoteOutlined';
import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined';
import LeaderboardOutlinedIcon from '@mui/icons-material/LeaderboardOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined';
import type { SvgIconComponent } from '@mui/icons-material';
import { primarySoft } from '../hub-theme';
import { PageHeader } from '../components/layout/PageHeader';
import { PageBody } from '../components/layout/PageBody';
import { UserStatusBanner } from '../components/common/UserStatusBanner';
import { useUser } from '../state/user';
import { PATHS } from '../routes/paths';
import { APP_VERSION } from '../constants/app';

const Grid = styled('div')(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
  gap: theme.spacing(1.5),
}));

const Tile = styled('button')(({ theme }) => ({
  appearance: 'none',
  textAlign: 'left',
  color: 'inherit',
  font: 'inherit',
  cursor: 'pointer',
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1),
  padding: theme.spacing(2),
  minHeight: 150,
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  transition: 'border-color 160ms ease, background-color 160ms ease',
  '&:hover': { backgroundColor: theme.palette.action.hover },
  '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
}));

const IconWrap = styled('span')(({ theme }) => ({
  width: 40,
  height: 40,
  borderRadius: theme.shape.borderRadius,
  backgroundColor: primarySoft(theme),
  color: theme.palette.primary.main,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  '& svg': { fontSize: 24 },
}));

interface Board {
  title: string;
  path: string;
  Icon: SvgIconComponent;
  blurb: string;
  adminOnly?: boolean;
}

/** The launcher tiles: the same boards the original home page offered, with its blurbs shortened. */
const BOARDS: Board[] = [
  {
    title: 'Forum',
    path: PATHS.forum,
    Icon: ForumOutlinedIcon,
    blurb:
      'The General and Minters rooms, plus the private Admins room. Learn how mintership replaced self-sponsorship and join the conversation.',
  },
  {
    title: 'Minter Board',
    path: PATHS.minters,
    Icon: HowToVoteOutlinedIcon,
    blurb:
      'Level 5+ minters nominate candidates here. Minters and Minter Admins review, comment, vote and follow each invite to the MINTER group.',
  },
  {
    title: 'MAM Board',
    path: PATHS.mam,
    Icon: AdminPanelSettingsOutlinedIcon,
    blurb: 'Proposals to add or remove Minter Admins, reviewed on their own track away from nominations.',
  },
  {
    title: 'Stats',
    path: PATHS.stats,
    Icon: LeaderboardOutlinedIcon,
    blurb: 'Nominator statistics, leaderboards and published stats snapshots.',
  },
  {
    title: 'Admin Board',
    path: PATHS.adminBoard,
    Icon: LockOutlinedIcon,
    blurb: 'The fully encrypted decision board for Minter Admins, with its two card types.',
    adminOnly: true,
  },
  {
    title: 'Admin Tools',
    path: PATHS.tools,
    Icon: BuildOutlinedIcon,
    blurb: 'Block list, pending invites and manual invites.',
    adminOnly: true,
  },
];

export function Home() {
  const navigate = useNavigate();
  const user = useUser();
  const boards = BOARDS.filter((board) => !board.adminOnly || user.isAdmin);
  return (
    <>
      <PageHeader title="Q-Mintership+" subtitle={`Minting forum and nomination boards · ${APP_VERSION}`} />
      <PageBody $maxWidth={1040}>
        <UserStatusBanner />
        <Grid>
          {boards.map(({ title, path, Icon, blurb }) => (
            <Tile key={path} type="button" onClick={() => navigate(path)} aria-label={`Open ${title}`}>
              <IconWrap aria-hidden>
                <Icon />
              </IconWrap>
              <Typography sx={{ fontWeight: 700, fontSize: 17 }}>{title}</Typography>
              <Typography variant="body2" color="text.secondary">
                {blurb}
              </Typography>
            </Tile>
          ))}
        </Grid>
      </PageBody>
    </>
  );
}

export default Home;
