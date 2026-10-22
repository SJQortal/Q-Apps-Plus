/**
 * A video in a product description: a 16:9 panel with Play. Nothing is
 * asked of the node until the buyer presses it; then the video is fetched
 * from peers if it has to be (qdn/resourceStatus.ts, with progress) and
 * plays in the browser's own player. Under it: its title, who published it,
 * and Open in Q-Tube when it came from there.
 */
import { useEffect, useRef, useState } from "react";
import { Box, Button, CircularProgress, IconButton, Link, Typography } from "@mui/material";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import { ResourceUnavailableError, resourceUrl, waitForResource } from "../qdn/resourceStatus";
import type { VideoEmbed } from "./embeds";

type Phase = "idle" | "fetching" | "ready" | "failed";

export function QortalVideo({ embed }: { embed: VideoEmbed }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [percent, setPercent] = useState<number | null>(null);
  const [problem, setProblem] = useState("");
  const stop = useRef<AbortController | null>(null);
  useEffect(() => () => stop.current?.abort(), []);
  const title = embed.title || "Video";
  const ref = { service: "VIDEO" as const, name: embed.name, identifier: embed.identifier };

  const play = async () => {
    stop.current?.abort();
    const controller = new AbortController();
    stop.current = controller;
    setPhase("fetching");
    setPercent(null);
    try {
      await waitForResource(ref, {
        signal: controller.signal,
        onStatus: (s) => setPercent(s.status === "DOWNLOADING" || s.status === "DOWNLOADED" ? Math.round(s.percentLoaded ?? 0) : null),
      });
      if (!controller.signal.aborted) setPhase("ready");
    } catch (error) {
      if (controller.signal.aborted) return;
      setProblem(error instanceof ResourceUnavailableError ? error.message : "Your node couldn't get the video right now.");
      setPhase("failed");
    }
  };

  return (
    <Box component="figure" sx={{ m: 0, display: "flex", flexDirection: "column", gap: 0.75 }}>
      <Box
        sx={{
          position: "relative",
          width: "100%",
          aspectRatio: "16 / 9",
          borderRadius: 2,
          overflow: "hidden",
          bgcolor: "common.black",
          color: "common.white",
          display: "grid",
          placeItems: "center",
        }}
      >
        {phase === "ready" ? (
          <Box
            component="video"
            controls
            autoPlay
            playsInline
            preload="metadata"
            src={resourceUrl(ref)}
            aria-label={title}
            sx={{ width: "100%", height: "100%", display: "block", bgcolor: "common.black" }}
          />
        ) : phase === "fetching" ? (
          <Box role="status" sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1, p: 2, textAlign: "center" }}>
            <CircularProgress color="inherit" size={32} />
            <Typography variant="body2">
              Getting the video from peers{percent !== null && percent > 0 ? `… ${percent} %` : "…"}
            </Typography>
          </Box>
        ) : phase === "failed" ? (
          <Box role="alert" sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1, p: 2, textAlign: "center" }}>
            <Typography variant="body2">{problem}</Typography>
            <Button variant="outlined" color="inherit" onClick={play} sx={{ minHeight: 44 }}>
              Try again
            </Button>
          </Box>
        ) : (
          <IconButton
            aria-label={`Play video: ${title}`}
            onClick={play}
            sx={{ width: 72, height: 72, bgcolor: "primary.main", color: "primary.contrastText", "&:hover": { bgcolor: "primary.dark" } }}
          >
            <PlayArrowRoundedIcon sx={{ fontSize: 44 }} />
          </IconButton>
        )}
      </Box>
      <Box component="figcaption" sx={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", columnGap: 1.5, rowGap: 0.25 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
          by {embed.name}
        </Typography>
        {embed.link?.toLowerCase().startsWith("qortal://app/q-tube/") && (
          <Link href={embed.link} className="qortal-link" variant="body2" underline="always" sx={{ display: "inline-flex", alignItems: "center", minHeight: 44 }}>
            Open in Q-Tube
          </Link>
        )}
      </Box>
    </Box>
  );
}
