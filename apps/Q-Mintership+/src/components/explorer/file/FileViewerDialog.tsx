/**
 * Open File's viewer (Simon, 2026-10-17): the public QDN resource a
 * transaction published, shown in the app, whatever kind of file it is.
 * Full screen on phones and in any frame under 500 px tall (a phone held
 * sideways), tall on wider screens; loaded on demand.
 *
 * At the top, what it is: its publisher's title and description, the
 * service, who published it, its size and kind, and, when the transaction
 * published an earlier version, that the latest is what shows (Core serves
 * the latest), with a link to that version's transaction. Then:
 *
 * - while the node gets it (useQdnReady): its parts and a bar, stalls
 *   said; a big file (50 MB and over) only on "Get it";
 * - a resource of several files: their list (FileList), each opening here;
 * - a file: by its kind (useFileView): a picture to zoom, a video or a
 *   sound, a PDF's pages, JSON laid out in colour, a table, text, a ZIP's
 *   list of files, or what it is with its first bytes in hex.
 *
 * Save File keeps it through Hub's save prompt (saveQdnFile.ts); on the
 * list of a resource's files it keeps them all, packed into one ZIP. Open
 * in Qortal opens an app or a website in a new Hub tab. Pressed outside
 * (`saveWhenReady`), Save File opens this and saves once the file is
 * ready. Nothing here signs or publishes; HTML and SVG never run.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, LinearProgress, Link, Typography } from '@mui/material';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import LaunchOutlinedIcon from '@mui/icons-material/LaunchOutlined';
import SaveAltOutlinedIcon from '@mui/icons-material/SaveAltOutlined';
import { ResponsiveDialog } from '../../common/ResponsiveDialog';
import { EmptyState, ErrorState, ListSkeleton } from '../../common/states';
import { NameWithAvatar } from '../NameWithAvatar';
import {
  getQdnLatest,
  getQdnMeta,
  qdnLatestKey,
  qdnMetaKey,
  QdnFileError,
  resourceKey,
  type QdnResourceRef,
} from '../../../data/explorer/qdnFile';
import { useQuery } from '../../../hooks/useQuery';
import { explorerTxPath } from '../../../routes/paths';
import {
  fileTypeWords,
  qortalLinkFor,
  saveFilename,
  TEXT_KINDS,
} from '../../../rules/explorer/qdnFiles';
import {
  bigFileLine,
  earlierVersionLine,
  fetchingLine,
  finalWords,
  STALLED_LINE,
} from '../../../rules/explorer/qdnFileWords';
import { sizeWords } from '../../../rules/explorer/txWords';
import { errorMessage } from '../../../utils/hubErrors';
import { openQortalLink } from '../../../utils/links';
import { useShortFrame } from '../../../utils/hubFrame';
import { useQdnReady } from './useQdnReady';
import { useFileView, type FileView } from './useFileView';
import { saveQdnFile, saveQdnFilesAsZip, zipNameOf, ZIP_ALL_MAX_BYTES } from './saveQdnFile';
import { FileList } from './views/FileList';
import { HexView } from './views/HexView';
import { ImageView } from './views/ImageView';
import { JsonView } from './views/JsonView';
import { MediaView } from './views/MediaView';
import { PdfView } from './views/PdfView';
import { TableView } from './views/TableView';
import { TextView } from './views/TextView';
import { ZipView } from './views/ZipView';

export interface FileViewerDialogProps {
  open: boolean;
  onClose: () => void;
  fileRef: QdnResourceRef;
  /** The transaction that published it (its version is checked against the latest). */
  signature: string;
  /** The publish's own size in bytes, for asking before a big file is fetched. */
  size: number | null;
  /** Save File was pressed: save once the file is ready. */
  saveWhenReady?: boolean;
}

type SaveState =
  'idle' | 'saving' | 'saved' | 'declined' | { packing: number; of: number } | { error: unknown };

