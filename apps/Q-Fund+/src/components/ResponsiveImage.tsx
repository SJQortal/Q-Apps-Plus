import React, { useState, useEffect, CSSProperties } from "react";
import Skeleton from "@mui/material/Skeleton";
import { Box } from "@mui/material";

interface ResponsiveImageProps {
  src: string;
  width: number;
  height: number;
  alt?: string;
  className?: string;
  styles?: CSSProperties;
}

const ResponsiveImage: React.FC<ResponsiveImageProps> = ({
  src,
  width,
  height,
  alt,
  className,
  styles,
}) => {
  const [loading, setLoading] = useState(true);

  return (
    <>
      {loading && (
        <Skeleton
          variant="rectangular"
          style={{
            width: "100%",
            height: 0,
            paddingBottom: `${(height / width) * 100}%`,
            objectFit: "cover",
            visibility: loading ? "visible" : "hidden",
            borderRadius: "8px 8px 0px 0px",
          }}
        />
      )}

      <img
        onLoad={() => setLoading(false)}
        src={src}
        style={{
          width: "100%",
          height: "auto",
          borderRadius: "8px 8px 0px 0px",
          visibility: loading ? "hidden" : "visible",
          position: loading ? "absolute" : "unset",
          ...(styles || {}),
        }}
      />
    </>
  );
};

export default ResponsiveImage;
