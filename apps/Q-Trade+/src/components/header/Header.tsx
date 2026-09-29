import {
  useState,
  useEffect,
  useRef,
  useContext,
  ChangeEvent,
  useMemo,
} from "react";
import {
  BubbleCardColored1,
  CoinActionContainer,
  CoinActionRow,
  CoinActionsRow,
  CoinCancelBtn,
  CoinConfirmSendBtn,
  CoinReceiveBtn,
  CoinSelectRow,
  CoinSendBtn,
  CustomInputField,
  HeaderNav,
  HeaderRow,
  HeaderText,
  LogoColumn,
  NameRow,
  RightColumn,
  SendFont,
  TotalCol,
  Username,
} from "./Header-styles";
import gameContext from "../../contexts/gameContext";
import { UserContext } from "../../contexts/userContext";
import { cropAddress } from "../../utils/cropAddress";
import qtradeLogo from "../../components/common/icons/qtradeLogo.png";
import qortIcon from "../../assets/img/qort.png";
import ErrorIcon from "@mui/icons-material/Error";
import Copy from "../../assets/SVG/Copy.svg";
import { AddressQRCode } from "./AddressQRCode";
import { FallingLines } from "react-loader-spinner";
import {
  Alert,
  AppBar,
  Avatar,
  Box,
  Button,
  ButtonBase,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  FormControlLabel,
  MenuItem,
  Select,
  Snackbar,
  SnackbarCloseReason,
  Switch,
  Typography,
  styled,
} from "@mui/material";
import { sendRequestToExtension } from "../../App";
import { Terms } from "../Terms";
import ltcIcon from "../../assets/img/ltc.png";
import btcIcon from "../../assets/img/btc.png";
import dogeIcon from "../../assets/img/doge.png";
import rvnIcon from "../../assets/img/rvn.png";
import dgbIcon from "../../assets/img/dgb.png";
import arrrIcon from "../../assets/img/arrr.png";
import { Spacer } from "../common/Spacer";
import { ReusableModal } from "../common/reusable-modal/ReusableModal";
import { NotificationContext } from "../../contexts/notificationContext";
import UnsignedFees from "../sell/UnsignedFees";
import { FeeManager } from "../sell/FeeManager";
import { Info } from "../sell/Info";
import { Settings } from "../sell/Settings";
import { useSetAtom } from "jotai/react";
import { stuckTradesAtom } from "../../global/state";

const checkIfLocal = async () => {
  try {
    const response = await sendRequestToExtension("CHECK_IF_LOCAL");

    if (!response.error) {
      return response;
    }
  } catch (error) {
    return false;
  }
};

export const Label = styled("label")(
  ({ theme }) => `
  font-family: 'IBM Plex Sans', sans-serif;
  font-size: 14px;
  display: block;
  margin-bottom: 4px;
  font-weight: 400;
  `
);

interface CoinModalProps {
  coin: string;
  type: string;
}

const getCoinIcon = (coin) => {
  let img;

  switch (coin) {
    case "LTC":
      img = ltcIcon;
      break;
    case "BTC":
      img = btcIcon;
      break;

    case "DOGE":
      img = dogeIcon;
      break;
    case "RVN":
      img = rvnIcon;
      break;

    case "ARRR":
      img = arrrIcon;
      break;
    case "DGB":
      img = dgbIcon;
      break;
    default:
      null;
  }
  return img;
};

export const SelectRow = ({ coin }) => {
  let img = getCoinIcon(coin);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        height: "25px",
      }}
    >
      <img
        style={{
          height: "20px",
          width: "auto",
        }}
        src={img}
      />
      <p>{coin}</p>
    </div>
  );
};

