import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Box } from '@mui/material';
import { ErrorState } from '../../layout/states';

interface Props {
  children: ReactNode;
  /** Called by the Reload button; defaults to reloading the app frame. */
  onReload?: () => void;
}

interface State {
  hasError: boolean;
}

/**
 * Catches render errors and failed code-split chunks below it, so one bad
 * screen shows a message with a Reload button instead of blanking the whole
 * app (found in the Hub check: a chunk that failed to load left an empty
 * frame with no way back). The error still goes to the console.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('Q-Mail+ could not show this screen:', error, info.componentStack);
  }

  private reload = () => {
    if (this.props.onReload) this.props.onReload();
    else window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <Box sx={{ minHeight: '100%', bgcolor: 'background.default' }}>
          <ErrorState
            message="This part of Q-Mail+ could not be shown. Reloading usually fixes it; your mail is safe on QDN."
            onRetry={this.reload}
          />
        </Box>
      );
    }
    return this.props.children;
  }
}
