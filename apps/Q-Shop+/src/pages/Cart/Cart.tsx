/* eslint-disable @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/set-state-in-effect -- upstream code, cleaned up when this file is rewritten (docs/apps/Q-Shop+.md) */
import { useState, useEffect, useMemo } from "react";
import { ReusableModal } from "../../components/modals/ReusableModal";
import {
  Grid,
  useTheme,
  useMediaQuery,
  FormControl,
  SelectChangeEvent,
} from "@mui/material";
import {
  addQuantityToCart,
  subtractQuantityFromCart,
  removeCartFromCarts,
  Order,
  removeProductFromCart,
} from "../../state/features/cartSlice";
import ShortUniqueId from "short-unique-id";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../state/store";
import { setIsOpen } from "../../state/features/cartSlice";
import { Cart as CartInterface } from "../../state/features/cartSlice";
import {
  AddQuantityButton,
  CartContainer,
  CoinToPayInRow,
  ColumnTitle,
  ConfirmPurchaseContainer,
  ConfirmPurchaseRow,
  GarbageIcon,
  IconsRow,
  OrderTotalRow,
  ProductContainer,
  ProductDescription,
  ProductDetailsCol,
  ProductDetailsRow,
  ProductImage,
  ProductInfoCol,
  ProductPriceFont,
  ProductTitle,
  QuantityRow,
  RemoveQuantityButton,
  TotalSumContainer,
  TotalSumHeader,
  TotalSumItem,
  TotalSumItemTitle,
  TotalSumItems,
} from "./Cart-styles";
import {
  BackToStorefrontButton as BackToCheckoutButton,
  BackToStorefrontButton as CheckoutButton,
} from "../Store/Store/Store-styles";
import {
  Catalogue,
  setIsLoadingGlobal,
} from "../../state/features/globalSlice";
import { QortalSVG } from "../../assets/svgs/QortalSVG";
import { setNotification } from "../../state/features/notificationsSlice";
import {
  CreateButton as ConfirmPurchaseButton,
  CancelButton,
  CustomInputField,
} from "../../components/modals/CreateStoreModal-styles";
import {
  CustomMenuItem,
  CustomSelect,
  InputFieldCustomLabel,
} from "../ProductManager/NewProduct/NewProduct-styles";
import countries from "../../constants/countries.json";
import states from "../../constants/states.json";
import { BackArrowSVG } from "../../assets/svgs/BackArrowSVG";
import { CloseIconModal } from "../Store/StoreReviews/StoreReviews-styles";
import { getRate } from "../../money/rates";
import { startCheckout } from "../../money/checkout";
import { missingDeliveryFields, type CartLine, type DeliveryInput } from "../../money/order";
import QORTLogo from "../../assets/img/qort.png";
import ARRRLogo from "../../assets/img/arrr.png";
import { AcceptedCoin } from "../StoreList/StoreList-styles";
import { ARRRSVG } from "../../assets/svgs/ARRRSVG";
import { setPreferredCoin } from "../../state/features/storeSlice";
import { CoinFilter } from "../Store/Store/Store";

/* Currency must be replaced in the order confirmation email by proper currency */

interface CountryProps {
  text: string;
  value: string;
}

