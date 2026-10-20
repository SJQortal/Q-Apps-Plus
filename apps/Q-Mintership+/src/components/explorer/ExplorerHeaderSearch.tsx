/**
 * The Explorer's search in the header of every Explorer page but its own
 * (which has the big field): a compact field on wider screens, and on phones
 * a search button that opens the full field in a dialog, focused, since the
 * button was pressed to type. A name, an address, a signature or a QDN
 * identifier, as on the Explorer's page (ExplorerSearch).
 */
import { useState } from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import { usePhoneLayout } from '../../hooks/usePhoneLayout';
import { ResponsiveDialog } from '../common/ResponsiveDialog';
import { ExplorerSearch } from './ExplorerSearch';

const LABEL = 'Search the Explorer';

export function ExplorerHeaderSearch() {
  const phone = usePhoneLayout();
  const [open, setOpen] = useState(false);
  if (!phone)
    return (
      <Box sx={{ width: { sm: 200, md: 280 }, flexShrink: 1, minWidth: 140, mr: 0.5 }}>
        <ExplorerSearch compact label={LABEL} />
      </Box>
    );
  return (
    <>
      <Tooltip title={LABEL}>
        <IconButton aria-label={LABEL} onClick={() => setOpen(true)} sx={{ width: 44, height: 44 }}>
          <SearchOutlinedIcon />
        </IconButton>
      </Tooltip>
      <ResponsiveDialog open={open} onClose={() => setOpen(false)} title={LABEL} tall>
        {open ? (
          <ExplorerSearch
            autoFocus
            label={LABEL}
            onDone={() => setOpen(false)}
            listMaxHeight="55vh"
          />
        ) : null}
      </ResponsiveDialog>
    </>
  );
}
