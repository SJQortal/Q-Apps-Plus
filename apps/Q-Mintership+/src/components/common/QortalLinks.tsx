/**
 * `qortal://` links as buttons that open in a new Hub tab, each with the
 * avatar of the app or website it opens (loaded lazily by NameAvatar), and
 * read without the scheme.
 */
import { Box, Button } from '@mui/material';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import { linkLabel, linkName, openQortalLink } from '../../utils/links';
import { NameAvatar } from './NameAvatar';

export function QortalLinks({ links }: { links: string[] }) {
  if (!links.length) return null;
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, minWidth: 0 }}>
      {links.map((link) => (
        <QortalLinkButton key={link} link={link} />
      ))}
    </Box>
  );
}

/**
 * One `qortal://` link as a button, with its app's or website's avatar; its
 * words are the link itself unless `label` says what it opens.
 */
export function QortalLinkButton({ link, label }: { link: string; label?: string }) {
  const name = linkName(link);
  return (
    <Button
      size="small"
      variant="outlined"
      startIcon={name ? <NameAvatar name={name} size={24} /> : <LinkOutlinedIcon />}
      endIcon={<OpenInNewOutlinedIcon />}
      onClick={() => void openQortalLink(link)}
      sx={{
        minHeight: 44,
        textTransform: 'none',
        maxWidth: '100%',
        justifyContent: 'flex-start',
        '& .MuiButton-startIcon': { ml: -0.25 },
      }}
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label ?? linkLabel(link)}
      </span>
    </Button>
  );
}
