/**
 * Around the reader in Mail.tsx: a message that cannot be drawn (a crafted
 * one, say) takes down the reader, not the mailbox beside it, and opening
 * another message clears it. A reader chunk that failed to load shows the
 * same, with Retry to reload.
 */
import type { ReactNode } from "react";
import { ErrorBoundary } from "../../components/common/ErrorBoundary";
import { ErrorState } from "../../layout/states";

export const READER_ERROR_TITLE = "This message could not be shown";

export function ReaderErrorBoundary({ messageKey, children }: { messageKey: string; children: ReactNode }) {
  return (
    <ErrorBoundary
      resetKey={messageKey}
      fallback={
        <ErrorState
          title={READER_ERROR_TITLE}
          message="Something in it can't be displayed. Open another message, or reload Q-Mail+ if none will open."
          onRetry={() => window.location.reload()}
        />
      }
    >
      {children}
    </ErrorBoundary>
  );
}
