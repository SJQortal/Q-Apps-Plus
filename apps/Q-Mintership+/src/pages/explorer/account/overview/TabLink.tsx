/**
 * Links from inside a tab to another tab of the same account ("owns 88
 * names" → Names): a text link in a sentence, or a button. Like the tabs
 * themselves they swap the URL in place (`replace`) and keep what the page
 * was opened with; the focus moves to the tab they open (the link leaves
 * with the panel it was in), which also brings the tab bar into view.
 */
import type { ReactNode } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { Button, Link, type SxProps, type Theme } from '@mui/material';
import ChevronRightOutlinedIcon from '@mui/icons-material/ChevronRightOutlined';
import { explorerAccountPath, type ExplorerTab } from '../../../../routes/paths';
import { tabIdOf } from '../tabIds';

interface TabLinkProps {
  address: string;
  tab: ExplorerTab;
  children: ReactNode;
  sx?: SxProps<Theme>;
}

function useTabLink(address: string, tab: ExplorerTab) {
  const location = useLocation();
  return {
    component: RouterLink,
    to: explorerAccountPath(address, tab),
    replace: true,
    state: location.state,
    onClick: () => document.getElementById(tabIdOf(tab))?.focus(),
  };
}

/** A link in a sentence. */
export function TabLink({ address, tab, children, sx }: TabLinkProps) {
  const link = useTabLink(address, tab);
  return (
    <Link
      {...link}
      underline="always"
      color="inherit"
      sx={[{ fontWeight: 600 }, ...(Array.isArray(sx) ? sx : [sx])]}
    >
      {children}
    </Link>
  );
}

/** A 44 px text button with a chevron ("Mintership ›"). */
export function TabButton({ address, tab, children }: Omit<TabLinkProps, 'sx'>) {
  const link = useTabLink(address, tab);
  return (
    <Button {...link} endIcon={<ChevronRightOutlinedIcon />} sx={{ minHeight: 44 }}>
      {children}
    </Button>
  );
}
