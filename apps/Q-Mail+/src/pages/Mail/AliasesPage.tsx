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
import { ALIAS_SCAN_MAX_PAGES, ALIAS_SCAN_PAGE_SIZE, aliasScanButtonLabel } from "./aliasScan";

interface AliasScanState {
  isRunning: boolean;
  isCancelRequested?: boolean;
  phase: "idle" | "collecting" | "scanning";
  scannedCount: number;
  totalCount: number;
  discoveredCount: number;
  statusMessage: string;
  /** N9: the capped run. `scannedCount`/`totalCount` are pages fetched / the page cap. */
  paging?: AliasScanPaging;
}

export interface AliasScanPaging {
  resourcesWalked: number;
  candidatesChecked: number;
  maxPages: number;
  /** The whole index has been walked; a run only checks new mail. */
  complete: boolean;
  /** The last run stopped at the page cap. */
  stoppedAtCap: boolean;
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

  const maxPages = scanState.paging?.maxPages || ALIAS_SCAN_MAX_PAGES;
  const maxResourcesPerRun = maxPages * ALIAS_SCAN_PAGE_SIZE;

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
            color: "text.primary",
            fontSize: "1.2rem",
            fontWeight: 700,
          }}
        >
          Aliases
        </Typography>
        <Typography
          sx={{
            color: "text.secondary",
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
          border: "1px solid", borderColor: "divider",
          borderRadius: "12px",
          padding: "12px",
          backgroundColor: "background.paper",
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
              color: "text.primary",
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
            minHeight: 44,
                    textTransform: "none",
            borderColor: "divider",
            color: "text.primary",
            backgroundColor: "action.hover",
            "&:hover": {
              borderColor: "primary.main",
              backgroundColor: "action.selected",
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
          border: "1px solid", borderColor: "divider",
          borderRadius: "12px",
          padding: "12px",
          backgroundColor: "background.paper",
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
              color: "text.primary",
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
              minHeight: 44,
                    textTransform: "none",
              borderColor: "divider",
              color: "text.primary",
              backgroundColor: "action.hover",
              "&:hover": {
                borderColor: "primary.main",
                backgroundColor: "action.selected",
              },
            }}
          >
            {aliasScanButtonLabel(
              {
                isRunning: scanState.isRunning,
                isCancelRequested: scanState.isCancelRequested,
                complete: scanState.paging?.complete,
              },
              hasScanCheckpoint
            )}
          </Button>
        </Box>
        <Typography
          sx={{
            color: "text.secondary",
            fontSize: "0.9rem",
          }}
        >
          Reads the network&apos;s Q-Mail resources newest first, up to {maxResourcesPerRun} per run
          ({maxPages} pages of {ALIAS_SCAN_PAGE_SIZE}). It skips mail to your names and mail it already checked, and tries
          to decrypt the rest to discover aliases people used to write to you.
        </Typography>
        {hasScanCheckpoint && (
          <Typography
            data-testid="alias-scan-coverage"
            sx={{
              color: "text.secondary",
              fontSize: "0.875rem",
            }}
          >
            {scanState.paging?.complete
              ? "All Q-Mail resources have been scanned. The next run only checks new mail."
              : "Older mail has not been scanned yet. Scan more to continue where the last run stopped."}
            {scanCheckpointTimestamp > 0 &&
              ` Newest scanned: ${formatFullTimestamp(scanCheckpointTimestamp)}.`}
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
                  color: "text.secondary",
                  fontSize: "0.875rem",
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
                    backgroundColor: "action.selected",
                  }}
                />
                <Typography
                  data-testid="alias-scan-progress"
                  sx={{
                    color: "text.secondary",
                    fontSize: "0.875rem",
                  }}
                >
                  Page {scanState.scannedCount} of {scanState.totalCount}
                  {scanState.paging
                    ? ` • ${scanState.paging.resourcesWalked} resources read • ${scanState.paging.candidatesChecked} checked`
                    : ""}
                  {` • ${scanState.discoveredCount} discovered`}
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
            color: "text.primary",
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
              color: "text.secondary",
            }}
          >
            <CircularProgress size={16} />
            <Typography sx={{ fontSize: "0.875rem" }}>Checking alias activity...</Typography>
          </Box>
        )}

        {sortedAliases.length === 0 && (
          <Typography
            sx={{
              color: "text.secondary",
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
                border: "1px solid", borderColor: "divider",
                borderRadius: "10px",
                backgroundColor: "background.paper",
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
                    color: "text.primary",
                    fontSize: "0.98rem",
                    fontWeight: 600,
                  }}
                >
                  {aliasName}
                </Typography>
                <Typography
                  sx={{
                    color: "text.secondary",
                    fontSize: "0.875rem",
                  }}
                >
                  {hasMessages ? "Has messages" : "No messages detected yet"}
                </Typography>
                <Typography
                  sx={[{
                    fontSize: "0.875rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px"
                  }, linkedReplyAlias ? {
                    color: "primary.main"
                  } : {
                    color: "text.secondary"
                  }]}
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
                      color: "text.primary",
                    },
                  }}
                />
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{
                    flexWrap: "wrap",
                    justifyContent: "flex-end"
                  }}>
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={!hasMessages}
                    onClick={() => {
                      onOpenAlias(aliasName);
                    }}
                    sx={{
                      minHeight: 44,
                    textTransform: "none",
                      borderColor: "divider",
                      color: "text.primary",
                      backgroundColor: "action.hover",
                      "&:hover": {
                        borderColor: "primary.main",
                        backgroundColor: "action.selected",
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
                      minHeight: 44,
                    textTransform: "none",
                      borderColor: "divider",
                      color: "text.primary",
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
                      minHeight: 44,
                    textTransform: "none",
                      color: "text.secondary",
                    }}
                  >
                    Clear Link
                  </Button>
                  <IconButton
                    size="small"
                    aria-label={`Remove alias ${aliasName}`}
                    onClick={() => {
                      onRemoveAlias(aliasName);
                    }}
                    sx={{
                      minWidth: 44,
                      minHeight: 44,
                      color: "text.secondary",
                      "&:hover": {
                        color: "text.primary",
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
