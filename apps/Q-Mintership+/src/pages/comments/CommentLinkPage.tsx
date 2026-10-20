/**
 * `/comments/<name>/<identifier>`: one comment, opened where it was posted
 * (Simon, 2026-10-19: a notification "that there is a reply to your
 * comment"). Reply alerts and Home's replies link here; the page finds the
 * comment's decision or nomination (data/commentPlace.ts) and opens it in
 * place (no history entry), its comments going to this one. A decision too
 * old for the decisions read, or a link that isn't a comment's, says so.
 */
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../../components/layout/PageHeader';
import { PageBody } from '../../components/layout/PageBody';
import { EmptyState, ErrorState, CardSkeleton } from '../../components/common/states';
import { commentLinkState } from '../../components/comments/commentLinkState';
import { findCommentPlace } from '../../data/commentPlace';
import { useQuery } from '../../hooks/useQuery';
import { decisionPath, nominationPath, PATHS } from '../../routes/paths';

export default function CommentLinkPage() {
  const { identifier = '' } = useParams();
  const navigate = useNavigate();
  const place = useQuery(identifier ? `commentplace:${identifier}` : null, (force) =>
    findCommentPlace(identifier, { force })
  );
  const found = place.data;
  if (found?.kind === 'nomination' || found?.kind === 'decision')
    return (
      <Navigate
        replace
        to={
          found.kind === 'nomination'
            ? nominationPath(found.address)
            : decisionPath(found.signature)
        }
        state={commentLinkState(identifier)}
      />
    );

  let content;
  if (!identifier || found?.kind === 'invalid')
    content = (
      <EmptyState
        title="That isn't a link to a comment."
        description="Comment links open a comment on a decision or a nomination."
        actionLabel="Open Decisions"
        onAction={() => navigate(PATHS.decisions)}
      />
    );
  else if (found?.kind === 'unknown')
    content = (
      <EmptyState
        title="Couldn't find the decision this comment is on."
        description="It is older than the decisions your node lists here. Its comments are on the decision's own page."
        actionLabel="Open Decisions"
        onAction={() => navigate(PATHS.decisions)}
      />
    );
  else if (place.isError)
    content = (
      <ErrorState
        title="Couldn't look for this comment."
        error={place.error}
        onRetry={() => void place.refetch()}
      />
    );
  else content = <CardSkeleton lines={3} />;

  return (
    <>
      <PageHeader title="Comment" back={PATHS.decisions} />
      <PageBody>{content}</PageBody>
    </>
  );
}
