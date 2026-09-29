import { useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import { CssBaseline } from "@mui/material";
import { darkTheme, lightTheme } from "./styles/theme";
import { store } from "./state/store";
import { Provider } from "react-redux";
import GlobalWrapper from "./wrappers/GlobalWrapper";
import Notification from "./components/common/Notification/Notification";
import { Home } from "./pages/Home/Home";
import { IssueContent } from "./pages/IssueContent/IssueContent.tsx";
import DownloadWrapper from "./wrappers/DownloadWrapper";
import { IndividualProfile } from "./pages/IndividualProfile/IndividualProfile";
import { fetchFeesRedux } from "./constants/PublishFees/FeePricePublish/FeePricePublish.ts";

function App() {
  // const themeColor = window._qdnTheme
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    fetchFeesRedux();
  }, []);

  return (
    <Provider store={store}>
      <ThemeProvider theme={theme === "light" ? lightTheme : darkTheme}>
        <Notification />
        <DownloadWrapper>
          <GlobalWrapper setTheme={(val: string) => setTheme(val)}>
            <CssBaseline />
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/issue/:name/:id" element={<IssueContent />} />
              <Route path="/channel/:name" element={<IndividualProfile />} />
            </Routes>
          </GlobalWrapper>
        </DownloadWrapper>
      </ThemeProvider>
    </Provider>
  );
}

export default App;
