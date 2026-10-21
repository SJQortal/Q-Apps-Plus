/**
 * Propose nomination (level 5+ MINTER members and Minter Admins; the words
 * are one constant, PROPOSE_NOMINATION in constants/words.ts):
 *
 * 1. Pick the candidate by name or address; their level, blocks minted and
 *    MINTER status show at once, with every reason they can't be nominated
 *    now (themselves, a member, banned, already nominated → add your support
 *    instead, admins already signing, already approved → they only need to
 *    join), before anything is written.
 * 2. Say why (20–600 characters) and add up to five qortal:// links.
 * 3. Read what happens next, then publish the record through Hub
 *    (PUBLISH_QDN_RESOURCE, fee stated). Done: the new nomination, and the
 *    app link to send the nominee so they can accept (the nomination's own
 *    page, /nominations/<address>).
 *
 * The submit bar is sticky inside the page (never 100vh). With the phone's
 * keyboard open the bottom bar steps aside and the submit bar sits right
 * above the keyboard, so its button stays in view while the reason is typed;
 * in a landscape frame it stays in the flow.
 */
import { useEffect, useId, useRef, useState, type Ref } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { Alert, Box, Button, IconButton, Skeleton, TextField, Typography } from '@mui/material';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import CheckOutlinedIcon from '@mui/icons-material/CheckOutlined';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import { FeeNote } from '../../components/common/FeeNote';
import { HubStepDialog } from '../../components/common/HubStepDialog';
import { AddressText, PersonChip } from '../../components/common/Person';
import { Card, Section } from '../../components/common/Section';
import { EmptyState, ErrorState, HeroSkeleton } from '../../components/common/states';
import { BOTTOM_NAV_HEIGHT } from '../../components/layout/BottomNav';
import { useBottomNavShown } from '../../components/layout/useBottomNav';
import { BOTTOM_BAR_VAR, usePublishOverlay } from '../../hooks/useOverlayPadding';
import { PageBody } from '../../components/layout/PageBody';
import { PageHeader } from '../../components/layout/PageHeader';
import { NominationCard } from '../../components/nomination/NominationCard';
import { SupportDialog } from '../../components/nomination/SupportDialog';
import { readable } from '../../utils/readable';
import { focusElement } from '../../utils/focus';
import { isAddress } from '../../data/accounts';
import type { ChainNow } from '../../data/chain';
import type { Nomination } from '../../data/nominations';
import { invalidate } from '../../data/query';
import {
  LINKS_MAX,
  REASON_MAX,
  REASON_MIN,
  isQortalLink,
  nominationIdentifier,
  nominationInputProblems,
} from '../../data/records';
import { headerFill } from '../../hub-theme';
import { useAdmins, useChainNow, useGroupInfo, useMyStatus } from '../../hooks/useData';
import { useDisplayName } from '../../hooks/useDisplayName';
import { usePhoneLayout } from '../../hooks/usePhoneLayout';
import { useQuery } from '../../hooks/useQuery';
import { getAdmins } from '../../data/group';
import { appParam } from '../../routes/hubLocation';
import { PROPOSE_NOMINATION, proposeNominationFor } from '../../constants/words';
import { decisionsViewPath, nominationPath, personPath } from '../../routes/paths';
import { NOMINEE_BLOCK_TEXT, type NomineeBlock } from '../../rules/nomination';
import type { MyStatus } from '../../rules/status';
import { approvalsNeeded, describeThreshold } from '../../rules/threshold';
import { signIn, signerOf, useSession } from '../../state/session';
import { formatCount, plural } from '../../utils/format';
import { useLandscapeFrame } from '../../utils/hubFrame';
import { appLink, copyText } from '../../utils/links';
import { publishNomination } from '../../writes/flows';
import { AdminNoteField } from '../../components/decision/AdminNoteField';
import { adminNoteFollowUp } from '../../components/decision/adminNoteStep';
import { followUpProblem } from '../decisions/decisionUi';
import { CandidatePicker, type PickedCandidate } from './CandidatePicker';
import { CANDIDATE_KEY, candidateBlock, loadCandidate, type Candidate } from './candidate';
import { isStillOpenForSupport } from './filters';
import { MarkedName } from '../../components/common/MarkedName';
import { withMarkedName } from '../../components/common/markedText';
import { APP_NAME } from '../../constants/plus';

