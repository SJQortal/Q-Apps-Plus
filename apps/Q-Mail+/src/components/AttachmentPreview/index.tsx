/**
 * Public entry for attachment previews. The dialog (and, from inside it, the
 * pdf.js engine) is loaded with a dynamic import() the first time a preview
 * opens, so none of it is in the main chunk.
 */
import { lazy, Suspense } from 'react';
import type { AttachmentPreviewProps } from './AttachmentPreviewDialog';

const AttachmentPreviewDialog = lazy(() => import('./AttachmentPreviewDialog'));

export type { AttachmentPreviewProps };
export { useAttachment } from './useAttachment';
export { useResourceReady } from './useResourceReady';

export function AttachmentPreview(props: AttachmentPreviewProps) {
  if (!props.open) return null;
  return (
    <Suspense fallback={null}>
      <AttachmentPreviewDialog {...props} />
    </Suspense>
  );
}
