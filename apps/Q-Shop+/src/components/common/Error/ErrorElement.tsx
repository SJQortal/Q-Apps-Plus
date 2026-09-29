import { Container, HeaderText, BackButton, HeaderRow } from "./Error-styles";
import { useTheme } from "@mui/material";
import { WarningSVG } from "../../../assets/svgs/WarningSVG";

interface ErrorElementProps {
  message: string;
}

export const ErrorElement: React.FC<ErrorElementProps> = ({ message }) => {
  const theme = useTheme();

  return (
    <Container>
      <HeaderRow>
        <WarningSVG
          color={theme.palette.text.primary}
          height={"35"}
          width={"35"}
        />
        <HeaderText variant="h1">{message}</HeaderText>
      </HeaderRow>
      <HeaderText variant="h2">
        Please return home or try refreshing the page!
      </HeaderText>
      <BackButton
        onClick={() => {
          window.location.reload();
        }}
      >
        Back Home
      </BackButton>
    </Container>
  );
};