export default function NominatePage() {
  const session = useSession();
  const { status, isError, error, refetch } = useMyStatus();

  let body;
  if (session.status === 'outside') {
    body = (
      <EmptyState
        title={`Open ${APP_NAME} in Qortal Hub or GO`}
        description="A nomination is published under your Qortal name, so it needs Hub."
      />
    );
  } else if (session.status === 'signedOut' || session.status === 'error') {
    body = (
      <EmptyState
        title="Sign in to propose a nomination"
        description="MINTER members at level 5 or above, and Minter Admins, can propose a nomination."
        actionLabel="Sign in"
        onAction={() => void signIn()}
      />
    );
  } else if (!status && isError) {
    body = (
      <ErrorState
        title="Couldn’t check your account."
        error={error}
        onRetry={() => void refetch()}
      />
    );
  } else if (!status || session.status !== 'ready') {
    body = <HeroSkeleton />;
  } else if (!status.canNominate) {
    body = <NotEligible status={status} />;
  } else {
    body = <NominateForm me={session.address} status={status} />;
  }

  return (
    <>
      <PageHeader
        title={PROPOSE_NOMINATION}
        subtitle="Pick the person, say why, add links."
        back={decisionsViewPath('nominations')}
      />
      <PageBody $maxWidth={680}>{body}</PageBody>
    </>
  );
}

function NotEligible({ status }: { status: MyStatus }) {
  const toLevel5 = status.isMember && status.level < 5 ? status.progress.blocksToTarget : 0;
  return (
    <Card sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography component="h2" sx={{ fontSize: 18, fontWeight: 700 }}>
        You can’t propose a nomination yet
      </Typography>
      <Typography>{status.nominateBlock}</Typography>
      {toLevel5 > 0 ? (
        <Typography variant="body2" color="text.secondary">
          You have {formatCount(status.blocksMinted)} blocks minted; {formatCount(toLevel5)} more
          take you to level 5.
        </Typography>
      ) : null}
      {status.kind === 'nominated' ? (
        <Typography variant="body2" color="text.secondary">
          You have a nomination of your own: see it in Decisions.
        </Typography>
      ) : null}
      <Box>
        <Button
          component={RouterLink}
          to={decisionsViewPath('nominations')}
          variant="outlined"
          sx={{ minHeight: 44 }}
        >
          See open nominations
        </Button>
      </Box>
    </Card>
  );
}

interface Published {
  preview: Nomination;
}

