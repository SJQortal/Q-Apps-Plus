/**
 * The Minter Admins' "Propose" button: a menu on wider layouts and a bottom
 * sheet on phones (docs/DESIGN.md → Mobile: menus open as sheets). The
 * sheet is a plain Drawer, mounted only while open (docs/QORTAL.md pitfall 4).
 */
import { useState, type ReactNode } from 'react';
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
import PersonRemoveOutlinedIcon from '@mui/icons-material/PersonRemoveOutlined';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined';
import RemoveModeratorOutlinedIcon from '@mui/icons-material/RemoveModeratorOutlined';
import LockOpenOutlinedIcon from '@mui/icons-material/LockOpenOutlined';
import CleaningServicesOutlinedIcon from '@mui/icons-material/CleaningServicesOutlined';
import CloseIcon from '@mui/icons-material/Close';
import { usePhoneLayout } from '../../hooks/usePhoneLayout';
import { PROPOSE_KINDS, PROPOSE_ORDER, type ProposeKind } from './proposeKinds';

const ICONS: Record<ProposeKind, ReactNode> = {
  kick: <PersonRemoveOutlinedIcon />,
  ban: <BlockOutlinedIcon />,
  addAdmin: <AdminPanelSettingsOutlinedIcon />,
  removeAdmin: <RemoveModeratorOutlinedIcon />,
  cancelBan: <LockOpenOutlinedIcon />,
};

export type ProposeChoice = ProposeKind | 'stale';

const ITEMS: Array<{ key: ProposeChoice; label: string; description: string; icon: ReactNode }> = [
  ...PROPOSE_ORDER.map((kind) => ({
    key: kind as ProposeChoice,
    label: PROPOSE_KINDS[kind].label,
    description: PROPOSE_KINDS[kind].description,
    icon: ICONS[kind],
  })),
  {
    key: 'stale',
    label: 'Clean up stale invites',
    description: 'Approved invites nobody used.',
    icon: <CleaningServicesOutlinedIcon />,
  },
];

export function ProposeMenu({ onChoose }: { onChoose: (choice: ProposeChoice) => void }) {
  const phone = usePhoneLayout();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [sheet, setSheet] = useState(false);
  const pick = (choice: ProposeChoice) => {
    setAnchor(null);
    setSheet(false);
    onChoose(choice);
  };
  return (
    <>
      <Button
        variant="contained"
        startIcon={<AddOutlinedIcon />}
        aria-haspopup={phone ? 'dialog' : 'menu'}
        aria-expanded={Boolean(anchor) || sheet}
        onClick={(e) => (phone ? setSheet(true) : setAnchor(e.currentTarget))}
        sx={{ minHeight: 44 }}
      >
        Propose
      </Button>
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
          {ITEMS.map((item) => (
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
            {ITEMS.map((item) => (
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
