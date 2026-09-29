import { FC, ChangeEvent, useState, useEffect } from "react";
import {
  Typography,
  Modal,
  FormControl,
  useTheme,
  IconButton,
  Zoom,
  Tooltip,
} from "@mui/material";
import { useDispatch } from "react-redux";
import { setIsLoadingGlobal, toggleCreateStoreModal } from "../../state/features/globalSlice";
import ImageUploader from "../common/ImageUploader";
import {
  ModalTitle,
  StoreLogoPreview,
  AddLogoButton,
  AddLogoIcon,
  TimesIcon,
  LogoPreviewRow,
  CustomInputField,
  ModalBody,
  ButtonRow,
  CancelButton,
  CreateButton,
  WalletRow,
  DownloadArrrWalletIcon,
} from "./CreateStoreModal-styles";
import {
  FilterSelect,
  FilterSelectMenuItems,
  FiltersCheckbox,
  FiltersChip,
  FiltersOption,
} from "../../pages/Store/Store/Store-styles";
import { supportedCoinsArray } from "../../constants/supported-coins";
import { QortalSVG } from "../../assets/svgs/QortalSVG";
import { ARRRSVG } from "../../assets/svgs/ARRRSVG";
import { setNotification } from "../../state/features/notificationsSlice";
export interface ForeignCoins {
  [key: string]: string;
}

export interface onPublishParam {
  title: string;
  description: string;
  shipsTo: string;
  location: string;
  storeIdentifier: string;
  logo: string;
  foreignCoins: ForeignCoins;
  supportedCoins: string[];
}

interface CreateStoreModalProps {
  open: boolean;
  closeCreateStoreModal: boolean;
  setCloseCreateStoreModal: (val: boolean) => void;
  onPublish: (param: onPublishParam) => Promise<void>;
  username: string;
}