function NominateForm({ me, status }: { me: string; status: MyStatus }) {
  const session = useSession();
  const [params, setParams] = useSearchParams();
  const who = appParam(params, 'who');
  const [picked, setPicked] = useState<PickedCandidate | null>(() =>
    who && isAddress(who) ? { address: who, name: null } : null
  );
  // Follow ?who= when another screen links here while this one is open.
  const [seenWho, setSeenWho] = useState(who);
  if (who !== seenWho) {
    setSeenWho(who);
    if (who && isAddress(who) && who !== picked?.address) setPicked({ address: who, name: null });
  }
  const [reason, setReason] = useState('');
  const [links, setLinks] = useState<string[]>([]);
  // A Minter Admin's note for the Minter Admins (encrypted to them), under the nominee's address.
  const [adminNote, setAdminNote] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [support, setSupport] = useState<{ open: boolean } | null>(null);
  const [published, setPublished] = useState<Published | null>(null);
  // Pressing the button with a problem moves focus to it (its error is read with it).
  const pickerRef = useRef<HTMLInputElement | null>(null);
  const reasonRef = useRef<HTMLInputElement | null>(null);
  const linkRefs = useRef<Array<HTMLInputElement | null>>([]);
  // Picking someone replaces the picker with their card, and Change the other way
  // round: focus follows, so it never falls to the page.
  const summaryRef = useRef<HTMLDivElement | null>(null);
  // Once published, the form (and the button that opened the dialog) is gone: focus goes to the news.
  const doneTitleId = useId();
  const focusNext = useRef<'summary' | 'picker' | null>(null);
  useEffect(() => {
    const next = focusNext.current;
    focusNext.current = null;
    if (next === 'picker') pickerRef.current?.focus();
    else if (next === 'summary' && summaryRef.current) focusElement(summaryRef.current);
  }, [picked, published]);
  // Add a link: focus to its new field. Remove one: to the field now in its place
  // (or the one before, or Add a link), not to the page with the button that went.
  const addLinkRef = useRef<HTMLButtonElement | null>(null);
  const linkFocus = useRef<number | null>(null);
  useEffect(() => {
    const at = linkFocus.current;
    linkFocus.current = null;
    if (at === null) return;
    const field = linkRefs.current[Math.min(at, links.length - 1)];
    if (field && links.length) field.focus();
    else addLinkRef.current?.focus();
  }, [links]);
  // The sticky submit bar's height is kept clear for focus (not in landscape, where it isn't sticky).
  const [submitBar, setSubmitBar] = useState<HTMLElement | null>(null);

  const chainNow = useChainNow().data;
  const group = useGroupInfo().data;
  const phone = usePhoneLayout();
  const landscape = useLandscapeFrame();
  const navShown = useBottomNavShown();
  usePublishOverlay(submitBar, BOTTOM_BAR_VAR, { enabled: !landscape && !published });

  const candidate = useQuery(picked ? `${CANDIDATE_KEY}${picked.address}` : null, (force) =>
    loadCandidate((picked as PickedCandidate).address, { force })
  );
  const info = candidate.data?.address === picked?.address ? candidate.data : undefined;
  const block: NomineeBlock | null = !picked
    ? null
    : picked.address === me
      ? 'self'
      : info
        ? candidateBlock(info, me)
        : null;
  const nomineeName = info?.name ?? picked?.name ?? null;
  const shownName = useDisplayName(picked?.address ?? me, picked ? nomineeName : null).label;

  const cleanLinks = links.map((l) => l.trim()).filter(Boolean);
  const problems = nominationInputProblems({
    nomineeAddress: picked?.address ?? '',
    reason,
    links: cleanLinks,
  });
  const reasonLength = reason.trim().length;
  const signer = signerOf(session);
  const myName = status.name ?? signer?.name ?? '';
  const publishSigner = signer && myName ? { ...signer, name: myName } : null;
  const noteFollowUp =
    status.isAdmin && publishSigner
      ? adminNoteFollowUp(publishSigner, adminNote, (nominee) => nominee)
      : null;
  const admins = useQuery(status.isAdmin ? 'group:admins' : null, (force) => getAdmins({ force }));

  const choose = (next: PickedCandidate | null) => {
    setPicked(next);
    setParams(
      (prev) => {
        const out = new URLSearchParams(prev);
        if (next) out.set('who', next.address);
        else out.delete('who');
        return out;
      },
      { replace: true }
    );
  };

  const restart = () => {
    focusNext.current = 'picker';
    setPublished(null);
    setReason('');
    setLinks([]);
    setAdminNote('');
    setAttempted(false);
    choose(null);
  };

  let hint: string;
  if (!picked) hint = 'Pick someone first.';
  else if (!info && candidate.isError) hint = `Couldn’t check ${shownName}. Try again.`;
  else if (!info) hint = `Checking ${shownName}…`;
  else if (problems.length) hint = problems[0];
  else hint = 'Ready to publish.';
  const ready = Boolean(picked && info && !block && problems.length === 0 && publishSigner);

  const submit = () => {
    setAttempted(true);
    if (ready) {
      setDialogOpen(true);
      return;
    }
    const badLink = links.findIndex((l) => l.trim() !== '' && !isQortalLink(l.trim()));
    const target = !picked
      ? pickerRef.current
      : reasonLength < REASON_MIN
        ? reasonRef.current
        : badLink >= 0
          ? linkRefs.current[badLink]
          : null;
    target?.focus();
  };

  const form = (
    <>
      <Section title="Who" id="who">
        {picked ? (
          <CandidateSummary
            picked={picked}
            info={info}
            loading={candidate.isLoading || (!info && candidate.fetching)}
            error={!info && candidate.isError ? candidate.error : null}
            onRetry={() => void candidate.refetch()}
            block={block}
            me={me}
            canSupport={Boolean(publishSigner)}
            onChange={() => {
              focusNext.current = 'picker';
              choose(null);
            }}
            cardRef={summaryRef}
            onSupport={() => setSupport({ open: true })}
          />
        ) : (
          <CandidatePicker
            inputRef={pickerRef}
            onPick={(next) => {
              focusNext.current = 'summary';
              choose(next);
            }}
            initialError={
              who && !isAddress(who)
                ? 'The link didn’t hold a valid Qortal address. Pick someone here instead.'
                : ''
            }
          />
        )}
      </Section>

      {block ? null : (
        <>
          <Section title="Why" id="why">
            <TextField
              label="Why should they mint?"
              placeholder="What have they done for Qortal? Do they run a reliable node? How do you know them?"
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, REASON_MAX))}
              multiline
              minRows={4}
              maxRows={14}
              fullWidth
              inputRef={reasonRef}
              error={attempted && reasonLength < REASON_MIN}
              helperText={
                reasonLength < REASON_MIN
                  ? `${reasonLength} / ${REASON_MAX} · at least ${REASON_MIN} characters`
                  : `${reasonLength} / ${REASON_MAX}`
              }
              slotProps={{ htmlInput: { maxLength: REASON_MAX } }}
            />
          </Section>

          <Section title="Links (optional)" id="links">
            <Typography variant="body2" color="text.secondary" sx={{ px: 0.5 }}>
              Point the Minter Admins to their work on Qortal: a channel, a website, an app. Links
              must start with qortal://, because web links can’t open inside Qortal.
            </Typography>
            {links.map((link, i) => {
              const bad = link.trim() !== '' && !isQortalLink(link.trim());
              return (
                <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                  <TextField
                    inputRef={(el: HTMLInputElement | null) => {
                      linkRefs.current[i] = el;
                    }}
                    label={`Link ${i + 1}`}
                    placeholder="qortal://APP/Q-Tube/channel/…"
                    value={link}
                    onChange={(e) =>
                      setLinks((all) => all.map((l, j) => (j === i ? e.target.value : l)))
                    }
                    fullWidth
                    error={bad}
                    helperText={
                      bad ? 'Start with qortal://. Web links can’t open inside Qortal.' : undefined
                    }
                    slotProps={{
                      htmlInput: {
                        inputMode: 'url',
                        autoCapitalize: 'none',
                        autoCorrect: 'off',
                        spellCheck: false,
                      },
                    }}
                  />
                  <IconButton
                    aria-label={`Remove link ${i + 1}`}
                    onClick={() => {
                      linkFocus.current = i;
                      setLinks((all) => all.filter((_, j) => j !== i));
                    }}
                    sx={{ width: 44, height: 44, mt: 0.5 }}
                  >
                    <DeleteOutlineOutlinedIcon />
                  </IconButton>
                </Box>
              );
            })}
            <Box>
              <Button
                startIcon={<AddOutlinedIcon />}
                ref={addLinkRef}
                onClick={() => {
                  linkFocus.current = links.length;
                  setLinks((all) => [...all, '']);
                }}
                disabled={links.length >= LINKS_MAX}
                sx={{ minHeight: 44 }}
              >
                {links.length >= LINKS_MAX ? `Up to ${LINKS_MAX} links` : 'Add a link'}
              </Button>
            </Box>
          </Section>

          {status.isAdmin ? (
            <Section title="For the Minter Admins (optional)" id="admin-note">
              <Typography variant="body2" color="text.secondary" sx={{ px: 0.5 }}>
                Anything only the Minter Admins should read: it is encrypted to them, and shows
                under your reason for them alone.
              </Typography>
              <AdminNoteField
                value={adminNote}
                onChange={setAdminNote}
                name={publishSigner?.name ?? null}
                admins={admins.data?.signers.length ?? 0}
              />
            </Section>
          ) : null}

          <WhatHappensNext name={picked ? shownName : 'they'} named={Boolean(picked)} />

          <Box
            ref={setSubmitBar}
            sx={{
              position: landscape ? 'static' : 'sticky',
              bottom: navShown ? `calc(${BOTTOM_NAV_HEIGHT}px + var(--qp-safe-bottom))` : 0,
              zIndex: 2,
              mx: { xs: -1.5, sm: -2 },
              px: { xs: 1.5, sm: 2 },
              py: { xs: 1, sm: 1.5 },
              bgcolor: (theme) => headerFill(theme),
              backdropFilter: 'blur(12px)',
              borderTop: 1,
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
            }}
          >
            <Box sx={{ flex: '1 1 auto', minWidth: 0 }}>
              <Typography
                variant="body2"
                role="status"
                color={attempted && !ready ? 'error' : 'text.secondary'}
              >
                {/* Changes on a failed press, so it is announced, not only recoloured. */}
                {attempted && !ready ? `Can’t publish yet: ${hint}` : hint}
              </Typography>
              {phone ? null : <FeeNote txType="ARBITRARY" prefix="QDN publish fee" />}
            </Box>
            <Button
              variant="contained"
              size="large"
              onClick={submit}
              disabled={Boolean(picked && !info)}
              sx={{ minHeight: 48, flexShrink: 0, maxWidth: '60%' }}
            >
              <Box
                component="span"
                sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {picked && !phone ? proposeNominationFor(shownName) : PROPOSE_NOMINATION}
              </Box>
            </Button>
          </Box>
        </>
      )}
    </>
  );

  return (
    <>
      {published ? (
        <Done
          published={published}
          now={chainNow}
          nominee={published.preview.nominee}
          name={shownName}
          onAgain={restart}
          titleId={doneTitleId}
        />
      ) : (
        form
      )}

      <HubStepDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        returnFocus={() => document.getElementById(doneTitleId)}
        title="Publish your nomination"
        intro={
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography>
              You’re nominating{' '}
              <strong>
                <MarkedName name={shownName} />
              </strong>{' '}
              for MINTER.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Your reason
              {cleanLinks.length ? ` and ${plural(cleanLinks.length, 'link')}` : ''} go into a small
              public record under your name, {myName}, on QDN. Anyone can read it, and the Minter
              Admins see it with the nomination.
            </Typography>
            {noteFollowUp ? (
              <Typography variant="body2" color="text.secondary">
                Your note for the Minter Admins follows as a second step, encrypted to them: only
                they can read it.
              </Typography>
            ) : null}
          </Box>
        }
        steps={[
          {
            action: 'PUBLISH_QDN_RESOURCE',
            title: 'Publish your nomination',
            feeTxType: 'ARBITRARY',
          },
          ...(noteFollowUp ? [noteFollowUp.step] : []),
        ]}
        run={async (report) => {
          if (!publishSigner || !picked) {
            return { outcome: { status: 'blocked', reason: 'Sign in to Hub first.' } };
          }
          const outcome = await publishNomination(
            publishSigner,
            {
              nomineeAddress: picked.address,
              nomineeName,
              reason,
              links: cleanLinks,
            },
            (stage) => report(0, stage)
          );
          if (outcome.status !== 'sent' || !noteFollowUp) return { outcome };
          // The note, once the nomination is sent; its failure never undoes the nomination.
          const extra = await noteFollowUp.run(picked.address, (stage) => report(1, stage));
          if (extra.status === 'sent') return { outcome };
          return {
            outcome,
            message: (
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                {noteFollowUp.step.title} didn’t go through: {followUpProblem(extra)} Your
                nomination is in. You can still add the note from its card.
              </Typography>
            ),
          };
        }}
        successTitle="Nomination published"
        successText={
          <Typography variant="body2">
            It shows on the Nominations page once QDN has it, usually within a minute or two.
          </Typography>
        }
        onSuccess={() => {
          invalidate(CANDIDATE_KEY);
          if (!picked || !publishSigner) return;
          const at = chainNow?.timestamp ?? Date.now();
          setPublished({
            preview: {
              nominee: picked.address,
              nomineeName,
              source: 'qdn',
              nomination: {
                publisher: {
                  name: publishSigner.name,
                  address: me,
                  isAdmin: status.isAdmin,
                  level: status.level,
                },
                record: {
                  v: 1,
                  nomineeAddress: picked.address,
                  nomineeName: nomineeName ?? undefined,
                  reason: reason.trim(),
                  links: cleanLinks,
                },
                publishedAt: at,
                identifier: nominationIdentifier(picked.address),
              },
              supporters: [],
              state: 'waiting',
              publishedAt: at,
              waitingEndsAt:
                chainNow && group ? at + group.maximumBlockDelay * chainNow.msPerBlock : null,
              decision: null,
              latestInvite: null,
              hasJoinRequest: Boolean(info?.hasJoinRequest),
              hasStoredInvite: false,
            },
          });
        }}
      />

      {support && picked ? (
        <SupportDialog
          open={support.open}
          nominee={picked.address}
          nomineeName={nomineeName}
          signer={publishSigner}
          onClose={() => setSupport({ open: false })}
          onSuccess={() => invalidate(CANDIDATE_KEY)}
        />
      ) : null}
    </>
  );
}

