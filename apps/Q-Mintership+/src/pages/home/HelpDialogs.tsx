/**
 * Help that opens from a hero's action: minting tips for members below
 * level 5. Plain steps, real numbers, no jargon.
 */
import { Button } from '@mui/material';
import { CUMULATIVE_BLOCKS_BY_LEVEL, NOMINATOR_MIN_LEVEL } from '../../data/constants';
import { ResponsiveDialog } from '../../components/common/ResponsiveDialog';
import { formatCount } from '../../utils/format';
import { Num } from './Hero';
import { Step, StepList } from './Steps';

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
