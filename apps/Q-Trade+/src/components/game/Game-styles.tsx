import { Box } from "@mui/material";
import { styled } from "@mui/system";

interface ICellProps {
  borderTopStyle?: boolean;
  borderRightStyle?: boolean;
  borderLeftStyle?: boolean;
  borderBottomStyle?: boolean;
}

export const Cell = styled(Box)<ICellProps>(
  ({
    borderTopStyle,
    borderLeftStyle,
    borderBottomStyle,
    borderRightStyle,
  }) => ({
    width: "13em",
    height: "9em",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "20px",
    cursor: "pointer",
    borderTop: borderTopStyle ? "3px solid #8e44ad" : "none",
    borderLeft: borderLeftStyle ? "3px solid #8e44ad" : "none",
    borderBottom: borderBottomStyle ? "3px solid #8e44ad" : "none",
    borderRight: borderRightStyle ? "3px solid #8e44ad" : "none",
    transition: "all 270ms ease-in-out",
    "&:hover": {
      backgroundColor: "#8d44ad28",
    },
  })
);

export const X = styled("span")({
  fontSize: "100px",
  color: "#8e44ad",
  "&::after": {
    content: "X",
  },
});

export const O = styled("span")({
  fontSize: "100px",
  color: "#8e44ad",
  "&::after": {
    content: "O",
  },
});

export const GameContainer = styled(Box)({
  display: "flex",
  flexDirection: "column",
  margin: "100px 0 50px 0",
  gap: "15px",
  fontFamily: "Zen Tokyo Zoo, cursive",
  position: "relative",
});

export const RowContainer = styled(Box)({
  display: "flex",
  width: "100%",
});
