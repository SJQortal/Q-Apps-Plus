import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../../state/store";
import { useParams } from "react-router-dom";
import {
  useTheme,
  Grid,
  CircularProgress,
  Chip,
  FormControl,
  Rating,
  Typography,
  Skeleton,
} from "@mui/material";
import {
  Catalogue,
  resetListProducts,
  resetProducts,
  setIsLoadingGlobal,
  updateRecentlyVisitedStoreId,
} from "../../../state/features/globalSlice";
import {
  Product,
  clearReviews,
  clearViewedStoreDataContainer,
  setCurrentViewedStore,
  setPreferredCoin,
  setViewedStoreDataContainer,
} from "../../../state/features/storeSlice";
import LazyLoad from "../../../components/common/LazyLoad";
import ContextMenuResource from "../../../components/common/ContextMenu/ContextMenuResource";
import { setStoreId, setStoreOwner } from "../../../state/features/storeSlice";
import { ProductCard } from "../ProductCard/ProductCard";
import { ProductDataContainer } from "../../../state/features/globalSlice";
import { useFetchOrders } from "../../../hooks/useFetchOrders";
import {
  ProductManagerRow,
  ProductManagerButton,
  BackToStorefrontButton,
  ProductsContainer,
  NoProductsContainer,
  NoProductsText,
  StoreControlsRow,
  EditStoreButton,
  CartIconContainer,
  NotificationBadge,
  FiltersCol,
  FiltersContainer,
  FiltersTitle,
  FiltersCheckbox,
  FiltersRow,
  FiltersSubContainer,
  FilterSelect,
  FilterSelectMenuItems,
  ProductCardCol,
  StoreTitleCard,
  StoreLogo,
  StoreTitleCol,
  StoreTitle,
  RatingContainer,
  ReusableModalStyled,
  FiltersOption,
  FiltersChip,
  AcceptedCoinRow,
  OfferedCoinsRow,
} from "./Store-styles";
import { toggleEditStoreModal } from "../../../state/features/globalSlice";
import { CartIcon } from "../../../components/layout/Navbar/Navbar-styles";
import { setIsOpen } from "../../../state/features/cartSlice";
import { Cart as CartInterface } from "../../../state/features/cartSlice";
import { ExpandMoreSVG } from "../../../assets/svgs/ExpandMoreSVG";
import { StoreDetails } from "../StoreDetails/StoreDetails";
import { StoreReviews } from "../StoreReviews/StoreReviews";
import { setNotification } from "../../../state/features/notificationsSlice";
import {
  DATA_CONTAINER_BASE,
  REVIEW_BASE,
  STORE_BASE,
} from "../../../constants/identifiers";
import QORT from "../../../assets/img/qort.png";
import ARRR from "../../../assets/img/arrr.png";
import {
  AcceptedCoin,
  ExchangeRateCard,
  ExchangeRateRow,
  ExchangeRateSubTitle,
  ExchangeRateTitle,
} from "../../StoreList/StoreList-styles";
import { CompareArrowsSVG } from "../../../assets/svgs/CompareArrowsSVG";

interface IListProducts {
  sort: string;
  products: ProductDataContainer[];
  categories: { label: string }[];
}

enum PriceFilter {
  highest = "Highest",
  lowest = "Lowest",
}

enum DateFilter {
  newest = "Newest",
  oldest = "Oldest",
}

export enum CoinFilter {
  qort = "QORT",
  arrr = "ARRR",
}

