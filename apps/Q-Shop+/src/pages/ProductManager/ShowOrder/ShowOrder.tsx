import { FC, useEffect, useState, useMemo } from "react";
import { ReusableModal } from "../../../components/modals/ReusableModal";
import { Box, CircularProgress, useTheme } from "@mui/material";
import EmailIcon from "@mui/icons-material/Email";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../../state/store";
import {
  base64ToUint8Array,
  objectToBase64,
  uint8ArrayToObject,
} from "../../../utils/toBase64";
import {
  Divider,
  OrderDetailsCard,
  OrderDetailsContainer,
  OrderId,
  OrderQuantityRow,
  OrderStatusCard,
  OrderStatusNote,
  OrderStatusRow,
  OrderTitle,
  OrderTitleCol,
  PriceRow,
  ShowOrderCol,
  ShowOrderContent,
  ShowOrderDateCreated,
  ShowOrderHeader,
  ShowOrderImages,
  ShowOrderProductImage,
  ShowOrderTitle,
  TotalCostContainer,
  TotalCostCol,
  TotalCostFont,
  OrderDetails,
  DetailsFont,
  DetailsRow,
  DetailsCard,
  CloseDetailsCardIcon,
  DeliveryInfoCard,
  CloseButton,
  CloseButtonRow,
  SellerOrderStatusRow,
  CustomSelect,
  UpdateStatusButton,
  TotalPriceRow,
} from "./ShowOrder-styles";
import moment from "moment";
import { DialogsSVG } from "../../../assets/svgs/DialogsSVG";
import { Order, addToHashMap } from "../../../state/features/orderSlice";
import { QortalSVG } from "../../../assets/svgs/QortalSVG";
import { ExpandMoreSVG } from "../../../assets/svgs/ExpandMoreSVG";
import { setNotification } from "../../../state/features/notificationsSlice";
import { CustomInputField } from "../../../components/modals/CreateStoreModal-styles";
import { CustomMenuItem } from "../NewProduct/NewProduct-styles";
import { CoinFilter } from "../../Store/Store/Store";
import { ARRRSVG } from "../../../assets/svgs/ARRRSVG";

/* <QortalSVG /> must be replaced by <ARRRSVG /> everywhere here depending on the payment info */

interface ShowOrderProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  order: Order;
  from: string;
}

