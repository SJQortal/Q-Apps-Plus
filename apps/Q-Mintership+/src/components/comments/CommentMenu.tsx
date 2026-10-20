/**
 * A comment's "More" actions: a menu on wider layouts and a bottom sheet on
 * phones (docs/DESIGN.md → Mobile: menus open as sheets), like Propose. The
 * sheet is mounted only while open.
 */
import { useState, type ReactNode } from 'react';
import {
  Box,
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
import MoreVertOutlinedIcon from '@mui/icons-material/MoreVertOutlined';
import CloseIcon from '@mui/icons-material/Close';
import { usePhoneLayout } from '../../hooks/usePhoneLayout';

export interface CommentAction {
  key: string;
  label: string;
  icon: ReactNode;
  onSelect: () => void;
}

export function CommentMenu({ label, actions }: { label: string; actions: CommentAction[] }) {
  const phone = usePhoneLayout();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [sheet, setSheet] = useState(false);
  const pick = (action: CommentAction) => {
    setAnchor(null);
    setSheet(false);
    action.onSelect();
  };
  return (
    <>
      <IconButton
        aria-label={label}
        aria-haspopup={phone ? 'dialog' : 'menu'}
        aria-expanded={Boolean(anchor) || sheet}
        onClick={(e) => (phone ? setSheet(true) : setAnchor(e.currentTarget))}
        sx={{ width: 44, height: 44, mt: -0.5, mr: -1, flexShrink: 0 }}
      >
        <MoreVertOutlinedIcon />
      </IconButton>
      {!phone ? (
        <Menu
          container={() => document.querySelector('main')}
          anchorEl={anchor}
          open={Boolean(anchor)}
          onClose={() => setAnchor(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          {actions.map((action) => (
            <MenuItem key={action.key} onClick={() => pick(action)} sx={{ minHeight: 44 }}>
              <ListItemIcon>{action.icon}</ListItemIcon>
              <ListItemText primary={action.label} />
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
              'aria-label': label,
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
            <Typography component="h2" sx={{ fontWeight: 700, flex: 1, overflowWrap: 'anywhere' }}>
              {label}
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
            {actions.map((action) => (
              <ListItemButton key={action.key} onClick={() => pick(action)} sx={{ minHeight: 52 }}>
                <ListItemIcon>{action.icon}</ListItemIcon>
                <ListItemText primary={action.label} />
              </ListItemButton>
            ))}
          </List>
        </Drawer>
      ) : null}
    </>
  );
}
