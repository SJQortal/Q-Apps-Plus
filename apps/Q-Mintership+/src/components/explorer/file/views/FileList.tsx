/**
 * The files of a resource that holds several (a website, an app, a set of
 * files), as its publisher's metadata lists them: each opens on its own in
 * the viewer, and Save File keeps them all in one ZIP (`savesAll`). A long
 * list has a filter and shows 100 at a time.
 */
import { useMemo, useState } from 'react';
import { Box, Button, ButtonBase, TextField, Typography } from '@mui/material';
import ChevronRightOutlinedIcon from '@mui/icons-material/ChevronRightOutlined';
import { formatCount } from '../../../../utils/format';
import { FileKindIcon } from './FileKindIcon';
import { kindFromExtension } from '../../../../rules/explorer/qdnFiles';

const STEP = 100;
/** A filter field from this many files. */
const FILTER_FROM = 12;

export function FileList({
  files,
  savesAll = false,
  onOpen,
}: {
  files: string[];
  /** Save File packs them all into one ZIP (not past what the page can hold). */
  savesAll?: boolean;
  onOpen: (file: string) => void;
}) {
  const [filter, setFilter] = useState('');
  const [limit, setLimit] = useState(STEP);
  const matching = useMemo(() => {
    const text = filter.trim().toLowerCase();
    return text ? files.filter((file) => file.toLowerCase().includes(text)) : files;
  }, [files, filter]);
  const shown = matching.slice(0, limit);
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
      <Typography variant="body2" color="text.secondary">
        It holds {formatCount(files.length)} files.{' '}
        {savesAll
          ? 'Open one to see it here; Save File keeps them all in one ZIP.'
          : 'Open one to see it here or to save it.'}
      </Typography>
      {files.length >= FILTER_FROM ? (
        <TextField
          size="small"
          label="Filter the files"
          value={filter}
          onChange={(event) => {
            setFilter(event.target.value);
            setLimit(STEP);
          }}
          sx={{ maxWidth: 360, '& .MuiInputBase-root': { minHeight: 44 } }}
        />
      ) : null}
      {matching.length === 0 ? (
        <Typography color="text.secondary" role="status">
          No file has “{filter.trim()}” in its name.
        </Typography>
      ) : (
        <Box
          component="ul"
          aria-label="Files in this resource"
          sx={{
            listStyle: 'none',
            m: 0,
            p: 0,
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            '& > li + li': { borderTop: 1, borderColor: 'divider' },
          }}
        >
          {shown.map((file) => (
            <li key={file}>
              <ButtonBase
                onClick={() => onOpen(file)}
                sx={(theme) => ({
                  width: '100%',
                  minHeight: 48,
                  px: 1.5,
                  py: 1,
                  gap: 1.25,
                  justifyContent: 'flex-start',
                  textAlign: 'left',
                  '&:hover': { bgcolor: 'action.hover' },
                  '&.Mui-focusVisible': {
                    outline: `2px solid ${theme.palette.primary.main}`,
                    outlineOffset: -2,
                  },
                })}
              >
                <Box aria-hidden sx={{ display: 'flex', color: 'text.secondary' }}>
                  <FileKindIcon kind={kindFromExtension(file) ?? 'binary'} />
                </Box>
                <Typography
                  component="span"
                  sx={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}
                >
                  <bdi dir="auto">{file}</bdi>
                </Typography>
                <ChevronRightOutlinedIcon aria-hidden sx={{ color: 'text.secondary' }} />
              </ButtonBase>
            </li>
          ))}
        </Box>
      )}
      {matching.length > shown.length ? (
        <Button
          onClick={() => setLimit((value) => value + STEP)}
          sx={{ alignSelf: 'flex-start', minHeight: 44 }}
        >
          Show more ({formatCount(matching.length - shown.length)} more)
        </Button>
      ) : null}
    </Box>
  );
}
