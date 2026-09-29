import { Box, CircularProgress } from "@mui/material";

export function PageFallback() {
  return (
    <Box sx={{ display: "flex", justifyContent: "center", p: 6 }}>
      <CircularProgress size={32} />
    </Box>
  );
}