function CandidateSummary({
  picked,
  info,
  loading,
  error,
  onRetry,
  block,
  me,
  canSupport,
  onChange,
  onSupport,
  cardRef,
}: {
  picked: PickedCandidate;
  info: Candidate | undefined;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  block: NomineeBlock | null;
  me: string;
  canSupport: boolean;
  onChange: () => void;
  onSupport: () => void;
  /** The card, which takes focus once someone is picked. */
  cardRef?: Ref<HTMLDivElement>;
}) {
  const role = info
    ? info.isAdmin
      ? 'Minter Admin'
      : info.isMember
        ? 'In MINTER'
        : 'Not in MINTER'
    : null;
  return (
    <Card
      ref={cardRef}
      sx={(theme) => ({
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        outline: 'none',
        '&:focus-visible': { boxShadow: `0 0 0 2px ${theme.palette.primary.main}` },
      })}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <PersonChip
            address={picked.address}
            name={info ? info.name : (picked.name ?? undefined)}
            size={48}
            secondary={
              info ? (
                `Level ${info.level} · ${formatCount(info.blocksMinted)} blocks minted · ${role}`
              ) : loading ? (
                <Skeleton variant="text" width={220} />
              ) : null
            }
          />
          <AddressText address={picked.address} full />
        </Box>
        <Button onClick={onChange} sx={{ minHeight: 44, flexShrink: 0 }}>
          Change
        </Button>
      </Box>
      {error ? (
        <ErrorState compact title="Couldn’t check this account." error={error} onRetry={onRetry} />
      ) : null}
      {/* There from the start (empty while checking), so the check's answer is read out. */}
      <Box role="status" sx={{ '&:empty': { mt: -1.5 } }}>
        {block ? (
          <BlockNotice
            block={block}
            info={info}
            me={me}
            canSupport={canSupport}
            onSupport={onSupport}
          />
        ) : info ? (
          <Typography
            variant="body2"
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 0.75,
              color: readable('success'),
            }}
          >
            <CheckCircleOutlineOutlinedIcon aria-hidden sx={{ fontSize: 18, mt: '1px' }} />
            <span>
              Can be nominated.
              {info.hasJoinRequest
                ? ' They have already asked to join MINTER, so an approval makes them a member at once.'
                : ''}
            </span>
          </Typography>
        ) : null}
      </Box>
    </Card>
  );
}

