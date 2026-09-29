import React, { useState, useEffect, CSSProperties } from "react";
import Skeleton from "@mui/material/Skeleton";
import { Box } from "@mui/material";

interface ResponsiveImageProps {
  src: string;
  dimensions: string;
  alt?: string;
  className?: string;
  style?: CSSProperties;
}

const ResponsiveImage: React.FC<ResponsiveImageProps> = ({
  src,
  dimensions,
  alt,
  className,
  style
}) => {
  const [loading, setLoading] = useState(true);
  const matchResult = dimensions?.match(/v1\.(\d+(\.\d+)?)x(\d+)/);

  const width = matchResult ? parseFloat(matchResult[1]) : 1; // Default width value
  const height = matchResult ? parseInt(matchResult[3], 10) : 1; // Default height value

  const aspectRatio = (height / width) * 100;

  useEffect(() => {
    if (dimensions === "v1.0x0") {
      setLoading(false);
      return;
    }
  }, [dimensions]);

  if (dimensions === "v1.0x0" || !dimensions) {
    return null;
  }

  const imageStyle: CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover"
  };

  const wrapperStyle: CSSProperties = {
    position: "relative",
    paddingBottom: `${aspectRatio}%`,
    overflow: "hidden",
    ...style
  };

  return (
    <Box
      sx={{
        padding: "2px"
      }}
    >
      {/* <img
        onLoad={() => setLoading(false)}
        src={src}
        style={{
          width: '100%',
          height: 'auto',
          borderRadius: '8px'
        }}
      /> */}
      {loading && (
        <Skeleton
          variant="rectangular"
          style={{
            width: "100%",
            height: 0,
            paddingBottom: `${(height / width) * 100}%`,
            objectFit: "contain",
            visibility: loading ? "visible" : "hidden",
            borderRadius: "8px"
          }}
        />
      )}

      <img
        onLoad={() => setLoading(false)}
        src={src}
        style={{
          width: "100%",
          height: "auto",
          borderRadius: "8px",
          visibility: loading ? "hidden" : "visible",
          position: loading ? "absolute" : "unset"
        }}
      />
    </Box>
  );

  return (
    <div style={wrapperStyle} className={className}>
      {loading ? (
        <Skeleton
          variant="rectangular"
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0
          }}
        />
      ) : (
        <img
          src={src}
          alt={alt}
          style={{
            ...imageStyle,
            position: "absolute",
            top: 0,
            left: 0
          }}
        />
      )}
    </div>
  );
};

export default ResponsiveImage;
