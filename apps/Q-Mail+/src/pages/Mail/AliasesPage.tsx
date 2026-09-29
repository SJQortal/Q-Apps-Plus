import React, { useMemo, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import LinkIcon from "@mui/icons-material/Link";
import { formatFullTimestamp } from "../../utils/time";

interface AliasScanState {
  isRunning: boolean;
  isCancelRequested?: boolean;
  phase: "idle" | "collecting" | "scanning";
  scannedCount: number;
  totalCount: number;
  discoveredCount: number;
  statusMessage: string;
}

interface AliasesPageProps {
  aliases: string[];
  aliasesWithMessages: string[];
  replyAliasLinks: Record<string, string>;
  isLoadingAliasesWithMessages?: boolean;
  onOpenAlias: (aliasName: string) => void;
  onAddAlias: (aliasName: string) => void;
  onRemoveAlias: (aliasName: string) => void;
  onSetReplyAlias: (aliasName: string, replyAlias: string) => void;
  onClearReplyAlias: (aliasName: string) => void;
  onRunAliasScan: () => void;
  onCancelAliasScan: () => void;
  hasScanCheckpoint?: boolean;
  scanCheckpointTimestamp?: number;
  scanState: AliasScanState;
}

export const AliasesPage = ({
  aliases,
  aliasesWithMessages,
  replyAliasLinks,
  isLoadingAliasesWithMessages = false,
  onOpenAlias,
  onAddAlias,
  onRemoveAlias,
  onSetReplyAlias,
  onClearReplyAlias,
  onRunAliasScan,
  onCancelAliasScan,
  hasScanCheckpoint = false,
  scanCheckpointTimestamp = 0,
  scanState,
}: AliasesPageProps) => {
  const [newAliasInput, setNewAliasInput] = useState("");
  const [editingReplyAliasByName, setEditingReplyAliasByName] = useState<Record<string, string>>(
    {}
  );

  const sortedAliases = useMemo(() => {
    return [...aliases].sort((a, b) => {
      return a.localeCompare(b, undefined, { sensitivity: "base" });
    });
  }, [aliases]);

  const aliasesWithMessagesSet = useMemo(() => {
    return new Set(aliasesWithMessages.map(aliasName => aliasName.toLowerCase()));
  }, [aliasesWithMessages]);

  const scanProgressValue = useMemo(() => {
    if (!scanState.totalCount) return 0;
    return Math.min(100, Math.round((scanState.scannedCount / scanState.totalCount) * 100));
  }, [scanState.scannedCount, scanState.totalCount]);

  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: "1100px",
        padding: "28px 16px",
        display: "flex",
        flexDirection: "column",
        gap: "18px",
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        <Typography
          sx={{
            color: "var(--qmail-thread-text)",
            fontSize: "1.2rem",
            fontWeight: 700,
          }}
        >
          Aliases
        </Typography>
        <Typography
          sx={{
            color: "var(--qmail-thread-subtle-text)",
            fontSize: "0.95rem",
          }}
        >
          Manage saved aliases. Sidebar subitems only show aliases that currently have messages.
        </Typography>
      </Box>

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          flexWrap: "wrap",
          border: "1px solid var(--qmail-shell-border)",
          borderRadius: "12px",
          padding: "12px",
          backgroundColor: "var(--qmail-thread-card-bg)",
        }}
      >
        <TextField
          value={newAliasInput}
          onChange={event => {
            setNewAliasInput(event.target.value);
          }}
          onKeyDown={event => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            const nextAlias = newAliasInput.trim();
            if (!nextAlias) return;
            onAddAlias(nextAlias);
            setNewAliasInput("");
          }}
          placeholder="Add alias"
          size="small"
          sx={{
            minWidth: "240px",
            flex: 1,
            "& .MuiInputBase-root": {
              color: "var(--qmail-thread-text)",
            },
          }}
        />
        <Button
          variant="outlined"
          onClick={() => {
            const nextAlias = newAliasInput.trim();
            if (!nextAlias) return;
            onAddAlias(nextAlias);
            setNewAliasInput("");
          }}
          sx={{
            textTransform: "none",
            borderColor: "var(--qmail-shell-border)",
            color: "var(--qmail-thread-text)",
            backgroundColor: "var(--qmail-shell-hover)",
            "&:hover": {
              borderColor: "var(--qmail-shell-active-strong)",
              backgroundColor: "var(--qmail-shell-hover-strong)",
            },
          }}
        >
          Add Alias
        </Button>
      </Box>

      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          border: "1px solid var(--qmail-shell-border)",
          borderRadius: "12px",
          padding: "12px",
          backgroundColor: "var(--qmail-thread-card-bg)",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <Typography
            sx={{
              color: "var(--qmail-thread-text)",
              fontSize: "1rem",
              fontWeight: 650,
            }}
          >
            Alias Scan
          </Typography>
          <Button
            variant="outlined"
            onClick={scanState.isRunning ? onCancelAliasScan : onRunAliasScan}
            sx={{
              textTransform: "none",
              borderColor: "var(--qmail-shell-border)",
              color: "var(--qmail-thread-text)",
              backgroundColor: "var(--qmail-shell-hover)",
              "&:hover": {
                borderColor: "var(--qmail-shell-active-strong)",
                backgroundColor: "var(--qmail-shell-hover-strong)",
              },
            }}
          >
            {scanState.isRunning
              ? scanState.isCancelRequested
                ? "Cancel Requested"
                : "Cancel Scan"
              : hasScanCheckpoint
              ? "Resume Scan"
              : "Alias Scan"}
          </Button>
        </Box>
        <Typography
          sx={{
            color: "var(--qmail-thread-subtle-text)",
            fontSize: "0.9rem",
          }}
        >
          Full scan checks Q-Mail resources, skips owned names, and attempts decryption to discover
          previously used aliases.
        </Typography>
        {hasScanCheckpoint && scanCheckpointTimestamp > 0 && (
          <Typography
            sx={{
              color: "var(--qmail-thread-subtle-text)",
              fontSize: "0.8rem",
            }}
          >
            Last checkpoint: {formatFullTimestamp(scanCheckpointTimestamp)}
          </Typography>
        )}
        {(scanState.isRunning || scanState.statusMessage) && (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              marginTop: "2px",
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              {scanState.isRunning && scanState.phase === "collecting" && (
                <CircularProgress size={14} />
              )}
              <Typography
                sx={{
                  color: "var(--qmail-thread-subtle-text)",
                  fontSize: "0.85rem",
                }}
              >
                {scanState.statusMessage}
              </Typography>
            </Box>
            {scanState.totalCount > 0 && (
              <>
                <LinearProgress
                  variant="determinate"
                  value={scanProgressValue}
                  sx={{
                    borderRadius: "999px",
                    height: "7px",
                    backgroundColor: "var(--qmail-shell-hover-strong)",
                  }}
                />
                <Typography
                  sx={{
                    color: "var(--qmail-thread-subtle-text)",
                    fontSize: "0.8rem",
                  }}
                >
                  Scanned {scanState.scannedCount}/{scanState.totalCount} • Discovered{" "}
                  {scanState.discoveredCount}
                </Typography>
              </>
            )}
          </Box>
        )}
      </Box>

      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        <Typography
          sx={{
            color: "var(--qmail-thread-text)",
            fontSize: "1rem",
            fontWeight: 650,
          }}
        >
          Saved Aliases ({sortedAliases.length})
        </Typography>

        {isLoadingAliasesWithMessages && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: "var(--qmail-thread-subtle-text)",
            }}
          >
            <CircularProgress size={16} />
            <Typography sx={{ fontSize: "0.85rem" }}>Checking alias activity...</Typography>
          </Box>
        )}

        {sortedAliases.length === 0 && (
          <Typography
            sx={{
              color: "var(--qmail-thread-subtle-text)",
              fontSize: "0.9rem",
            }}
          >
            No saved aliases.
          </Typography>
        )}

        {sortedAliases.map(aliasName => {
          const hasMessages = aliasesWithMessagesSet.has(aliasName.toLowerCase());
          const linkedReplyAlias = replyAliasLinks[aliasName.toLowerCase()] || "";
          const replyAliasDraft =
            editingReplyAliasByName[aliasName] !== undefined
              ? editingReplyAliasByName[aliasName]
              : linkedReplyAlias;
          return (
            <Box
              key={aliasName}
              sx={{
                border: "1px solid var(--qmail-shell-border)",
                borderRadius: "10px",
                backgroundColor: "var(--qmail-thread-card-bg)",
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: "12px",
                padding: "10px 12px",
                flexWrap: "wrap",
              }}
            >
              <Box
                sx={{
                  minWidth: "180px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "2px",
                }}
              >
                <Typography
                  sx={{
                    color: "var(--qmail-thread-text)",
                    fontSize: "0.98rem",
                    fontWeight: 600,
                  }}
                >
                  {aliasName}
                </Typography>
                <Typography
                  sx={{
                    color: "var(--qmail-thread-subtle-text)",
                    fontSize: "0.78rem",
                  }}
                >
                  {hasMessages ? "Has messages" : "No messages detected yet"}
                </Typography>
                <Typography
                  sx={{
                    color: linkedReplyAlias
                      ? "var(--qmail-shell-active-strong)"
                      : "var(--qmail-thread-subtle-text)",
                    fontSize: "0.78rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <LinkIcon sx={{ fontSize: "0.9rem" }} />
                  {linkedReplyAlias
                    ? `Reply alias linked: ${linkedReplyAlias}`
                    : "No reply alias linked"}
                </Typography>
              </Box>
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "stretch",
                  gap: "8px",
                  marginLeft: "auto",
                  minWidth: "260px",
                  flex: "1 1 280px",
                }}
              >
                <TextField
                  value={replyAliasDraft}
                  onChange={event => {
                    const nextValue = event.target.value;
                    setEditingReplyAliasByName(previous => ({
                      ...previous,
                      [aliasName]: nextValue,
                    }));
                  }}
                  placeholder="Optional reply alias for this inbox"
                  size="small"
                  sx={{
                    "& .MuiInputBase-root": {
                      color: "var(--qmail-thread-text)",
                    },
                  }}
                />
                <Stack
                  direction="row"
                  spacing={1}
                  flexWrap="wrap"
                  justifyContent="flex-end"
                >
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={!hasMessages}
                    onClick={() => {
                      onOpenAlias(aliasName);
                    }}
                    sx={{
                      textTransform: "none",
                      borderColor: "var(--qmail-shell-border)",
                      color: "var(--qmail-thread-text)",
                      backgroundColor: "var(--qmail-shell-hover)",
                      "&:hover": {
                        borderColor: "var(--qmail-shell-active-strong)",
                        backgroundColor: "var(--qmail-shell-hover-strong)",
                      },
                    }}
                  >
                    Open Inbox
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      const nextReplyAlias = replyAliasDraft.trim();
                      if (!nextReplyAlias) return;
                      onSetReplyAlias(aliasName, nextReplyAlias);
                      setEditingReplyAliasByName(previous => ({
                        ...previous,
                        [aliasName]: nextReplyAlias,
                      }));
                    }}
                    sx={{
                      textTransform: "none",
                      borderColor: "var(--qmail-shell-border)",
                      color: "var(--qmail-thread-text)",
                    }}
                  >
                    Save Reply Alias
                  </Button>
                  <Button
                    size="small"
                    variant="text"
                    disabled={!linkedReplyAlias}
                    onClick={() => {
                      onClearReplyAlias(aliasName);
                      setEditingReplyAliasByName(previous => ({
                        ...previous,
                        [aliasName]: "",
                      }));
                    }}
                    sx={{
                      textTransform: "none",
                      color: "var(--qmail-thread-subtle-text)",
                    }}
                  >
                    Clear Link
                  </Button>
                  <IconButton
                    size="small"
                    onClick={() => {
                      onRemoveAlias(aliasName);
                    }}
                    sx={{
                      color: "var(--qmail-thread-subtle-text)",
                      "&:hover": {
                        color: "var(--qmail-thread-text)",
                      },
                    }}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};
