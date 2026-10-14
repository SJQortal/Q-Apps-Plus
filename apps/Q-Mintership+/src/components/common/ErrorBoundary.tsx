import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Box } from '@mui/material';
import { ErrorState } from './states';

interface Props {
  children: ReactNode;
  /** Shown in place of the children instead of the page-sized message. */
  fallback?: ReactNode;
  /** A new value (another route) clears the error. */
  resetKey?: unknown;
}

interface State {
  hasError: boolean;
}

/**
 * Catches render errors and failed code-split chunks below it, so one bad
 * screen shows a message with Reload instead of blanking the app.
 * Adapted from Q-Mail+.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('Q-Mintership+ could not show this screen:', error, info.componentStack);
  }

  componentDidUpdate(previous: Props, previousState: State): void {
    if (
      this.state.hasError &&
      previousState.hasError &&
      previous.resetKey !== this.props.resetKey
    ) {
      this.setState({ hasError: false });
    }
  }

  render(): ReactNode {
    if (this.state.hasError && this.props.fallback !== undefined) return this.props.fallback;
    if (this.state.hasError) {
      return (
        <Box sx={{ p: 2 }}>
          <ErrorState
            title="This part of Q-Mintership+ could not be shown."
            error="Reloading usually fixes it. Nothing on chain was changed."
            onRetry={() => window.location.reload()}
          />
        </Box>
      );
    }
    return this.props.children;
  }
}
