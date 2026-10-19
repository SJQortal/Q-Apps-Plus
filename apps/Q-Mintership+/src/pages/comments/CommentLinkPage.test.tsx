/**
 * A comment's link (`/comments/<name>/<identifier>`, from reply alerts and
 * Home's replies): it opens the comment's nomination or decision in place,
 * where the comments go to it; a link that isn't a comment's, or a decision
 * that isn't among those read, says so.
 */
import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { renderPage, type RenderPageOptions } from '../../test/render';
import { ADDR } from '../../test/world';
import { addComments } from '../../../e2e/world.mjs';
import { commentPath } from '../../routes/paths';
import NominationPage from '../nominations/NominationPage';
import CommentLinkPage from './CommentLinkPage';

const T = { timeout: 4000 };

/** Where the app went, and the state it went with. */
function Probe() {
  const location = useLocation();
  return (
    <output data-testid="at">
      {location.pathname}|{JSON.stringify(location.state ?? null)}
    </output>
  );
}

function open(name: string, identifier: string, setup?: RenderPageOptions['setup']) {
  return renderPage(
    <Routes>
      <Route path="comments/:name/:identifier" element={<CommentLinkPage />} />
      <Route path="*" element={<Probe />} />
    </Routes>,
    { persona: 'nominator', path: commentPath(name, identifier), route: '/*', strict: true, setup }
  );
}

const at = () => screen.getByTestId('at').textContent;

describe('a comment’s link', () => {
  it('opens a nomination’s comment on the nomination, going to that comment', async () => {
    const identifier = `qmp-comment-${ADDR.nominatedWaiting}-wren03`;
    await open('Zoë Newcomer', identifier);
    await waitFor(
      () =>
        expect(at()).toBe(
          `/nominations/${ADDR.nominatedWaiting}|${JSON.stringify({ comment: identifier })}`
        ),
      T
    );
  });

  it('finds a decision’s full signature from the start of it in the comment', async () => {
    let decision = '';
    let identifier = '';
    await open('Member 5', 'qmp-comment-x', (world) => {
      const { decisionKey, ids } = addComments(world);
      identifier = ids.agreed;
      decision =
        world.pending.find((t: { signature: string }) => t.signature.startsWith(decisionKey))
          ?.signature ?? '';
    });
    // Opened again with the real identifier, now that the world gave it.
    await open('Member 5', identifier);
    await waitFor(
      () =>
        expect(at()).toBe(
          `/decisions/${encodeURIComponent(decision)}|${JSON.stringify({ comment: identifier })}`
        ),
      T
    );
  });

  it('says when a link isn’t a comment’s, or its decision isn’t among those read', async () => {
    await open('Someone', 'not-a-comment');
    expect(
      await screen.findByText('That isn’t a link to a comment.'.replace('’', "'"), {}, T)
    ).toBeVisible();
    await open('Someone', `qmp-comment-${'Z'.repeat(40)}-abc123`);
    expect(
      await screen.findByText(
        'Couldn’t find the decision this comment is on.'.replace('’', "'"),
        {},
        T
      )
    ).toBeVisible();
  });
});

describe('the comments, opened from a comment’s link', () => {
  it('go to that comment once it shows: focused and highlighted', async () => {
    let identifier = '';
    await renderPage(<NominationPage />, {
      persona: 'nominator',
      path: `/nominations/${ADDR.nominatedWaiting}`,
      route: '/nominations/:address',
      setup: (world) => {
        identifier = addComments(world).ids.thanks;
      },
      state: { comment: `qmp-comment-${ADDR.nominatedWaiting}-wren03` },
    });
    await waitFor(() => {
      const target = document.querySelector<HTMLElement>(`[data-comment="${identifier}"]`);
      expect(target).not.toBeNull();
      expect(target).toHaveFocus();
      expect(target).toHaveAttribute('data-flash', 'true');
    }, T);
  });
});
