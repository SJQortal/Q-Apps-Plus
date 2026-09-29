import React, { useRef, useState, useEffect, useMemo, useContext } from "react";
import { useSelector } from "react-redux";
import { RootState } from "../../state/store";
import { MyContext } from "../../wrappers/DownloadWrapper";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import PauseCircleOutlineIcon from "@mui/icons-material/PauseCircleOutline";
import Slider from "@mui/material/Slider";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import DownloadIcon from "@mui/icons-material/Download";
import FileElement from "./FileElement";
import {
  FileAttachmentContainer,
  FileAttachmentFont,
  PlayerBox,
} from "../../pages/Crowdfund/Update-styles";

interface AudioPlayerProps {
  name: string;
  identifier: string;
  service: string;
  jsonId: string;
  user: string;
  filename: string;
  fullFile?: any;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({
  name,
  identifier,
  service,
  jsonId,
  user,
  filename,
  fullFile,
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const { downloadVideo } = useContext(MyContext);
  const reDownload = useRef<boolean>(false);
  const [volume, setVolume] = useState(0.5);
  const [isLoading, setIsLoading] = useState(false);
  const [canPlay, setCanPlay] = useState(false);
  const [startPlay, setStartPlay] = useState(false);
  const { downloads } = useSelector((state: RootState) => state.global);
  const download = useMemo(() => {
    if (!downloads || !identifier) return {};
    const findDownload = downloads[identifier];

    if (!findDownload) return {};
    return findDownload;
  }, [downloads, identifier]);

  const src = useMemo(() => {
    return download?.url || "";
  }, [download?.url]);

  const resourceStatus = useMemo(() => {
    return download?.status || {};
  }, [download]);

  const getSrc = React.useCallback(async () => {
    if (!name || !identifier || !service || !jsonId || !user) return;
    try {
      downloadVideo({
        name,
        service,
        identifier,
        properties: {
          jsonId,
          user,
          ...fullFile,
        },
      });
    } catch (error) {
      console.error(error);
    }
  }, [identifier, name, service, jsonId, user]);

  useEffect(() => {
    const audio = audioRef.current;
    const updateProgress = () => {
      if (audio) {
        setProgress((audio.currentTime / audio.duration) * 100);
      }
    };

    if (audio) {
      audio.addEventListener("timeupdate", updateProgress);
    }

    return () => {
      if (audio) {
        audio.removeEventListener("timeupdate", updateProgress);
      }
    };
  }, []);

  const togglePlayPause = () => {
    if (!audioRef.current) return;
    const audio = audioRef.current;
    setStartPlay(true);
    if (!src || resourceStatus?.status !== "READY") {
      setIsLoading(true);
      getSrc();
    }
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  useEffect(() => {
    if (
      resourceStatus?.status === "DOWNLOADED" &&
      reDownload?.current === false
    ) {
      getSrc();
      reDownload.current = true;
    }
  }, [getSrc, resourceStatus]);

  const handleCanPlay = () => {
    setIsLoading(false);
    setCanPlay(true);
  };

  const handleVolumeChange = (e: Event, newValue: number | number[]) => {
    const volume = Array.isArray(newValue) ? newValue[0] : newValue;
    setVolume(volume);
  };

  const handleProgressClick = (e: Event, newValue: number | number[]) => {
    const audio = audioRef.current;
    const clickPositionInPercentage = Array.isArray(newValue)
      ? newValue[0]
      : newValue;

    if (audio) {
      audio.currentTime = (clickPositionInPercentage * audio.duration) / 100;
    }
  };

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  return (
    <PlayerBox>
      <FileAttachmentContainer>
        <FileAttachmentFont>{filename}</FileAttachmentFont>
        <audio
          autoPlay={true}
          src={!startPlay ? "" : resourceStatus?.status === "READY" ? src : ""}
          onCanPlay={handleCanPlay}
          ref={audioRef}
        />
      </FileAttachmentContainer>
      <Box sx={{ display: "flex", alignItems: "center", pl: 1, pr: 1 }}>
        {isLoading ? (
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <CircularProgress size={20} />
            <Typography variant="body2">{`${Math.round(
              resourceStatus?.percentLoaded || 0
            ).toFixed(0)}% loaded`}</Typography>
          </Box>
        ) : (
          <>
            <IconButton
              onClick={togglePlayPause}
              sx={{
                margin: "0px",
                padding: "0px",
                marginRight: "5px",
              }}
            >
              {isPlaying ? (
                <PauseCircleOutlineIcon fontSize="large" />
              ) : (
                <PlayCircleOutlineIcon fontSize="large" />
              )}
            </IconButton>

            <Slider
              min={0}
              max={100}
              value={progress}
              onChange={handleProgressClick}
              sx={{ ml: 1, mr: 1 }}
            />
            <Slider
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={handleVolumeChange}
              sx={{ ml: 1, mr: 1, width: "35%" }}
            />
          </>
        )}
      </Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          pl: 1,
          pr: 1,
        }}
      >
        {fullFile && (
          <FileElement
            fileInfo={fullFile}
            title={fullFile?.filename}
            customStyles={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
            }}
          >
            <DownloadIcon />
          </FileElement>
        )}
      </Box>
    </PlayerBox>
  );
};

export default AudioPlayer;
