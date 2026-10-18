/**
 * The note for the Minter Admins on a decision or a nomination: what its
 * proposer (or nominator) wrote for the Minter Admins only, encrypted to
 * them (data/adminNotes.ts). Only a Minter Admin reads it and sees it: under
 * the public reason, in a frame headed "For the Minter Admins only", with
 * who wrote it. Its writer can edit it, and (with `addable`, while the
 * decision is open) add one when there is none.
 *
 * Reads, for Minter Admins only and once the card nears the screen (`near`):
 * the shared list of notes (one GET for every card), then this note's body
 * only when there is one (or the list can't tell). A note this device just
 * published shows at once, "publishing…", until QDN has it.
 */
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import NoteAddOutlinedIcon from '@mui/icons-material/NoteAddOutlined';
import {
  ADMIN_NOTES_INDEX_KEY,
  adminIndexCovers,
  adminNoteKey,
  loadAdminNote,
  loadAdminNoteIndex,
  noteRowsFor,
  type NoteTarget,
} from '../../data/adminNotes';
import { getAdmins } from '../../data/group';
import { useQuery } from '../../hooks/useQuery';
import { useViewerIsAdmin } from '../../hooks/useViewerIsAdmin';
import { setPendingAdminNote, usePendingAdminNote } from '../../state/adminNotes';
import { useSession } from '../../state/session';
import { formatDateTime, formatRelative } from '../../utils/format';
import { FramedText } from '../common/FramedText';
import { PersonInline } from '../common/Person';
import type { AdminNoteRequest } from './AdminNoteDialog';

const AdminNoteDialog = lazy(() =>
  import('./AdminNoteDialog').then((m) => ({ default: m.AdminNoteDialog }))
);

/** Hub didn't decrypt it (its wallet locked, or busy): the same advice as for polls. */
const NOT_DECRYPTED =
  'Hub didn’t decrypt it just now. If Hub is locked, unlock it, then try again.';

function Heading() {
  return (
    <Typography
      variant="body2"
      sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontWeight: 700 }}
    >
      <LockOutlinedIcon aria-hidden sx={{ fontSize: 18 }} />
      For the Minter Admins only
    </Typography>
  );
}

