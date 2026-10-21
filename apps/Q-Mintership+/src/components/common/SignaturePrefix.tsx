/**
 * The first characters of a transaction's signature, as Hub's raw-data
 * dialog shows them in "pendingSignature", so the person can compare the
 * two before they approve.
 */
import { Box } from '@mui/material';

export function SignaturePrefix({ signature }: { signature: string }) {
  return (
    <Box
      component="code"
      sx={{
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontWeight: 700,
        bgcolor: 'action.hover',
        px: 0.5,
        borderRadius: 0.5,
      }}
    >
      {signature.slice(0, 8)}
    </Box>
  );
}
