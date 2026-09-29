import { CircularProgress, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useAtomValue } from 'jotai';
import { useTranslation } from 'react-i18next';
import { allSortedPendingTxsAtom, NameTransactions } from '../../state/global/names';

const Card = styled('section')(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(1.5, 2),
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(0.75),
}));

const Line = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.25),
  minHeight: 28,
}));

function describe(tx: NameTransactions, t: ReturnType<typeof useTranslation>['t']): string {
  const options = { postProcess: 'capitalizeFirstChar' as const };
  switch (tx.type) {
    case 'UPDATE_NAME':
      return t('core:pending.UPDATE_NAME', { name: tx.name, newName: tx.newName, ...options });
    default:
      return t(`core:pending.${tx.type}`, { name: tx.name, ...options });
  }
}

/** The transactions this session sent that the chain has not confirmed yet. */
export const PendingTxsList = () => {
  const { t } = useTranslation(['core']);
  const allTxs = useAtomValue(allSortedPendingTxsAtom);
  if (allTxs.length === 0) return null;
  return (
    <Card aria-live="polite">
      <Typography sx={{ fontWeight: 700, fontSize: 14 }}>
        {t('core:pending.title', { postProcess: 'capitalizeFirstChar' })}
      </Typography>
      {allTxs.map((tx) => (
        <Line key={tx.signature}>
          <CircularProgress size={16} />
          <Typography variant="body2">{describe(tx, t)}</Typography>
        </Line>
      ))}
      <Typography variant="body2" color="text.secondary">
        {t('core:pending.hint', { postProcess: 'capitalizeFirstChar' })}
      </Typography>
    </Card>
  );
};
