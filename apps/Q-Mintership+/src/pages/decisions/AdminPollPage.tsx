/**
 * One Minter Admin poll (/decisions/polls/<id>): its shareable link, for
 * Minter Admins only. The card from Decisions, with its comments open; the
 * shell reports the path to Hub, so Hub's own Copy link gives the same link.
 * Anyone else reads "This is for Minter Admins only", and nothing is read
 * or decrypted for them.
 *
 * Reads: the admin list (shared), then the polls' shared read (as on
 * Decisions); the poll is found there by its id.
 */
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CopyLinkButton } from '../../components/common/CopyLinkButton';
import { Section } from '../../components/common/Section';
import { CardSkeleton, EmptyState, ErrorState } from '../../components/common/states';
import { PageBody } from '../../components/layout/PageBody';
import { PageHeader } from '../../components/layout/PageHeader';
import { isPollId } from '../../data/adminPollRecords';
import { useAdmins } from '../../hooks/useData';
import { useNow } from '../../hooks/useNow';
import { PATHS, adminPollPath } from '../../routes/paths';
import { signIn, useSession } from '../../state/session';
import type { PollAuthor } from '../../writes/adminPolls';
import { AdminPollCard } from './AdminPollCard';
import { PollWriteDialogs, type PollDialog } from './PollWriteDialogs';
import { ADMINS_ONLY, HUB_DID_NOT_DECRYPT, myVoteView } from './adminPollUi';
import { useAdminPolls } from './useAdminPolls';

export default function AdminPollPage() {
  const { id: param = '' } = useParams();
  const id = param.trim();
  const session = useSession();
  const admins = useAdmins();
  const navigate = useNavigate();
  const ready = session.status === 'ready';
  const isAdmin = Boolean(ready && admins.data?.signers.some((a) => a.member === session.address));
  const author: PollAuthor | null = useMemo(
    () =>
      ready ? { address: session.address, publicKey: session.publicKey, name: session.name } : null,
    [ready, session.address, session.publicKey, session.name]
  );
  const { query, views, pending, signers, undecrypted, retry } = useAdminPolls(
    author?.address ?? null,
    isAdmin && isPollId(id)
  );
  const now = useNow(60_000);
  const [dialog, setDialog] = useState<PollDialog | null>(null);
  const view = views?.find((v) => v.id === id) ?? null;
  const toDecisions = () => navigate(PATHS.decisions);

  let content;
  if (session.status === 'idle' || session.status === 'loading' || (ready && !admins.data)) {
    content =
      ready && admins.isError ? (
        <ErrorState
          title="Couldn’t check who the Minter Admins are."
          error={admins.error}
          onRetry={() => void admins.refetch()}
        />
      ) : (
        <CardSkeleton lines={4} />
      );
  } else if (!isAdmin || !author) {
    content = (
      <EmptyState
        title={ADMINS_ONLY}
        description={
          ready
            ? 'Minter Admin polls are encrypted to the Minter Admins: only they can read them.'
            : 'Minter Admin polls are encrypted to the Minter Admins. Sign in with a Minter Admin account to read this one.'
        }
        actionLabel={ready || session.status === 'outside' ? 'All decisions' : 'Sign in'}
        onAction={ready || session.status === 'outside' ? toDecisions : () => void signIn()}
      />
    );
  } else if (!isPollId(id)) {
    content = (
      <EmptyState
        title="No Minter Admin poll with this link"
        description="The link may be cut short: a poll’s link ends with 8 letters or digits."
        actionLabel="All decisions"
        onAction={toDecisions}
      />
    );
  } else if (!views && query.isError) {
    content = (
      <ErrorState
        title="Couldn’t load the Minter Admin polls."
        error={query.error}
        onRetry={() => void query.refetch()}
      />
    );
  } else if (!views) {
    content = <CardSkeleton lines={5} />;
  } else if (!view && undecrypted) {
    // Not "isn't here": Hub didn't decrypt some polls this time.
    content = (
      <ErrorState
        title="Couldn’t decrypt the Minter Admin polls."
        error={HUB_DID_NOT_DECRYPT}
        onRetry={retry}
      />
    );
  } else if (!view) {
    content = (
      <EmptyState
        title="This poll isn’t here"
        description="It isn’t among the Minter Admin polls of the last two months that you can read. If it wasn’t encrypted to you, a Minter Admin who can read it can share it with you."
        actionLabel="All decisions"
        onAction={toDecisions}
      />
    );
  } else {
    content = (
      <Section title="Minter Admin poll" id="admin-poll">
        <AdminPollCard
          view={view}
          now={now}
          author={author}
          admins={signers.length}
          pendingVote={pending.votes[view.id]}
          pendingShare={pending.shares[view.id]}
          onVote={(v, vote) =>
            setDialog({
              kind: 'vote',
              view: v,
              vote,
              changing: Boolean(myVoteView(v, pending.votes[v.id]).vote),
            })
          }
          onShare={(v) => setDialog({ kind: 'share', view: v })}
          commentsOpen
          copyLink={false}
        />
      </Section>
    );
  }

  return (
    <>
      <PageHeader
        title="Minter Admin poll"
        subtitle={view ? view.poll.question : 'For Minter Admins'}
        back={PATHS.decisions}
        actions={
          isAdmin && isPollId(id) ? (
            <CopyLinkButton path={adminPollPath(id)} what="this poll" />
          ) : null
        }
      />
      <PageBody>{content}</PageBody>
      {author ? (
        <PollWriteDialogs
          dialog={dialog}
          author={author}
          admins={signers.length}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </>
  );
}