export const ShowOrder: FC<ShowOrderProps> = ({
  isOpen,
  setIsOpen,
  order,
  from,
}) => {
  const theme = useTheme();
  const username = useSelector((state: RootState) => state.auth.user?.name);
  const usernamePublicKey = useSelector(
    (state: RootState) => state.auth.user?.publicKey
  );
  const hashMapOrders = useSelector(
    (state: RootState) => state.order.hashMapOrders
  );

  const dispatch = useDispatch();

  const [note, setNote] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("Received");
  const [paymentInfo, setPaymentInfo] = useState(null);
  const [paymentInfoForeign, setPaymentInfoForeign] = useState(false);

  const [statusLoader, setStatusLoader] = useState(false);

  const closeModal = () => {
    setIsOpen(false);
  };

  const getPaymentInfo = async (signature: string) => {
    try {
      const url = `/transactions/signature/${signature}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });
      // Coin payment info must be added to responseData so we can display it to the user
      const responseData = await response.json();
      if (responseData && !responseData.error) {
        setPaymentInfo(responseData);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const updateStatus = async () => {
    try {
      const orderStateObject: any = {
        status: selectedStatus,
        note,
      };
      const orderStatusToBase64 = await objectToBase64(orderStateObject);

      let res = await qortalRequest({
        action: "GET_NAME_DATA",
        name: order?.user,
      });
      const address = res.owner;
      const resAddress = await qortalRequest({
        action: "GET_ACCOUNT_DATA",
        address: address,
      });
      if (!resAddress?.publicKey) throw new Error("Cannot find store owner");
      const string = order?.id;

      const identifier = string.replace(/(q-store)(-order)/, "$1-status$2");
      const productRequestBody = {
        action: "PUBLISH_QDN_RESOURCE",
        identifier: identifier,
        name: username,
        service: "DOCUMENT_PRIVATE",
        filename: `${order?.id}_status.json`,
        data64: orderStatusToBase64,
        encrypt: true,
        publicKeys: [resAddress.publicKey, usernamePublicKey],
      };
      await qortalRequest(productRequestBody);
      dispatch(
        setNotification({
          alertType: "success",
          msg: "Order status updated successfully!",
        })
      );
    } catch (error) {
      console.log({ error });
    }
  };

  const verifyIfOrderStatusUpdated = async () => {
    if (!order?.id) return;
    // Find the index of "order-" in the string
    const extractedOrderIdEnd = order?.id.slice(
      order?.id.indexOf("order-") + "order-".length
    );
    try {
      setStatusLoader(true);
      const query = `q-store-status-order-${extractedOrderIdEnd}`;
      // Check if resource exists
      const url = `/arbitrary/resources/search?service=DOCUMENT_PRIVATE&query=${query}&limit=1&includemetadata=false&mode=ALL&reverse=true`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const responseData = await response.json();
      if (responseData.length === 0) return;
      // Get the raw data if the resource exists
      else {
        let orderRawData = await qortalRequest({
          action: "FETCH_QDN_RESOURCE",
          name: from === "ProductManager" ? username : order?.sellerName,
          service: "DOCUMENT_PRIVATE",
          identifier: query,
          encoding: "base64",
        });
        const base64 = orderRawData;
        let orderUserName = await qortalRequest({
          action: "GET_NAME_DATA",
          name: order?.user,
        });
        const address = orderUserName.owner;
        const resAddress = await qortalRequest({
          action: "GET_ACCOUNT_DATA",
          address: address,
        });
        if (!resAddress?.publicKey) throw new Error("Cannot find order owner");
        const recipientPublicKey = resAddress.publicKey;
        // Decrypt the raw data since it was encrypted when the status was changed
        let requestEncryptBody: any = {
          action: "DECRYPT_DATA",
          encryptedData: base64,
          publicKey: recipientPublicKey,
        };
        const resDecrypt = await qortalRequest(requestEncryptBody);

        if (!resDecrypt) return;
        const decryptToUnit8Array = base64ToUint8Array(resDecrypt);
        const orderStatus = uint8ArrayToObject(decryptToUnit8Array);
        setNote(orderStatus?.note || "");
        setSelectedStatus(orderStatus?.status || "");
        dispatch(
          addToHashMap({
            ...order,
            status: orderStatus?.status,
            note: orderStatus?.note,
          })
        );
        return;
      }
    } catch (error) {
      console.error(error);
    } finally {
      setStatusLoader(false);
    }
  };

  //  Check to see if any of the products in the order are digital and that there are none which are physical. Hide delivery details in the order if that's the case.
  const isDigitalOrder = useMemo(() => {
    if (order && order?.details) {
      if (!order) return false;
      return Object.keys(order?.details || {})
        .filter(key => key !== "totalPrice")
        .every(key => {
          const product = order?.details?.[key]?.product;
          if (!product) return false;
          return product?.type === "digital";
        });
    } else {
      return false;
    }
  }, [order]);

  // Check to see if product status has been updated when opening <ShowOrder /> from either ProductManager.tsx or from MyOrders.tsx
  useEffect(() => {
    if (isOpen && order?.id) {
      verifyIfOrderStatusUpdated();
    }
  }, [isOpen, order?.id]);


  const coinToUse = order?.payment?.currency


  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "flex-end",
        width: "100%",
      }}
    >
      <ReusableModal
        open={isOpen}
        customStyles={{
          width: "100%",
          maxWidth: 800,
          height: "90%",
          wordBreak: "break-word",
          borderRadius: 8,
          padding: "32px 20px",
        }}
      >
        <ShowOrderHeader>
          <ShowOrderImages>
            {Object.keys(order?.details || {})
              .filter(key => key !== "totalPrice")
              .map((key, index) => {
                return (
                  <ShowOrderProductImage
                    key={key}
                    src={order?.details?.[key]?.product?.images?.[0]}
                    alt={`image-${index}`}
                  />
                );
              })}
          </ShowOrderImages>
          <ShowOrderCol>
            <ShowOrderTitle
              href={`qortal://APP/Q-Mail/to/${
                from === "ProductManager"
                  ? order?.delivery?.customerName
                  : order?.sellerName
              }`}
              className="qortal-link"
            >
              <EmailIcon
                sx={{
                  color: "#50e3c2",
                }}
              />
              {from === "ProductManager"
                ? `Message ${order?.delivery?.customerName} on Q-Mail`
                : `Message ${order?.sellerName} on Q-Mail`}
            </ShowOrderTitle>
            <ShowOrderDateCreated>
              {moment(order?.created).format("llll")}
            </ShowOrderDateCreated>
          </ShowOrderCol>
        </ShowOrderHeader>
        <ShowOrderContent>
          <>
            {statusLoader ? (
              <CircularProgress />
            ) : from === "ProductManager" ? (
              <SellerOrderStatusRow>
                <ShowOrderTitle>Order Status</ShowOrderTitle>
                <CustomSelect
                  name="status"
                  value={selectedStatus}
                  onChange={event => {
                    setSelectedStatus(event.target.value as string);
                  }}
                  variant="filled"
                  required
                >
                  <CustomMenuItem value="Received">Received</CustomMenuItem>
                  <CustomMenuItem value="Shipped">Shipped</CustomMenuItem>
                  <CustomMenuItem value="Refunded">Refunded</CustomMenuItem>
                </CustomSelect>
                <CustomInputField
                  style={{ minWidth: "300px" }}
                  name="note"
                  label="Note"
                  value={note}
                  variant="filled"
                  onChange={e => setNote(e.target.value)}
                  size="small"
                  fullWidth
                />
                <UpdateStatusButton onClick={updateStatus} variant="contained">
                  Update Status
                </UpdateStatusButton>
              </SellerOrderStatusRow>
            ) : (
              <OrderStatusRow>
                <OrderStatusCard
                  style={{
                    backgroundColor:
                      hashMapOrders[order?.id]?.status === "Received"
                        ? "#e5e916"
                        : hashMapOrders[order?.id]?.status === "Shipped"
                        ? "#29b100"
                        : hashMapOrders[order?.id]?.status === " Refunded"
                        ? "#f33c3c"
                        : "#e5e916",
                  }}
                >
                  Order Status: {hashMapOrders[order?.id]?.status}
                </OrderStatusCard>
                <OrderStatusNote>
                  {hashMapOrders[order?.id]?.note}
                </OrderStatusNote>
              </OrderStatusRow>
            )}
          </>
          <>
            {order?.details && (
              <>
                <OrderDetails>
                  {Object.keys(order?.details || {})
                    .filter(key => key !== "totalPrice")
                    .map(key => {
                      const product = order?.details?.[key];
                      return (
                        <OrderDetailsContainer key={key}>
                          <DialogsSVG
                            color={theme.palette.text.primary}
                            height={"22"}
                            width={"22"}
                          />
                          <OrderDetailsCard>
                            <OrderTitleCol>
                              <OrderTitle>{product?.product?.title}</OrderTitle>
                              <OrderId>
                                Product Id: {product?.product?.id}
                              </OrderId>
                            </OrderTitleCol>
                            <OrderTitleCol>
                              <OrderQuantityRow>
                                <OrderTitle
                                  style={{ display: "flex", gap: "10px" }}
                                >
                                  {`x ${product?.quantity}`}
                                  <span>{product?.pricePerUnit}</span>
                                </OrderTitle>
                                {coinToUse === CoinFilter.qort && (
                                   <QortalSVG
                                   width={"22"}
                                   height={"22"}
                                   color={theme.palette.text.primary}
                                 />
                                )}
                                {coinToUse === CoinFilter.arrr && (
                                   <ARRRSVG
                                   width={"22"}
                                   height={"22"}
                                   color={theme.palette.text.primary}
                                 />
                                )}
                              </OrderQuantityRow>
                              <TotalPriceRow>
                                Total: {product?.totalProductPrice}
                                {coinToUse === CoinFilter.qort && (
                                   <QortalSVG
                                   width={"22"}
                                   height={"22"}
                                   color={theme.palette.text.primary}
                                 />
                                )}
                                {coinToUse === CoinFilter.arrr && (
                                   <ARRRSVG
                                   width={"22"}
                                   height={"22"}
                                   color={theme.palette.text.primary}
                                 />
                                )}
                              </TotalPriceRow>
                            </OrderTitleCol>
                          </OrderDetailsCard>
                        </OrderDetailsContainer>
                      );
                    })}
                </OrderDetails>
                <TotalCostContainer>
                  <TotalCostCol>
                    <Divider />
                    <PriceRow>
                    {coinToUse === CoinFilter.qort && (
                                   <QortalSVG
                                   width={"22"}
                                   height={"22"}
                                   color={theme.palette.text.primary}
                                 />
                                )}
                                {coinToUse === CoinFilter.arrr && (
                                   <ARRRSVG
                                   width={"22"}
                                   height={"22"}
                                   color={theme.palette.text.primary}
                                 />
                                )}
                    
                      <TotalCostFont>
                        {order?.details?.totalPrice}
                      </TotalCostFont>
                    </PriceRow>
                  </TotalCostCol>
                  <TotalCostCol>
                    <DetailsRow
                      onClick={() =>{
                        if(coinToUse === CoinFilter.qort){
                          getPaymentInfo(
                            order?.payment?.transactionSignature as string
                          )
                        } else {
                          setPaymentInfoForeign(true)
                        }
                      }
                       
                        
                      }
                    >
                      <DetailsFont>Payment Details</DetailsFont>
                      <ExpandMoreSVG
                        color={theme.palette.text.primary}
                        height={"22"}
                        width={"22"}
                      />
                    </DetailsRow>
                  </TotalCostCol>

                 {paymentInfoForeign && (
                   <DetailsCard>
                   {coinToUse === CoinFilter.arrr && (
                    <>
                     <span>Currency:</span>{" "}
                          <span style={{ fontWeight: 300 }}>
                            {coinToUse}
                          </span>
                          <span>Payment sent to</span>{" "}
                          <span style={{ fontWeight: 300 }}>
                            {order?.payment?.arrrAddressUsed}
                          </span>
                          </>
                           )}
                           <CloseDetailsCardIcon
                        width={"18"}
                        height={"18"}
                        color={theme.palette.text.primary}
                        onClickFunc={() => setPaymentInfoForeign(false)}
                      />
                   </DetailsCard>
                 )}
                    
                 
                  {paymentInfo && (
                    <DetailsCard>
                      {Object.keys(paymentInfo || {}).map(key => {
                        return (
                          <>
                            <span>{key}:</span>{" "}
                            <span style={{ fontWeight: 300 }}>
                              {paymentInfo[key]}
                            </span>
                          </>
                        );
                      })}
                      <CloseDetailsCardIcon
                        width={"18"}
                        height={"18"}
                        color={theme.palette.text.primary}
                        onClickFunc={() => setPaymentInfo(null)}
                      />
                    </DetailsCard>
                  )}
                </TotalCostContainer>
              </>
            )}
          </>
          {!isDigitalOrder && (
            <DeliveryInfoCard>
              <ShowOrderTitle>Delivery Information</ShowOrderTitle>
              <OrderTitle>
                <span>Shop Name:</span> {order?.storeName}
              </OrderTitle>
              <OrderTitle>
                <span>Seller Name:</span> {order?.sellerName}
              </OrderTitle>
              <OrderTitle>
                <span>Customer name:</span> {order?.delivery?.customerName}
              </OrderTitle>
              {order?.delivery?.shippingAddress && (
                <>
                  {Object.entries(order?.delivery?.shippingAddress).map(
                    ([key, value]) => (
                      <OrderTitle key={key}>
                        <span>{key}:</span> {value}
                      </OrderTitle>
                    )
                  )}
                </>
              )}
            </DeliveryInfoCard>
          )}
        </ShowOrderContent>
        <CloseButtonRow>
          <CloseButton variant="outlined" color="error" onClick={closeModal}>
            Close
          </CloseButton>
        </CloseButtonRow>
      </ReusableModal>
    </Box>
  );
};
