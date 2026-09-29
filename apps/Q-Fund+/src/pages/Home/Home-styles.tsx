import { styled } from "@mui/system";
import { Box, Grid, Typography, Checkbox, Button } from "@mui/material";

export const HomepageTitleRow = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  justifyContent: "center",
  alignItems: "center",
  gap: "20px",
}));

export const Logo = styled("img")(({ theme }) => ({
  width: "100px",
  height: "100px",
}));

export const SubtitleContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  justifyContent: "center",
  alignItems: "center",
  margin: "10px 0px",
  width: "100%",
}));

export const Subtitle = styled(Typography)({
  textAlign: "center",
  fontSize: "20px",
});

const DoubleLine = styled(Typography)`
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
`;
export const ChannelTitle = styled(DoubleLine)(({ theme }) => ({
  fontFamily: "Cairo",
  fontSize: "20px",
  letterSpacing: "0.4px",
  color: theme.palette.text.primary,
  userSelect: "none",
  marginBottom: "auto",
  textAlign: "center",
}));
export const WelcomeTitle = styled(DoubleLine)(({ theme }) => ({
  fontFamily: "Cairo",
  fontSize: "24px",
  letterSpacing: "0.4px",
  color: theme.palette.text.primary,
  userSelect: "none",
  textAlign: "center",
}));

export const WelcomeContainer = styled(Box)(({ theme }) => ({
  position: "fixed",
  width: "90%",
  height: "90%",
  backgroundColor: theme.palette.background.paper,
  left: "50%",
  top: "50%",
  transform: "translate(-50%, -50%)",
  zIndex: 500,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
}));

export const ChannelCard = styled(Grid)(({ theme }) => ({
  position: "relative",
  display: "flex",
  flexDirection: "column",
  height: "auto",
  maxWidth: "100%",
  minHeight: "250px",
  maxHeight: "250px",
  backgroundColor: theme.palette.background.paper,
  borderRadius: "0 0 8px 8px",
  padding: "10px 15px",
  gap: "20px",
  border:
    theme.palette.mode === "dark"
      ? "none"
      : `1px solid ${theme.palette.primary.light}`,
  boxShadow:
    theme.palette.mode === "dark"
      ? "0px 4px 5px 0px hsla(0,0%,0%,0.14),  0px 1px 10px 0px hsla(0,0%,0%,0.12),  0px 2px 4px -1px hsla(0,0%,0%,0.2)"
      : "rgba(99, 99, 99, 0.2) 0px 2px 8px 0px",
  transition: "all 0.3s ease-in-out",
  "&:hover": {
    cursor: "pointer",
    boxShadow:
      theme.palette.mode === "dark"
        ? "0px 8px 10px 1px hsla(0,0%,0%,0.14), 0px 3px 14px 2px hsla(0,0%,0%,0.12), 0px 5px 5px -3px hsla(0,0%,0%,0.2)"
        : "rgba(0, 0, 0, 0.1) 0px 4px 6px -1px, rgba(0, 0, 0, 0.06) 0px 2px 4px -1px;",
  },
}));

export const CrowdfundContainer = styled(Grid)(({ theme }) => ({
  position: "relative",
  display: "flex",
  padding: "15px",
  justifyContent: "center",
  alignItems: "center",
}));

export const BottomWrapper = styled(Box)(({ theme }) => ({
  position: "relative",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginTop: "auto",
}));

export const HomePageContainer = styled(Box)(({ theme }) => ({
  position: "relative",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
  width: "100%",
  gap: "20px",
  background: "linear-gradient(135deg, #74d7c5 0%, #34bfa6 49%, #159892 100%)",
}));

export const HomePageSubContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "40px",
  paddingBottom: "50px",
  textAlign: "center",
}));

export const HomepageTitle = styled(Typography)(({ theme }) => ({
  fontFamily: "Copse",
  fontWeight: 400,
  fontSize: "55px",
  letterSpacing: "1px",
  color: "white",
  userSelect: "none",
}));

export const HomepageDescription = styled(Typography)(({ theme }) => ({
  fontFamily: "Mulish",
  fontSize: "25px",
  letterSpacing: "0px",
  color: "white",
  userSelect: "none",
  padding: "0 200px",
}));

