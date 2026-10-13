/**
 * A double on its card (rules/double.ts): the "Double" chip in the title
 * row (its full words for screen readers), and the note that says why it
 * is a double and when it runs out (to Minter Admins, also that there's no
 * need to sign it), with a link to the other decision when there is one.
 */
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, Typography } from '@mui/material';
import FileCopyOutlinedIcon from '@mui/icons-material/FileCopyOutlined';
import type { ChainNow } from '../../data/chain';
import type { Decision } from '../../rules/decision';
import type { DecisionDouble } from '../../rules/double';
import { ToneChip } from '../../components/common/Section';
import { decisionPath } from '../../routes/paths';
import { doubleChipText, doubleNote } from './doubleUi';

/** "Double", with what it means in full for screen readers; never colour alone. */
export function DoubleChip({ decision: d, double }: { decision: Decision; double: DecisionDouble }) {
  const full = doubleChipText({ kind: d.kind, double });
  return (
    <ToneChip
      size="small"
      variant="outlined"
      color="info"
      icon={<FileCopyOutlinedIcon aria-hidden />}
      label={
        <>
          Double
          <span className="qmp-visually-hidden">{full.slice('Double'.length)}</span>
        </>
      }
      sx={{ fontWeight: 700 }}
    />
  );
}

/** Why it is a double, and the other decision's page when it is known. */
export function DoubleNote({
  decision: d,
  double,
  name,
  label,
  now,
  advice,
}: {
  decision: Decision;
  double: DecisionDouble;
  /** The subject as the card shows them. */
  name: string;
  /** The card's full title, for the link's name. */
  label: string;
  now: ChainNow;
  /** Minter Admins also read that there's no need to sign it, and what to do instead. */
  advice: boolean;
}) {
  const other = double.otherSignature;
  return (
    <Alert
      severity="info"
      role="note"
      icon={<FileCopyOutlinedIcon aria-hidden />}
      sx={{ '& .MuiAlert-message': { minWidth: 0, width: '100%' }, overflowWrap: 'anywhere' }}
    >
      <Typography variant="body2">{doubleNote({ ...d, double }, name, now, advice)}</Typography>
      {other ? (
        <Box sx={{ mt: 0.5, ml: -1 }}>
          <Button
            component={RouterLink}
            to={decisionPath(other)}
            color="inherit"
            aria-label={`The earlier proposal: ${label}`}
            sx={{ minHeight: 44, textDecoration: 'underline' }}
          >
            The earlier proposal
          </Button>
        </Box>
      ) : null}
    </Alert>
  );
}
