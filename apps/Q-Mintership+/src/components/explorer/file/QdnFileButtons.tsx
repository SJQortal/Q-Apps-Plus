/**
 * Open File and Save File (Simon, 2026-10-17) on a QDN publish: in a
 * transaction row's details and on its own page. Only for a public
 * resource with a name (rules/explorer/qdnFiles.ts openableResource): an
 * encrypted one gets neither, and nothing about it is read.
 *
 * Both open the viewer (FileViewerDialog, its own chunk, loaded on the
 * first press): Open File to look at it, Save File to keep it, saved
 * through Hub's prompt as soon as the node has the file. Nothing is read
 * before a press.
 */
import { lazy, Suspense, useMemo, useState } from 'react';
import { Button } from '@mui/material';
import FileOpenOutlinedIcon from '@mui/icons-material/FileOpenOutlined';
import SaveAltOutlinedIcon from '@mui/icons-material/SaveAltOutlined';
import type { TxRow } from '../../../data/types';
import { openableResource } from '../../../rules/explorer/qdnFiles';

const FileViewerDialog = lazy(() => import('./FileViewerDialog'));

export const OPEN_FILE = 'Open File';
export const SAVE_FILE = 'Save File';

export function QdnFileButtons({ tx }: { tx: TxRow }) {
  const ref = useMemo(() => openableResource(tx), [tx]);
  const [open, setOpen] = useState<'view' | 'save' | null>(null);
  const [mounted, setMounted] = useState(false);
  // How it was last opened, kept while it closes, so its content doesn't jump.
  const [mode, setMode] = useState<'view' | 'save'>('view');
  if (!ref) return null;
  const show = (how: 'view' | 'save') => {
    setMounted(true);
    setMode(how);
    setOpen(how);
  };
  const size = typeof tx.size === 'number' && tx.size >= 0 ? tx.size : null;
  return (
    <>
      <Button
        variant="outlined"
        startIcon={<FileOpenOutlinedIcon />}
        onClick={() => show('view')}
        sx={{ minHeight: 44 }}
      >
        {OPEN_FILE}
      </Button>
      <Button
        variant="outlined"
        startIcon={<SaveAltOutlinedIcon />}
        onClick={() => show('save')}
        sx={{ minHeight: 44 }}
      >
        {SAVE_FILE}
      </Button>
      {mounted ? (
        <Suspense fallback={null}>
          <FileViewerDialog
            open={open !== null}
            onClose={() => setOpen(null)}
            fileRef={ref}
            signature={tx.signature}
            size={size}
            saveWhenReady={mode === 'save'}
          />
        </Suspense>
      ) : null}
    </>
  );
}
