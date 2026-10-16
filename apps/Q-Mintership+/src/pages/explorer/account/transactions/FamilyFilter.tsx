/**
 * Which kind of transactions to show: a chip per family (All, Payments,
 * Names, Minting, Groups, QDN data, Trading, Messages, Other), or on phones
 * one native picker, where nine chips would stack several rows deep. The
 * page asks once whether it is on a phone and passes it in.
 */
import { Box, Chip, TextField } from '@mui/material';
import { TX_FAMILIES, type TxFamilyKey } from '../../../../rules/explorer/txFamilies';

export function FamilyFilter({
  family,
  onFamily,
  phone,
}: {
  family: TxFamilyKey;
  onFamily: (family: TxFamilyKey) => void;
  phone: boolean;
}) {
  if (phone)
    return (
      <TextField
        select
        label="Show"
        size="small"
        value={family}
        onChange={(e) => onFamily(e.target.value as TxFamilyKey)}
        slotProps={{ select: { native: true } }}
        sx={{ alignSelf: 'stretch', '& .MuiInputBase-root': { minHeight: 44 } }}
      >
        {TX_FAMILIES.map((f) => (
          <option key={f.key} value={f.key}>
            {f.key === 'all' ? 'All transactions' : f.label}
          </option>
        ))}
      </TextField>
    );
  return (
    <Box
      role="group"
      aria-label="Show one kind of transaction"
      sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}
    >
      {TX_FAMILIES.map((f) => {
        const active = family === f.key;
        return (
          <Chip
            key={f.key}
            clickable
            aria-pressed={active}
            color={active ? 'primary' : 'default'}
            variant={active ? 'filled' : 'outlined'}
            onClick={() => onFamily(f.key)}
            label={f.label}
            sx={{ height: 44, borderRadius: 999, px: 0.5, fontSize: 15 }}
          />
        );
      })}
    </Box>
  );
}