export const Header = ({
  qortBalance,
  foreignCoinBalance,
  qortAddress,
  fee,
        setFee
}: any) => {
  const [openDropdown, setOpenDropdown] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const [checked, setChecked] = useState(false);
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<any>(null);
  const [openCoinActionModal, setOpenCoinActionModal] =
    useState<CoinModalProps | null>(null);
  const [receiverAddress, setReceiverAddress] = useState<string>("");
  const [openPermissionOpenQwallets, setOpenPermissionOpenQwallets] = useState(false)
  const [senderAddress, setSenderAddress] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [coinAddresses, setCoinAddresses] = useState({});
  const { isUsingGateway } = useContext(gameContext);
    const setStuckTrades = useSetAtom(stuckTradesAtom)
  

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setChecked(false);
    setOpen(true);
    setInfo({
      type: "error",
      message: "Change the node you are using at the authentication page",
    });
  };
  const { userInfo, selectedCoin, setSelectedCoin, getCoinLabel } =
    useContext(gameContext);
  const { setNotification } = useContext(NotificationContext);

  const LocalNodeSwitch = styled(Switch)(({ theme }) => ({
    padding: 8,
    "& .MuiSwitch-track": {
      borderRadius: 22 / 2,
      "&::before, &::after": {
        content: '""',
        position: "absolute",
        top: "50%",
        transform: "translateY(-50%)",
        width: 16,
        height: 16,
      },
      "&::before": {
        backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" height="16" width="16" viewBox="0 0 24 24"><path fill="${encodeURIComponent(
          theme.palette.getContrastText(theme.palette.primary.main)
        )}" d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z"/></svg>')`,
        left: 12,
      },
      "&::after": {
        backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" height="16" width="16" viewBox="0 0 24 24"><path fill="${encodeURIComponent(
          theme.palette.getContrastText(theme.palette.primary.main)
        )}" d="M19,13H5V11H19V13Z" /></svg>')`,
        right: 12,
      },
    },
    "& .MuiSwitch-thumb": {
      boxShadow: "none",
      width: 16,
      height: 16,
      margin: 2,
    },
  }));

  const handleClose = (
    event?: React.SyntheticEvent | Event,
    reason?: SnackbarCloseReason
  ) => {
    if (reason === "clickaway") {
      return;
    }

    setOpen(false);
    setInfo(null);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setOpenDropdown(false);
      }
    };

    document.addEventListener("click", handleClickOutside);

    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, []);

  // // Fetch avatar on userInfo change
  // useEffect(() => {
  //   if (userInfo?.name) {
  //     getAvatar();
  //   }
  // }, [userInfo]);

  const sendCoin = async () => {
    try {
      const coin =
        openCoinActionModal.coin === "QORT" ? "QORT" : getCoinLabel();
      if (!coin) return;
      setOpen(true);
      setInfo({
        type: "info",
        message: "Sending Coin...",
        autoHideDurationOff: true,
      });
      const response = await qortalRequest({
        action: "SEND_COIN",
        coin,
        destinationAddress: senderAddress,
        amount: +amount,
      });
      if (response?.error) {
        throw new Error(response?.error || "Failed to send coin.");
      }
      setOpen(true);
      setInfo({
        type: "success",
        message: "Coin sent",
      });
      setAmount("");
    } catch (error) {
      setOpen(true);
      setInfo({
        type: "error",
        message: error?.error || error?.message,
      });
    }
  };

  return (
    <>
      <AppBar
        position="sticky"
        sx={{
          background: "rgba(39, 40, 44, 1)",
        }}
      >
        <Box
          sx={{
            display: "flex",
            gap: "20px",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            padding: "10px",
          }}
        >
          <LogoColumn>
            <img
              src={qtradeLogo}
              style={{
                height: "40px",
              }}
            />
          </LogoColumn>
          <FormControlLabel
            sx={{
              color: "white",
            }}
            control={
              <LocalNodeSwitch
                checked={isUsingGateway}
                onChange={handleChange}
              />
            }
            label="Is using Gateway"
          />
        </Box>
      </AppBar>
      <HeaderNav
        sx={{
          flexDirection: "column",
          gap: "10px",
        }}
      >
        <Spacer height="10px" />
        <Box
          sx={{
            display: "flex",
            gap: "20px",
            alignItems: "center",
            width: "100%",
            justifyContent: "space-between",
          }}
        >
          <NameRow>
            {userInfo?.name ? (
              <Avatar
                sx={{
                  height: "30px",
                  width: "30px",
                  fontSize: "16px",
                }}
                src={`/arbitrary/THUMBNAIL/${userInfo?.name}/qortal_avatar?async=true`}
                alt={`${userInfo?.name}`}
              >
                {userInfo?.name?.charAt(0)?.toUpperCase()}
              </Avatar>
            ) : userInfo?.address ? (
              <BubbleCardColored1 style={{ height: "35px", width: "35px" }} />
            ) : null}
            {userInfo?.name ? (
              <Username>{userInfo?.name}</Username>
            ) : userInfo?.address ? (
              <Username>{cropAddress(userInfo?.address)}</Username>
            ) : null}
          </NameRow>
          <Box sx={{
            display: 'flex',
            gap: '10px'
          }}>
             <Terms />
             {!isUsingGateway && (
               <Settings />
             )}
           
          </Box>
         
        </Box>

        <RightColumn
          sx={{
            alignItems: "center",
          }}
        >
          <Card
            variant="outlined"
            sx={{
              backgroundColor: "#292929",
              "&.MuiCard-root": {
                cursor: "default",
              },
            }}
          >
            <CardContent>
              <HeaderText>Total Balance</HeaderText>
              <Spacer height="10px" />
              <TotalCol>
                <Box
                  sx={{
                    display: "flex",
                    gap: "10px",
                    alignItems: "center",
                  }}
                >
                  <img
                    src={qortIcon}
                    style={{
                      height: "25px",
                      width: "auto",
                    }}
                  />
                  <HeaderText>{qortBalance} QORT</HeaderText>
                </Box>
                <CoinActionsRow>
                  <CoinSendBtn
                    onClick={() => {
                      setOpenCoinActionModal({
                        coin: "QORT",
                        type: "send",
                      });
                    }}
                  >
                    Send
                  </CoinSendBtn>
                  <CoinReceiveBtn
                    onClick={() => {
                      setOpenCoinActionModal({
                        coin: "QORT",
                        type: "receive",
                      });
                    }}
                  >
                    Receive
                  </CoinReceiveBtn>
                </CoinActionsRow>
              </TotalCol>
              <Spacer height="10px" />
              <TotalCol>
                <Box
                  sx={{
                    display: "flex",
                    gap: "10px",
                    alignItems: "center",
                  }}
                >
                  <img
                    src={getCoinIcon(getCoinLabel())}
                    style={{
                      height: "25px",
                      width: "auto",
                    }}
                  />
                  {foreignCoinBalance === null ? (
                    <FallingLines color="white" width="30" visible={true} />
                  ) : (
                    foreignCoinBalance
                  )}{" "}
                  {getCoinLabel()}
                </Box>
                <CoinActionsRow>
                  <CoinSendBtn
                    onClick={() => {
                      setOpenPermissionOpenQwallets(true)
                      // setOpenCoinActionModal({
                      //   coin: selectedCoin,
                      //   type: "send",
                      // });
                    }}
                  >
                    Send
                  </CoinSendBtn>
                  <CoinReceiveBtn
                    onClick={() => {
                      setOpenCoinActionModal({
                        coin: selectedCoin,
                        type: "receive",
                      });
                    }}
                  >
                    Receive
                  </CoinReceiveBtn>
                </CoinActionsRow>
              </TotalCol>
            </CardContent>
          </Card>
        </RightColumn>
 <Dialog
        open={openPermissionOpenQwallets}

        keepMounted
        onClose={()=> setOpenPermissionOpenQwallets(false)}
        aria-describedby="alert-dialog-slide-description"
      >
        <DialogTitle>{`Send ${selectedCoin}`}</DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-slide-description">
           To send {selectedCoin} please open and use Q-Wallets
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={()=> setOpenPermissionOpenQwallets(false)}>Close</Button>
          <Button onClick={()=> {
            qortalRequest({
         action: "OPEN_NEW_TAB",
  qortalLink: `qortal://APP/Q-Wallets/${selectedCoin.toLowerCase()}`,
          })
          setOpenPermissionOpenQwallets(false)
          }}>Open Q-Wallets</Button>
        </DialogActions>
      </Dialog>
        <CoinSelectRow>
          <Select
            size="small"
            value={selectedCoin}
            onChange={(e) => {
              setFee(null)
              setSelectedCoin(e.target.value)
              setStuckTrades([])
            }}
          >
            <MenuItem value={"LITECOIN"}>
              <SelectRow coin="LTC" />
            </MenuItem>
            <MenuItem value={"DOGECOIN"}>
              <SelectRow coin="DOGE" />
            </MenuItem>
            <MenuItem value={"BITCOIN"}>
              <SelectRow coin="BTC" />
            </MenuItem>
            <MenuItem value={"DIGIBYTE"}>
              <SelectRow coin="DGB" />
            </MenuItem>
            <MenuItem value={"RAVENCOIN"}>
              <SelectRow coin="RVN" />
            </MenuItem>
            <MenuItem value={"PIRATECHAIN"}>
              <SelectRow coin="ARRR" />
            </MenuItem>
          </Select>
          {/* <Info /> */}
          {!isUsingGateway && selectedCoin !== 'PIRATECHAIN' && (
            <>
              <FeeManager selectedCoin={selectedCoin} fee={fee}
        setFee={setFee} />
              <UnsignedFees
                qortAddress={qortAddress}
              />
            </>
          )}
        </CoinSelectRow>
        <Snackbar
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
          open={open}
          autoHideDuration={info?.autoHideDurationOff ? null : 6000}
          onClose={handleClose}
        >
          {info?.type && (
            <Alert
              onClose={handleClose}
              severity={info?.type}
              variant="filled"
              sx={{ width: "100%" }}
            >
              {info?.message}
            </Alert>
          )}
        </Snackbar>
        {openCoinActionModal && (
          <ReusableModal
            onClickClose={() => {
              setOpenCoinActionModal(null);
              setAmount("");
              setSenderAddress("");
            }}
            backdrop
            open={!!openCoinActionModal}
          >
            <CoinActionContainer>
              {openCoinActionModal.type === "send" ? (
                <>
                  <CoinActionRow>
                    <HeaderRow>
                      {openCoinActionModal.type === "send" &&
                      openCoinActionModal.coin === "QORT" ? (
                        <>
                          <SendFont>Send {openCoinActionModal.coin}</SendFont>
                          <img
                            src={qortIcon}
                            style={{
                              height: "25px",
                              width: "auto",
                            }}
                          />
                        </>
                      ) : openCoinActionModal.type === "send" &&
                        openCoinActionModal.coin !== "QORT" ? (
                        <>
                          <SendFont>Send {openCoinActionModal.coin}</SendFont>
                          <img
                            src={getCoinIcon(getCoinLabel())}
                            style={{
                              height: "25px",
                              width: "auto",
                            }}
                          />
                        </>
                      ) : null}
                    </HeaderRow>
                  </CoinActionRow>
                  <CoinActionRow>
                    <FormControl fullWidth>
                      <CustomInputField
                        style={{ flexGrow: 1 }}
                        name={
                          openCoinActionModal.type === "send"
                            ? `${
                                openCoinActionModal.coin === "QORT"
                                  ? "Recipient Address or Name"
                                  : "Recipient Address"
                              }`
                            : "Receive Address"
                        }
                        label={
                          openCoinActionModal.type === "send"
                            ? `${
                                openCoinActionModal.coin === "QORT"
                                  ? "Recipient Address or Name"
                                  : "Recipient Address"
                              }`
                            : "Receive Address"
                        }
                        variant="filled"
                        value={
                          openCoinActionModal.type === "send"
                            ? senderAddress
                            : receiverAddress
                        }
                        required
                        onChange={(e) => {
                          if (openCoinActionModal.type === "send") {
                            setSenderAddress(e.target.value);
                          } else {
                            setReceiverAddress(e.target.value);
                          }
                        }}
                      />
                    </FormControl>
                  </CoinActionRow>
                  {openCoinActionModal.type === "send" && (
                    <CoinActionRow>
                      <FormControl fullWidth>
                        <CustomInputField
                          style={{ flexGrow: 1 }}
                          name="Amount"
                          label="Amount"
                          variant="filled"
                          type="number"
                          value={amount}
                          required
                          onChange={(e) => {
                            setAmount(e.target.value);
                          }}
                        />
                      </FormControl>
                    </CoinActionRow>
                  )}
                </>
              ) : (
                <>
                  <ReceiveCoin
                    setOpen={setOpen}
                    setInfo={setInfo}
                    coinAddresses={coinAddresses}
                    setCoinAddresses={setCoinAddresses}
                    selectedCoin={
                      openCoinActionModal.coin === "QORT"
                        ? "QORT"
                        : getCoinLabel()
                    }
                  />
                </>
              )}
              {openCoinActionModal.type === "send" && (
                <CoinActionRow style={{ gap: "10px" }}>
                  {/* <CoinCancelBtn onClick={() => setOpenCoinActionModal(null)}>
                   Cancel
                 </CoinCancelBtn> */}
                  <CoinConfirmSendBtn
                    onClick={() => {
                      if (openCoinActionModal.type === "send") {
                        sendCoin();
                      }
                      setNotification({
                        alertType: "alertInfo",
                        msg: "Sending...",
                      });
                    }}
                  >
                    {openCoinActionModal.type === "send" ? "Send" : "Receive"}
                  </CoinConfirmSendBtn>
                </CoinActionRow>
              )}
            </CoinActionContainer>
          </ReusableModal>
        )}
      </HeaderNav>
    </>
  );
};

