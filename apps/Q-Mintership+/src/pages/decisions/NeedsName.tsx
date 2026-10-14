/**
 * Minter Admin polls publish under a registered name: what that is, and
 * where to get one. Shown where a poll write would need it (Ask, voting and
 * sharing), so nobody reaches a Hub step that can only stop them.
 */
import { Box, Button, Typography } from '@mui/material';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import { NAMES_APP_LINK } from '../../components/ready/readyChecks';
import { invalidate } from '../../data/query';
import { signIn } from '../../state/session';
import { openQortalLink } from '../../utils/links';

export function NeedsName({
  address,
  title,
  text,
}: {
  address: string;
  /** "Asking needs a registered name". */
  title: string;
  /** Why, in a sentence or two. */
  text: string;
}) {
  return (
    <Box
      role="note"
      aria-label={title}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        p: 1.5,
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        minWidth: 0,
        flexBasis: '100%',
      }}
    >
      <Typography sx={{ fontWeight: 700 }}>{title}</Typography>
      <Typography variant="body2" color="text.secondary">
        {text} A name is a short public name for your Qortal account; you register it once, in the
        Names app.
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        <Button
          variant="outlined"
          endIcon={<OpenInNewOutlinedIcon />}
          onClick={() => void openQortalLink(NAMES_APP_LINK)}
          sx={{ minHeight: 44 }}
        >
          Register a name
        </Button>
        <Button
          onClick={() => {
            invalidate(`name:${address}`);
            void signIn();
          }}
          sx={{ minHeight: 44 }}
        >
          I’ve registered one
        </Button>
      </Box>
    </Box>
  );
}
