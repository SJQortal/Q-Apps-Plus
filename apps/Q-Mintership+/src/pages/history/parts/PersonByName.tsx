/**
 * A person known only by name (old cards and comments name their author):
 * the name's owner is looked up once (cached), then shown like everyone
 * else, linking to their page. Until then, and for a name that no longer
 * resolves, the name and avatar alone.
 */
import type { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import { getNameOwner } from '../../../data/accounts';
import { useQuery } from '../../../hooks/useQuery';
import { NameAvatar } from '../../../components/common/NameAvatar';
import { PersonChip } from '../../../components/common/Person';

export function PersonByName({
  name,
  size = 32,
  secondary,
}: {
  name: string;
  size?: number;
  secondary?: ReactNode;
}) {
  const owner = useQuery(`nameowner:${name}`, () => getNameOwner(name));
  if (owner.data) {
    return <PersonChip address={owner.data} name={name} size={size} secondary={secondary} />;
  }
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
      <NameAvatar name={name} size={size} />
      <Box sx={{ minWidth: 0 }}>
        <Typography
          component="span"
          sx={{ fontWeight: 600, overflowWrap: 'anywhere', display: 'block', lineHeight: 1.3 }}
        >
          {name}
        </Typography>
        {secondary ? (
          <Typography
            component="span"
            variant="body2"
            color="text.secondary"
            sx={{ display: 'block', lineHeight: 1.3 }}
          >
            {secondary}
          </Typography>
        ) : null}
      </Box>
    </Box>
  );
}
