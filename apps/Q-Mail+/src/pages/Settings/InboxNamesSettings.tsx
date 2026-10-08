/**
 * Settings → Mail: which of your names the mailboxes list under Inbox
 * (utils/inboxNamesPreference.ts). Names hidden from a name's menu are
 * listed here to show again.
 */
import { Box, Button, FormControlLabel, Switch, Typography } from '@mui/material';
import { NameText } from '../../components/common/NameText';
import {
  setInboxNameHidden,
  useInboxNamesPreference,
  writeHideEmptyInboxNames,
} from '../../utils/inboxNamesPreference';

export function InboxNamesSettings({ address, names }: { address: string; names: string[] }) {
  const { hidden, hideEmpty } = useInboxNamesPreference(address);
  // Stored lower-cased; shown as the name is written.
  const displayName = (stored: string) => names.find((name) => name.toLowerCase() === stored) || stored;
  return (
    <>
      <FormControlLabel
        sx={{ m: 0, justifyContent: 'space-between', minHeight: 44, gap: 2 }}
        labelPlacement="start"
        disabled={!address}
        label={
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 500 }}>Hide names with nothing in the inbox</Typography>
            <Typography variant="body2" color="text.secondary">
              Under Inbox in the mailboxes, leave out your other names whose mail is all archived. A name comes back
              when new mail arrives for it.
            </Typography>
          </Box>
        }
        control={
          <Switch
            checked={hideEmpty}
            onChange={(event) => writeHideEmptyInboxNames(address, event.target.checked)}
            slotProps={{ input: { 'aria-label': 'Hide names with nothing in the inbox' } }}
          />
        }
      />
      {hidden.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Typography sx={{ fontWeight: 500 }}>Hidden from the list</Typography>
          <Typography variant="body2" color="text.secondary">
            Hidden with a name's menu (right click or long press). Their mail still shows in the Inbox.
          </Typography>
          {hidden.map((stored) => (
            <Box key={stored} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, minHeight: 44 }}>
              <Typography noWrap sx={{ minWidth: 0 }}>
                <NameText name={displayName(stored)} />
              </Typography>
              <Button
                variant="outlined"
                onClick={() => setInboxNameHidden(address, stored, false)}
                aria-label={`Show ${displayName(stored)} again`}
                sx={{ minHeight: 44, flexShrink: 0 }}
              >
                Show
              </Button>
            </Box>
          ))}
        </Box>
      )}
    </>
  );
}