function BlockNotice({
  block,
  info,
  me,
  canSupport,
  onSupport,
}: {
  block: NomineeBlock;
  info: Candidate | undefined;
  me: string;
  canSupport: boolean;
  onSupport: () => void;
}) {
  const open = info?.openNomination ?? null;
  const nominatedByMe = open?.nomination?.publisher.address === me;
  const supportedByMe = Boolean(open?.supporters.some((s) => s.publisher.address === me));
  const supportable =
    (block === 'open' || block === 'pending') && open && isStillOpenForSupport(open);
  const severity = block === 'banned' ? 'warning' : block === 'stored' ? 'success' : 'info';
  return (
    <Alert severity={severity} role="note">
      <Typography variant="body2">{NOMINEE_BLOCK_TEXT[block]}</Typography>
      {supportable && nominatedByMe ? (
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          You nominated them already.
        </Typography>
      ) : null}
      {supportable && !nominatedByMe && supportedByMe ? (
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          You already support this nomination.
        </Typography>
      ) : null}
      {block === 'stored' && info ? (
        <Box sx={{ mt: 1 }}>
          {/* Their Minter Profile: it offers Join now, with or without a nomination. */}
          <ShareLink
            path={personPath(info.address)}
            label="Send them this link so they can join:"
          />
        </Box>
      ) : null}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
        {supportable && !nominatedByMe && !supportedByMe && canSupport ? (
          <Button variant="contained" onClick={onSupport} sx={{ minHeight: 44 }}>
            Add your support
          </Button>
        ) : null}
        {block !== 'self' && info ? (
          <Button
            component={RouterLink}
            to={personPath(info.address)}
            variant="outlined"
            color="inherit"
            sx={{ minHeight: 44 }}
          >
            Open Minter Profile
          </Button>
        ) : null}
      </Box>
    </Alert>
  );
}

