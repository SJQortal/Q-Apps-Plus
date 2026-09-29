import { styled } from "@mui/system";
import { TableRow } from "@mui/material";

export const StyledTableRow = styled(TableRow)(({ theme }) => ({
  transition: "all 0.2s ease-in-out",
  "&:hover": {
    cursor: "pointer",
    backgroundColor: theme.palette.background.paper
  }
}));
