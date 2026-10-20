/**
 * What an avatar of the Connections circle stands for (Simon, 2026-10-17:
 * "when clicking on each avatar I want to see the list of these
 * transactions, not that user's account"): what was recorded that way, in
 * the list's words, then each transaction as a row (opening to its details
 * and its own page). Explore opens that account in the Explorer, the trail
 * growing, and Compare puts the two side by side. Full screen on phones.
 */
import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Typography } from '@mui/material';
import { ResponsiveDialog } from '../../../../components/common/ResponsiveDialog';
import { ViewScope } from '../../../../components/common/ViewScope';
import { usePersonLinks } from '../../../../components/common/personLinks';
import { TxList } from '../../../../components/explorer/TxListRow';
import { TxSentence } from '../../../../components/explorer/TxSentence';
import { useDisplayName } from '../../../../hooks/useDisplayName';
import { explorerComparePath } from '../../../../routes/paths';
import { nodeTransactions, type CircleNode } from '../../../../rules/explorer/circle';
import { circleNodeTitle, whenLine } from './words';

export function CircleNodeDialog({
  node,
  address,
  onClose,
}: {
  /** The avatar pressed; null when closed. */
  node: CircleNode | null;
  /** The account whose connections these are. */
  address: string;
  onClose: () => void;
}) {
  // The last one stays while the dialog closes, so its content doesn't jump.
  const [shown, setShown] = useState<CircleNode | null>(node);
  useEffect(() => {
    if (node) setShown(node);
  }, [node]);
  const current = node ?? shown;
  const other = current?.address ?? '';
  const name = useDisplayName(other, other.startsWith('A') ? null : undefined);
  const links = usePersonLinks();
  if (!current) return null;
  const txs = nodeTransactions(current);
  const title = circleNodeTitle(current.side, name.label);
  return (
    <ResponsiveDialog
      open={node !== null}
      onClose={onClose}
      title={title}
      maxWidth="md"
      actions={
        <>
          <Button
            component={RouterLink}
            to={links.to(other)}
            state={links.state}
            onClick={onClose}
            variant="outlined"
          >
            Explore {name.label}
          </Button>
          <Button
            component={RouterLink}
            to={explorerComparePath([address, other])}
            state={links.state}
            onClick={onClose}
          >
            Compare
          </Button>
          <Button onClick={onClose}>Close</Button>
        </>
      }
    >
      <Box
        component="ul"
        aria-label="What was recorded"
        sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 1 }}
      >
        {current.findings.map((finding) => (
          <Box component="li" key={finding.key}>
            {/* A div: the people in the sentence are chips. */}
            <Typography component="div" sx={{ overflowWrap: 'anywhere', fontWeight: 600 }}>
              <TxSentence parts={finding.parts} />
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {whenLine(finding)}
            </Typography>
          </Box>
        ))}
      </Box>
      {txs.length ? (
        // Its rows open apart from the same transactions in the list under it.
        <ViewScope name={`circle:${current.key}`}>
          <TxList rows={txs} viewpoint={address} label={`${title}: its transactions`} />
        </ViewScope>
      ) : (
        <Typography color="text.secondary">No transactions are listed for this link.</Typography>
      )}
    </ResponsiveDialog>
  );
}
