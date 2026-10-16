/**
 * A transaction's details in plain words, each field on a panel of its own
 * (fieldBlock.ts): its type's fields
 * (rules/explorer/txWords.ts → fields; accounts, names, amounts, groups and
 * transactions rendered as in its sentence, accounts and transactions as
 * links), and the accounts it involves as people, linking where the page
 * links people (into the Explorer inside it).
 *
 * Long lists stop at 20 with "Show all" (a multi-payment can pay hundreds
 * of accounts, and each person shown looks up a name). What a transaction
 * never shows is left out before this: a message's content, an encrypted
 * resource's identifier, the fields only its raw data carries.
 */
import { useId, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { PersonChip } from '../common/Person';
import { isAtAddress } from '../../data/explorer/account';
import type { TxField } from '../../rules/explorer/txWords';
import { plural } from '../../utils/format';
import { TxSentence } from './TxSentence';
import { FIELD_BLOCK_SX } from './fieldBlock';

/** Rows shown before "Show all". */
export const TX_LIST_CAP = 20;

function FieldValue({ value }: { value: TxField['value'] }) {
  if (typeof value === 'string') return <>{value}</>;
  return <TxSentence parts={[value]} />;
}

export function TxFields({ fields, label = 'Details' }: { fields: TxField[]; label?: string }) {
  const [all, setAll] = useState(false);
  if (!fields.length) return null;
  const shown = all ? fields : fields.slice(0, TX_LIST_CAP);
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
      <Box
        component="dl"
        aria-label={label}
        sx={{ m: 0, display: 'flex', flexDirection: 'column', gap: 0.75 }}
      >
        {shown.map((field, i) => (
          // Each field on its own panel: the label above its value on phones, beside it wider.
          <Box
            key={i}
            sx={{
              ...FIELD_BLOCK_SX,
              py: 1,
              display: 'grid',
              gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: '8.5rem minmax(0, 1fr)' },
              columnGap: 2,
              rowGap: 0.25,
              alignItems: 'baseline',
            }}
          >
            <Typography component="dt" variant="body2" color="text.secondary">
              {field.label}
            </Typography>
            <Typography component="dd" sx={{ m: 0, overflowWrap: 'anywhere', minWidth: 0 }}>
              <FieldValue value={field.value} />
            </Typography>
          </Box>
        ))}
      </Box>
      {fields.length > shown.length ? (
        <Button
          onClick={() => setAll(true)}
          sx={{ alignSelf: 'flex-start', minHeight: 44 }}
          aria-label={`Show all ${fields.length} details`}
        >
          Show all {fields.length}
        </Button>
      ) : null}
    </Box>
  );
}

/** The accounts a transaction involves, the one that made it first. */
export function TxPeople({
  addresses,
  label = 'Accounts involved',
  maker,
}: {
  addresses: string[];
  label?: string;
  /** The account that signed it, marked "Signed". */
  maker?: string | null;
}) {
  const [all, setAll] = useState(false);
  const labelId = useId();
  if (!addresses.length) return null;
  const shown = all ? addresses : addresses.slice(0, TX_LIST_CAP);
  return (
    <Box sx={{ ...FIELD_BLOCK_SX, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Typography id={labelId} variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
        {label}
      </Typography>
      <Box
        component="ul"
        aria-labelledby={labelId}
        sx={{
          listStyle: 'none',
          m: 0,
          p: 0,
          display: 'flex',
          flexWrap: 'wrap',
          columnGap: 2.5,
          rowGap: 0.5,
        }}
      >
        {shown.map((address) => {
          const at = isAtAddress(address);
          const note = [address === maker ? 'Signed' : null, at ? 'AT (automated contract)' : null]
            .filter(Boolean)
            .join(' · ');
          return (
            <Box component="li" key={address} sx={{ minWidth: 0, maxWidth: '100%' }}>
              <PersonChip
                address={address}
                // An AT has no name to look up.
                name={at ? null : undefined}
                size={28}
                secondary={note || undefined}
              />
            </Box>
          );
        })}
      </Box>
      {addresses.length > shown.length ? (
        <Button
          onClick={() => setAll(true)}
          sx={{ alignSelf: 'flex-start', minHeight: 44 }}
          aria-label={`Show all ${plural(addresses.length, 'account')} involved`}
        >
          Show all {addresses.length}
        </Button>
      ) : null}
    </Box>
  );
}
