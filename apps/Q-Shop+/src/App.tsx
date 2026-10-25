import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";
import { Provider } from "react-redux";
import { store } from "./state/store";
import GlobalWrapper from "./wrappers/GlobalWrapper";
import Notification from "./components/common/Notification/Notification";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import { HubThemeProvider } from "./hub-theme";
import { THEME_STORAGE_KEY, themeConfig } from "./theme/qplus-theme";

// Every screen loads on demand, so the first paint only carries the shell
// (docs/QORTAL.md → Efficiency rules 8). Route shapes are the original's, so
// links copied from Q-Shop open here too.
const StoreList = lazy(() => import("./pages/StoreList/StoreList").then((m) => ({ default: m.StoreList })));
const ProductsPage = lazy(() => import("./pages/Products/ProductsPage").then((m) => ({ default: m.ProductsPage })));
const Store = lazy(() => import("./pages/Store/Store/Store").then((m) => ({ default: m.Store })));
const ProductPage = lazy(() => import("./pages/Product/ProductPage").then((m) => ({ default: m.ProductPage })));
const ProductManager = lazy(() =>
  import("./pages/ProductManager/ProductManager").then((m) => ({ default: m.ProductManager }))
);
const MyOrders = lazy(() => import("./pages/MyOrders/MyOrders").then((m) => ({ default: m.MyOrders })));
const CartPage = lazy(() => import("./pages/Cart/CartPage").then((m) => ({ default: m.CartPage })));
const SettingsPage = lazy(() => import("./pages/Settings/SettingsPage").then((m) => ({ default: m.SettingsPage })));
const FavoritesPage = lazy(() => import("./pages/Favorites/FavoritesPage").then((m) => ({ default: m.FavoritesPage })));
const NamesPage = lazy(() => import("./names/NamesPage").then((m) => ({ default: m.NamesPage })));

function RouteFallback() {
  return (
    <Box sx={{ display: "flex", justifyContent: "center", py: 8 }} role="status" aria-label="Loading">
      <CircularProgress size={28} />
    </Box>
  );
}

function App() {
  return (
    <Provider store={store}>
      <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
        <Notification />
        <ErrorBoundary>
          <GlobalWrapper>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/:user/:store/:product/:catalogue" element={<ProductPage />} />
                <Route path="/product-manager/:store" element={<ProductManager />} />
                <Route path="/my-orders" element={<MyOrders />} />
                <Route path="/cart" element={<CartPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/favorites" element={<FavoritesPage />} />
                <Route path="/products" element={<ProductsPage />} />
                <Route path="/names" element={<NamesPage />} />
                <Route path="/:user/:store" element={<Store />} />
                <Route path="/" element={<StoreList />} />
              </Routes>
            </Suspense>
          </GlobalWrapper>
        </ErrorBoundary>
      </HubThemeProvider>
    </Provider>
  );
}

export default App;
