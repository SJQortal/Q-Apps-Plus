import { Component, type ErrorInfo, type ReactNode } from "react";
import { Box } from "@mui/material";
import ErrorOutlineOutlinedIcon from "@mui/icons-material/ErrorOutlineOutlined";
import { EmptyState } from "./EmptyState";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Catches render errors below it and shows a friendly message with a Reload
 * button instead of a blank screen. The error goes to the console.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error("Q-Share+ crashed while rendering:", error, info.componentStack);
  }

  private reload = () => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <Box sx={{ maxWidth: 520, mx: "auto", p: 2, pt: 6 }}>
          <EmptyState
            icon={<ErrorOutlineOutlinedIcon />}
            title="Something went wrong"
            description="This part of the app could not be shown. Reloading usually fixes it."
            actionLabel="Reload"
            onAction={this.reload}
          />
        </Box>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
