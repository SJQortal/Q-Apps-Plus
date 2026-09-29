import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { CommentSection } from './CommentSection';
import { store } from '../../../state/store';
import { fetchCallsMatching, mockFetch } from '../../../test/setup';
import { resetQdnSearchCache } from '../../../utils/qdnSearch';
import { HubThemeProvider } from '../../../hub-theme';
import { THEME_STORAGE_KEY, themeConfig } from '../../../theme/qplus-theme';

const POST_ID = 'qshare_file_my-share_abcdefghijkl_metadata';
const KEY = POST_ID.slice(-12); // "kl_metadata" style key the original app uses
const BASE = `qcomment_v1_qshare_${KEY}_base_`;
const REPLY = `qcomment_v1_qshare_${KEY}_reply_`;

function comment(identifier: string) {
  return { name: 'bob', service: 'BLOG_COMMENT', identifier, created: 1700000000000 };
}

describe('CommentSection loading', () => {
  it('loads a share with 2 comments and 3 replies in 2 searches and 5 body fetches', async () => {
    resetQdnSearchCache();
    mockFetch(/service=BLOG_COMMENT&query=.*_base_/, [comment(`${BASE}aaaaaa`), comment(`${BASE}bbbbbb`)]);
    mockFetch(/service=BLOG_COMMENT&query=.*_reply_/, [
      comment(`${REPLY}aaaaaa_r1`),
      comment(`${REPLY}aaaaaa_r2`),
      comment(`${REPLY}bbbbbb_r3`),
    ]);
    mockFetch('/arbitrary/BLOG_COMMENT/', (url) => `body of ${url.pathname.split('/').pop()}`);

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
    expect(screen.queryByText('Load More Comments')).not.toBeInTheDocument();
  });
});
