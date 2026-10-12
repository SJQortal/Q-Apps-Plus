/**
 * Help that opens from a hero's primary action: how to find a nominator
 * (newcomers, and former members who want back in) and minting tips
 * (members below level 5). Plain steps, real numbers, no jargon.
 */
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Typography } from '@mui/material';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import { CUMULATIVE_BLOCKS_BY_LEVEL, NOMINATOR_MIN_LEVEL } from '../../data/constants';
import { formatQort } from '../../data/accounts';
import { AddressText } from '../../components/common/Person';
import { ResponsiveDialog } from '../../components/common/ResponsiveDialog';
import { useFee } from '../../hooks/useFee';
import { PATHS } from '../../routes/paths';
import { formatCount } from '../../utils/format';
import { openQortalLink } from '../../utils/links';
import { CopyButton, Num } from './Hero';
import { Step, StepList } from './Steps';

/** Hub's Names app, for registering a name. */
export const NAMES_APP_LINK = 'qortal://APP/Names';

export function FindNominatorDialog({
  open,
  onClose,
  address,
  name,
  again,
}: {
  open: boolean;
  onClose: () => void;
  address: string;
  name: string | null;
  /** For former members: "Getting nominated again". */
  again?: boolean;
}) {
  const fee = useFee('JOIN_GROUP');
  return (
    <ResponsiveDialog
      open={open}
      onClose={onClose}
      title={again ? 'Getting nominated again' : 'Find a nominator'}
      actions={
        <Button variant="contained" onClick={onClose}>
          Close
        </Button>
      }
    >
      <StepList label="How to get nominated">
        <Step n={1} title="Who can nominate you">
          Any MINTER member at level {NOMINATOR_MIN_LEVEL} or above, or any Minter Admin.
          {again ? ' A new nomination works just like a first one.' : ''}
        </Step>
        <Step n={2} title="Ask someone who knows you">
          The best nominator has seen you around: in Q-Chat, in a Q-App you run, or helping others.
          Tell them a little about yourself and your node.
        </Step>
        <Step n={3} title={name ? 'Send them your name or address' : 'Send them your address'}>
          <AddressText address={address} full />
          {name ? (
            <Box sx={{ mt: 0.5 }}>
              <CopyButton text={name} label={`Copy “${name}”`} copiedLabel="Name copied" />
            </Box>
          ) : null}
        </Step>
        <Step n={4} title="See who nominates">
          Open nominations show who nominated whom.
          <Box sx={{ mt: 0.75 }}>
            <Button
              component={RouterLink}
              to={PATHS.nominations}
              variant="outlined"
              onClick={onClose}
              sx={{ minHeight: 44 }}
            >
              See open nominations
            </Button>
          </Box>
        </Step>
        <Step n={5} title="Then accept">
          When someone nominates you, Home shows it with an Accept button. Accepting costs a{' '}
          <Num>{formatQort(fee.data?.qort ?? 0.01)}</Num> fee.
        </Step>
      </StepList>
      {name ? null : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography variant="body2" color="text.secondary">
            A registered name helps people recognise you. It&rsquo;s optional: nominations work with
            an address too.
          </Typography>
          <Button
            variant="outlined"
            endIcon={<OpenInNewOutlinedIcon />}
            onClick={() => void openQortalLink(NAMES_APP_LINK)}
            sx={{ alignSelf: 'flex-start', minHeight: 44 }}
          >
            Register a name
          </Button>
        </Box>
      )}
    </ResponsiveDialog>
  );
}

export function MintingTipsDialog({
  open,
  onClose,
  level,
}: {
  open: boolean;
  onClose: () => void;
  level: number;
}) {
  const nextAt =
    level < CUMULATIVE_BLOCKS_BY_LEVEL.length ? CUMULATIVE_BLOCKS_BY_LEVEL[level] : null;
  return (
    <ResponsiveDialog
      open={open}
      onClose={onClose}
      title="Minting tips"
      actions={
        <Button variant="contained" onClick={onClose}>
          Close
        </Button>
      }
    >
      <StepList label="Minting tips">
        <Step n={1} title="Keep your node online and synced">
          Your level grows with every block your minting key is online for. Time away from the chain
          doesn&rsquo;t count.
        </Step>
        <Step n={2} title="One minting key, one node">
          Check in Hub that your minting key is active on your own node, and keep it on just that
          one.
        </Step>
        <Step n={3} title="Levels come from blocks minted">
          {nextAt !== null ? (
            <>
              Level {level + 1} comes at <Num>{formatCount(nextAt)}</Num> blocks minted in
              total.{' '}
            </>
          ) : null}
          Level {NOMINATOR_MIN_LEVEL} is at{' '}
          <Num>{formatCount(CUMULATIVE_BLOCKS_BY_LEVEL[NOMINATOR_MIN_LEVEL - 1])}</Num>.
        </Step>
        {level === 0 ? (
          <Step n={4} title="Level 0 mints without rewards">
            You mint from day one, but rewards start at level 1 (
            <Num>{formatCount(CUMULATIVE_BLOCKS_BY_LEVEL[0])}</Num> blocks).
          </Step>
        ) : null}
        <Step n={level === 0 ? 5 : 4} title={`What level ${NOMINATOR_MIN_LEVEL} unlocks`}>
          You can nominate new minters here, and it&rsquo;s the level at which nodes submit blocks
          by default.
        </Step>
      </StepList>
    </ResponsiveDialog>
  );
}
