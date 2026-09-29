import { Box } from "@mui/material";

export const Spacer = ({ height }: any) => {
    return (
      <Box
        sx={{
          height: height,
          display: 'flex',
          flexShrink: 0
        }}
      />
    );
  };