export const StepsContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  justifyContent: "space-evenly",
  alignItems: "flex-start",
  gap: "20px",
  width: "100%",
  padding: "0 30px",
}));

export const StepCol = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
  gap: "10px",
  width: "100%",
}));

export const StepIcon = styled(Box)(({ theme }) => ({
  width: "100px",
  height: "100px",
  border: "2px solid white",
  borderRadius: "50%",
  backgroundColor: "transparent",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
}));

export const StepTitle = styled(Typography)(({ theme }) => ({
  fontFamily: "Copse",
  fontWeight: 400,
  fontSize: "25px",
  letterSpacing: "1px",
  color: "white",
  userSelect: "none",
}));

export const StepDescription = styled(Typography)(({ theme }) => ({
  fontFamily: "Mulish",
  fontWeight: 400,
  fontSize: "19px",
  letterSpacing: "0px",
  color: "white",
  userSelect: "none",
}));

export const CrowdfundListHeader = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  alignItems: "flex-start",
  width: "100%",
  padding: "25px 0 10px 45px",
}));

export const CrowdfundListTitle = styled(Typography)(({ theme }) => ({
  fontFamily: "Copse",
  fontWeight: 400,
  fontSize: "25px",
  letterSpacing: "0.5px",
  color: theme.palette.text.primary,
  userSelect: "none",
}));

export const CardContainer = styled(Box)({
  display: "flex",
  flexDirection: "column",
  height: "auto",
  width: "100%",
});

export const CrowdfundImageContainer = styled(Box)({
  display: "flex",
  position: "relative",
  cursor: "pointer",
});

export const CrowdfundTitleCard = styled(Box)(({ theme }) => ({
  position: "absolute",
  bottom: 0,
  display: "flex",
  flexDirection: "column",
  height: "auto",
  width: "100%",
  backgroundColor:
    theme.palette.mode === "dark"
      ? "rgba(142, 146, 223, 0.8)"
      : "rgba(169, 217, 208, 0.8)",
  color: theme.palette.text.primary,
  padding: "5px 15px",
  gap: "5px",
}));

export const CrowdfundTitle = styled(Typography)({
  fontFamily: "Montserrat",
  fontWeight: 400,
  fontSize: "20px",
  letterSpacing: "0.4px",
  userSelect: "none",
});

export const NameContainer = styled(Box)({
  display: "flex",
  flexDirection: "row",
  justifyContent: "flex-start",
  alignItems: "center",
  gap: "5px",
});

export const CrowdfundOwner = styled(Typography)({
  fontFamily: "Mulish",
  fontSize: "16px",
  letterSpacing: "0px",
  userSelect: "none",
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
  width: "100%",
});

export const CrowdfundDescription = styled(Typography)(({ theme }) => ({
  fontFamily: "Mulish",
  fontSize: "16px",
  letterSpacing: "0px",
  color: theme.palette.text.primary,
  userSelect: "none",
}));

export const DonateButton = styled(Button)(({ theme }) => ({
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  minWidth: "200px",
  width: "44%",
  padding: "5px 25px",
  borderRadius: "20px",
  backgroundColor: theme.palette.primary.main,
  color: "white",
  fontFamily: "Mulish",
  fontSize: "14px",
  fontWeight: 400,
  letterSpacing: "0.4px",
  textTransform: "none",
  transition: "all 0.3s ease-in-out",
  "&:hover": {
    backgroundColor: theme.palette.primary.dark,
    cursor: "pointer",
  },
}));

export const CrowdfundGoalRow = styled(Box)({
  display: "flex",
  alignItems: "center",
  gap: "7px",
  width: "100%",
});

export const CrowdfundText = styled(Typography)({
  fontFamily: "Mulish",
  fontSize: "18px",
  fontWeight: 400,
  letterSpacing: "0.4px",
  userSelect: "none",
});

export const CrowdfundGoal = styled(Box)({
  display: "flex",
  alignItems: "center",
  gap: "3px",
  fontFamily: "Mulish",
  fontSize: "18px",
  fontWeight: 400,
  letterSpacing: "0.4px",
});