export const Cart = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const uid = new ShortUniqueId({
    length: 10,
  });
  const mailUid = new ShortUniqueId();

  const dispatch = useDispatch();
  const username = useSelector((state: RootState) => state.auth.user?.name);
  const usernamePublicKey = useSelector(
    (state: RootState) => state.auth.user?.publicKey
  );
  const userAddress = useSelector((state: RootState) => state.auth.user?.address);
  // Redux state to open the cart
  const isOpen = useSelector((state: RootState) => state.cart.isOpen);
  // Redux state to get the current cart
  const carts = useSelector((state: RootState) => state.cart.carts);
  // Redux state to get the storeId
  const storeOwner = useSelector((state: RootState) => state.store.storeOwner);
  const storeId = useSelector((state: RootState) => state.store.storeId);
  const hashMapStores = useSelector(
    (state: RootState) => state.store.hashMapStores
  );
  // Redux state to get the catalogue hashmap
  const catalogueHashMap = useSelector(
    (state: RootState) => state.global.catalogueHashMap
  );

  // Coins to pay in options
  const coinOptions = [
    { value: "QORT", label: "QORT", icon: QORTLogo },
    { value: "ARRR", label: "ARRR", icon: ARRRLogo },
  ];

  const [cartOrders, setCartOrders] = useState<string[]>([]);
  const [localCart, setLocalCart] = useState<CartInterface>();
  const [checkoutPage, setCheckoutPage] = useState<boolean>(false);
  const [customerName, setCustomerName] = useState<string>("");
  const [streetAddress, setStreetAddress] = useState<string>("");
  const [country, setCountry] = useState<string | null>("");
  const [state, setState] = useState<string | null>("");
  const [city, setCity] = useState<string>("");
  const [region, setRegion] = useState<string>("");
  const [zipCode, setZipCode] = useState<string>("");
  const [deliveryNote, setDeliveryNote] = useState<string>("");
  const [confirmPurchaseModalOpen, setConfirmPurchaseModalOpen] =
    useState<boolean>(false);
  const preferredCoin = useSelector((state: RootState) => state.store.preferredCoin);
  const [exchangeRate, setExchangeRate] = useState<number | null>(
    null
  );
  const currentStore = useSelector(
    (state: RootState) => state.global.currentStore
  );
  const currentViewedStore = useSelector(
    (state: RootState) => state.store.currentViewedStore
  );


  const calculateARRRExchangeRate = async()=> {
    try {
      setExchangeRate(await getRate(CoinFilter.arrr))
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
  const storeToUse = useMemo(()=> {
    return  currentViewedStore
   }, [currentViewedStore])

   const switchCoin = async ()=> {
    dispatch(setIsLoadingGlobal(true));

    await calculateARRRExchangeRate()
    dispatch(setIsLoadingGlobal(false));


  }

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

  // Set cart & orders to local state
  useEffect(() => {
    if (storeId && Object.keys(carts).length > 0) {
      const shopCart: CartInterface = carts[storeId];
      // Get the orders of this cart
      const orders = shopCart?.orders || {};
      setLocalCart(shopCart);
      setCartOrders(Object.keys(orders));
    }
  }, [storeId, carts]);

  // Set username to customer name on cart open

  useEffect(() => {
    if (username) setCustomerName(username);
  }, [isOpen, username]);

  const closeModal = () => {
    dispatch(setIsOpen(false));
    setCheckoutPage(false);
  };

  const handleSelectCountry = (event: SelectChangeEvent<string | null>) => {
    const optionId = event.target.value;
    const selectedOption = countries.find(country => country.text === optionId);
    setCountry(selectedOption?.text || null);
  };

  const handleSelectState = (event: SelectChangeEvent<string | null>) => {
    const optionId = event.target.value;
    const selectedOption = states.find(state => state.text === optionId);
    setState(selectedOption?.text || null);
  };

  //  Check to see if any of the products in the cart are digital and that there are none which are physical
  const isDigitalOrder = useMemo(() => {
    if (!localCart) return false;
    return Object.keys(localCart.orders).every(key => {
      const order = localCart.orders[key];
      const productId = order?.productId;
      const catalogueId = order?.catalogueId;
      let product = null;
      if (productId && catalogueId && catalogueHashMap[catalogueId]) {
        product = catalogueHashMap[catalogueId]?.products[productId];
      }
      if (!product) return false;
      return product.type === "digital";
    });
  }, [localCart]);

  const handlePurchase = async () => {
    if (!localCart) {
      dispatch(
        setNotification({
          alertType: "error",
          msg: "Cannot find a cart! Please try refreshing the page and trying again!",
        })
      );
      return;
    }
    if (!storeId) {
      dispatch(
        setNotification({
          alertType: "error",
          msg: "Cannot find a store! Please try refreshing the page and trying again!",
        })
      );
      return;
    }
    if (!storeOwner) {
      dispatch(
        setNotification({
          alertType: "error",
          msg: "Cannot find a store owner! Please try refreshing the page and trying again!"
        })
      );
      return;
    }
    if (cartOrders.length === 0) {
      dispatch(
        setNotification({
          alertType: "error",
          msg: "You have no items in your cart",
        })
      );
      return;
    }
    const delivery: DeliveryInput = {
      customerName,
      streetAddress,
      city,
      state: state || "",
      region,
      country: country || "",
      zipCode,
      deliveryNote,
    };
    if (!isDigitalOrder && missingDeliveryFields(delivery).length > 0) {
      dispatch(
        setNotification({
          alertType: "error",
          msg: "Please fill in all the required delivery fields",
        })
      );
      return;
    }
    if (!username || !usernamePublicKey || !userAddress) return;
    const lines: CartLine[] = cartOrders.map((key) => {
      const order = localCart.orders[key];
      return {
        productId: order.productId,
        catalogueId: order.catalogueId,
        quantity: order.quantity,
        product: catalogueHashMap[order.catalogueId]?.products[order.productId] ?? null,
      };
    });
    dispatch(setIsLoadingGlobal(true));
    try {
      const result = await startCheckout({
        buyer: { name: username, address: userAddress, publicKey: usernamePublicKey },
        shop: {
          id: storeId,
          title: hashMapStores[storeId]?.title,
          owner: storeOwner,
          supportedCoins: storeToUse?.supportedCoins,
          foreignCoins: storeToUse?.foreignCoins,
        },
        lines,
        coin: coinToUse,
        rate: exchangeRate,
        isDigital: isDigitalOrder,
        delivery: isDigitalOrder ? null : delivery,
        orderUid: uid(),
        mailUid: mailUid(),
        now: Date.now(),
        onPaid: () => {
          // Paid: the order now lives in pending orders until it's on QDN.
          dispatch(removeCartFromCarts({ storeId }));
        },
      });
      if (result.kind === "done") {
        setCheckoutPage(false);
        setCustomerName("");
        setStreetAddress("");
        setCountry("");
        setState("");
        setCity("");
        setRegion("");
        setZipCode("");
        setDeliveryNote("");
        setConfirmPurchaseModalOpen(false);
        closeModal();
        dispatch(
          setNotification({
            alertType: "success",
            msg: "Order placed successfully!",
          })
        );
      } else if (result.kind === "failed") {
        dispatch(setNotification({ alertType: "error", msg: result.message }));
      } else if (result.kind === "not-recorded") {
        setConfirmPurchaseModalOpen(false);
        closeModal();
        dispatch(setNotification({ alertType: "error", msg: result.message }));
      } else if (result.kind === "unconfirmed") {
        setConfirmPurchaseModalOpen(false);
        closeModal();
        dispatch(
          setNotification({
            alertType: "error",
            msg: "Hub didn't confirm the payment. Check My orders before paying again.",
          })
        );
      }
    } finally {
      dispatch(setIsLoadingGlobal(false));
    }
  };

  // Calculate sum total for cart
  const calculateCartTotalSum = (
    cartOrders: string[],
    localCart: CartInterface | undefined,
    catalogueHashMap: Record<string, Catalogue>
  ): number => {
    let totalSum = 0;
    cartOrders.forEach(key => {
      const order: Order | undefined = localCart?.orders[key];
      const { quantity, productId, catalogueId } = order || {};

      if (productId && catalogueId && catalogueHashMap[catalogueId]) {
        const product = catalogueHashMap[catalogueId].products[productId];
        let price = product?.price?.find(item => item?.currency === "qort")?.value;
  const priceArrr = product?.price?.find(item => item?.currency === CoinFilter.arrr)?.value;

  if(coinToUse === CoinFilter.arrr && priceArrr) {
    price = +priceArrr
  } else if(price && exchangeRate && coinToUse !== CoinFilter.qort){
    price = +price * exchangeRate
  }

        if (price !== null && price !== undefined && quantity !== undefined) {
          totalSum += price * quantity;
        }
      }
    });

    return totalSum;
  };

  const totalSum = useMemo(
    () => calculateCartTotalSum(cartOrders, localCart, catalogueHashMap),
    [cartOrders, localCart, catalogueHashMap, coinToUse, exchangeRate]
  );

  return (
    <>
      <ReusableModal
        open={isOpen}
        customStyles={{
          width: "96%",
          maxWidth: 1500,
          height: "96%",
          backgroundColor:
            theme.palette.mode === "light" ? "#e8e8e8" : "#32333c",
          position: "relative",
          padding: "15px 20px 35px 10px",
          borderRadius: "3px",
          overflowY: "auto",
          overflowX: "hidden",
          maxHeight: "90vh",
        }}
      >
        <CartContainer
          container
          spacing={1}
          sx={{ flexDirection: isMobile ? "column" : "row" }}
        >
          <Grid
            sx={{ width: "100%" }}
            size={{
              xs: 12,
              sm: 9
            }}>
            {!localCart || cartOrders.length === 0 ? (
              <ProductTitle style={{ textAlign: "center" }}>
                No items in cart
              </ProductTitle>
            ) : (
              <>
                {checkoutPage && !isDigitalOrder ? (
                  <>
                    <BackToCheckoutButton
                      onClick={() => {
                        setCheckoutPage(false);
                      }}
                      style={{ marginBottom: "5px" }}
                    >
                      <BackArrowSVG
                        color={"white"}
                        height={"22"}
                        width={"22"}
                      />{" "}
                      Checkout
                    </BackToCheckoutButton>
                    <ColumnTitle>Delivery Information</ColumnTitle>
                    <Grid container spacing={2}>
                      <ProductInfoCol size={{ xs: 12, sm: 6 }}>
                        {/* Customer Name */}
                        <FormControl fullWidth>
                          <CustomInputField
                            style={{ flexGrow: 1 }}
                            name="customer-name"
                            label="Customer Name"
                            variant="filled"
                            value={customerName}
                            required
                            onChange={e =>
                              setCustomerName(e.target.value as string)
                            }
                          />
                        </FormControl>
                        {/* Street Address */}
                        <FormControl fullWidth>
                          <CustomInputField
                            style={{ flexGrow: 1 }}
                            name="street-address"
                            label="Street Address"
                            variant="filled"
                            value={streetAddress}
                            required
                            onChange={e =>
                              setStreetAddress(e.target.value as string)
                            }
                          />
                        </FormControl>
                        {/* City */}
                        <FormControl fullWidth>
                          <CustomInputField
                            style={{ flexGrow: 1 }}
                            name="city"
                            label="City"
                            variant="filled"
                            value={city}
                            required
                            onChange={e => setCity(e.target.value as string)}
                          />
                        </FormControl>
                        {/* Country */}
                        <FormControl fullWidth>
                          <InputFieldCustomLabel id="country-label">
                            Country
                          </InputFieldCustomLabel>
                          <CustomSelect
                            labelId="country-label"
                            label="Country"
                            variant="filled"
                            value={country}
                            onChange={event => {
                              handleSelectCountry(
                                event as SelectChangeEvent<string | null>
                              );
                            }}
                            required
                            fullWidth
                          >
                            {countries.map((country: CountryProps) => {
                              return (
                                <CustomMenuItem value={country.text}>
                                  {country.text}
                                </CustomMenuItem>
                              );
                            })}
                          </CustomSelect>
                        </FormControl>
                      </ProductInfoCol>
                      <ProductInfoCol size={{ xs: 12, sm: 6 }}>
                        {/* State or region */}
                        {country === "United States" ? (
                          <FormControl fullWidth>
                            <InputFieldCustomLabel id="state-label">
                              State
                            </InputFieldCustomLabel>
                            <CustomSelect
                              labelId="state-label"
                              label="State"
                              variant="filled"
                              value={state}
                              onChange={event => {
                                handleSelectState(
                                  event as SelectChangeEvent<string | null>
                                );
                              }}
                              required
                              fullWidth
                            >
                              {states.map((state: CountryProps) => {
                                return (
                                  <CustomMenuItem value={state.text}>
                                    {state.text}
                                  </CustomMenuItem>
                                );
                              })}
                            </CustomSelect>
                          </FormControl>
                        ) : (
                          <FormControl fullWidth>
                            <CustomInputField
                              style={{ flexGrow: 1 }}
                              name="region"
                              label="Region"
                              variant="filled"
                              value={region}
                              required
                              onChange={e =>
                                setRegion(e.target.value as string)
                              }
                            />
                          </FormControl>
                        )}
                        {/* Zip Code */}
                        <FormControl fullWidth>
                          <CustomInputField
                            style={{ flexGrow: 1 }}
                            name="zip-code"
                            label="Zip Code"
                            variant="filled"
                            value={zipCode}
                            required
                            onChange={e => setZipCode(e.target.value as string)}
                          />
                        </FormControl>
                        {/* Delivery Note */}
                        <FormControl fullWidth>
                          <CustomInputField
                            style={{ flexGrow: 1 }}
                            name="delivery-note"
                            label="Delivery Note"
                            variant="filled"
                            value={deliveryNote}
                            required
                            onChange={e =>
                              setDeliveryNote(e.target.value as string)
                            }
                          />
                        </FormControl>
                      </ProductInfoCol>
                    </Grid>
                  </>
                ) : (
                  <>
                    <ColumnTitle>My Cart</ColumnTitle>
                    {(cartOrders || []).map(key => {
                      const order = localCart?.orders[key];
                      const quantity = order?.quantity;
                      const productId = order?.productId;
                      const catalogueId = order?.catalogueId;
                      let product = null;
                      if (
                        productId &&
                        catalogueId &&
                        catalogueHashMap[catalogueId]
                      ) {
                        product =
                          catalogueHashMap[catalogueId]?.products[productId];
                      }
                      if (!product) return null;
                      let price = product?.price?.find(item => item?.currency === "qort")?.value;
                      const priceArrr = product?.price?.find(item => item?.currency === CoinFilter.arrr)?.value;
                    
                      if(coinToUse === CoinFilter.arrr && priceArrr) {
                        price = +priceArrr
                      } else if(price && exchangeRate && coinToUse !== CoinFilter.qort){
                        price = +price * exchangeRate
                      }
                      return (
                        <ProductContainer container key={productId}>
                          <ProductInfoCol
                            style={{ textAlign: "center" }} size={{ xs: 12, sm: 4 }}>
                            <ProductTitle>{product.title}</ProductTitle>
                            <ProductImage
                              src={product?.images?.[0] || ""}
                              alt={`product-img-${productId}}`}
                            />
                          </ProductInfoCol>
                          <ProductDetailsCol size={{ xs: 12, sm: 8 }}>
                            <ProductDescription>
                              {product.description}
                            </ProductDescription>
                            <ProductDetailsRow>
                              <ProductPriceFont>
                                Price per unit:
                                <span>
                                {coinToUse === CoinFilter.qort && (
                                  <QortalSVG
                                    color={theme.palette.text.primary}
                                    height={"20"}
                                    width={"20"}
                                  />
                    )}
                                   {coinToUse === CoinFilter.arrr && (
                                 <ARRRSVG
                                  height={"20"}
                                  width={"20"}
                                  color={theme.palette.text.primary}
                                  />
                                    )}
                                 {price}
                                </span>
                              </ProductPriceFont>
                              {price && (
                                <ProductPriceFont>
                                  Total Price:
                                  <span>
                                  {coinToUse === CoinFilter.qort && (
                                  <QortalSVG
                                    color={theme.palette.text.primary}
                                    height={"20"}
                                    width={"20"}
                                  />
                    )}
                                   {coinToUse === CoinFilter.arrr && (
                                 <ARRRSVG
                                  height={"20"}
                                  width={"20"}
                                  color={theme.palette.text.primary}
                                  />
                                    )}
                                    {price * quantity}
                                  </span>
                                </ProductPriceFont>
                              )}
                              <IconsRow>
                                <GarbageIcon
                                  onClickFunc={() => {
                                    dispatch(
                                      removeProductFromCart({
                                        storeId,
                                        productId,
                                      })
                                    );
                                  }}
                                  color={theme.palette.text.primary}
                                  height={"30"}
                                  width={"30"}
                                />
                                <QuantityRow>
                                  <RemoveQuantityButton
                                    onClickFunc={() => {
                                      dispatch(
                                        subtractQuantityFromCart({
                                          storeId,
                                          productId,
                                        })
                                      );
                                    }}
                                    color={theme.palette.text.primary}
                                    height={"30"}
                                    width={"30"}
                                  />
                                  {quantity}
                                  <AddQuantityButton
                                    onClickFunc={() =>
                                      dispatch(
                                        addQuantityToCart({
                                          storeId,
                                          productId,
                                        })
                                      )
                                    }
                                    color={theme.palette.text.primary}
                                    height={"30"}
                                    width={"30"}
                                  />
                                </QuantityRow>
                              </IconsRow>
                            </ProductDetailsRow>
                          </ProductDetailsCol>
                        </ProductContainer>
                      );
                    })}
                  </>
                )}
              </>
            )}
          </Grid>
          {localCart && cartOrders.length > 0 && (
            <Grid
              sx={{ width: "100%" }}
              size={{
                xs: 12,
                sm: 3
              }}>
              <TotalSumContainer>
                <TotalSumHeader>Order Summary</TotalSumHeader>
                <TotalSumItems>
                  {(cartOrders || []).map(key => {
                    const order = localCart?.orders[key];
                    const quantity = order?.quantity;
                    const productId = order?.productId;
                    const catalogueId = order?.catalogueId;
                    let product = null;
                    if (
                      productId &&
                      catalogueId &&
                      catalogueHashMap[catalogueId]
                    ) {
                      product =
                        catalogueHashMap[catalogueId]?.products[productId];
                    }
                    if (!product) return null;
                    let price = product?.price?.find(item => item?.currency === "qort")?.value;
                    const priceArrr = product?.price?.find(item => item?.currency === CoinFilter.arrr)?.value;
                  
                    if(coinToUse === CoinFilter.arrr && priceArrr) {
                      price = +priceArrr
                    } else if(price && exchangeRate && coinToUse !== CoinFilter.qort){
                      price = +price * exchangeRate
                    }
                    return (
                      <TotalSumItem>
                        <TotalSumItemTitle>
                          x{quantity} {product.title}
                        </TotalSumItemTitle>
                        <TotalSumItemTitle>
                        {coinToUse === CoinFilter.qort && (
                                  <QortalSVG
                                  color={theme.palette.text.primary}
                                  height={"18"}
                                  width={"18"}
                                />
                                    )}
                         
                            {coinToUse === CoinFilter.arrr && (
                                 <ARRRSVG
                                  height={"18"}
                                  width={"18"}
                                  color={theme.palette.text.primary}
                                  />
                                    )}
                          {price}
                        </TotalSumItemTitle>
                      </TotalSumItem>
                    );
                  })}
                </TotalSumItems>
                <OrderTotalRow>
                  <span>Total:</span>
                  {coinToUse === CoinFilter.qort && (
                  <QortalSVG
                    color={theme.palette.text.primary}
                    height={"22"}
                    width={"22"}
                  />
                  )}
                  {coinToUse === CoinFilter.arrr && (
                   <ARRRSVG
                height={"22"}
                width={"22"}
                color={theme.palette.text.primary}
              />
                  )}
                  {totalSum}
                </OrderTotalRow>
                {(checkoutPage || (!checkoutPage && isDigitalOrder)) && (
                  <OrderTotalRow>
                    <FormControl fullWidth>
                      <InputFieldCustomLabel
                        style={{ transformOrigin: "top left" }}
                        id="coin-to-pay-with-label"
                      >
                        Coin to pay with
                      </InputFieldCustomLabel>
                      <CustomSelect
                        labelId="coin-to-pay-with-label"
                        label="Coin to pay with"
                        variant="outlined"
                        value={coinToUse}
                        renderValue={selected => {
                          const option = coinOptions.find(
                            opt => opt.value === coinToUse
                          );
                          return (
                            <CoinToPayInRow>
                              <AcceptedCoin
                                src={option?.icon}
                                alt={option?.value}
                              />
                              {option?.label}
                            </CoinToPayInRow>
                          );
                        }}
                        onChange={event => {
                          dispatch(setPreferredCoin(event.target.value))
                        }}
                        required
                        fullWidth
                      >
                        <CustomMenuItem
                          style={{ display: "flex", gap: "5px" }}
                          value="QORT"
                        >
                          <QortalSVG
                            color={theme.palette.text.primary}
                            width="22"
                            height="22"
                          />
                          QORT
                        </CustomMenuItem>
                        <CustomMenuItem
                          style={{ display: "flex", gap: "5px" }}
                          value="ARRR"
                        >
                          <ARRRSVG
                            color={theme.palette.text.primary}
                            width="22"
                            height="22"
                          />
                          ARRR
                        </CustomMenuItem>
                      </CustomSelect>
                    </FormControl>
                  </OrderTotalRow>
                )}
                <CheckoutButton
                  style={{ marginTop: "15px" }}
                  onClick={() => {
                    if (checkoutPage) {
                      handlePurchase();
                    } else if (!checkoutPage && !isDigitalOrder) {
                      setCheckoutPage(true);
                    } else if (!checkoutPage && isDigitalOrder) {
                      setConfirmPurchaseModalOpen(true);
                    } else {
                      setCheckoutPage(true);
                    }
                  }}
                >
                  {checkoutPage || (!checkoutPage && isDigitalOrder)
                    ? "Purchase"
                    : "Checkout"}
                </CheckoutButton>
              </TotalSumContainer>
            </Grid>
          )}
        </CartContainer>
        <CloseIconModal
          onClickFunc={closeModal}
          color={theme.palette.text.primary}
          height={"22"}
          width={"22"}
        />
      </ReusableModal>
      <ReusableModal
        open={confirmPurchaseModalOpen}
        customStyles={{
          width: "96%",
          maxWidth: 700,
          height: "auto",
          backgroundColor:
            theme.palette.mode === "light" ? "#e8e8e8" : "#32333c",
          position: "relative",
          padding: "15px 20px 35px 10px",
          borderRadius: "3px",
          overflowY: "auto",
          overflowX: "hidden",
          maxHeight: "90vh",
        }}
      >
        <ConfirmPurchaseContainer>
          <ConfirmPurchaseRow>
            Are you sure you wish to complete this purchase?
          </ConfirmPurchaseRow>
          <ConfirmPurchaseRow style={{ gap: "15px" }}>
            <CancelButton
              variant="outlined"
              color="error"
              onClick={() => {
                setConfirmPurchaseModalOpen(false);
              }}
            >
              Cancel
            </CancelButton>
            <ConfirmPurchaseButton variant="contained" onClick={handlePurchase}>
              Confirm
            </ConfirmPurchaseButton>
          </ConfirmPurchaseRow>
        </ConfirmPurchaseContainer>
      </ReusableModal>
    </>
  );
};