/** What the file reads as, for a view of text. */
function decode(file: FileView): string {
  return new TextDecoder('utf-8').decode(file.head);
}

function FileBody({
  file,
  fileRef,
  filepath,
  title,
  publishedSize,
}: {
  file: FileView;
  fileRef: QdnResourceRef;
  filepath: string | null;
  title: string;
  /** The publish's own size, for a PDF's limit when the node didn't say the file's. */
  publishedSize: number | null;
}) {
  const text = useMemo(() => (TEXT_KINDS.has(file.kind) ? decode(file) : ''), [file]);
  const shared = { label: title, shown: file.head.length, size: file.size, more: file.more };
  switch (file.kind) {
    case 'image':
      return <ImageView src={file.url} alt={title} />;
    case 'video':
    case 'audio':
      return <MediaView src={file.url} kind={file.kind} label={title} />;
    case 'pdf':
      return (
        <PdfView
          fileRef={fileRef}
          filepath={filepath}
          size={file.size ?? publishedSize}
          title={title}
        />
      );
    case 'json':
      return <JsonView text={text} {...shared} />;
    case 'csv':
      return <TableView text={text} {...shared} />;
    case 'html':
      return (
        <TextView
          text={text}
          {...shared}
          note="The page’s source, as written. It isn’t run here."
        />
      );
    case 'text':
      return <TextView text={text} {...shared} />;
    case 'zip':
      return <ZipView fileRef={fileRef} filepath={filepath} size={file.size} />;
    default:
      return (
        <HexView
          head={file.head}
          size={file.size}
          typeWords={fileTypeWords(file.kind, file.mime)}
        />
      );
  }
}

