import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { CommentEditor } from './CommentEditor';
import { store } from '../../../state/store';
import { addUser } from '../../../state/features/authSlice';
import { removeNotification } from '../../../state/features/notificationsSlice';
import { mockQortalAction, qortalCallsFor } from '../../../test/setup';
import { renderWithProviders } from '../../../test/renderWithProviders';

const POST_ID = 'qshare_file_my-share_abcdefghijkl_metadata';

function alerts() {
  return store.getState().notifications.alertTypes;
}

function writeAndSubmit(text: string) {
  fireEvent.change(screen.getByLabelText('Your comment'), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: 'Submit comment' }));
}

describe('CommentEditor', () => {
  beforeEach(() => {
    store.dispatch(removeNotification());
    store.dispatch(addUser({ address: 'Qabc', publicKey: 'k', name: 'alice' }));
  });

  it("stays quiet and keeps the text when the publish is declined in Hub's language", async () => {
    // Hub rejects with {error, message}, the error localised (here German).
    mockQortalAction('PUBLISH_QDN_RESOURCE', () => {
      throw { error: 'Benutzer hat die Anfrage abgelehnt', message: 'Benutzer hat die Anfrage abgelehnt' };
    });
    const onSubmit = vi.fn();
    renderWithProviders(<CommentEditor postId={POST_ID} postName="bob" onSubmit={onSubmit} />);

    writeAndSubmit('Nice share');

    await waitFor(() => expect(screen.getByRole('button', { name: 'Submit comment' })).toBeEnabled());
    expect(qortalCallsFor('PUBLISH_QDN_RESOURCE')).toHaveLength(1);
    expect(alerts().alertError).toBe('');
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Your comment')).toHaveValue('Nice share');
  });

  it('shows the reason when the publish really fails', async () => {
    mockQortalAction('PUBLISH_QDN_RESOURCE', () => {
      throw { error: 1401, message: 'Insufficient balance' };
    });
    renderWithProviders(<CommentEditor postId={POST_ID} postName="bob" onSubmit={() => {}} />);

    writeAndSubmit('Nice share');

    await waitFor(() => expect(alerts().alertError).toBe('Insufficient balance'));
  });

  it('publishes with the original app key and hands the new comment back', async () => {
    mockQortalAction('PUBLISH_QDN_RESOURCE', true);
    const onSubmit = vi.fn();
    renderWithProviders(<CommentEditor postId={POST_ID} postName="bob" onSubmit={onSubmit} />);

    writeAndSubmit('Nice share');

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const [call] = qortalCallsFor('PUBLISH_QDN_RESOURCE');
    expect(call.identifier).toMatch(new RegExp(`^qcomment_v1_qshare_${POST_ID.slice(-12)}_base_`));
    expect(call.service).toBe('BLOG_COMMENT');
    expect(alerts().alertSuccess).toBe('Comment published');
  });
});
