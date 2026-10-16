/**
 * Transactions on Qortal's two pickers, both native (they work the same on
 * phones and with a screen reader): the type (All, each family, and each
 * family's exact types under it) and the blocks (the latest 1,000, the
 * latest 10,000, or from a block, typed in a number field and applied with
 * Show). Side by side where they fit, stacked on phones.
 */
import { useState, type FormEvent } from 'react';
import { Box, Button, TextField, Typography } from '@mui/material';
import type { BlocksChoice } from '../../../data/explorer/globalTx';
import { formatCount } from '../../../utils/format';
import { TYPE_GROUPS, type GlobalType } from './globalFilters';

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
  tip,
}: {
  type: GlobalType;
  onType: (type: GlobalType) => void;
  blocks: BlocksChoice;
  onBlocks: (blocks: BlocksChoice) => void;
  /** The tip the page pinned, the last block a range can start at. */
  tip: number | null;
}) {
  const [editing, setEditing] = useState(false);
  const fromOn = editing || blocks.kind === 'from';
  const [start, setStart] = useState(() => (blocks.kind === 'from' ? String(blocks.start) : ''));
  const [problem, setProblem] = useState<string | null>(null);

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
    onBlocks({ kind: 'from', start: n });
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
          <option value="from">10,000 blocks from a block…</option>
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
    </Box>
  );
}
