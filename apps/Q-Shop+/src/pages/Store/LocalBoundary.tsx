/**
 * Keeps one bad item from taking a page down. Shops and products are JSON
 * that any name can publish, so a card can meet data the app didn't expect;
 * without this the app-level boundary replaced the header, the navigation
 * and every route with "Something went wrong", for every visitor, on every
 * reload. Here only that card (or strip) gives way, to `fallback`, and the
 * error goes to the console.
 */
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Box, Typography } from "@mui/material";

/** A plain card in place of one that couldn't be shown. */
export function UnavailableCard({
  heading,
  text,
  action,
  component = "div",
}: {
  heading?: string;
  text: string;
  action?: ReactNode;
  component?: "div" | "li";
}) {
  return (
    <Box component={component} sx={{ minWidth: 0, listStyle: "none" }}>
      <Box
        role="status"
        sx={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 0.5,
          p: 2,
          border: 1,
          borderColor: "divider",
          borderRadius: 2,
          bgcolor: "background.paper",
          overflowWrap: "anywhere",
        }}
      >
        {heading && <Typography sx={{ fontWeight: 700 }}>{heading}</Typography>}
        <Typography variant="body2" color="text.secondary">
          {text}
        </Typography>
        {action}
      </Box>
    </Box>
  );
}

interface Props {
  children: ReactNode;
  /** Shown in place of the children once they fail; null hides them. */
  fallback: ReactNode;
  /** Names what failed, in the console message. */
  label: string;
}

interface State {
  failed: boolean;
}

export class LocalBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error(`${this.props.label} couldn't be shown:`, error, info.componentStack);
  }

  render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export default LocalBoundary;
