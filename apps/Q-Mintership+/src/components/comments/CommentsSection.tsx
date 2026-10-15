/**
 * Public comments on a decision or a nomination, behind a "Comments (n)"
 * toggle so lists stay light. Self-contained: mount it with a target and a
 * label anywhere (a card, or a decision's or nomination's own page with
 * `defaultOpen`):
 *
 *   <CommentsSection target={decisionCommentTarget(decision, nomination)} label="Add to MINTER, Ada" />
 *   <CommentsSection target={nominationCommentTarget(nomination)} label="the nomination of Ada" />
 *   <CommentsSection target={commentTarget('decision', signature)} label="…" defaultOpen />
 *
 * Closed, it costs the shared count search (one GET for every card on the
 * page), or its own search once on screen when that can't tell. The thread
 * itself (and its code) loads only when opened, and opens and closes
 * smoothly (SmoothReveal), so the page below glides instead of jumping.
 */
import { lazy, Suspense, useId, useState } from 'react';
import { Box, Button } from '@mui/material';
import ChatBubbleOutlineOutlinedIcon from '@mui/icons-material/ChatBubbleOutlineOutlined';
import type { CommentTarget } from '../../data/commentThread';
import { formatCount } from '../../utils/format';
import { ExpandChevron } from '../common/ExpandChevron';
import { ListSkeleton } from '../common/states';
import { SmoothReveal } from '../common/SmoothReveal';
import { useCommentCount, useInView, useStableTarget } from './useComments';
import type { AnswerBadges } from './answerBadges';

const CommentsPanel = lazy(() => import('./CommentsPanel'));

export interface CommentsSectionProps {
  /** What the comments are about (data/commentThread.ts builds it). */
  target: CommentTarget;
  /** The item, for screen readers: "Add to MINTER, Ada Approved", "the nomination of Ada". */
  label: string;
  /** Start open (on an item's own page). */
  defaultOpen?: boolean;
  /** 'card' (default) draws a divider above it, inside a card; 'plain' doesn't. */
  variant?: 'card' | 'plain';
  /** What each Minter Admin chose, for the badge next to their comments. */
  answers?: AnswerBadges;
}

export function CommentsSection({
  target: given,
  label,
  defaultOpen = false,
  variant = 'card',
  answers,
}: CommentsSectionProps) {
  const target = useStableTarget(given);
  const [open, setOpen] = useState(defaultOpen);
  const [node, setNode] = useState<HTMLElement | null>(null);
  const nearScreen = useInView(node);
  const count = useCommentCount(target, { nearScreen, open });
  const panelId = useId();
  const text = count === null ? 'Comments' : `Comments (${formatCount(count)})`;
  return (
    <Box
      ref={setNode}
      sx={{
        minWidth: 0,
        ...(variant === 'card' ? { borderTop: 1, borderColor: 'divider', pt: 0.5 } : {}),
      }}
    >
      <Button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={`${text}: ${label}`}
        startIcon={<ChatBubbleOutlineOutlinedIcon />}
        endIcon={<ExpandChevron open={open} />}
        sx={{ minHeight: 44, ml: -1 }}
      >
        {text}
      </Button>
      <SmoothReveal open={open}>
        <Suspense fallback={<ListSkeleton count={1} label="Loading comments" />}>
          <CommentsPanel id={panelId} target={target} label={label} answers={answers} />
        </Suspense>
      </SmoothReveal>
    </Box>
  );
}
