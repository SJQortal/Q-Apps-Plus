/**
 * Transactions on Qortal's pickers, all native (they work the same on
 * phones and with a screen reader): the type (All, each family, and each
 * family's exact types under it), the blocks (the latest 1,000, the latest
 * 10,000, or from a block: a block number typed in, how many blocks from it,
 * just that one up to 10,000, applied with Show) and the order (newest or
 * oldest first). Under them, what narrows the rows read: text they must
 * mention, and for reward shares, their kind. Side by side where they fit,
 * stacked on phones.
 */
import { useState, type FormEvent } from 'react';
import { Box, Button, IconButton, InputAdornment, TextField, Typography } from '@mui/material';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import FilterListOutlinedIcon from '@mui/icons-material/FilterListOutlined';
import {
  FROM_SPAN,
  FROM_SPANS,
  type BlocksChoice,
  type FromSpan,
  type GlobalOrder,
} from '../../../data/explorer/globalTx';
import { SHARE_KINDS, isShareKind, type ShareKind } from '../../../rules/explorer/rowFilter';
import { formatCount } from '../../../utils/format';
import { spanWords, TYPE_GROUPS, type GlobalType } from './globalFilters';

const FIELD_SX = {
  flex: '1 1 200px',
  maxWidth: { sm: 320 },
  '& .MuiInputBase-root': { minHeight: 44 },
};

export function GlobalFilterBar({
  type,
  onType,
  blocks,
  onBlocks,
  order,
  onOrder,
  find,
  onFind,
  share,
  onShare,
  tip,
}: {
  type: GlobalType;
  onType: (type: GlobalType) => void;
  blocks: BlocksChoice;
  onBlocks: (blocks: BlocksChoice) => void;
  order: GlobalOrder;
  onOrder: (order: GlobalOrder) => void;
  /** The text the rows must mention, as typed. */
  find: string;
  onFind: (text: string) => void;
  /** The reward shares' kind; offered only for reward shares. */
  share: ShareKind;
  onShare: (share: ShareKind) => void;
  /** The tip the page pinned, the last block a range can start at. */
  tip: number | null;
}) {
  const [editing, setEditing] = useState(false);
  const fromOn = editing || blocks.kind === 'from';
  const [start, setStart] = useState(() => (blocks.kind === 'from' ? String(blocks.start) : ''));
  const [span, setSpan] = useState<FromSpan>(() =>
    blocks.kind === 'from' ? (blocks.span ?? FROM_SPAN) : FROM_SPAN
  );
  const [problem, setProblem] = useState<string | null>(null);
  const shares = type === 'REWARD_SHARE' || type === 'minting';

  const chooseBlocks = (value: string) => {
    setProblem(null);
    if (value === 'from') {
      setEditing(true);
      return;
    }
    setEditing(false);
    onBlocks({ kind: 'latest', blocks: value === '10000' ? 10000 : 1000 });
  };

  const apply = (event: FormEvent) => {
    event.preventDefault();
    const n = Number(start.trim());
    let why: string | null = null;
    if (!/^\d+$/.test(start.trim()) || n < 1) why = 'Enter a block number, like 2700000.';
    else if (tip !== null && n > tip) why = `The chain is at block ${formatCount(tip)}.`;
    setProblem(why);
    if (why) return;
    setEditing(false);
    onBlocks(span === FROM_SPAN ? { kind: 'from', start: n } : { kind: 'from', start: n, span });
  };

  const blocksValue = fromOn ? 'from' : blocks.kind === 'latest' ? String(blocks.blocks) : 'from';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
        <TextField
          select
          label="Type"
          size="small"
          value={type}
          onChange={(e) => onType(e.target.value)}
          slotProps={{ select: { native: true } }}
          sx={FIELD_SX}
        >
          <option value="all">All types</option>
          {TYPE_GROUPS.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </optgroup>
          ))}
        </TextField>
        <TextField
          select
          label="Blocks"
          size="small"
          value={blocksValue}
          onChange={(e) => chooseBlocks(e.target.value)}
          slotProps={{ select: { native: true } }}
          sx={FIELD_SX}
        >
          <option value="1000">The latest 1,000 blocks</option>
          <option value="10000">The latest 10,000 blocks</option>
          <option value="from">From a block…</option>
        </TextField>
        <TextField
          select
          label="Order"
          size="small"
          value={order}
          onChange={(e) => onOrder(e.target.value === 'oldest' ? 'oldest' : 'newest')}
          slotProps={{ select: { native: true } }}
          sx={FIELD_SX}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </TextField>
      </Box>
      {fromOn ? (
        <Box
          component="form"
          onSubmit={apply}
          noValidate
          aria-label="From a block"
          sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}
        >
          <TextField
            label="From block"
            size="small"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            slotProps={{
              htmlInput: { inputMode: 'numeric', pattern: '[0-9]*', autoComplete: 'off' },
            }}
            sx={FIELD_SX}
          />
          <TextField
            select
            label="How many blocks"
            size="small"
            value={String(span)}
            onChange={(e) =>
              setSpan(FROM_SPANS.find((n) => String(n) === e.target.value) ?? FROM_SPAN)
            }
            slotProps={{ select: { native: true } }}
            sx={FIELD_SX}
          >
            {FROM_SPANS.map((n) => (
              <option key={n} value={String(n)}>
                {spanWords(n)}
              </option>
            ))}
          </TextField>
          <Button
            type="submit"
            variant="outlined"
            color="inherit"
            sx={{ minHeight: 44, flex: '0 0 auto' }}
          >
            Show
          </Button>
          {problem ? (
            <Typography role="alert" variant="body2" color="error" sx={{ flexBasis: '100%' }}>
              {problem}
            </Typography>
          ) : null}
        </Box>
      ) : null}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
        <TextField
          label="Only rows with"
          placeholder="A name, address, group number or amount"
          size="small"
          value={find}
          onChange={(e) => onFind(e.target.value)}
          slotProps={{
            htmlInput: { autoComplete: 'off', spellCheck: false, enterKeyHint: 'search' },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <FilterListOutlinedIcon fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: find ? (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="Clear what the rows must mention"
                    onClick={() => onFind('')}
                    edge="end"
                    sx={{ width: 40, height: 40 }}
                  >
                    <CloseOutlinedIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            },
          }}
          sx={{ ...FIELD_SX, flexBasis: 280, maxWidth: { sm: 420 } }}
        />
        {shares ? (
          <TextField
            select
            label="Reward share kind"
            size="small"
            value={share}
            onChange={(e) => onShare(isShareKind(e.target.value) ? e.target.value : 'any')}
            slotProps={{ select: { native: true } }}
            sx={FIELD_SX}
          >
            {SHARE_KINDS.map((kind) => (
              <option key={kind.value} value={kind.value}>
                {kind.label}
              </option>
            ))}
          </TextField>
        ) : null}
      </Box>
    </Box>
  );
}
