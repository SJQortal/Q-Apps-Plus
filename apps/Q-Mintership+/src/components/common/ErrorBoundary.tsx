import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Box } from '@mui/material';
import { ErrorState } from './states';
import { isStaleBuildError, reloadForNewBuild } from '../../utils/staleBuild';
import { APP_NAME } from '../../constants/plus';

interface Props {
  children: ReactNode;
  /** Shown in place of the children instead of the page-sized message. */
  fallback?: ReactNode;
  /** A new value (another route) clears the error. */
  resetKey?: unknown;
}

interface State {
  hasError: boolean;
  /** A code-split file of an older build failed: reloading to the new one. */
  reloading: boolean;
}

/**
 * Catches render errors and failed code-split chunks below it, so one bad
 * screen shows a message with Reload instead of blanking the app. A chunk
 * from an older build (the app was updated while open) reloads once to the
 * new build instead (utils/staleBuild.ts). Adapted from Q-Mail+.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, reloading: false };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, reloading: isStaleBuildError(error) };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    if (isStaleBuildError(error) && reloadForNewBuild()) return;
    if (this.state.reloading) this.setState({ reloading: false });
    console.error(`${APP_NAME} could not show this screen:`, error, info.componentStack);
  }

  componentDidUpdate(previous: Props, previousState: State): void {
    if (
      this.state.hasError &&
      previousState.hasError &&
      previous.resetKey !== this.props.resetKey
    ) {
      this.setState({ hasError: false, reloading: false });
    }
  }

  render(): ReactNode {
    if (this.state.hasError && this.state.reloading) {
      return (
        <Box sx={{ p: 2 }} role="status">
          {APP_NAME} was updated. Loading the new version…
        </Box>
      );
    }
    if (this.state.hasError && this.props.fallback !== undefined) return this.props.fallback;
    if (this.state.hasError) {
      return (
        <Box sx={{ p: 2 }}>
          <ErrorState
            title={`This part of ${APP_NAME} could not be shown.`}
            error="Reloading usually fixes it. Nothing on chain was changed."
            onRetry={() => window.location.reload()}
          />
        </Box>
      );
    }
    return this.props.children;
  }
}
