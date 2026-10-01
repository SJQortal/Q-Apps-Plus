/**
 * A menu that opens as a bottom sheet on phones and as a MUI Menu elsewhere
 * (docs/DESIGN.md → Mobile → Dialogs: "Menus open as sheets"). Items are
 * 48 px tall on phones, 44 px on desktop, and the sheet closes with a swipe
 * down (SwipeableDrawer), the backdrop or Escape.
 */
import type { ReactNode } from 'react';
import {
  Box,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  SwipeableDrawer,
  Typography,
} from '@mui/material';
import { useLayoutMode } from '../../layout/useLayoutMode';

export interface SheetMenuItem {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

export interface BottomSheetMenuProps {
  open: boolean;
  onClose: () => void;
  /** Anchor for the desktop Menu; ignored for the phone sheet. */
  anchorEl: HTMLElement | null;
  items: SheetMenuItem[];
  /** Shown above the items on phones. */
  title?: ReactNode;
  ariaLabel?: string;
}

const noop = () => {};

export function BottomSheetMenu({ open, onClose, anchorEl, items, title, ariaLabel }: BottomSheetMenuProps) {
  const isPhone = useLayoutMode() === 'phone';

  if (!isPhone) {
    return (
      <Menu
        anchorEl={anchorEl}
        open={open && Boolean(anchorEl)}
        onClose={onClose}
        slotProps={{ list: { 'aria-label': ariaLabel } as any }}
      >
        {items.map((item) => (
          <MenuItem
            key={item.id}
            selected={item.selected}
            disabled={item.disabled}
            onClick={() => {
              onClose();
              item.onSelect();
            }}
            sx={{ minHeight: 44, gap: 1.5 }}
          >
            {item.icon && <ListItemIcon sx={{ minWidth: 32 }}>{item.icon}</ListItemIcon>}
            {item.label}
          </MenuItem>
        ))}
      </Menu>
    );
  }

  return (
    <SwipeableDrawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      onOpen={noop}
      disableSwipeToOpen
      slotProps={{
        paper: {
          sx: (theme) => ({
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            backgroundColor: theme.palette.background.paper,
            backgroundImage: 'none',
            maxHeight: '70vh',
          }),
        },
      }}
    >
      <Box
        aria-hidden
        sx={(theme) => ({
          width: 36,
          height: 4,
          borderRadius: 2,
          backgroundColor: theme.palette.divider,
          mx: 'auto',
          mt: 1,
          mb: 0.5,
        })}
      />
      {title && (
        <Typography
          component="h2"
          variant="body2"
          color="text.secondary"
          sx={{ px: 2.5, pt: 1, pb: 0.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}
        >
          {title}
        </Typography>
      )}
      <List aria-label={ariaLabel} sx={{ pb: 1 }}>
        {items.map((item) => (
          <ListItemButton
            key={item.id}
            selected={item.selected}
            disabled={item.disabled}
            onClick={() => {
              onClose();
              item.onSelect();
            }}
            sx={{ minHeight: 48, px: 2.5 }}
          >
            {item.icon && <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>}
            <ListItemText
              primary={item.label}
              slotProps={{ primary: { sx: { fontSize: '1rem', fontWeight: item.selected ? 600 : 400 } } }}
            />
          </ListItemButton>
        ))}
      </List>
    </SwipeableDrawer>
  );
}
