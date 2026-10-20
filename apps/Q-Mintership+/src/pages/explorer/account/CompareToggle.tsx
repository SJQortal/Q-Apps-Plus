/**
 * The account header's Compare button: adds the account to the accounts
 * picked to compare (up to 4), or takes it out. Its icon is a list to add
 * to (ticked once picked), apart from Compare with…'s arrows. A short note
 * just under the button says what happened, with "Compare now" once two or more are picked; a 5th is
 * refused in words.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, IconButton, Tooltip } from '@mui/material';
import { AnchoredNote } from '../../../components/common/AnchoredNote';
import PlaylistAddCheckOutlinedIcon from '@mui/icons-material/PlaylistAddCheckOutlined';
import PlaylistAddOutlinedIcon from '@mui/icons-material/PlaylistAddOutlined';
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
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
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
          ref={setAnchor}
          aria-pressed={picked}
          aria-label={picked ? `Remove ${label} from compare` : `Add ${label} to compare`}
          onClick={toggle}
          color={picked ? 'primary' : 'default'}
          sx={{ width: 44, height: 44 }}
        >
          {picked ? <PlaylistAddCheckOutlinedIcon /> : <PlaylistAddOutlinedIcon />}
        </IconButton>
      </Tooltip>
      <AnchoredNote
        anchor={anchor}
        open={message !== null}
        onClose={() => setMessage(null)}
        action={
          message?.compare ? (
            <Button
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
      >
        {message?.text}
      </AnchoredNote>
    </>
  );
}
