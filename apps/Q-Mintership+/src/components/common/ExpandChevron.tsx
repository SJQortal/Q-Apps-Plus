/**
 * The chevron on a Show / Hide button: it turns over as the part it
 * controls opens or closes, instead of swapping icons. Decorative; the
 * button's aria-expanded says the state. Reduced motion makes it instant.
 * Its timing is the app's (index.css → --qmp-motion-enter).
 */
import ExpandMoreOutlinedIcon from '@mui/icons-material/ExpandMoreOutlined';

/** The turn, for a chevron drawn elsewhere (Activity's "How this is counted"). */
export const CHEVRON_TURN = 'transform var(--qmp-motion-enter) var(--qmp-ease-enter)';

export function ExpandChevron({ open }: { open: boolean }) {
  return (
    <ExpandMoreOutlinedIcon
      aria-hidden
      sx={{
        transform: open ? 'rotate(180deg)' : 'none',
        transition: CHEVRON_TURN,
      }}
    />
  );
}