/** The process in four lines, with today's numbers (live block time and admin count). */
function WhatHappensNext({ name, named }: { name: string; named: boolean }) {
  const now = useChainNow().data;
  const group = useGroupInfo().data;
  const admins = useAdmins().data;
  const days =
    now && group
      ? ((group.maximumBlockDelay * now.msPerBlock) / 86_400_000).toFixed(1).replace(/\.0$/, '')
      : null;
  const span = days ? `about ${days} days` : 'about a week and a half';
  const needed =
    group && admins ? approvalsNeeded(group.approvalThreshold, admins.adminCount) : null;
  return (
    <Section title="What happens next" id="next">
      <Card>
        <Box
          component="ol"
          sx={{ m: 0, pl: 2.5, display: 'flex', flexDirection: 'column', gap: 1.25 }}
        >
          <li>
            <Typography variant="body2">
              <strong>{named ? withMarkedName(`${name} accepts.`, name) : 'They accept.'}</strong>{' '}
              In {APP_NAME} they press Accept, which sends their join request (
              <FeeNote txType="JOIN_GROUP" prefix="fee" />
              ), so an approval later makes them a member at once. You get a link to send them.
            </Typography>
          </li>
          <li>
            <Typography variant="body2">
              <strong>A Minter Admin approves first.</strong> That puts the nomination on chain and
              starts the clock: {span} to collect approvals. Until then it waits on the Nominations
              page for up to {span}.
            </Typography>
          </li>
          <li>
            <Typography variant="body2">
              <strong>The other Minter Admins approve, reject, or let it run out.</strong>{' '}
              {needed && group
                ? `It needs ${plural(needed, 'approval')} right now (${describeThreshold(group.approvalThreshold)}). `
                : ''}
              Once enough have approved it goes through automatically. If as many reject it, or time
              runs out, it ends and they can be nominated again.
            </Typography>
          </li>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          Nominating costs only <FeeNote txType="ARBITRARY" prefix="the QDN publish fee" />. Nothing
          else is sent or spent.
        </Typography>
      </Card>
    </Section>
  );
}

