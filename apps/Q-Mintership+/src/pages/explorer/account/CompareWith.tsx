/**
 * The account header's "Compare with…": a 44 px button that opens the
 * Explorer's search field in a dialog; the account picked there opens side
 * by side with this one (`/explorer/compare/<this>/<picked>`). Picking this
 * same account says so instead. The Compare toggle beside it is unchanged
 * (it adds to the accounts picked to compare).
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconButton, Tooltip, Typography } from '@mui/material';
import CompareArrowsOutlinedIcon from '@mui/icons-material/CompareArrowsOutlined';
import { ResponsiveDialog } from '../../../components/common/ResponsiveDialog';
import { ExplorerSearch } from '../../../components/explorer/ExplorerSearch';
import { usePhoneLayout } from '../../../hooks/usePhoneLayout';
import { explorerComparePath } from '../../../routes/paths';

export function CompareWith({ address, label }: { address: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  const phone = usePhoneLayout();
  const close = () => {
    setOpen(false);
    setMessage('');
  };
  return (
    <>
      <Tooltip title="Compare with…">
        <IconButton
          aria-label={`Compare ${label} with another account`}
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
          sx={{ width: 44, height: 44 }}
        >
          <CompareArrowsOutlinedIcon />
        </IconButton>
      </Tooltip>
      <ResponsiveDialog open={open} onClose={close} title="Compare with…">
        <Typography sx={{ mb: 1.5, overflowWrap: 'anywhere' }}>
          Find the account to compare <bdi dir="auto">{label}</bdi> with.
        </Typography>
        <ExplorerSearch
          label="Find an account"
          // The keyboard would cover the dialog on a phone.
          autoFocus={!phone}
          onAccount={(picked) => {
            if (picked === address) {
              setMessage('That’s this account. Pick another one.');
              return;
            }
            close();
            navigate(explorerComparePath([address, picked]));
          }}
        />
        <Typography role="status" color="text.secondary" sx={{ mt: 1 }}>
          {message}
        </Typography>
      </ResponsiveDialog>
    </>
  );
}