export const AddressBox = styled(Box)`
  display: flex;
  border: 1px solid var(--50-white, rgba(255, 255, 255, 0.5));
  justify-content: space-between;
  align-items: center;
  width: auto;
  word-break: break-word;
  padding: 5px 15px 5px 15px;
  gap: 5px;
  border-radius: 100px;
  font-family: Inter;
  font-size: 12px;
  font-weight: 600;
  line-height: 14.52px;
  text-align: left;
  color: var(--50-white, rgba(255, 255, 255, 0.5));
  cursor: pointer;
  transition: all 0.2s;
  &:hover {
    background-color: rgba(41, 41, 43, 1);
    color: white;
    svg path {
      fill: white; // Fill color changes to white on hover
    }
  }
`;

const ReceiveCoin = ({
  coinAddresses,
  setCoinAddresses,
  selectedCoin,
  setOpen,
  setInfo,
}) => {
  const [errorMsg, setErrorMsg] = useState("");
  const foreignAddress = useMemo(() => {
    return coinAddresses[selectedCoin] || null;
  }, [coinAddresses, selectedCoin]);

  const getForeignAddress = async (coin) => {
    try {
      setOpen(true);
      setInfo({
        type: "info",
        message: "Retrieving address...",
      });
      const response = await qortalRequest({
        action: "GET_USER_WALLET",
        coin,
      });
      if (response?.address) {
        setCoinAddresses((prev) => {
          return {
            ...prev,
            [coin]: response.address,
          };
        });
      }
      if (response?.error) {
        throw new Error(response?.error || "Failed to send coin.");
      }
    } catch (error) {
      setErrorMsg(error?.message);
    } finally {
      setOpen(false);
      setInfo(null);
    }
  };

  useEffect(() => {
    if (!selectedCoin) return;
    if (!coinAddresses[selectedCoin]) {
      getForeignAddress(selectedCoin);
    }
  }, [selectedCoin, coinAddresses]);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <Typography
        sx={{
          color: "white",
        }}
      >{`Send ${selectedCoin} to your address below`}</Typography>
      <Spacer height="20px" />
      {foreignAddress && (
        <ButtonBase
          onClick={() => {
            navigator.clipboard
              .writeText(foreignAddress)
              .then(() => {
                setOpen(true);
                setInfo({
                  type: "info",
                  message: "Address copied!",
                });
              })
              .catch((err) => {
                console.error("Failed to copy LTC address:", err);
              });
          }}
        >
          <AddressBox>
            {foreignAddress} <img src={Copy} />
          </AddressBox>
        </ButtonBase>
      )}
      {foreignAddress && (
        <>
          <AddressQRCode targetAddress={foreignAddress} />
        </>
      )}
      {errorMsg && (
        <>
          <Spacer height="20px" />
          <Typography
            sx={{
              color: "white",
            }}
          >
            {errorMsg}
          </Typography>
        </>
      )}
    </Box>
  );
};
