/**
 * What a ZIP archive holds, without reading it whole: its last bytes for
 * the end record, then its central directory (rules/explorer/zipListing.ts),
 * at most 1 MB of it. Each file with its size and date, folders marked,
 * 100 at a time; nothing inside is opened. Save File keeps the archive.
 */
import { useEffect, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { ErrorState, ListSkeleton } from '../../../common/states';
import { readFileRange, type QdnResourceRef } from '../../../../data/explorer/qdnFile';
import {
  DIRECTORY_MAX_BYTES,
  findDirectory,
  readEntries,
  TAIL_BYTES,
  type ZipEntry,
} from '../../../../rules/explorer/zipListing';
import { sizeWords } from '../../../../rules/explorer/txWords';
import { formatCount, formatDateTime } from '../../../../utils/format';

/** Entries listed at most (a directory of 1 MB holds about 10,000). */
const MAX_ENTRIES = 10_000;
const STEP = 100;

type Listing = { entries: ZipEntry[]; count: number; partial: boolean };

export const NOT_A_ZIP = 'This file doesn’t read as a ZIP archive (its end record is missing).';

async function readListing(
  ref: QdnResourceRef,
  filepath: string | null,
  size: number
): Promise<Listing | null> {
  const tailStart = Math.max(0, size - TAIL_BYTES);
  const tail = await readFileRange(ref, filepath, { from: tailStart, to: size - 1, size });
  const directory = findDirectory(tail, tailStart);
  if (!directory) return null;
  const length = Math.min(directory.size, DIRECTORY_MAX_BYTES);
  const bytes =
    directory.offset >= tailStart
      ? tail.subarray(directory.offset - tailStart, directory.offset - tailStart + length)
      : await readFileRange(ref, filepath, {
          from: directory.offset,
          to: directory.offset + length - 1,
          size,
        });
  const entries = readEntries(bytes, MAX_ENTRIES);
  return { entries, count: directory.count, partial: entries.length < directory.count };
}

export function ZipView({
  fileRef,
  filepath,
  size,
}: {
  fileRef: QdnResourceRef;
  filepath: string | null;
  size: number | null;
}) {
  const [state, setState] = useState<
    | { phase: 'loading' }
    | { phase: 'ready'; listing: Listing | null }
    | { phase: 'error'; error: unknown }
  >({ phase: 'loading' });
  const [run, setRun] = useState(0);
  const [limit, setLimit] = useState(STEP);

  useEffect(() => {
    if (size === null) return;
    let stopped = false;
    setState({ phase: 'loading' });
    readListing(fileRef, filepath, size)
      .then((listing) => {
        if (!stopped) setState({ phase: 'ready', listing });
      })
      .catch((error: unknown) => {
        if (!stopped) setState({ phase: 'error', error });
      });
    return () => {
      stopped = true;
    };
  }, [fileRef, filepath, size, run]);

  if (size === null)
    return (
      <Typography color="text.secondary" role="status">
        Your node didn’t say how big this archive is, so its list of files can’t be read from its
        end.
      </Typography>
    );
  if (state.phase === 'loading')
    return <ListSkeleton count={3} label="Reading the archive’s list of files" />;
  if (state.phase === 'error')
    return (
      <ErrorState
        compact
        title="Couldn’t read the archive’s list of files."
        error={state.error}
        onRetry={() => setRun((value) => value + 1)}
      />
    );
  if (!state.listing)
    return (
      <Typography color="text.secondary" role="status">
        {NOT_A_ZIP}
      </Typography>
    );
  const { entries, count, partial } = state.listing;
  const files = entries.filter((entry) => !entry.directory).length;
  const shown = entries.slice(0, limit);
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
      <Typography variant="body2" color="text.secondary">
        {formatCount(count)} {count === 1 ? 'entry' : 'entries'} ({formatCount(files)}{' '}
        {files === 1 ? 'file' : 'files'}
        {partial ? ' in the part of its list read' : ''}). Nothing inside is opened here.
      </Typography>
      <Box
        component="ul"
        aria-label="Files in the archive"
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
        {shown.map((entry, i) => (
          <Box
            component="li"
            key={`${entry.name}-${i}`}
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 1.25,
              px: 1.5,
              py: 1,
              minWidth: 0,
            }}
          >
            <Box aria-hidden sx={{ color: 'text.secondary', display: 'flex', pt: 0.25 }}>
              {entry.directory ? (
                <FolderOutlinedIcon fontSize="small" />
              ) : (
                <InsertDriveFileOutlinedIcon fontSize="small" />
              )}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ overflowWrap: 'anywhere', fontSize: 15 }}>
                <bdi dir="auto">{entry.name}</bdi>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {entry.directory ? 'Folder' : sizeWords(entry.size)}
                {entry.modified ? ` · ${formatDateTime(entry.modified.getTime())}` : ''}
              </Typography>
            </Box>
            {entry.encrypted ? (
              <Box
                sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}
              >
                <LockOutlinedIcon fontSize="small" aria-hidden />
                <Typography variant="body2">Password</Typography>
              </Box>
            ) : null}
          </Box>
        ))}
      </Box>
      {entries.length > shown.length ? (
        <Button
          onClick={() => setLimit((value) => value + STEP)}
          sx={{ alignSelf: 'flex-start', minHeight: 44 }}
        >
          Show more ({formatCount(entries.length - shown.length)} more)
        </Button>
      ) : null}
    </Box>
  );
}