export default function FileViewerDialog({
  open,
  onClose,
  fileRef,
  signature,
  size,
  saveWhenReady = false,
}: FileViewerDialogProps) {
  const key = resourceKey(fileRef);
  // One object per resource, so views keyed on it don't read again on every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ref = useMemo(() => fileRef, [key]);
  // A short frame (a phone held sideways) gives the file the whole frame.
  const short = useShortFrame();
  const meta = useQuery(open ? qdnMetaKey(ref) : null, (force) => getQdnMeta(ref, { force }));
  const latest = useQuery(open ? qdnLatestKey(ref) : null, (force) => getQdnLatest(ref, { force }));
  const ready = useQdnReady(ref, { size, enabled: open });
  const [picked, setPicked] = useState<string | null>(null);
  const [save, setSave] = useState<SaveState>('idle');
  const savedOnce = useRef(false);
  // Packing a ZIP stops when the viewer closes.
  const packing = useRef<AbortController | null>(null);

  const metaSettled = meta.data !== undefined || meta.isError;
  const files = meta.data?.files ?? null;
  const several = (files?.length ?? 0) > 1;
  const ownName = several ? picked : (files?.[0] ?? null);
  // One file in a folder of its own: Core picks a resource's only file only at its top.
  const filepath = several ? picked : ownName?.includes('/') ? ownName : null;
  const view = useFileView(ref, {
    filepath,
    filename: ownName,
    mimeType: several ? null : (meta.data?.mimeType ?? null),
    enabled: open && ready.phase === 'ready' && metaSettled && (!several || picked !== null),
  });
  const file = view.phase === 'ready' ? view.file : null;

  const title =
    ownName ??
    meta.data?.title ??
    (ref.identifier ? ref.identifier : `${ref.service} of ${ref.name}`);
  const link = qortalLinkFor(ref);
  const earlier = latest.data && latest.data.signature !== signature ? latest.data : null;
  // The list of a resource's files: Save File keeps them all in one ZIP,
  // unless its publish alone is past what can be packed in the page.
  const zipAll =
    several &&
    picked === null &&
    ready.phase === 'ready' &&
    !(size !== null && size > ZIP_ALL_MAX_BYTES);

  const runZip = async (list: readonly string[]) => {
    packing.current?.abort();
    const controller = new AbortController();
    packing.current = controller;
    setSave({ packing: 0, of: list.length });
    try {
      const result = await saveQdnFilesAsZip(ref, list, zipNameOf(ref), {
        signal: controller.signal,
        onProgress: (read) => {
          if (!controller.signal.aborted) setSave({ packing: read, of: list.length });
        },
      });
      if (!controller.signal.aborted) setSave(result);
    } catch (error) {
      if (!controller.signal.aborted) setSave({ error });
    } finally {
      if (packing.current === controller) packing.current = null;
    }
  };

  const runSave = async () => {
    if (zipAll && files) return runZip(files);
    if (!file) return;
    setSave('saving');
    try {
      const result = await saveQdnFile(ref, {
        filepath,
        filename: saveFilename({
          filename: ownName,
          identifier: ref.identifier,
          name: ref.name,
          mime: file.mime,
        }),
        mime: file.mime,
        size: file.size,
      });
      setSave(result);
    } catch (error) {
      setSave({ error });
    }
  };

  // Save File pressed outside: once each time it opens, when the file is ready.
  useEffect(() => {
    if (open) return;
    savedOnce.current = false;
    packing.current?.abort();
    packing.current = null;
    setSave('idle');
  }, [open]);
  useEffect(() => () => packing.current?.abort(), []);
  useEffect(() => {
    if (!open || !saveWhenReady || savedOnce.current || !(several ? zipAll : file)) return;
    savedOnce.current = true;
    void runSave();
    // runSave reads the current file.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, saveWhenReady, file, several, zipAll]);

  let body: React.ReactNode;
  if (ready.phase === 'checking') body = <ListSkeleton count={2} label="Checking your node" />;
  else if (ready.phase === 'confirm')
    body = (
      <EmptyState
        title="Get it from the network?"
        description={bigFileLine(size ?? 0)}
        actionLabel="Get it"
        onAction={() => ready.confirm()}
      />
    );
  else if (ready.phase === 'fetching')
    body = (
      <Box role="status" sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, py: 2 }}>
        <Typography sx={{ fontWeight: 600 }}>Getting the file to your node…</Typography>
        <LinearProgress
          variant={ready.status.percent !== null ? 'determinate' : 'indeterminate'}
          value={ready.status.percent ?? undefined}
          aria-label="How much of the file your node holds"
          sx={{ height: 6, borderRadius: 3 }}
        />
        <Typography color="text.secondary">{fetchingLine(ready.status)}</Typography>
        {ready.stalled ? (
          <Typography variant="body2" color="text.secondary">
            {STALLED_LINE}
          </Typography>
        ) : null}
      </Box>
    );
  else if (ready.phase === 'final') {
    const words = finalWords(ready.status.status);
    body = (
      <EmptyState
        title={words.title}
        description={words.description}
        actionLabel={ready.status.status === 'BUILD_FAILED' ? 'Try again' : undefined}
        onAction={() => ready.retry()}
      />
    );
  } else if (ready.phase === 'failed')
    body = (
      <ErrorState
        title={
          ready.gaveUp
            ? 'Your node hasn’t got the whole file after 10 minutes.'
            : 'Couldn’t ask your node about this file.'
        }
        error={ready.error ?? undefined}
        onRetry={() => ready.retry()}
      />
    );
  else if (!metaSettled) body = <ListSkeleton count={2} label="Reading what it holds" />;
  else if (several && picked === null)
    body = (
      <FileList files={files as string[]} savesAll={zipAll} onOpen={(next) => setPicked(next)} />
    );
  else if (view.phase === 'error') {
    const problem = view.error instanceof QdnFileError ? view.error.problem : null;
    body =
      problem === 'several' ? (
        <EmptyState
          title="It holds several files, and its publisher didn’t list them."
          description={
            link
              ? 'So they can’t be opened one by one here. Open in Qortal shows it as it runs.'
              : 'So they can’t be opened one by one here.'
          }
        />
      ) : (
        <ErrorState
          title={
            problem === 'notFound' ? 'Your node didn’t find the file.' : 'Couldn’t read the file.'
          }
          error={view.error}
          onRetry={() => view.retry()}
        />
      );
  } else if (!file) body = <ListSkeleton count={2} label="Reading the file" />;
  else
    body = (
      <FileBody
        key={`${key}/${filepath ?? ''}`}
        file={file}
        fileRef={ref}
        filepath={filepath}
        title={title}
        publishedSize={several ? null : size}
      />
    );

  const busy = save === 'saving' || (typeof save === 'object' && 'packing' in save);
  const saveWords =
    typeof save === 'object' && 'packing' in save
      ? `Packing ${save.packing} of ${save.of} files into one ZIP…`
      : save === 'saving'
        ? 'Saving…'
        : save === 'saved'
          ? 'Hub is saving it.'
          : save === 'declined'
            ? 'Not saved.'
            : typeof save === 'object' && 'error' in save
              ? `Couldn’t save it: ${errorMessage(save.error, 'something went wrong')}.`
              : '';

  const facts = [
    ref.service,
    file?.size !== null && file?.size !== undefined ? sizeWords(file.size) : null,
    file ? fileTypeWords(file.kind, file.mime) : null,
  ].filter(Boolean);

  return (
    <ResponsiveDialog
      open={open}
      onClose={onClose}
      title={<bdi dir="auto">{title}</bdi>}
      maxWidth="lg"
      tall
      fullScreen={short}
      actions={
        <>
          {link ? (
            <Button
              startIcon={<LaunchOutlinedIcon />}
              onClick={() => void openQortalLink(link)}
              sx={{ mr: 'auto' }}
            >
              Open in Qortal
            </Button>
          ) : null}
          <Button
            variant="contained"
            startIcon={<SaveAltOutlinedIcon />}
            disabled={!(file || zipAll) || busy}
            onClick={() => void runSave()}
          >
            {busy ? 'Saving…' : 'Save File'}
          </Button>
          <Button onClick={onClose}>Close</Button>
        </>
      }
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, minWidth: 0 }}>
        {/* In a short frame the file gets the room: who, what and how big only. */}
        {meta.data?.title && meta.data.title !== title && !short ? (
          <Typography sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>
            <bdi dir="auto">{meta.data.title}</bdi>
          </Typography>
        ) : null}
        {meta.data?.description && !short ? (
          <Typography
            color="text.secondary"
            sx={{
              overflowWrap: 'anywhere',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            <bdi dir="auto">{meta.data.description}</bdi>
          </Typography>
        ) : null}
        <Typography
          component="div"
          variant="body2"
          color="text.secondary"
          sx={{ overflowWrap: 'anywhere' }}
        >
          Published by <NameWithAvatar name={ref.name} size={18} />
          {facts.length ? ` · ${facts.join(' · ')}` : ''}
        </Typography>
        {earlier ? (
          <Typography variant="body2" color="text.secondary" role="note">
            {earlierVersionLine(earlier)}{' '}
            <Link component={RouterLink} to={explorerTxPath(earlier.signature)} onClick={onClose}>
              Open the latest version’s transaction
            </Link>
          </Typography>
        ) : null}
      </Box>
      {several && picked !== null ? (
        <Button
          startIcon={<ArrowBackOutlinedIcon />}
          onClick={() => {
            setPicked(null);
            setSave('idle');
          }}
          sx={{ alignSelf: 'flex-start', minHeight: 44 }}
        >
          All {files?.length} files
        </Button>
      ) : null}
      {body}
      <Typography
        role="status"
        variant="body2"
        color={typeof save === 'object' && 'error' in save ? 'error' : 'text.secondary'}
      >
        {saveWords}
      </Typography>
    </ResponsiveDialog>
  );
}
