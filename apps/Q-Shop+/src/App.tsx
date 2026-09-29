import { Routes, Route } from "react-router-dom";
import { ProductPage } from "./pages/Product/ProductPage";
import { StoreList } from "./pages/StoreList/StoreList";
import { store } from "./state/store";
import { Provider } from "react-redux";
import { Store } from "./pages/Store/Store/Store";
import { MyOrders } from "./pages/MyOrders/MyOrders";
import GlobalWrapper from "./wrappers/GlobalWrapper";
import Notification from "./components/common/Notification/Notification";
import { ProductManager } from "./pages/ProductManager/ProductManager";
import { HubThemeProvider } from "./hub-theme";
import { THEME_STORAGE_KEY, themeConfig } from "./theme/qplus-theme";

function App() {
  return (
    <Provider store={store}>
      <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
        <Notification />
        <GlobalWrapper>
          <Routes>
            <Route
              path="/:user/:store/:product/:catalogue"
              element={<ProductPage />}
            />
            <Route
              path="/product-manager/:store"
              element={<ProductManager />}
            />
            <Route path="/my-orders" element={<MyOrders />} />
            <Route path="/:user/:store" element={<Store />} />
            <Route path="/" element={<StoreList />} />
          </Routes>
        </GlobalWrapper>
      </HubThemeProvider>
    </Provider>
  );
}

export default App;