/** A link to send someone, with Copy link. `path` is the app path it opens. */
function ShareLink({ path, label }: { path: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const link = appLink(path);
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, minWidth: 0 }}>
      <Typography variant="body2">{label}</Typography>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          flexWrap: 'wrap',
          minWidth: 0,
        }}
      >
        <Typography
          component="code"
          variant="body2"
          sx={{
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            overflowWrap: 'anywhere',
            flex: '1 1 220px',
            minWidth: 0,
          }}
        >
          {link}
        </Typography>
        <Button
          variant="outlined"
          color="inherit"
          startIcon={copied ? <CheckOutlinedIcon /> : <ContentCopyOutlinedIcon />}
          onClick={async () => {
            if (await copyText(link)) {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }
          }}
          sx={{ minHeight: 44 }}
        >
          {copied ? 'Copied' : 'Copy link'}
        </Button>
      </Box>
    </Box>
  );
}

function Done({
  published,
  now,
  nominee,
  name,
  onAgain,
  titleId,
}: {
  published: Published;
  now: ChainNow | undefined;
  nominee: string;
  name: string;
  onAgain: () => void;
  /** The heading's id: focus comes here when the publish dialog closes. */
  titleId: string;
}) {
  return (
    <>
      <Card sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography
          component="h2"
          id={titleId}
          tabIndex={-1}
          sx={{ fontSize: 20, fontWeight: 700, '&:focus': { outline: 'none' } }}
        >
          Nomination published
        </Typography>
        <Typography variant="body2" color="text.secondary">
          It shows on the Nominations page once QDN has it, usually within a minute or two. The
          Minter Admins take it from there.
        </Typography>
      </Card>
      {now ? <NominationCard nomination={published.preview} now={now} /> : null}
      <Card sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography component="h2" sx={{ fontSize: 18, fontWeight: 700 }}>
          Let <MarkedName name={name} /> know
        </Typography>
        {published.preview.hasJoinRequest ? (
          <Typography variant="body2" color="text.secondary">
            They have already asked to join MINTER, so an approval makes them a member at once.
          </Typography>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Accepting sends their join request, so an approval makes them a member at once. Without
            it, they have to press Join now after the approval.
          </Typography>
        )}
        {/* The nomination's own page: the nominee finds Accept there. */}
        <ShareLink path={nominationPath(nominee)} label="Send them this link so they can accept:" />
      </Card>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        <Button
          component={RouterLink}
          to={decisionsViewPath('nominations')}
          variant="contained"
          sx={{ minHeight: 44 }}
        >
          See all nominations
        </Button>
        <Button variant="outlined" onClick={onAgain} sx={{ minHeight: 44 }}>
          {PROPOSE_NOMINATION} for someone else
        </Button>
      </Box>
    </>
  );
}