export const Store = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const dispatch = useDispatch();

  const isFirstMountRef = useRef(false);

  const user = useSelector((state: RootState) => state.auth.user);
  const currentStore = useSelector(
    (state: RootState) => state.global.currentStore
  );
  const isLoadingGlobal = useSelector(
    (state: RootState) => state.global.isLoadingGlobal
  );
  const catalogueHashMap = useSelector(
    (state: RootState) => state.global.catalogueHashMap
  );
  // Fetch all carts from Redux
  const carts = useSelector((state: RootState) => state.cart.carts);
  // Get storeId from Redux
  const storeId = useSelector((state: RootState) => state.store.storeId);
  // Get storeOwner from Redux
  const storeOwner = useSelector((state: RootState) => state.store.storeOwner);
  const preferredCoin = useSelector((state: RootState) => state.store.preferredCoin);

  // Get current viewed store from Redux
  const currentViewedStore = useSelector(
    (state: RootState) => state.store.currentViewedStore
  );
  // List products from store's data container
  const viewedStoreListProducts = useSelector(
    (state: RootState) => state.store.viewedStoreListProducts
  );
  // List products from store's data container when you own the store
  const ownStoreListProducts = useSelector(
    (state: RootState) => state.global.listProducts
  );

  // Your own data container
  const userOwnDataContainer = useSelector(
    (state: RootState) => state.global.dataContainer
  );

  const { checkAndUpdateResourceCatalogue, getCatalogue } = useFetchOrders();

  const { store, user: username } = useParams();

  const [products, setProducts] = React.useState<Product[]>([]);
  const [totalCartQuantity, setTotalCartQuantity] = useState<number>(0);
  const [filterPrice, setFilterPrice] = useState<PriceFilter | null>(null);
  const [filterDate, setFilterDate] = useState<DateFilter | null>(
    DateFilter.newest
  );
  const [filterCoin, setFilterCoin] = useState<string>(CoinFilter.qort);
  const [categoryChips, setCategoryChips] = useState<string[]>([]);
  const [openStoreDetails, setOpenStoreDetails] = useState<boolean>(false);
  const [openStoreReviews, setOpenStoreReviews] = useState<boolean>(false);
  const [averageStoreRating, setAverageStoreRating] = useState<number | null>(
    null
  );
  const [averageRatingLoader, setAverageRatingLoader] =
    useState<boolean>(false);
  const [hasFetched, setHasFetched] = useState<boolean>(false);
  const [exchangeRate, setExchangeRate] = useState<number | null>(
    null
  );

  const storeToUse = useMemo(()=> {
   return username === user?.name
  ? currentStore
  : currentViewedStore
  }, [username, user?.name, currentStore, currentViewedStore])

  const calculateARRRExchangeRate = async()=> {
    try {
      const url = '/crosschain/price/PIRATECHAIN?maxtrades=10&inverse=true'
    const info = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    const responseDataStore = await info.text();

    const ratio = +responseDataStore /100000000
    if(isNaN(ratio)) throw new Error('Cannot get exchange rate')
    setExchangeRate(ratio)
    } catch (error) {
      dispatch(setPreferredCoin(CoinFilter.qort))
      dispatch(
        setNotification({
          alertType: "error",
          msg: "Cannot get exchange rate- reverted to QORT",
        })
      );
    }

  }

  const switchCoin = async ()=> {
    dispatch(setIsLoadingGlobal(true));
    await calculateARRRExchangeRate()
    dispatch(setIsLoadingGlobal(false));
  }

  // If shop's datacontainer changes, and listProducts becomes empty, clear local products array
  useEffect(() => {
    if (username === user?.name && userOwnDataContainer && Object.keys(userOwnDataContainer.products).length === 0) {
      setProducts([]);
    }
  }, [userOwnDataContainer]);

  useEffect(()=> {
    if(preferredCoin === CoinFilter.arrr && storeToUse?.supportedCoins?.includes(CoinFilter.arrr)){
      switchCoin()
    } 
  }, [preferredCoin, storeToUse])

  const coinToUse = useMemo(()=> {
    if(preferredCoin === CoinFilter.arrr && storeToUse?.supportedCoins?.includes(CoinFilter.arrr)){
      return CoinFilter.arrr
    } else {
      return CoinFilter.qort
    }
  }, [preferredCoin, storeToUse])
  const getProducts = useCallback(async () => {
    if (!store) return;
    try {
      const offset = products.length;
      // Get products from store's data container, with ternary depending on whether you own the store or not
      const productList =
        username !== user?.name
          ? viewedStoreListProducts.products
          : ownStoreListProducts.products;
      const responseData = productList.slice(offset, offset + 20);
      const structureData = responseData.map(
        (product: ProductDataContainer): Product => {
          return {
            created: product?.created,
            catalogueId: product.catalogueId,
            id: product?.productId || "",
            user: product?.user || "",
            status: product?.status || "",
          };
        }
      );
      isFirstMountRef.current = true;
      setHasFetched(true);
      const copiedProducts = [...products];
      structureData.forEach((product: Product) => {
        const index = copiedProducts.findIndex(p => p.id === product.id);
        if (index !== -1) {
          copiedProducts[index] = product;
        } else {
          copiedProducts.push(product);
        }
      });
      setProducts(copiedProducts);
      // First check in catalogueHashMap if the product raw data is available. If it is, don't do anything as that data will already be available to use in the filterProducts useMemo() function.
      // If it isn't in catalogueHashMap, loop through the products and add the catalogue found so that you don't fetch other catalogues that you don't need, as each one contains 10 products. This goes too fast on first mount, therefore you can't rely on redux to verify if the catalogue is available or not.
      let localCatalogue: Record<string, Catalogue> = {};
      for (const content of structureData) {
        if (
          (catalogueHashMap[content.catalogueId] &&
            catalogueHashMap[content.catalogueId].products[content.id]) ||
          localCatalogue[content.catalogueId]
        ) {
          continue;
        }
        if (content.user && content.id) {
          const res = checkAndUpdateResourceCatalogue({
            id: content.catalogueId,
          });
          if (res) {
            const fetchedCatalogue: Catalogue = await getCatalogue(
              content.user,
              content.catalogueId
            );
            if (fetchedCatalogue) {
              localCatalogue = {
                ...localCatalogue,
                [content.catalogueId]: fetchedCatalogue,
              };
            }
          }
        }
      }
    } catch (error) {
      console.error(error);
    }
  }, [
    products,
    viewedStoreListProducts.products,
    ownStoreListProducts.products,
    store,
    username,
    user?.name,
  ]);

  // Get products on mount
  useEffect(() => {
    // Get products from store's data container, with ternary depending on whether you own the store or not
    if (!isFirstMountRef.current && store) {
      const productList =
        username && username !== user?.name
          ? viewedStoreListProducts.products
          : ownStoreListProducts.products;
      if (productList.length === 0) return;
      // This gets the product raw data
      getProducts();
    }
  }, [
    getProducts,
    username,
    user?.name,
    store,
    viewedStoreListProducts?.products,
    ownStoreListProducts?.products,
  ]);

  // Get store on mount & dipatch setCurrentViewedStore to redux when it's not your store. If it is your store, this is handled already in the global wrapper, so we do nothing as well.
  const getStore = useCallback(async () => {
    let name = username;
    if (!name) return;
    if (!store) return;

    try {
      dispatch(setIsLoadingGlobal(true));
      // Have access to the storeId, store owner and recently viewed store id in global state for when you are in cart for example
      dispatch(setStoreId(store));
      dispatch(updateRecentlyVisitedStoreId(store));
      dispatch(setStoreOwner(name));
      // Check if store data is not already inside redux, and that if it is, that it's not from another store. This is to avoid unnecessary QDN calls. getProducts() will get its data from the existing data container in Redux if the store hasn't changed, hence why we clear the products array here as well as the datacontainer only if the currentViewedStore is not the same as the store in the url. The logic below is only for other's people's stores, not your own. Your own store is handled in the global wrapper.
      if (
        (!currentViewedStore && name !== user?.name) ||
        (currentViewedStore?.id !== store && name !== user?.name)
      ) {
        setProducts([]);
        dispatch(clearReviews());
        dispatch(clearViewedStoreDataContainer());
        let myStore;
        const url = `/arbitrary/resources/search?service=STORE&identifier=${store}&exactmatchnames=true&mode=ALL&name=${name}&includemetadata=false`;
        const info = await fetch(url, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        const responseDataStore = await info.json();
        const filterOut = responseDataStore.filter((store: any) =>
          store.identifier.startsWith(`${STORE_BASE}-`)
        );
        if (filterOut.length === 0) return;
        if (filterOut.length !== 0) {
          // Get first element since it returns an array of stores
          myStore = filterOut[0];
        }

        const urlStore = `/arbitrary/STORE/${name}/${store}`;
        const resource = await fetch(urlStore, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });
        const responseData = await resource.json();
        // Set shop data to redux now that you have the info/metadata & resource
        dispatch(
          setCurrentViewedStore({
            created: responseData?.created || "",
            id: myStore.identifier,
            title: responseData?.title || "",
            location: responseData?.location,
            shipsTo: responseData?.shipsTo,
            description: responseData?.description || "",
            category: myStore.metadata?.category,
            tags: myStore.metadata?.tags || [],
            logo: responseData?.logo || "",
            shortStoreId: responseData?.shortStoreId,
            supportedCoins: responseData?.supportedCoins || [],
            foreignCoins: responseData?.foreignCoins || {}
          })
        );

        const urlDatacontainer = `/arbitrary/DOCUMENT/${name}/${store}-${DATA_CONTAINER_BASE}`;
        const responseContainer = await fetch(urlDatacontainer, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });
        const responseDataContainer = await responseContainer.json();

        // Call to see if the datacontainer actually exists
        const dataContainerExists = await qortalRequest({
          action: "SEARCH_QDN_RESOURCES",
          service: "DOCUMENT",
          identifier: `${myStore.identifier}-${DATA_CONTAINER_BASE}`,
          name: name,
          prefix: false,
          exactMatchNames: true,
          limit: 0,
          offset: 0,
          reverse: true,
          mode: "ALL"
        });

        // Set dataContainer in redux if it is found. This is to do filtering in the future since it cannot be done on QDN at the moment.
        if (
          responseDataContainer &&
          !("error" in responseDataContainer) &&
          Object.keys(responseDataContainer).length > 0
        ) {
          dispatch(
            setViewedStoreDataContainer({
              ...responseDataContainer,
              id: `${store}-${DATA_CONTAINER_BASE}`,
            })
          );
          // If they haven't published a datacontainer, by querying "/arbitrary​/resources​/search", and it comes back as []
          // If you can't find the data container, aka response code of 404, and it's not your own store, redirect to home page.
        } else if (
          responseContainer.status === 404 &&
          dataContainerExists.length === 0
        ) {
          navigate("/");
          dispatch(
            setNotification({
              msg: "Error getting store data container.",
              alertType: "error",
            })
          );
          // If they haven't published a datacontainer, by querying "/arbitrary​/resources​/search", and it comes back as []
          // If you can't find the data container, aka response code of 404, and it's your own store, prompt to create the data container.
        } else if (
          !responseContainer.ok &&
          responseContainer.status !== 404 &&
          dataContainerExists.length > 0
        ) {
          navigate("/");
          dispatch(
            setNotification({
              msg: "Server Error",
              alertType: "error",
            })
          );
          // If the datacontainer exists and you cannot find it, but it's a response of 500, throw general error and redirect to home page.
        } else {
          navigate("/");
          dispatch(
            setNotification({
              msg: "Server Error",
              alertType: "error",
            })
          );
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      dispatch(setIsLoadingGlobal(false));
    }
  }, [username, store, currentViewedStore]);

  // Get 100 store reviews from QDN and calculate the average review.
  const getStoreAverageReview = async () => {
    if (!storeId) return;
    try {
      setAverageRatingLoader(true);
      const parts = storeId.split(`${STORE_BASE}-`);
      const shortStoreId = parts[1];
      const query = `${REVIEW_BASE}-${shortStoreId}`;
      // Since it the url includes /resources, you know you're fetching the resources and not the raw data
      const url = `/arbitrary/resources/search?service=DOCUMENT&query=${query}&limit=100&includemetadata=false&mode=ALL&reverse=true`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const responseData = await response.json();
      if (responseData.length === 0) {
        setAverageStoreRating(null);
        return;
      }
      // Modify resource into data that is more easily used on the front end
      const storeRatingsArray = responseData.map((review: any) => {
        const splitIdentifier = review.identifier.split("-");
        // Return null if idenfier is not an exact match, because search is not case sensitive
        const prefixIdentifier = splitIdentifier.slice(0, splitIdentifier.length - 2).join("-");
        if (query !== prefixIdentifier) return null;
        const rating = Number(splitIdentifier[splitIdentifier.length - 1]) / 10;
        return rating;
      }).filter((rating: number | null) => rating !== null); // Filter out null entries

      // Calculate average rating of the store
      let averageRating =
        storeRatingsArray.reduce((acc: number, curr: number) => {
          return acc + curr;
        }, 0) / storeRatingsArray.length;

      averageRating = Math.ceil(averageRating * 2) / 2;

      setAverageStoreRating(averageRating);
    } catch (error) {
      console.error(error);
    } finally {
      setAverageRatingLoader(false);
    }
  };

  // Get Store and set it in redux global state
  useEffect(() => {
    getStore();
  }, [username, store]);

  // Get average store rating when storeId is available, and only if the storeId is different from the currentViewedStore when it's not your store, or if storeId is different from currentStore when it is your store. Do this to avoid unnecessary QDN calls.
  useEffect(() => {
    if (
      storeId &&
      ((currentViewedStore?.id !== storeId &&
        username !== user?.name &&
        storeOwner !== user?.name) ||
        (currentStore?.id !== storeId && username === user?.name))
    ) {
      getStoreAverageReview();
    }
  }, [storeId, currentViewedStore, currentStore, username, storeOwner, user]);

  // Set cart notifications when cart changes
  useEffect(() => {
    if (user?.name && storeId) {
      const shopCart: CartInterface = carts[storeId];
      // Get the orders of this cart
      const orders = shopCart?.orders || {};
      let totalQuantity = 0;
      Object.keys(orders).forEach(key => {
        const order = orders[key];
        const { quantity } = order;
        totalQuantity += quantity;
      });
      setTotalCartQuantity(totalQuantity);
    }
  }, [carts, user, storeId]);

  const getProductsHandler = useCallback(async () => {
    if (!isFirstMountRef.current) return;
    await getProducts();
  }, [getProducts]);

  // Filter products
  const filteredProducts = useMemo(() => {
    const newArray: any = products
      .map((product: Product, index) => {
        if (
          catalogueHashMap[product?.catalogueId] &&
          catalogueHashMap[product.catalogueId].products[product?.id]
        ) {
          return {
            ...product,
            ...catalogueHashMap[product.catalogueId].products[product?.id],
            catalogueId: product?.catalogueId || "",
          };
        } else {
          return product;
        }
      })
      .filter((product: any) => {
        const condition =
          product?.status === "AVAILABLE" || product?.status === "OUT_OF_STOCK";
        return condition;
      });
    const newArray2 = newArray.sort((a: Product, b: Product) => {
      if (
        filterPrice === PriceFilter.highest &&
        a?.price &&
        b?.price &&
        a?.price[0]?.value &&
        b?.price[0]?.value
      ) {
        return b?.price[0]?.value - a?.price[0]?.value;
      } else if (
        filterPrice === PriceFilter.lowest &&
        a?.price &&
        b?.price &&
        a?.price[0]?.value &&
        b?.price[0]?.value
      ) {
        return a?.price[0]?.value - Number(b?.price[0]?.value);
      } else return newArray;
    });
    const newArray3: any = newArray2.filter((product: Product) => {
      const condition =
        categoryChips.length > 0
          ? product?.category &&
            categoryChips.some(chip => chip === product.category)
          : true;
      return condition;
    });
    const newArray4: any = newArray3.sort((a: Product, b: Product) => {
      if (filterDate === DateFilter.newest) {
        return b?.created - a?.created;
      } else if (filterDate === DateFilter.oldest) {
        return a?.created - b?.created;
      } else {
        return newArray3;
      }
    });
    return newArray4;
  }, [filterDate, filterPrice, products, categoryChips, catalogueHashMap]);

  // Filtering by categories

  const handleChipSelect = (value: string[]) => {
    setCategoryChips(value);
  };

  const handleChipRemove = (chip: string) => {
    setCategoryChips(prevChips => prevChips.filter(c => c !== chip));
  };

  if (isLoadingGlobal) return;

  if (!currentViewedStore && username !== user?.name && !isLoadingGlobal)
    return (
      <Typography
        marginTop={"20px"}
        fontFamily={"Karla"}
        fontSize={"25px"}
        fontWeight={"500"}
        textAlign={"center"}
      >
        Store Not Found!
      </Typography>
    );

  




 
  return (
    <Grid container sx={{ width: "100%" }}>
      <FiltersCol item xs={12} sm={3}>
        <BackToStorefrontButton
          style={{ maxWidth: "70%", alignSelf: "center" }}
          onClick={() => {
            navigate("/");
          }}
        >
          Back To All Shops
        </BackToStorefrontButton>
        <FiltersContainer>
          <FiltersTitle>
            Categories
            <ExpandMoreSVG
              color={theme.palette.text.primary}
              height={"22"}
              width={"22"}
            />
          </FiltersTitle>
          <FiltersSubContainer>
            <FormControl sx={{ width: "100%" }}>
              <FilterSelect
                multiple
                id="categories-select"
                value={categoryChips}
                options={
                  username !== user?.name
                    ? viewedStoreListProducts?.categories
                    : ownStoreListProducts?.categories
                }
                disableCloseOnSelect
                onChange={(e: any, value) =>
                  handleChipSelect(value as string[])
                }
                renderTags={(values: any) =>
                  values.map((value: string) => {
                    return (
                      <FiltersChip
                        key={value}
                        label={value}
                        onDelete={() => {
                          handleChipRemove(value);
                        }}
                      />
                    );
                  })
                }
                renderOption={(props, option: any) => (
                  <FiltersOption {...props}>
                    <FiltersCheckbox
                      checked={categoryChips.some(chip => chip === option)}
                    />
                    {option}
                  </FiltersOption>
                )}
                renderInput={params => (
                  <FilterSelectMenuItems
                    {...params}
                    label="Categories"
                    placeholder="Filter by category"
                  />
                )}
              />
            </FormControl>
          </FiltersSubContainer>
          <FiltersTitle>
            Price
            <ExpandMoreSVG
              color={theme.palette.text.primary}
              height={"22"}
              width={"22"}
            />
          </FiltersTitle>
          <FiltersSubContainer>
            <FiltersRow>
              Highest
              <FiltersCheckbox
                checked={filterPrice === PriceFilter.highest}
                onChange={() => {
                  setFilterPrice(PriceFilter.highest);
                  setFilterDate(null);
                }}
                inputProps={{ "aria-label": "controlled" }}
              />
            </FiltersRow>
            <FiltersRow>
              Lowest
              <FiltersCheckbox
                checked={filterPrice === PriceFilter.lowest}
                onChange={() => {
                  setFilterPrice(PriceFilter.lowest);
                  setFilterDate(null);
                }}
                inputProps={{ "aria-label": "controlled" }}
              />
            </FiltersRow>
          </FiltersSubContainer>
          <FiltersTitle>
            Prices In
            <ExpandMoreSVG
              color={theme.palette.text.primary}
              height={"22"}
              width={"22"}
            />
          </FiltersTitle>
          <FiltersSubContainer>
            <FiltersRow>
              <AcceptedCoinRow>
                QORT
                <AcceptedCoin src={QORT} alt="QORT-logo" />
              </AcceptedCoinRow>
              <FiltersCheckbox
                checked={coinToUse === CoinFilter.qort}
                onChange={() => {
           
                    if (coinToUse !== CoinFilter.qort) {
                      dispatch(setPreferredCoin(CoinFilter.qort))

                    } 
                 

                }}
                inputProps={{ "aria-label": "controlled" }}
              />
            </FiltersRow>
            {storeToUse?.foreignCoins?.ARRR && storeToUse?.supportedCoins?.includes('ARRR') && (
              <FiltersRow>
              <AcceptedCoinRow>
                ARRR
                <AcceptedCoin src={ARRR} alt="ARRR-logo" />
              </AcceptedCoinRow>
              <FiltersCheckbox
                checked={coinToUse === CoinFilter.arrr}
                onChange={() => {
                    if (coinToUse !== CoinFilter.arrr) {
                      dispatch(setPreferredCoin(CoinFilter.arrr))
                    } 
                }}
                inputProps={{ "aria-label": "controlled" }}
              />
            </FiltersRow>
            )}
            
          </FiltersSubContainer>
          <FiltersTitle>
            Date Product Added
            <ExpandMoreSVG
              color={theme.palette.text.primary}
              height={"22"}
              width={"22"}
            />
          </FiltersTitle>
          <FiltersSubContainer>
            <FiltersRow>
              Most Recent
              <FiltersCheckbox
                checked={filterDate === DateFilter.newest}
                onChange={() => {
                  setFilterDate(DateFilter.newest);
                  setFilterPrice(null);
                }}
                inputProps={{ "aria-label": "controlled" }}
              />
            </FiltersRow>
            <FiltersRow>
              Oldest
              <FiltersCheckbox
                checked={filterDate === DateFilter.oldest}
                onChange={() => {
                  setFilterDate(DateFilter.oldest);
                  setFilterPrice(null);
                }}
                inputProps={{ "aria-label": "controlled" }}
              />
            </FiltersRow>
          </FiltersSubContainer>
          {coinToUse === CoinFilter.arrr && exchangeRate && (
            <FiltersSubContainer>
            <ExchangeRateCard>
              <ExchangeRateRow>
                <ExchangeRateTitle>1 QORT = {exchangeRate} ARRR</ExchangeRateTitle>
              </ExchangeRateRow>
              <ExchangeRateRow>
                <ExchangeRateSubTitle>
                  {`Rate calculated by recent trade portal trades`}
                </ExchangeRateSubTitle>
               
              </ExchangeRateRow>
              <ExchangeRateRow style={{ gap: "10px" }}>
                <AcceptedCoin src={QORT} alt="QORT-logo" />
                <CompareArrowsSVG
                  color={theme.palette.text.primary}
                  height={"32"}
                  width={"32"}
                />
                <AcceptedCoin src={ARRR} alt="ARRR-logo" />
              </ExchangeRateRow>
            </ExchangeRateCard>
          </FiltersSubContainer>
          )}
          
        </FiltersContainer>
      </FiltersCol>
      <Grid item xs={12} sm={9}>
        <ProductManagerRow>
          <StoreTitleCard>
            <StoreLogo
              src={
                username === user?.name
                  ? currentStore?.logo
                  : currentViewedStore?.logo
              }
              alt={
                username === user?.name
                  ? currentStore?.id
                  : currentViewedStore?.id
              }
            />
            <StoreTitleCol>
              <StoreTitle
                onClick={() => {
                  setOpenStoreDetails(true);
                }}
              >
                {username === user?.name
                  ? currentStore?.title + " 🛈"
                  : currentViewedStore?.title + " 🛈"}
              </StoreTitle>
              {averageRatingLoader ? (
                <CircularProgress />
              ) : (
                <RatingContainer
                  onClick={() => {
                    setOpenStoreReviews(true);
                  }}
                >
                  {!averageStoreRating ? (
                    "No reviews yet"
                  ) : (
                    <Rating
                      precision={0.5}
                      value={averageStoreRating}
                      readOnly
                    />
                  )}
                </RatingContainer>
              )}
              <OfferedCoinsRow>
                Accepted Coins
                <AcceptedCoinRow>
                  <AcceptedCoin
                    style={{ width: "26px", height: "26px" }}
                    src={QORT}
                    alt="QORT-logo"
                  />
                  {storeToUse?.foreignCoins?.ARRR && storeToUse?.supportedCoins?.includes('ARRR') && (
                    <AcceptedCoin
                    style={{ width: "26px", height: "26px" }}
                    src={ARRR}
                    alt="ARRR-logo"
                  />
                  )}
                  
                </AcceptedCoinRow>
              </OfferedCoinsRow>
            </StoreTitleCol>
          </StoreTitleCard>
          {username === user?.name ? (
            <StoreControlsRow>
              <EditStoreButton
                onClick={() => {
                  dispatch(toggleEditStoreModal(true));
                }}
              >
                Edit Shop
              </EditStoreButton>
              <ProductManagerButton
                onClick={() => {
                  navigate(`/product-manager/${store}`);
                }}
              >
                Product Manager
              </ProductManagerButton>
            </StoreControlsRow>
          ) : user?.name ? (
            <CartIconContainer
              fixedCartPosition={totalCartQuantity > 0 ? true : false}
              onClick={() => {
                dispatch(setIsOpen(true));
              }}
            >
              <CartIcon
                color={theme.palette.text.primary}
                height={"32"}
                width={"32"}
              />
              {totalCartQuantity > 0 && (
                <NotificationBadge
                  fixedCartPosition={totalCartQuantity > 0 ? true : false}
                >
                  {totalCartQuantity}
                </NotificationBadge>
              )}
            </CartIconContainer>
          ) : null}
        </ProductManagerRow>
        <ProductsContainer container spacing={2}>
          {filteredProducts.length > 0 && hasFetched ? (
            filteredProducts.map((product: Product) => {
              const storeId: string = currentStore?.id || "";
              let productItem = product;
              let hasHash = false;
              const existingProduct =
                catalogueHashMap[product?.catalogueId]?.products[product?.id];
              if (existingProduct) {
                productItem = existingProduct;
                hasHash = true;
              }
              if (!hasHash) {
                return (
                  <ProductCardCol
                    xs={12}
                    sm={6}
                    md={4}
                    lg={3}
                    item
                    key={product.id}
                  >
                    <Skeleton
                      variant="rectangular"
                      style={{
                        width: "100%",
                        height: "400px",
                        paddingBottom: "10px",
                        objectFit: "contain",
                        visibility: "visible",
                        borderRadius: "8px",
                      }}
                    />
                  </ProductCardCol>
                );
              } else {
                return (
                  <ProductCardCol
                    xs={12}
                    sm={6}
                    md={4}
                    lg={3}
                    item
                    key={productItem.id}
                  >
                    <ContextMenuResource
                      name={productItem.user}
                      service="PRODUCT"
                      identifier={productItem.id}
                      link={`qortal://APP/Q-Shop/${
                        productItem?.user ||
                        catalogueHashMap[productItem?.catalogueId]?.user
                      }/${storeId}/${productItem?.id}/${
                        productItem?.catalogueId
                      }`}
                    >
                      <ProductCard product={productItem} exchangeRate={exchangeRate} filterCoin={coinToUse} />
                    </ContextMenuResource>
                  </ProductCardCol>
                );
              }
            })
          ) : filteredProducts.length === 0 &&
            username === user?.name &&
            hasFetched ? (
            <NoProductsContainer>
              <NoProductsText>
                You currently have no products! Add some in the Product Manager.
              </NoProductsText>
            </NoProductsContainer>
          ) : (
            <NoProductsContainer>
              <NoProductsText>
                There are currently no products for sale!
              </NoProductsText>
            </NoProductsContainer>
          )}
        </ProductsContainer>
        <LazyLoad onLoadMore={getProductsHandler}></LazyLoad>
      </Grid>
      <ReusableModalStyled
        id={"store-details"}
        customStyles={{
          width: "96%",
          maxWidth: 1000,
          height: "70%",
          backgroundColor:
            theme.palette.mode === "light" ? "#e8e8e8" : "#32333c",
          position: "relative",
          padding: "25px 40px",
          borderRadius: "5px",
          outline: "none",
          overflowY: "auto",
        }}
        open={openStoreDetails}
      >
        <StoreDetails
          setOpenStoreDetails={setOpenStoreDetails}
          storeTitle={
            username === user?.name
              ? currentStore?.title || ""
              : currentViewedStore?.title || ""
          }
          storeImage={
            username === user?.name
              ? currentStore?.logo || ""
              : currentViewedStore?.logo || ""
          }
          storeOwner={username || ""}
          storeDescription={
            username === user?.name
              ? currentStore?.description || ""
              : currentViewedStore?.description || ""
          }
          dateCreated={
            username === user?.name
              ? currentStore?.created || 0
              : currentViewedStore?.created || 0
          }
          location={
            username === user?.name
              ? currentStore?.location || ""
              : currentViewedStore?.location || ""
          }
          shipsTo={
            username === user?.name
              ? currentStore?.shipsTo || ""
              : currentViewedStore?.shipsTo || ""
          }
          supportedCoins={
            username === user?.name
              ? currentStore?.supportedCoins || [CoinFilter.qort]
              : currentViewedStore?.supportedCoins || [CoinFilter.qort]
          }
          foreignCoins={
            username === user?.name
              ? currentStore?.foreignCoins || {}
              : currentViewedStore?.foreignCoins || {}
          }
        />
      </ReusableModalStyled>
      <ReusableModalStyled
        id={"store-details"}
        customStyles={{
          width: "96%",
          maxWidth: 1200,
          height: "95vh",
          backgroundColor:
            theme.palette.mode === "light" ? "#e8e8e8" : "#32333c",
          position: "relative",
          padding: "25px 40px",
          borderRadius: "5px",
          outline: "none",
          overflowY: "auto",
          overflowX: "hidden",
        }}
        open={openStoreReviews}
      >
        <StoreReviews
          averageStoreRating={averageStoreRating}
          storeTitle={
            username === user?.name
              ? currentStore?.title || ""
              : currentViewedStore?.title || ""
          }
          storeImage={
            username === user?.name
              ? currentStore?.logo || ""
              : currentViewedStore?.logo || ""
          }
          storeId={
            username === user?.name
              ? currentStore?.id || ""
              : currentViewedStore?.id || ""
          }
          setOpenStoreReviews={setOpenStoreReviews}
        />
      </ReusableModalStyled>
    </Grid>
  );
};
