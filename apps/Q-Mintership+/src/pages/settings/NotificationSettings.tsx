/**
 * Settings → Notifications: Home's "Since your last visit" (on by default,
 * kept in this browser).
 */
import { useId } from 'react';
import { Switch, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useAtom } from 'jotai';
import { Section } from '../../components/common/Section';
import { sinceLastVisitAtom } from '../../state/notifications';

const Card = styled('div')(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  overflow: 'hidden',
}));

const Row = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  minHeight: 56,
  padding: theme.spacing(1.25, 2),
  '& + &': { borderTop: `1px solid ${theme.palette.divider}` },
}));

const Copy = styled('div')({ flex: 1, minWidth: 0 });

export function NotificationSettings() {
  const [since, setSince] = useAtom(sinceLastVisitAtom);
  const labelId = useId();
  const hintId = useId();
  return (
    <Section title="Notifications" id="settings-notifications">
      <Card>
        <Row>
          <Copy>
            <Typography id={labelId} sx={{ fontWeight: 600 }}>
              Since your last visit
            </Typography>
            <Typography id={hintId} variant="body2" color="text.secondary">
              Home lists what changed since you last opened the app on this device: new decisions,
              your nomination&apos;s progress.
            </Typography>
          </Copy>
          <Switch
            checked={since}
            onChange={(_, v) => setSince(v)}
            slotProps={{ input: { 'aria-labelledby': labelId, 'aria-describedby': hintId } }}
          />
        </Row>
      </Card>
    </Section>
  );
}
