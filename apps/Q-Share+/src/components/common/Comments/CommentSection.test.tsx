import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { CommentSection } from './CommentSection';
import { store } from '../../../state/store';
import { addUser } from '../../../state/features/authSlice';
import { fetchCallsMatching, mockFetch, mockQortalAction } from '../../../test/setup';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { resetQdnSearchCache } from '../../../utils/qdnSearch';
import { HubThemeProvider } from '../../../hub-theme';
import { THEME_STORAGE_KEY, themeConfig } from '../../../theme/qplus-theme';

const POST_ID = 'qshare_file_my-share_abcdefghijkl_metadata';
const KEY = POST_ID.slice(-12); // "kl_metadata" style key the original app uses
const BASE = `qcomment_v1_qshare_${KEY}_base_`;
const REPLY = `qcomment_v1_qshare_${KEY}_reply_`;
// Some other client keyed comments by the share JSON's commentsId instead.
const COMMENTS_ID = 'qshare_file__cm_xYz123';
const EXTRA = `qcomment_v1_qshare_${COMMENTS_ID}_`;

function comment(identifier: string, created = 1700000000000, name = 'bob') {
  return { name, service: 'BLOG_COMMENT', identifier, created };
}

function mockBodies() {
  mockFetch('/arbitrary/BLOG_COMMENT/', (url) => `body of ${decodeURIComponent(url.pathname.split('/').pop() ?? '')}`);
}

describe('CommentSection from a notification', () => {
  beforeEach(() => resetQdnSearchCache());

  it.each([
    ['the in-app list', `/share/alice/${POST_ID}#comments`],
    ["a Hub alert", `/share/alice/${POST_ID}/comments`],
  ])('scrolls to the comments once they are in, opened from %s', async (_from, entry) => {
    mockBodies();
    mockFetch(/service=BLOG_COMMENT&query=.*_base_/, [comment(`${BASE}aaaaaa`)]);
    mockFetch(/service=BLOG_COMMENT&query=.*_reply_/, []);
    const scrolled: string[] = [];
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push(this.id);
    };
    renderWithProviders(<CommentSection postId={POST_ID} postName="alice" />, { initialEntries: [entry] });
    await waitFor(() => expect(scrolled).toEqual(['comments']));
  });

  it('scrolls only once, not again after "Load more comments"', async () => {
    mockBodies();
    const page = Array.from({ length: 20 }, (_, i) => comment(`${BASE}p${String(i).padStart(5, '0')}`));
    mockFetch(/service=BLOG_COMMENT&query=.*_base_/, (url: URL) =>
      url.searchParams.get('offset') === '0' ? page : [comment(`${BASE}last01`)]
    );
    mockFetch(/service=BLOG_COMMENT&query=.*_reply_/, []);
    const scrolled: string[] = [];
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push(this.id);
    };
    renderWithProviders(<CommentSection postId={POST_ID} postName="alice" />, {
      initialEntries: [`/share/alice/${POST_ID}#comments`],
    });
    await waitFor(() => expect(scrolled).toEqual(['comments']));
    fireEvent.click(await screen.findByRole('button', { name: 'Load more comments' }));
    expect(await screen.findByText(`body of ${BASE}last01`)).toBeInTheDocument();
    expect(scrolled).toEqual(['comments']);
  });

  it('stays where it is when opened normally', async () => {
    mockBodies();
    mockFetch(/service=BLOG_COMMENT&query=.*_base_/, [comment(`${BASE}aaaaaa`)]);
    mockFetch(/service=BLOG_COMMENT&query=.*_reply_/, []);
    const scrolled: string[] = [];
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push(this.id);
    };
    renderWithProviders(<CommentSection postId={POST_ID} postName="alice" />, { initialEntries: [`/share/alice/${POST_ID}`] });
    expect(await screen.findByText(`body of ${BASE}aaaaaa`)).toBeInTheDocument();
    expect(scrolled).toEqual([]);
  });
});

