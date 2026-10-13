/**
 * The chevron on a Show / Hide button: it turns over as the part it
 * controls opens or closes, instead of swapping icons. Decorative; the
 * button's aria-expanded says the state. Reduced motion makes it instant.
 */
import ExpandMoreOutlinedIcon from '@mui/icons-material/ExpandMoreOutlined';

export function ExpandChevron({ open }: { open: boolean }) {
  return (
    <ExpandMoreOutlinedIcon
      aria-hidden
      sx={{
        transform: open ? 'rotate(180deg)' : 'none',
        transition: 'transform 200ms cubic-bezier(0.2, 0, 0, 1)',
      }}
    />
  );
}
