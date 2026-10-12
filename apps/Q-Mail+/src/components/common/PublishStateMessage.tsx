/**
 * What "Publish mail state" puts on QDN, said the same way wherever it can be
 * started (Settings → Sync, and the rail's Publish item).
 */
import { NameText } from './NameText';

export const PUBLISH_STATE_TITLE = 'Publish mail state?';

export function PublishStateMessage({ name }: { name?: string | null }) {
  return (
    <>
      This publishes your read state, subjects, archived list, theme, text size, watched aliases and footer as an
      encrypted document (qmail_state_v1) under {name ? <NameText name={name} /> : 'your name'}, so other devices can
      load it. It costs one QDN publish.
    </>
  );
}
