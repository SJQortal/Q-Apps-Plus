import { describe, expect, it } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { Comment } from './Comment';
import { store } from '../../../state/store';
import { addUser } from '../../../state/features/authSlice';
import { renderWithProviders } from '../../../test/renderWithProviders';

const BASE = 'qcomment_v1_qshare_kl_metadata_base_';
const REPLY = 'qcomment_v1_qshare_kl_metadata_reply_';
const HOUR = 3_600_000;

function follows(a: Node, b: Node): boolean {
  return Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
}

describe('Comment', () => {
  it("keeps the parent's time and Reply with its own text, above its replies", () => {
    store.dispatch(addUser({ address: 'Qabc', publicKey: 'k', name: 'alice' }));
    const now = Date.now();
    const parent = {
      name: 'bob',
      identifier: `${BASE}aaaaaa`,
      message: 'Parent text',
      created: now - 3 * HOUR,
      replies: [{ name: 'carol', identifier: `${REPLY}aaaaaa_r1`, message: 'First reply', created: now - HOUR }],
    };

    renderWithProviders(<Comment comment={parent} postId="qshare_file_x_abcdefghijkl_metadata" postName="bob" onSubmit={() => {}} />);

    const parentTime = screen.getByText('3 hours ago');
    const reply = screen.getByText('First reply');
    const replyButton = screen.getByRole('button', { name: 'Reply to bob' });
    // The time sits on the author line.
    expect(parentTime.tagName).toBe('TIME');
    expect(screen.getByText('bob').parentElement).toBe(parentTime.parentElement);
    expect(follows(screen.getByText('Parent text'), replyButton)).toBe(true);
    expect(follows(replyButton, reply)).toBe(true);
    expect(screen.getByText('an hour ago').tagName).toBe('TIME');

    // The reply box opens under the parent's text, not after the replies.
    fireEvent.click(replyButton);
    expect(follows(screen.getByLabelText('Your reply'), reply)).toBe(true);
  });
});
