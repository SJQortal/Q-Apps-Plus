import { Dialog, DialogContent, DialogTitle, IconButton, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import CloseOutlined from '@mui/icons-material/CloseOutlined';
import { CHANGELOG, APP_VERSION } from '../constants/changelog';
import { usePhoneLayout } from '../hooks/usePhoneLayout';

const Release = styled('article')(({ theme }) => ({
  padding: theme.spacing(1.5, 0),
  borderBottom: `1px solid ${theme.palette.divider}`,
  '&:last-of-type': { borderBottom: 0 },
  '& ul': { margin: theme.spacing(1, 0, 0), paddingLeft: theme.spacing(2.5) },
  '& li': { marginBottom: 4 },
}));

export function ChangelogDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const phone = usePhoneLayout();
  return (
    <Dialog open={open} onClose={onClose} fullScreen={phone} fullWidth maxWidth="sm" aria-labelledby="changelog-title">
      <DialogTitle id="changelog-title" sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 1 }}>
        <span style={{ flex: 1 }}>What's new in Q-Apps+ {APP_VERSION}</span>
        <IconButton onClick={onClose} aria-label="Close" size="small">
          <CloseOutlined />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {CHANGELOG.map((release) => (
          <Release key={release.version}>
            <Typography sx={{ fontWeight: 700 }}>
              {release.version} · {release.title}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {release.date}
            </Typography>
            <ul>
              {release.notes.map((note) => (
                <li key={note}>
                  <Typography variant="body2">{note}</Typography>
                </li>
              ))}
            </ul>
          </Release>
        ))}
      </DialogContent>
    </Dialog>
  );
}