describe('CommentSection loading', () => {
  beforeEach(() => {
    resetQdnSearchCache();
    store.dispatch(addUser(null));
  });

  it('loads a share with 2 comments and 3 replies in 2 searches and 5 body fetches', async () => {
    mockFetch(/service=BLOG_COMMENT&query=.*_base_/, [comment(`${BASE}aaaaaa`), comment(`${BASE}bbbbbb`)]);
    mockFetch(/service=BLOG_COMMENT&query=.*_reply_/, [
      comment(`${REPLY}aaaaaa_r1`),
      comment(`${REPLY}aaaaaa_r2`),
      comment(`${REPLY}bbbbbb_r3`),
    ]);
    mockBodies();

    render(
      <Provider store={store}>
        <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
          <MemoryRouter>
            <CommentSection postId={POST_ID} postName="alice" />
          </MemoryRouter>
        </HubThemeProvider>
      </Provider>
    );

    expect(await screen.findByText(`body of ${BASE}aaaaaa`)).toBeInTheDocument();
    expect(await screen.findByText(`body of ${REPLY}bbbbbb_r3`)).toBeInTheDocument();

    const searches = fetchCallsMatching('/arbitrary/resources/search');
    expect(searches.length).toBe(2);
    expect(searches.every((u) => !/limit=0\b/.test(u))).toBe(true);
    expect(fetchCallsMatching('/arbitrary/BLOG_COMMENT/').length).toBe(5);
    // "Load more" only shows when a full page of base comments came back.
    expect(screen.queryByText('Load more comments')).not.toBeInTheDocument();
  });

  it("also shows comments keyed by the share's commentsId, from one more search", async () => {
    mockFetch(/service=BLOG_COMMENT&query=.*_base_/, [comment(`${BASE}aaaaaa`, 1700000000000)]);
    // A reply we published (upstream key) to the commentsId comment below.
    mockFetch(/service=BLOG_COMMENT&query=.*_reply_/, [comment(`${REPLY}zzzzzz_r1`, 1700000300000, 'carol')]);
    mockFetch(/service=BLOG_COMMENT&identifier=/, [
      comment(`${EXTRA}base_zzzzzz`, 1600000000000, 'native'),
      comment(`${EXTRA}reply_aaaaaa_r2`, 1700000200000, 'dave'),
      // Core matches case-insensitively: another share's key that only differs in case.
      comment(`qcomment_v1_qshare_QSHARE_FILE__CM_XYZ123_base_other1`),
      // The same row twice is shown once.
      comment(`${BASE}aaaaaa`, 1700000000000),
    ]);
    mockBodies();

    renderWithProviders(<CommentSection postId={POST_ID} postName="alice" commentsId={COMMENTS_ID} />);

    const extraBase = await screen.findByText(`body of ${EXTRA}base_zzzzzz`);
    const ownBase = await screen.findByText(`body of ${BASE}aaaaaa`);
    expect(await screen.findByText(`body of ${EXTRA}reply_aaaaaa_r2`)).toBeInTheDocument();
    expect(screen.getByText(`body of ${REPLY}zzzzzz_r1`)).toBeInTheDocument();
    expect(screen.queryByText(/other1/)).not.toBeInTheDocument();
    expect(screen.getAllByText(`body of ${BASE}aaaaaa`)).toHaveLength(1);
    // Oldest first: the commentsId comment is older, so it comes first.
    expect(extraBase.compareDocumentPosition(ownBase) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const searches = fetchCallsMatching('/arbitrary/resources/search');
    expect(searches.length).toBe(3);
    const extra = searches.find((u) => u.includes('identifier='));
    expect(extra).toContain(`identifier=${EXTRA}`);
    expect(extra).toContain('prefix=true');
    expect(fetchCallsMatching('/arbitrary/BLOG_COMMENT/').length).toBe(4);
  });

  it('makes no extra search when commentsId is the upstream key', async () => {
    mockFetch(/service=BLOG_COMMENT&query=.*_base_/, [comment(`${BASE}aaaaaa`)]);
    mockFetch(/service=BLOG_COMMENT&query=.*_reply_/, []);
    mockBodies();

    renderWithProviders(<CommentSection postId={POST_ID} postName="alice" commentsId={KEY} />);

    expect(await screen.findByText(`body of ${BASE}aaaaaa`)).toBeInTheDocument();
    expect(fetchCallsMatching('/arbitrary/resources/search').length).toBe(2);
  });

  it.each(['%', '____', 'qshare_file__cm_%', 'qshare_file__cm_ab_'])(
    'makes no extra search for a commentsId the original app never writes (%s)',
    async (commentsId) => {
      mockFetch(/service=BLOG_COMMENT&query=.*_base_/, [comment(`${BASE}aaaaaa`)]);
      mockFetch(/service=BLOG_COMMENT&query=.*_reply_/, []);
      mockBodies();

      renderWithProviders(<CommentSection postId={POST_ID} postName="alice" commentsId={commentsId} />);

      expect(await screen.findByText(`body of ${BASE}aaaaaa`)).toBeInTheDocument();
      // `%` and `_` are LIKE wildcards in Core: such a prefix could match every comment on the node.
      expect(fetchCallsMatching('/arbitrary/resources/search').length).toBe(2);
    }
  );

  it('still shows the upstream-key comments when the commentsId search fails', async () => {
    mockFetch(/service=BLOG_COMMENT&query=.*_base_/, [comment(`${BASE}aaaaaa`)]);
    mockFetch(/service=BLOG_COMMENT&query=.*_reply_/, [comment(`${REPLY}aaaaaa_r1`)]);
    mockFetch(/service=BLOG_COMMENT&identifier=/, () => {
      throw new Error('Search failed (500)');
    });
    mockBodies();

    renderWithProviders(<CommentSection postId={POST_ID} postName="alice" commentsId={COMMENTS_ID} />);

    expect(await screen.findByText(`body of ${BASE}aaaaaa`)).toBeInTheDocument();
    expect(screen.getByText(`body of ${REPLY}aaaaaa_r1`)).toBeInTheDocument();
    expect(screen.queryByText('Comments could not be loaded.')).not.toBeInTheDocument();
    expect(fetchCallsMatching('/arbitrary/resources/search').some((u) => u.includes('identifier='))).toBe(true);
  });

  it('pages base comments by the paged search only, not by what else is in the list', async () => {
    const offsets: string[] = [];
    mockFetch(/service=BLOG_COMMENT&query=.*_base_/, (url) => {
      const offset = url.searchParams.get('offset') ?? '0';
      offsets.push(offset);
      if (offset === '0') return Array.from({ length: 20 }, (_, i) => comment(`${BASE}p1-${String(i).padStart(3, '0')}`));
      return [comment(`${BASE}p2-000`)];
    });
    mockFetch(/service=BLOG_COMMENT&query=.*_reply_/, []);
    mockFetch(/service=BLOG_COMMENT&identifier=/, [comment(`${EXTRA}base_zzzzzz`, 1600000000000, 'native')]);
    mockBodies();

    renderWithProviders(<CommentSection postId={POST_ID} postName="alice" commentsId={COMMENTS_ID} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Load more comments' }));
    expect(await screen.findByText(`body of ${BASE}p2-000`)).toBeInTheDocument();
    expect(offsets).toEqual(['0', '20']);
    // Only the base search pages; replies and commentsId rows came with the first page.
    expect(fetchCallsMatching('/arbitrary/resources/search').length).toBe(4);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Load more comments' })).not.toBeInTheDocument());
  });

  it("leaves out a comment whose body can't be read and shows the rest", async () => {
    mockFetch(/service=BLOG_COMMENT&query=.*_base_/, [comment(`${BASE}aaaaaa`), comment(`${BASE}bbbbbb`)]);
    mockFetch(/service=BLOG_COMMENT&query=.*_reply_/, [comment(`${REPLY}bbbbbb_r1`)]);
    mockFetch('/arbitrary/BLOG_COMMENT/', (url) => {
      // fetchQdnText rejects when the node can't serve the body (e.g. a 404 with error JSON).
      if (url.pathname.endsWith('aaaaaa')) throw new Error('QDN 404');
      return `body of ${decodeURIComponent(url.pathname.split('/').pop() ?? '')}`;
    });

    renderWithProviders(<CommentSection postId={POST_ID} postName="alice" />);

    expect(await screen.findByText(`body of ${BASE}bbbbbb`)).toBeInTheDocument();
    expect(screen.getByText(`body of ${REPLY}bbbbbb_r1`)).toBeInTheDocument();
    expect(screen.queryByText(/aaaaaa/)).not.toBeInTheDocument();
    expect(screen.queryByText('Comments could not be loaded.')).not.toBeInTheDocument();
    // A small note (with Retry) above the list says one is missing.
    expect(screen.getByText('1 comment could not be loaded.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('offers Retry when comments exist but none can be read', async () => {
    let nodeUp = false;
    mockFetch(/service=BLOG_COMMENT&query=.*_base_/, [comment(`${BASE}aaaaaa`)]);
    mockFetch(/service=BLOG_COMMENT&query=.*_reply_/, []);
    mockFetch('/arbitrary/BLOG_COMMENT/', (url) => {
      if (!nodeUp) throw new Error('QDN 404');
      return `body of ${decodeURIComponent(url.pathname.split('/').pop() ?? '')}`;
    });

    renderWithProviders(<CommentSection postId={POST_ID} postName="alice" />);

    expect(await screen.findByText('Comments could not be loaded.')).toBeInTheDocument();
    expect(screen.queryByText(/No comments yet/)).not.toBeInTheDocument();
    nodeUp = true;
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText(`body of ${BASE}aaaaaa`)).toBeInTheDocument();
  });

  it("shows a comment the user posts even when none of the others could be read", async () => {
    store.dispatch(addUser({ address: 'Qabc', publicKey: 'k', name: 'alice' }));
    mockQortalAction('PUBLISH_QDN_RESOURCE', true);
    mockFetch(/service=BLOG_COMMENT&query=.*_base_/, [comment(`${BASE}aaaaaa`)]);
    mockFetch(/service=BLOG_COMMENT&query=.*_reply_/, []);
    mockFetch('/arbitrary/BLOG_COMMENT/', () => {
      throw new Error('QDN 404');
    });

    renderWithProviders(<CommentSection postId={POST_ID} postName="bob" />);

    expect(await screen.findByText('Comments could not be loaded.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Your comment'), { target: { value: 'My new comment' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit comment' }));

    expect(await screen.findByText('My new comment')).toBeInTheDocument();
    expect(screen.queryByText('Comments could not be loaded.')).not.toBeInTheDocument();
    expect(screen.getByText('1 comment could not be loaded.')).toBeInTheDocument();

    // Retry reads page one again (the cached search doesn't have the new comment yet): it stays.
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(fetchCallsMatching('/arbitrary/BLOG_COMMENT/').length).toBe(2));
    expect(await screen.findByText('1 comment could not be loaded.')).toBeInTheDocument();
    expect(screen.getByText('My new comment')).toBeInTheDocument();
  });
});
