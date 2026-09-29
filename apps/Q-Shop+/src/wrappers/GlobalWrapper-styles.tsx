import { styled } from "@mui/system";
import { Button, Stack, Typography } from "@mui/material";

export const CustomModalTitle = styled(Typography)({
  textAlign: "center",
  fontFamily: "Merriweather Sans",
  fontSize: "30px",
  fontWeight: 500,
  color: "#a01717",
  userSelect: "none"
});

export const CustomModalButton = styled(Button)(({ theme }) => ({
  alignSelf: "center",
  fontFamily: "Raleway",
  fontWeight: 400,
  width: "50%",
  backgroundColor: theme.palette.secondary.main,
  color: "#fff",
  transition: "all 0.3s ease-in-out",
  borderRadius: "5px",
  "&:hover": {
    backgroundColor: theme.palette.secondary.dark,
    cursor: "pointer"
  }
}));

export const DownloadQortalCol = styled(Stack)(({theme}) => ({
  display: "flex",
  flexDirection: "column",
  justifyContent: "flex-start",
  alignItems: "center",
  gap: "15px",
  textAlign: "center",
  width: "100%",
  height: "100%",
}))

export const QortalIcon = styled("img")({
  width: "120px",
  height: "120px",
  userSelect: "none"
})

export const DownloadQortalFont = styled(Typography)(({theme}) => ({
  fontFamily: "Figtree",
  letterSpacing: "2.2px",
  lineHeight: '52px',
  fontSize: "50px",
  fontWeight: 600,
  color: theme.palette.text.primary
}))

export const DownloadQortalSubFont = styled(Typography)(({theme}) => ({
  fontFamily: "Raleway",
  fontSize: "25px",
  lineHeight: "38px",
  fontWeight: 500,
  color: theme.palette.text.primary,
  userSelect: "none"
}))

export const DownloadNowButton = styled(Button)(({theme}) => ({
  fontFamily: "Montserrat",
  fontSize: "22px",
  marginTop: "20px",
  fontWeight: 500,
  width: "90%",
  padding: "12px 20px",
  gap: "10px",
  backgroundColor: theme.palette.secondary.main,
  color: "#fff",
  transition: "all 0.3s ease-in-out",
  borderRadius: "10px",
  boxShadow:
    "rgba(50, 50, 93, 0.25) 0px 2px 5px -1px, rgba(0, 0, 0, 0.3) 0px 1px 3px -1px;",
  "&:hover": {
    cursor: "pointer",
    backgroundColor: theme.palette.secondary.dark,
    boxShadow:
      "rgba(50, 50, 93, 0.35) 0px 3px 5px -1px, rgba(0, 0, 0, 0.4) 0px 2px 3px -1px;"
  }
}))