export function AdminNote({
  target,
  near,
  label,
  addable = false,
}: {
  target: NoteTarget | null;
  /** The card is near the screen: only then is anything read. */
  near: boolean;
  /** What the note is on, for its dialog: "Remove a member: Kai Target". */
  label: string;
  /** Its writer may add one (the decision or nomination is still open). */
  addable?: boolean;
}) {
  const isAdmin = useViewerIsAdmin();
  const session = useSession();
  const viewer = session.address;
  const enabled = isAdmin && Boolean(target) && near;
  const index = useQuery(enabled ? ADMIN_NOTES_INDEX_KEY : null, (force) =>
    loadAdminNoteIndex({ force })
  );
  const since = target
    ? target.spans.reduce<number | null>(
        (min, s) => (s.since === null || min === null ? null : Math.min(min, s.since)),
        Number.POSITIVE_INFINITY
      )
    : null;
  const covered = index.data ? adminIndexCovers(index.data, since) : false;
  const listed = Boolean(index.data && target && noteRowsFor(target, index.data.rows).length);
  // Its own read only when the shared list has one, or can't tell.
  const wanted = enabled && (Boolean(index.data) || index.isError) && (!covered || listed);
  const note = useQuery(
    wanted && target ? adminNoteKey(viewer, target) : null,
    (force) => loadAdminNote(viewer, target as NoteTarget, { force }),
    { refreshMs: 3 * 60_000 }
  );
  const pending = usePendingAdminNote(
    target?.spans.map((s) => s.key) ?? [],
    target?.spans.map((s) => s.author) ?? []
  );
  const read = note.data;
  // QDN has the version this device published: no "publishing…" any more.
  useEffect(() => {
    if (pending && read?.status === 'ok' && read.text === pending.text)
      setPendingAdminNote(null, pending.ref);
  }, [pending, read]);

  const own = target?.spans.find((s) => s.author === viewer) ?? null;
  const admins = useQuery(isAdmin && own ? 'group:admins' : null, (force) => getAdmins({ force }));
  const [request, setRequest] = useState<AdminNoteRequest | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  if (!isAdmin || !target) return null;

  const writer =
    own && session.status === 'ready'
      ? { address: session.address, publicKey: session.publicKey, name: session.name }
      : null;
  const dialog =
    request && writer ? (
      <Suspense fallback={null}>
        <AdminNoteDialog
          request={request}
          writer={writer}
          admins={admins.data?.signers.length ?? 0}
          onClose={() => setRequest(null)}
          returnFocus={() => opener.current}
        />
      </Suspense>
    ) : null;

  const shownPending = pending && !(read?.status === 'ok' && read.text === pending.text);
  if (shownPending || read?.status === 'ok') {
    const text = shownPending ? pending.text : read?.status === 'ok' ? read.text : '';
    const name = shownPending ? pending.name : read?.status === 'ok' ? read.name : '';
    const author = shownPending ? pending.author : read?.status === 'ok' ? read.author : '';
    const at = shownPending ? pending.at : read?.status === 'ok' ? read.at : 0;
    const edited = !shownPending && read?.status === 'ok' && read.edited;
    const mine = writer !== null && author === viewer;
    const key = shownPending ? pending.key : read?.status === 'ok' ? read.key : '';
    return (
      <>
        <FramedText
          text={text}
          moreLabel="Show the whole note"
          heading={<Heading />}
          footer={
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                columnGap: 1,
                mt: -0.5,
              }}
            >
              <Typography component="div" variant="body2" color="text.secondary">
                By <PersonInline address={author} name={name} />
                {' · '}
                {shownPending ? (
                  'publishing…'
                ) : (
                  <time dateTime={new Date(at).toISOString()} title={formatDateTime(at)}>
                    {formatRelative(at)}
                  </time>
                )}
                {edited ? ' · edited' : ''}
              </Typography>
              {mine && !shownPending ? (
                <Button
                  ref={opener}
                  size="small"
                  startIcon={<EditOutlinedIcon />}
                  onClick={() => setRequest({ noteKey: key, label, text })}
                  aria-label={`Edit your note for the Minter Admins: ${label}`}
                  sx={{ minHeight: 44, ml: 'auto' }}
                >
                  Edit
                </Button>
              ) : null}
            </Box>
          }
        />
        {dialog}
      </>
    );
  }
  if (read?.status === 'locked')
    return (
      <Typography variant="body2" color="text.secondary">
        The proposer added a note for the Minter Admins before you could read it: it wasn’t
        encrypted to you.
      </Typography>
    );
  if (read?.status === 'unavailable')
    return (
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
        <Typography variant="body2" color="text.secondary">
          {read.hub
            ? `There is a note for the Minter Admins. ${NOT_DECRYPTED}`
            : 'There is a note for the Minter Admins, but it isn’t on your node yet.'}
        </Typography>
        <Button size="small" onClick={() => void note.refetch()} sx={{ minHeight: 44 }}>
          Try again
        </Button>
      </Box>
    );
  // None: its writer may add one while it is open.
  if (own && addable && writer && (read?.status === 'none' || (covered && !listed)))
    return (
      <>
        <Box>
          <Button
            ref={opener}
            size="small"
            startIcon={<NoteAddOutlinedIcon />}
            onClick={() => setRequest({ noteKey: own.key, label })}
            aria-label={`Add a note for the Minter Admins: ${label}`}
            sx={{ minHeight: 44, ml: -0.5 }}
          >
            Add a note for the Minter Admins
          </Button>
        </Box>
        {dialog}
      </>
    );
  return null;
}
