/**
 * The Minter Admins' "Propose" button: a menu on wider layouts and a bottom
 * sheet on phones (docs/DESIGN.md → Mobile: menus open as sheets), where it
 * is the page's floating button (`fab`). Propose nomination comes first
 * (Simon, 2026-10-17: "propose nomination will be the first option at the
 * top of + Propose"). The sheet is a plain Drawer, mounted only while open
 * (docs/QORTAL.md pitfall 4).
 */
import { useState, type ReactNode, type Ref } from 'react';
import {
  Box,
  Button,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
} from '@mui/material';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import PersonAddAlt1OutlinedIcon from '@mui/icons-material/PersonAddAlt1Outlined';
import PersonRemoveOutlinedIcon from '@mui/icons-material/PersonRemoveOutlined';
import PersonOffOutlinedIcon from '@mui/icons-material/PersonOffOutlined';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined';
import RemoveModeratorOutlinedIcon from '@mui/icons-material/RemoveModeratorOutlined';
import LockOpenOutlinedIcon from '@mui/icons-material/LockOpenOutlined';
import PersonAddDisabledOutlinedIcon from '@mui/icons-material/PersonAddDisabledOutlined';
import CleaningServicesOutlinedIcon from '@mui/icons-material/CleaningServicesOutlined';
import HowToVoteOutlinedIcon from '@mui/icons-material/HowToVoteOutlined';
import CloseIcon from '@mui/icons-material/Close';
import { PageFab } from '../../components/layout/PageFab';
import { PROPOSE_NOMINATION } from '../../constants/words';
import { usePhoneLayout } from '../../hooks/usePhoneLayout';
import { PROPOSE_KINDS, PROPOSE_ORDER, type ProposeKind } from './proposeKinds';

const ICONS: Record<ProposeKind, ReactNode> = {
  kick: <PersonRemoveOutlinedIcon />,
  decline: <PersonOffOutlinedIcon />,
  ban: <BlockOutlinedIcon />,
  addAdmin: <AdminPanelSettingsOutlinedIcon />,
  removeAdmin: <RemoveModeratorOutlinedIcon />,
  cancelBan: <LockOpenOutlinedIcon />,
  cancelInvite: <PersonAddDisabledOutlinedIcon />,
};

/** A nomination, a chain proposal, Clean up stale invites, or a Minter Admin poll. */
export type ProposeChoice = 'nominate' | ProposeKind | 'stale' | 'poll';

type Item = { key: ProposeChoice; label: string; description: string; icon: ReactNode };

const NOMINATE_ITEM: Item = {
  key: 'nominate',
  label: PROPOSE_NOMINATION,
  description: 'Someone who runs a node and should mint. The Minter Admins then decide.',
  icon: <PersonAddAlt1OutlinedIcon />,
};

const ITEMS: Item[] = [
  ...PROPOSE_ORDER.map((kind) => ({
    key: kind as ProposeChoice,
    label: PROPOSE_KINDS[kind].label,
    description: PROPOSE_KINDS[kind].description,
    icon: ICONS[kind],
  })),
  {
    key: 'stale',
    label: 'Clean up stale invites',
    description: 'Every unused invite with when it was approved; the old ones in one go.',
    icon: <CleaningServicesOutlinedIcon />,
  },
  {
    key: 'poll',
    label: 'Ask the Minter Admins',
    description:
      'An advisory poll: Yes, No and Neutral, or answers of your own, encrypted to the Minter Admins.',
    icon: <HowToVoteOutlinedIcon />,
  },
];

export function ProposeMenu({
  onChoose,
  buttonRef,
  nominate = false,
  fab = false,
}: {
  onChoose: (choice: ProposeChoice) => void;
  /** The Propose button, where focus comes back after a proposal's dialogs. */
  buttonRef?: Ref<HTMLButtonElement>;
  /** Offer Propose nomination, first (whoever can nominate: every Minter Admin can). */
  nominate?: boolean;
  /** The page's floating button on a phone: icon only, opening the sheet. */
  fab?: boolean;
}) {
  const phone = usePhoneLayout() || fab;
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [sheet, setSheet] = useState(false);
  const items = nominate ? [NOMINATE_ITEM, ...ITEMS] : ITEMS;
  const pick = (choice: ProposeChoice) => {
    setAnchor(null);
    setSheet(false);
    onChoose(choice);
  };
  return (
    <>
      {fab ? (
        <PageFab
          ref={buttonRef}
          label="Propose"
          icon={<AddOutlinedIcon aria-hidden />}
          aria-haspopup="dialog"
          aria-expanded={sheet}
          onClick={() => setSheet(true)}
        />
      ) : (
        <Button
          ref={buttonRef}
          variant="contained"
          startIcon={<AddOutlinedIcon />}
          aria-haspopup={phone ? 'dialog' : 'menu'}
          aria-expanded={Boolean(anchor) || sheet}
          onClick={(e) => (phone ? setSheet(true) : setAnchor(e.currentTarget))}
          sx={{ minHeight: 44 }}
        >
          Propose
        </Button>
      )}
      {!phone ? (
        <Menu
          // Inside <main>, so the menu's text sits in a landmark like the page's.
          container={() => document.querySelector('main')}
          anchorEl={anchor}
          open={Boolean(anchor)}
          onClose={() => setAnchor(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          {items.map((item) => (
            <MenuItem
              key={item.key}
              onClick={() => pick(item.key)}
              sx={{ minHeight: 48, alignItems: 'flex-start', maxWidth: 360, whiteSpace: 'normal' }}
            >
              <ListItemIcon sx={{ mt: 0.5 }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} secondary={item.description} />
            </MenuItem>
          ))}
        </Menu>
      ) : null}
      {phone && sheet ? (
        <Drawer
          anchor="bottom"
          open
          onClose={() => setSheet(false)}
          slotProps={{
            paper: {
              'aria-label': 'Propose',
              sx: {
                borderTopLeftRadius: 12,
                borderTopRightRadius: 12,
                pb: 'var(--qp-safe-bottom)',
                maxHeight: 'calc(var(--qmp-app-height, 100dvh) - 48px)',
              },
            },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', px: 2, pt: 1 }}>
            <Typography component="h2" sx={{ fontWeight: 700, flex: 1 }}>
              Propose
            </Typography>
            <IconButton
              aria-label="Close"
              onClick={() => setSheet(false)}
              sx={{ width: 44, height: 44 }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
          <List component="div">
            {items.map((item) => (
              <ListItemButton
                key={item.key}
                onClick={() => pick(item.key)}
                sx={{ minHeight: 56, alignItems: 'flex-start' }}
              >
                <ListItemIcon sx={{ mt: 0.5 }}>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} secondary={item.description} />
              </ListItemButton>
            ))}
          </List>
        </Drawer>
      ) : null}
    </>
  );
}