const CreateStoreModal: React.FC<CreateStoreModalProps> = ({
  open,
  closeCreateStoreModal,
  setCloseCreateStoreModal,
  onPublish,
  username,
}) => {
  const dispatch = useDispatch();
  const theme = useTheme();

  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [location, setLocation] = useState<string>("");
  const [shipsTo, setShipsTo] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [storeIdentifier, setStoreIdentifier] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [supportedCoinsSelected, setSupportedCoinsSelected] = useState<
    string[]
  >(["QORT"]);
  const [qortWalletAddress, setQortWalletAddress] = useState<string>("");
  const [arrrWalletAddress, setArrrWalletAddress] = useState<string>("");

  const handlePublish = async (): Promise<void> => {
    try {
      setErrorMessage("");
      if (!logo) {
        setErrorMessage("A logo is required");
        return;
      }
      const foreignCoins: ForeignCoins = {
        ARRR: arrrWalletAddress
      }
      supportedCoinsSelected.filter((coin)=> coin !== 'QORT').forEach((item: string)=> {
        if(!foreignCoins[item]) throw new Error(`Please add a ${item} address`)
      })
      await onPublish({
        title,
        description,
        shipsTo,
        location,
        storeIdentifier,
        logo,
        foreignCoins: {
          ARRR: arrrWalletAddress
        },
        supportedCoins: supportedCoinsSelected
      });
    } catch (error: any) {
      setErrorMessage(error.message);
    }
  };

  const handleClose = (): void => {
    setTitle("");
    setDescription("");
    setErrorMessage("");
    setArrrWalletAddress("")
    setSupportedCoinsSelected(["QORT"])
    dispatch(toggleCreateStoreModal(false));
  };

  const handleInputChangeId = (event: ChangeEvent<HTMLInputElement>) => {
    // Replace any non-alphanumeric and non-space characters with an empty string
    // Replace multiple spaces with a single dash and remove any dashes that come one after another
    let newValue = event.target.value
      .replace(/[^a-zA-Z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();

    if (newValue.toLowerCase().includes("post")) {
      // Replace the 'post' string with an empty string
      newValue = newValue.replace(/post/gi, "");
    }
    if (newValue.toLowerCase().includes("q-shop")) {
      // Replace the 'q-shop' string with an empty string
      newValue = newValue.replace(/q-shop/gi, "");
    }
    setStoreIdentifier(newValue);
  };

  // Close modal when closeCreateStoreModal is true and reset closeCreateStoreModal to false. This is done once the data container is created inside the GlobalWrapper createStore function.
  useEffect(() => {
    if (closeCreateStoreModal) {
      handleClose();
      setCloseCreateStoreModal(false);
    }
  }, [closeCreateStoreModal]);

  const handleChipSelect = (value: string[]) => {
    setSupportedCoinsSelected(value);
  };

  const handleChipRemove = (chip: string) => {
    if (chip === "QORT") return;
    setSupportedCoinsSelected(prevChips => prevChips.filter(c => c !== chip));
  };

  const importAddress = async (coin: string)=> {
    try {
      dispatch(setIsLoadingGlobal(true));
     
      const res = await qortalRequest({
        action: 'GET_USER_WALLET',
        coin
      })
      
      if(res?.address){
        setArrrWalletAddress(res.address)
      }
    } catch (error) {
      dispatch(
        setNotification({
          alertType: "error",
          msg: "Unable to import ARRR address. Please insert it manually",
        })
      );
    } finally {
      dispatch(setIsLoadingGlobal(false));
    }
  }

  return (
    <Modal
      open={open}
      aria-labelledby="modal-title"
      aria-describedby="modal-description"
    >
      <ModalBody>
        <ModalTitle id="modal-title">Create Shop</ModalTitle>
        {!logo ? (
          <ImageUploader onPick={(img: string) => setLogo(img)}>
            <AddLogoButton>
              Add Shop Logo
              <AddLogoIcon
                sx={{
                  height: "25px",
                  width: "auto",
                }}
              ></AddLogoIcon>
            </AddLogoButton>
          </ImageUploader>
        ) : (
          <LogoPreviewRow>
            <StoreLogoPreview src={logo} alt="logo" />
            <TimesIcon
              color={theme.palette.text.primary}
              onClickFunc={() => setLogo(null)}
              height={"32"}
              width={"32"}
            ></TimesIcon>
          </LogoPreviewRow>
        )}

        <CustomInputField
          id="modal-title-input"
          label="Url Preview"
          value={`/${username}/${storeIdentifier}`}
          // onChange={(e) => setTitle(e.target.value)}
          fullWidth
          disabled={true}
          variant="filled"
        />

        <CustomInputField
          id="modal-shopId-input"
          label="Shop Id"
          value={storeIdentifier}
          onChange={handleInputChangeId}
          fullWidth
          inputProps={{ maxLength: 25 }}
          required
          variant="filled"
        />

        <CustomInputField
          id="modal-title-input"
          label="Title"
          value={title}
          onChange={(e: any) => setTitle(e.target.value)}
          fullWidth
          required
          variant="filled"
          inputProps={{ maxLength: 50 }}
        />

        <CustomInputField
          id="modal-description-input"
          label="Description"
          value={description}
          onChange={(e: any) => setDescription(e.target.value)}
          multiline
          rows={4}
          fullWidth
          required
          variant="filled"
        />

        <CustomInputField
          id="modal-location-input"
          label="Location"
          value={location}
          onChange={(e: any) => setLocation(e.target.value)}
          fullWidth
          required
          variant="filled"
        />

        <CustomInputField
          id="modal-shipsTo-input"
          label="Ships To"
          value={shipsTo}
          onChange={(e: any) => setShipsTo(e.target.value)}
          fullWidth
          required
          variant="filled"
        />

        {/* QORT Wallet Input Field */}
        {/* <WalletRow>
          <CustomInputField
            id="modal-qort-wallet-input"
            label="QORT Wallet Address"
            value={qortWalletAddress}
            onChange={(e: any) => {
              setQortWalletAddress(e.target.value);
            }}
            fullWidth
            required
            variant="filled"
          />
          <Tooltip
            TransitionComponent={Zoom}
            placement="top"
            arrow={true}
            title="Import your QORT Wallet Address from your current account"
          >
            <IconButton disableFocusRipple={true} disableRipple={true}>
              <DownloadArrrWalletIcon
                color={theme.palette.text.primary}
                height="40"
                width="40"
              />
            </IconButton>
          </Tooltip>
        </WalletRow> */}

        {/* ARRR Wallet Input Field */}
        <WalletRow>
          <CustomInputField
            id="modal-arrr-wallet-input"
            label="ARRR Wallet Address"
            value={arrrWalletAddress}
            onChange={(e: any) => {
              setArrrWalletAddress(e.target.value);
            }}
            fullWidth
            required
            variant="filled"
          />
          <Tooltip
            TransitionComponent={Zoom}
            placement="top"
            arrow={true}
            title="Import your ARRR Wallet Address from your current account"
          >
            <IconButton disableFocusRipple={true} disableRipple={true} onClick={()=> importAddress('ARRR')}>
              <DownloadArrrWalletIcon
                color={theme.palette.text.primary}
                height="40"
                width="40"
              />
            </IconButton>
          </Tooltip>
        </WalletRow>
        {/* Coin selection available for your shop */}
        <FilterSelect
          disableClearable
          multiple
          id="coin-select"
          value={supportedCoinsSelected}
          options={supportedCoinsArray}
          disableCloseOnSelect
          onChange={(e: any, value) => {
            if (e.target.textContent === "QORT") return;
            handleChipSelect(value as string[]);
          }}
          renderTags={(values: any) =>
            values.map((value: string) => {
              return (
                <FiltersChip
                  key={value}
                  label={value}
                  onDelete={
                    value !== "QORT" ? () => handleChipRemove(value) : undefined
                  }
                  clickable={value === "QORT" ? false : true}
                />
              );
            })
          }
          renderOption={(props, option: any) => {
            const isDisabled = option === "QORT";
            return (
              <FiltersOption {...props}>
                <FiltersCheckbox
                  disabled={isDisabled}
                  checked={supportedCoinsSelected.some(coin => coin === option)}
                />
                {option === "QORT" ? (
                  <QortalSVG
                    height="22"
                    width="22"
                    color={theme.palette.text.primary}
                  />
                ) : option === "ARRR" ? (
                  <ARRRSVG
                    height="22"
                    width="22"
                    color={theme.palette.text.primary}
                  />
                ) : null}
                <span style={{ marginLeft: "5px" }}>{option}</span>
              </FiltersOption>
            );
          }}
          renderInput={params => (
            <FilterSelectMenuItems
              {...params}
              label="Supported Coins"
              placeholder="Choose the coins that will be supported by your shop"
            />
          )}
        />

        <FormControl fullWidth sx={{ marginBottom: 2 }}></FormControl>
        {errorMessage && (
          <Typography color="error" variant="body1">
            {errorMessage}
          </Typography>
        )}
        <ButtonRow>
          <CancelButton variant="outlined" color="error" onClick={handleClose}>
            Cancel
          </CancelButton>
          <CreateButton variant="contained" onClick={handlePublish}>
            Create Shop
          </CreateButton>
        </ButtonRow>
      </ModalBody>
    </Modal>
  );
};

export default CreateStoreModal;
