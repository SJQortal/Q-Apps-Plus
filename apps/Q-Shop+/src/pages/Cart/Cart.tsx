import { useState, useEffect, useMemo } from "react";
import { ReusableModal } from "../../components/modals/ReusableModal";
import {
  CircularProgress,
  Grid,
  useTheme,
  useMediaQuery,
  FormControl,
  SelectChangeEvent,
  Box,
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
import { objectToBase64 } from "../../utils/toBase64";
import { MAIL_SERVICE_TYPE } from "../../constants/mail";
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
import moment from "moment";
import { BackArrowSVG } from "../../assets/svgs/BackArrowSVG";
import { CloseIconModal } from "../Store/StoreReviews/StoreReviews-styles";
import { ORDER_BASE, STORE_BASE } from "../../constants/identifiers";
import QORTLogo from "../../assets/img/qort.png";
import ARRRLogo from "../../assets/img/arrr.png";
import { AcceptedCoin } from "../StoreList/StoreList-styles";
import { ARRRSVG } from "../../assets/svgs/ARRRSVG";
import { setPreferredCoin } from "../../state/features/storeSlice";
import { CoinFilter } from "../Store/Store/Store";
import { useModal } from "../../components/common/useModal";
import { MultiplePublish } from "../../components/common/MultiplePublish/MultiplePublish";

/* Currency must be replaced in the order confirmation email by proper currency */

interface CountryProps {
  text: string;
  value: string;
}

export const Cart = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const {isShow, onCancel, onOk, show} = useModal()
  const [publishes, setPublishes] = useState<any>(null);
  const uid = new ShortUniqueId({
    length: 10,
  });
  const mailUid = new ShortUniqueId();

  const dispatch = useDispatch();
  const username = useSelector((state: RootState) => state.auth.user?.name);
  const usernamePublicKey = useSelector(
    (state: RootState) => state.auth.user?.publicKey
  );
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
    if (
      !isDigitalOrder &&
      (!customerName ||
        !streetAddress ||
        !country ||
        !city ||
        (country === "United States" && !state) ||
        (country !== "United States" && !region) ||
        !zipCode)
    ) {
      dispatch(
        setNotification({
          alertType: "error",
          msg: "Please fill in all the required delivery fields",
        })
      );
      return;
    }
    const details = (cartOrders || []).reduce(
      (acc: any, key) => {
        const order = localCart?.orders[key];
        const quantity = order?.quantity;
        const productId = order?.productId;
        const catalogueId = order?.catalogueId;
        let product = null;
        if (productId && catalogueId && catalogueHashMap[catalogueId]) {
          product = catalogueHashMap[catalogueId]?.products[productId];
        }
        if (!product) return acc;
        let price = product?.price?.find(item => item?.currency === "qort")?.value;
                      const priceArrr = product?.price?.find(item => item?.currency === CoinFilter.arrr)?.value;
                    
                      if(coinToUse === CoinFilter.arrr && priceArrr) {
                        price = +priceArrr
                      } else if(price && exchangeRate && coinToUse !== CoinFilter.qort){
                        price = +price * exchangeRate
                      }
        if (!price) {
          dispatch(
            setNotification({
              alertType: "error",
              msg: "Could not find the price",
            })
          );
          return;
        }
        const totalProductPrice = price * quantity;
        acc[productId] = {
          product,
          catalogueId,
          quantity,
          pricePerUnit: price,
          totalProductPrice: price * quantity,
        };
        acc["totalPrice"] = acc["totalPrice"] + totalProductPrice;
        return acc;
      },
      {
        totalPrice: 0,
      }
    );
    details["totalPrice"] = details["totalPrice"].toFixed(8);
    const priceToPay = details["totalPrice"];
    if (!storeOwner) {
      dispatch(
        setNotification({
          alertType: "error",
          msg: "Cannot find the store owner",
        })
      );
      return;
    }
    let res = await qortalRequest({
      action: "GET_NAME_DATA",
      name: storeOwner,
    });
    const address = res.owner;
    const resAddress = await qortalRequest({
      action: "GET_ACCOUNT_DATA",
      address: address,
    });
    if (!resAddress?.publicKey) {
      dispatch(
        setNotification({
          alertType: "error",
          msg: "Cannot find the store owner",
        })
      );
      return;
    }

    let responseSendCoin = null
    let signature = null

    if(coinToUse === CoinFilter.qort){
       responseSendCoin = await qortalRequest({
        action: "SEND_COIN",
        coin: "QORT",
        destinationAddress: address,
        amount: priceToPay,
      });
       signature = responseSendCoin.signature;
  
    } else if(coinToUse === CoinFilter.arrr){

      if(!storeToUse?.foreignCoins?.ARRR) throw new Error('Store has not set an ARRR address')
      responseSendCoin = await qortalRequest({
        action: "SEND_COIN",
        coin: "ARRR",
        destinationAddress: storeToUse?.foreignCoins?.ARRR.trim(),
        amount: priceToPay,
      });
    } else {
      dispatch(
        setNotification({
          alertType: "error",
          msg: "Currency not found",
        })
      );
    }
   
    try {
      dispatch(setIsLoadingGlobal(true));
      // Validate whether order is coming from the USA to put state instead of region
      const orderObjectNotUSA: any = {
        created: Date.now(),
        version: 1,
        details,
        storeName: hashMapStores[storeId]?.title,
        sellerName: storeOwner,
        delivery: {
          customerName,
          shippingAddress: {
            streetAddress,
            city,
            region,
            country,
            zipCode,
            deliveryNote,
          },
        },
        payment: {
          total: priceToPay,
          currency: coinToUse,
          transactionSignature: signature,
          arrrAddressUsed: coinToUse === CoinFilter.arrr ? storeToUse?.foreignCoins?.ARRR.trim() : ""
        },
        communicationMethod: ["Q-Mail"],
      };
      const orderObjectUSA: any = {
        created: Date.now(),
        version: 1,
        details,
        storeName: hashMapStores[storeId]?.title,
        sellerName: storeOwner,
        delivery: {
          customerName,
          shippingAddress: {
            streetAddress,
            city,
            state,
            country,
            zipCode,
            deliveryNote,
          },
        },
        payment: {
          total: priceToPay,
          currency: coinToUse,
          transactionSignature: signature,
          arrrAddressUsed: coinToUse === CoinFilter.arrr ? storeToUse?.foreignCoins?.ARRR.trim() : ""
        },
        communicationMethod: ["Q-Mail"],
      };
      const orderToBase64 = await objectToBase64(
        country === "United States" ? orderObjectUSA : orderObjectNotUSA
      );
      const orderId = uid();
      if (!storeId) throw new Error("Cannot find store identifier");
      const parts = storeId.split(`${STORE_BASE}-`);
      const shortStoreId = parts[1];
      const productRequestBody = {
        action: "PUBLISH_QDN_RESOURCE",
        identifier: `${ORDER_BASE}-${shortStoreId}-${orderId}`,
        name: username,
        service: "DOCUMENT_PRIVATE",
        data64: orderToBase64,
      };

      const mailId = mailUid();
      let identifier = `qortal_qmail_${storeOwner?.slice(0, 20)}_${address.slice(
        -6
      )}_mail_${mailId}`;

      // HTML with the order details being sent to seller by Q-Mail
      const htmlContent = `
      <div style="display: flex; flex-direction: column; align-items: center; padding: 10px; gap: 10px;">
        <div style="font-family: Merriweather Sans, sans-serif; font-size: 20px; letter-spacing: 0; text-align: center;">
          You have sold a product for your shop!
        </div>
        <div>
          ${Object.keys(details)
            .filter(key => key !== "totalPrice")
            .map(key => {
              const { product, quantity, pricePerUnit, totalProductPrice } =
                details[key];
              return `
                <div style="display: flex; flex-direction: column; align-items: center; padding: 20px 40px; gap: 10px; background-color: white; border-radius: 5px; color: black;">
                <div style="font-family: Karla; font-size: 21px; font-weight: 300; letter-spacing: 0; text-align: center;">Shop: ${
                  hashMapStores[storeId]?.title
                }</div>
                  <div style="display: flex; flex-direction: row; align-items: center; gap: 10px;">
                    <div style="font-family: Karla; font-size: 21px; font-weight: 300; letter-spacing: 0; text-align: center;">Product: ${
                      product.title
                    }</div>
                    <div style="font-family: Karla; font-size: 21px; font-weight: 300; letter-spacing: 0; text-align: center;">x ${quantity}</div>
                  </div>
                  <div style="display: flex; flex-direction: row; align-items: center;">
                    <div style="display: flex; align-items: center; font-family: Karla; font-size: 21px; font-weight: 300; letter-spacing: 0; text-align: center; gap: 7px">
                    Price: 
                    <div style="display: flex; align-items: center; gap: 2px;">
                    ${
                      orderObjectUSA?.payment?.currency === "QORT"
                        ? `<svg
                          fill={"#000000"}
                          version="1.0"
                          xmlns="http://www.w3.org/2000/svg"
                          width="22"
                          height="22"
                          viewBox="0 0 695.000000 754.000000"
                          preserveAspectRatio="xMidYMid meet"
                        >
                          <g
                            transform="translate(0.000000,754.000000) scale(0.100000,-0.100000)"
                            stroke="none"
                          >
                            <path
                              d="M3035 7289 c-374 -216 -536 -309 -1090 -629 -409 -236 -1129 -652
                -1280 -739 -82 -48 -228 -132 -322 -186 l-173 -100 0 -1882 0 -1883 38 -24
                c20 -13 228 -134 462 -269 389 -223 1779 -1026 2335 -1347 127 -73 268 -155
                314 -182 56 -32 95 -48 118 -48 33 0 207 97 991 552 l102 60 0 779 c0 428 -2
                779 -4 779 -3 0 -247 -140 -543 -311 -296 -170 -544 -308 -553 -306 -8 2 -188
                104 -400 226 -212 123 -636 368 -942 544 l-558 322 0 1105 c0 1042 1 1106 18
                1116 9 6 107 63 217 126 110 64 421 243 690 398 270 156 601 347 736 425 l247
                142 363 -210 c200 -115 551 -317 779 -449 228 -132 495 -286 594 -341 l178
                -102 -6 -1889 -6 -1888 23 14 c12 8 318 185 680 393 l657 379 0 1887 0 1886
                -77 46 c-43 25 -458 264 -923 532 -465 268 -1047 605 -1295 748 -646 373 -965
                557 -968 557 -1 0 -182 -104 -402 -231z"
                            />
                            <path
                              d="M3010 4769 c-228 -133 -471 -274 -540 -313 l-125 -72 0 -633 0 -632
                295 -171 c162 -94 407 -235 544 -315 137 -79 255 -142 261 -139 6 2 200 113
                431 247 230 133 471 272 534 308 l115 66 2 635 3 635 -536 309 c-294 169 -543
                310 -552 312 -9 2 -204 -105 -432 -237z"
                            />
                          </g>
                        </svg>`
                        : `<svg
                          xmlns="http://www.w3.org/2000/svg"
                          xmlnsXlink="http://www.w3.org/1999/xlink"
                          version="1.1"
                          id="Layer_1"
                          x="0px"
                          y="0px"
                          viewBox="0 0 2000 2000"
                          width="22"
                          height="22"
                          xmlSpace="preserve"
                        >
                          <linearGradient
                            id="SVGID_1_"
                            gradientUnits="userSpaceOnUse"
                            x1="0"
                            y1="-2"
                            x2="2000"
                            y2="-2"
                            gradientTransform="matrix(1 0 0 1 0 1002)"
                          >
                            <stop offset="0"></stop>
                            <stop offset="1"></stop>
                          </linearGradient>
                          <path
                            fill="#000000"
                            d="M1000,0C447.6,0,0,447.6,0,1000s447.6,1000,1000,1000s1000-447.6,1000-1000S1552.4,0,1000,0z M548.6,741.5  c0-123.6,100.2-223.1,224.6-223.1h512.4c58.6,0,114.9,23,156.7,64.1l-262.2,131.9h-361c-40.7,0-73.1,29.4-73.1,64.8v160.5  l-196.7,102.5V741.5L548.6,741.5z M1507.9,1075.4c0,123.6-100.2,223.1-223.1,223.1H745.3v190.7c0,32.4-24.1,58.8-52.8,65.6  l-67.1,1.5h-76.9v-331.6l257-134.1h431.8c40.7,0,74.6-29.4,74.6-65.6V828.9l195.9-98.7L1507.9,1075.4L1507.9,1075.4z"
                          ></path>
                        </svg>`
                    } ${pricePerUnit} ${
                country === "United States"
                  ? orderObjectUSA?.payment?.currency
                  : orderObjectNotUSA?.payment?.currency
              }
                </div>
                  </div>
                    </div>
                  <div style="display: flex; flex-direction: row; align-items: center;">
                    <div style="display: flex; align-items: center; font-family: Karla; font-size: 21px; font-weight: 300; letter-spacing: 0; text-align: center; gap: 7px">
                    Total Price:
                    <div style="display: flex; align-items: center; gap: 2px;">
                    ${
                      orderObjectUSA?.payment?.currency === "QORT"
                        ? `<svg
                          fill={"#000000"}
                          version="1.0"
                          xmlns="http://www.w3.org/2000/svg"
                          width="22"
                          height="22"
                          viewBox="0 0 695.000000 754.000000"
                          preserveAspectRatio="xMidYMid meet"
                        >
                          <g
                            transform="translate(0.000000,754.000000) scale(0.100000,-0.100000)"
                            stroke="none"
                          >
                            <path
                              d="M3035 7289 c-374 -216 -536 -309 -1090 -629 -409 -236 -1129 -652
                -1280 -739 -82 -48 -228 -132 -322 -186 l-173 -100 0 -1882 0 -1883 38 -24
                c20 -13 228 -134 462 -269 389 -223 1779 -1026 2335 -1347 127 -73 268 -155
                314 -182 56 -32 95 -48 118 -48 33 0 207 97 991 552 l102 60 0 779 c0 428 -2
                779 -4 779 -3 0 -247 -140 -543 -311 -296 -170 -544 -308 -553 -306 -8 2 -188
                104 -400 226 -212 123 -636 368 -942 544 l-558 322 0 1105 c0 1042 1 1106 18
                1116 9 6 107 63 217 126 110 64 421 243 690 398 270 156 601 347 736 425 l247
                142 363 -210 c200 -115 551 -317 779 -449 228 -132 495 -286 594 -341 l178
                -102 -6 -1889 -6 -1888 23 14 c12 8 318 185 680 393 l657 379 0 1887 0 1886
                -77 46 c-43 25 -458 264 -923 532 -465 268 -1047 605 -1295 748 -646 373 -965
                557 -968 557 -1 0 -182 -104 -402 -231z"
                            />
                            <path
                              d="M3010 4769 c-228 -133 -471 -274 -540 -313 l-125 -72 0 -633 0 -632
                295 -171 c162 -94 407 -235 544 -315 137 -79 255 -142 261 -139 6 2 200 113
                431 247 230 133 471 272 534 308 l115 66 2 635 3 635 -536 309 c-294 169 -543
                310 -552 312 -9 2 -204 -105 -432 -237z"
                            />
                          </g>
                        </svg>`
                        : `<svg
                          xmlns="http://www.w3.org/2000/svg"
                          xmlnsXlink="http://www.w3.org/1999/xlink"
                          version="1.1"
                          id="Layer_1"
                          x="0px"
                          y="0px"
                          viewBox="0 0 2000 2000"
                          width="22"
                          height="22"
                          xmlSpace="preserve"
                        >
                          <linearGradient
                            id="SVGID_1_"
                            gradientUnits="userSpaceOnUse"
                            x1="0"
                            y1="-2"
                            x2="2000"
                            y2="-2"
                            gradientTransform="matrix(1 0 0 1 0 1002)"
                          >
                            <stop offset="0"></stop>
                            <stop offset="1"></stop>
                          </linearGradient>
                          <path
                            fill="#000000"
                            d="M1000,0C447.6,0,0,447.6,0,1000s447.6,1000,1000,1000s1000-447.6,1000-1000S1552.4,0,1000,0z M548.6,741.5  c0-123.6,100.2-223.1,224.6-223.1h512.4c58.6,0,114.9,23,156.7,64.1l-262.2,131.9h-361c-40.7,0-73.1,29.4-73.1,64.8v160.5  l-196.7,102.5V741.5L548.6,741.5z M1507.9,1075.4c0,123.6-100.2,223.1-223.1,223.1H745.3v190.7c0,32.4-24.1,58.8-52.8,65.6  l-67.1,1.5h-76.9v-331.6l257-134.1h431.8c40.7,0,74.6-29.4,74.6-65.6V828.9l195.9-98.7L1507.9,1075.4L1507.9,1075.4z"
                          ></path>
                        </svg>`
                    }
                    ${totalProductPrice} ${
                country === "United States"
                  ? orderObjectUSA?.payment?.currency
                  : orderObjectNotUSA?.payment?.currency
              }
                  </div>
                </div>
              </div>
            </div>
              `;
            })
            .join("")}
        </div>
        ${
          !isDigitalOrder
            ? `
        <div>
          <div style="font-family: Merriweather Sans, sans-serif; font-size: 20px; letter-spacing: 0; text-align: center;">
            Delivery Information
          </div>
          <div style="display: flex; flex-direction: column; align-items: center; padding: 20px 40px; gap: 10px; background-color: white; border-radius: 5px; color: black;">
            <div style="font-family: Karla; font-size: 21px; font-weight: 300; letter-spacing: 0; text-align: center;">
              Qortal Username: ${username}
            </div>
            <div style="font-family: Karla; font-size: 21px; font-weight: 300; letter-spacing: 0; text-align: center;">
              Customer Name: ${customerName}
            </div>
            <div style="font-family: Karla; font-size: 21px; font-weight: 300; letter-spacing: 0; text-align: center;">
              Street Address: ${streetAddress}
            </div>
            <div style="font-family: Karla; font-size: 21px; font-weight: 300; letter-spacing: 0; text-align: center;">
              City: ${city}
            </div>
            ${
              country === "United States"
                ? `<div style="font-family: Karla; font-size: 21px; font-weight: 300; letter-spacing: 0; text-align: center;">
                State: ${state}
              </div>`
                : `<div style="font-family: Karla; font-size: 21px; font-weight: 300; letter-spacing: 0; text-align: center;">
                Region: ${region}
              </div>`
            }
            <div style="font-family: Karla; font-size: 21px; font-weight: 300; letter-spacing: 0; text-align: center;">
              Country: ${country}
            </div>
            <div style="font-family: Karla; font-size: 21px; font-weight: 300; letter-spacing: 0; text-align: center;">
              Zip Code: ${zipCode}
            </div>
            <div style="font-family: Karla; font-size: 21px; font-weight: 300; letter-spacing: 0; text-align: center;">
              Delivery Note: ${deliveryNote}
            </div>
          </div>
        </div>
        `
            : `<div></div>`
        }
        <div>
          <div style="font-family: Merriweather Sans, sans-serif; font-size: 20px; letter-spacing: 0; text-align: center;">
            Date of purchase
          </div>
          <div style="display: flex; flex-direction: column; align-items: center; padding: 20px 40px; gap: 10px; background-color: white; border-radius: 5px; color: black;">
            <div style="font-family: Karla; font-size: 18px; font-weight: 300; letter-spacing: 0; text-align: center;">
              Date: ${moment(
                country === "United States"
                  ? orderObjectUSA?.created
                  : orderObjectNotUSA?.created
              ).format("llll")}
            </div>
          </div>
        </div>
      </div>
      `;

      const mailObject: any = {
        title: `Order for shop ${shortStoreId} from ${username}`,
        subject: "New order",
        createdAt: Date.now(),
        version: 1,
        attachments: [],
        textContent: "",
        htmlContent: htmlContent,
        generalData: {
          thread: [],
        },
        recipient: storeOwner,
      };

      const mailObjectToBase64 = await objectToBase64(mailObject);
      let mailRequestBody: any = {
        action: "PUBLISH_QDN_RESOURCE",
        name: username,
        service: MAIL_SERVICE_TYPE,
        data64: mailObjectToBase64,
        identifier,
      };

      const multiplePublish = {
        action: "PUBLISH_MULTIPLE_QDN_RESOURCES",
        resources: [productRequestBody, mailRequestBody],
        encrypt: true,
        publicKeys: [resAddress.publicKey, usernamePublicKey],
      };
      setPublishes(multiplePublish)
      await show()
      // await qortalRequest(multiplePublish);
      // Clear this cart state from global carts redux
      dispatch(removeCartFromCarts({ storeId }));
      // Clear cart local state
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
      // Close the modal and set notification message
      closeModal();
      dispatch(
        setNotification({
          alertType: "success",
          msg: "Order placed successfully!",
        })
      );
    } catch (error) {
      console.log({ error });
      const errMsg = "Order failed to be placed! Please try again!";
      dispatch(
        setNotification({
          msg: errMsg,
          alertType: "error",
        })
      );
    } finally {
      dispatch(setIsLoadingGlobal(false));
      setPublishes(null)
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
     {isShow && (
        <MultiplePublish
          isOpen={isShow}
          onError={(messageNotification)=> {
            onCancel()
          }}
          onSubmit={() => {
            onOk()
          }}
          publishes={publishes}
        />
      )}
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
          direction={isMobile ? "column" : "row"}
          spacing={1}
        >
          <Grid item xs={12} sm={9} sx={{ width: "100%" }}>
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
                      <ProductInfoCol item xs={12} sm={6}>
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
                      <ProductInfoCol item xs={12} sm={6}>
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
                            item
                            xs={12}
                            sm={4}
                            style={{ textAlign: "center" }}
                          >
                            <ProductTitle>{product.title}</ProductTitle>
                            <ProductImage
                              src={product?.images?.[0] || ""}
                              alt={`product-img-${productId}}`}
                            />
                          </ProductInfoCol>
                          <ProductDetailsCol item xs={12} sm={8}>
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
            <Grid item xs={12} sm={3} sx={{ width: "100%" }}>
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
