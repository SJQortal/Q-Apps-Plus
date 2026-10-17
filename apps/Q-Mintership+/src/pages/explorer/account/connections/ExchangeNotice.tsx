/**
 * QORT an account sent to exchanges, or got from them (Simon, 2026-10-17:
 * "add the notification if users were sending QORT to exchanges"), at the
 * top of Connections: a line for each exchange and way, with the payments
 * behind it on request. Read exactly by sender and recipient
 * (getExchangePayments, a few ms each); on a node without that read, from
 * the payments the Connections lists read. On an exchange's own account it
 * says whose it is. Evidence, not a verdict.
 */
import { useId, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import CurrencyExchangeOutlinedIcon from '@mui/icons-material/CurrencyExchangeOutlined';
import { ResponsiveDialog } from '../../../../components/common/ResponsiveDialog';
import { ViewScope } from '../../../../components/common/ViewScope';
import { TxList } from '../../../../components/explorer/TxListRow';
import { getExchangePayments } from '../../../../data/explorer/money';
import { useQuery } from '../../../../hooks/useQuery';
import {
  exchangeFlow,
  exchangeLine,
  exchangeName,
  type ExchangeFlow,
} from '../../../../rules/explorer/exchanges';
import type { Finding } from '../../../../rules/explorer/findings';
import { readable } from '../../../../utils/readable';

/** The flows the Connections lists found, when the exact read isn't there. */
function fromFindings(recorded: readonly Finding[]): ExchangeFlow[] {
  return recorded.flatMap((finding) => {
    if ((finding.kind !== 'paidTo' && finding.kind !== 'paidBy') || !finding.other) return [];
    const rows = finding.evidence.filter((tx) => tx.type === 'PAYMENT');
    const flow = exchangeFlow(finding.other, finding.kind === 'paidTo' ? 'sent' : 'received', rows);
    return flow ? [flow] : [];
  });
}

function Frame({ titleId, children }: { titleId: string; children: React.ReactNode }) {
  return (
    <Box
      component="section"
      aria-labelledby={titleId}
      sx={{
        display: 'flex',
        gap: 1.5,
        p: 1.5,
        borderRadius: 2,
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderLeft: 4,
        borderLeftColor: 'warning.main',
      }}
    >
      <CurrencyExchangeOutlinedIcon aria-hidden sx={{ color: readable('warning'), mt: 0.25 }} />
      <Box sx={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}>{children}</Box>
    </Box>
  );
}

export function ExchangeNotice({
  address,
  recorded,
}: {
  address: string;
  /** What the Connections lists recorded (the fallback). */
  recorded: readonly Finding[];
}) {
  const own = exchangeName(address);
  const read = useQuery(own ? null : `xexch:${address}`, () => getExchangePayments(address));
  const [open, setOpen] = useState<ExchangeFlow | null>(null);
  const titleId = useId();
  if (own)
    return (
      <Frame titleId={titleId}>
        <Typography id={titleId} component="h3" sx={{ fontWeight: 700 }}>
          An exchange
        </Typography>
        <Typography>This is {own}&rsquo;s account, an exchange.</Typography>
      </Frame>
    );
  // The exact read, or the lists' payments when this node can't answer it (or it failed).
  const flows =
    read.data ?? (read.data === null || (read.isError && !read.data) ? fromFindings(recorded) : []);
  if (!flows.length) return null;
  const sent = flows.some((flow) => flow.direction === 'sent');
  return (
    <Frame titleId={titleId}>
      <Typography id={titleId} component="h3" sx={{ fontWeight: 700 }}>
        {sent ? 'Sent QORT to an exchange' : 'Got QORT from an exchange'}
      </Typography>
      <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
        {flows.map((flow) => (
          <Box
            component="li"
            key={`${flow.direction}:${flow.address}`}
            sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 1 }}
          >
            <Typography sx={{ overflowWrap: 'anywhere' }}>{exchangeLine(flow)}</Typography>
            <Button
              size="small"
              onClick={() => setOpen(flow)}
              aria-label={`Show the payments: ${exchangeLine(flow)}`}
              sx={{ minHeight: 44 }}
            >
              Show them
            </Button>
          </Box>
        ))}
      </Box>
      <ResponsiveDialog
        open={open !== null}
        onClose={() => setOpen(null)}
        title={
          open
            ? open.direction === 'sent'
              ? `Sent to ${open.exchange}`
              : `Received from ${open.exchange}`
            : ''
        }
        maxWidth="md"
        actions={<Button onClick={() => setOpen(null)}>Close</Button>}
      >
        {open ? (
          <>
            <Typography sx={{ mb: 1.5 }}>{exchangeLine(open)}</Typography>
            <ViewScope name={`exchange:${open.direction}:${open.address}`}>
              <TxList
                rows={open.rows}
                viewpoint={address}
                label={`${open.direction === 'sent' ? 'Sent to' : 'Received from'} ${open.exchange}: the payments`}
              />
            </ViewScope>
          </>
        ) : null}
      </ResponsiveDialog>
    </Frame>
  );
}
