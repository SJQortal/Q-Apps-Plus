/**
 * The account header's Compare button: adds the account to the accounts
 * picked to compare (up to 4), or takes it out. A short message says what
 * happened, with "Compare now" once two or more are picked; a 5th is
 * refused in words.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, IconButton, Snackbar, Tooltip } from '@mui/material';
import CompareArrowsOutlinedIcon from '@mui/icons-material/CompareArrowsOutlined';
import { explorerComparePath } from '../../../routes/paths';
import { COMPARE_FULL, COMPARE_MAX, togglePick, useComparePicks } from '../../../state/explorer';

interface Message {
  text: string;
  /** Offer "Compare now" (two or more picked). */
  compare: boolean;
}

export function CompareToggle({ address, label }: { address: string; label: string }) {
  const picks = useComparePicks();
  const navigate = useNavigate();
  const [message, setMessage] = useState<Message | null>(null);
  const picked = picks.includes(address);

  const toggle = () => {
    const result = togglePick(address);
    if (result === 'full') setMessage({ text: COMPARE_FULL, compare: false });
    else if (result === 'added') {
      const count = picks.length + 1;
      setMessage({ text: `Added to compare (${count} of ${COMPARE_MAX})`, compare: count >= 2 });
    } else if (result === 'removed') setMessage({ text: 'Removed from compare', compare: false });
  };

  return (
    <>
      <Tooltip title={picked ? 'Remove from compare' : 'Add to compare'}>
        <IconButton
          aria-pressed={picked}
          aria-label={picked ? `Remove ${label} from compare` : `Add ${label} to compare`}
          onClick={toggle}
          color={picked ? 'primary' : 'default'}
          sx={{ width: 44, height: 44 }}
        >
          <CompareArrowsOutlinedIcon />
        </IconButton>
      </Tooltip>
      <Snackbar
        open={message !== null}
        autoHideDuration={6000}
        onClose={(_, reason) => {
          if (reason !== 'clickaway') setMessage(null);
        }}
        message={message?.text}
        action={
          message?.compare ? (
            <Button
              color="inherit"
              onClick={() => {
                setMessage(null);
                navigate(explorerComparePath(picks));
              }}
              sx={{ minHeight: 44, fontWeight: 700 }}
            >
              Compare now
            </Button>
          ) : undefined
        }
        // Above the phone's bottom bar.
        sx={{ bottom: { xs: 'calc(var(--qmp-bottom-nav, 0px) + 8px)', sm: 24 } }}
      />
    </>
  );
}
