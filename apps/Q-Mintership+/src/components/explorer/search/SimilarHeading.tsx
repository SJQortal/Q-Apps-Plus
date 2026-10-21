/** Above the rows a search found only similar (a letter or two off). */
import { Typography } from '@mui/material';

export function SimilarHeading({ typed, id }: { typed: string; id?: string }) {
  return (
    <Typography
      id={id}
      component="h3"
      sx={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3, mt: 0.5, overflowWrap: 'anywhere' }}
    >
      Similar to “{typed}”
      <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
        not exact: a letter or two differ
      </Typography>
    </Typography>
  );
}
