import { useState, useEffect } from "react";
import {
  Typography,
  Modal,
  FormControl,
  useTheme,
  IconButton,
  Tooltip,
  Zoom,
  Box,
} from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import {
  toggleCreateStoreModal,
  setDataContainer,
  resetListProducts,
  resetProducts
} from "../../state/features/globalSlice";
import { RootState } from "../../state/store";
import {
  AddLogoButton,
  AddLogoIcon,
  WalletRow,
  ButtonRow,
  CancelButton,
  CreateButton,
  CustomInputField,
  DownloadArrrWalletIcon,
  LogoPreviewRow,
  ModalBody,
  ModalTitle,
  StoreLogoPreview,
  TimesIcon,
  AdvancedSettingsBox,
  EditStoreButtonsRow,
  CreateNewDataContainerRow,
  CreateNewDataContainerButton,
} from "./CreateStoreModal-styles";
import ImageUploader from "../common/ImageUploader";
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
import { ReusableModal } from "./ReusableModal";
import { DATA_CONTAINER_BASE, STORE_BASE } from "../../constants/identifiers";
import { objectToBase64 } from "../../utils/toBase64";
import { ShortDataContainer } from "../../wrappers/GlobalWrapper";
import { setNotification } from "../../state/features/notificationsSlice";

interface ForeignCoins {
  [key: string]: string;
}
export interface onPublishParamEdit {
  title: string;
  description: string;
  shipsTo: string;
  location: string;
  logo: string;
  foreignCoins: ForeignCoins;
  supportedCoins: string[];
}
interface MyModalProps {
  open: boolean;
  onClose: () => void;
  onPublish: (param: onPublishParamEdit) => Promise<void>;
  username: string;
}

const MyModal: React.FC<MyModalProps> = ({ open, onClose, onPublish }) => {
  const dispatch = useDispatch();
  const currentStore = useSelector(
    (state: RootState) => state.global.currentStore
  );
  const user = useSelector((state: RootState) => state.auth.user);

  const storeId = useSelector((state: RootState) => state.store.storeId);

  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [location, setLocation] = useState<string>("");
  const [shipsTo, setShipsTo] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [logo, setLogo] = useState<string | null>(null);
  const [supportedCoinsSelected, setSupportedCoinsSelected] = useState<
    string[]
  >(["QORT"]);
  const [qortWalletAddress, setQortWalletAddress] = useState<string>("");
  const [arrrWalletAddress, setArrrWalletAddress] = useState<string>("");
  const [showAdvancedSettings, setShowAdvancedSettings] =
    useState<boolean>(false);
  const [showCreateNewDataContainerModal, setShowCreateNewDataContainerModal] =
    useState<boolean>(false);

  const theme = useTheme();

  const handlePublish = async (): Promise<void> => {
    try {
      setErrorMessage("");
      if (!logo) {
        setErrorMessage("A logo is required");
        return;
      }

      const foreignCoins: ForeignCoins = {
        ARRR: arrrWalletAddress,
      };
      supportedCoinsSelected
        .filter(coin => coin !== "QORT")
        .forEach((item: string) => {
          if (!foreignCoins[item])
            throw new Error(`Please add a ${item} address`);
        });
      await onPublish({
        title,
        description,
        shipsTo,
        location,
        logo,
        foreignCoins: {
          ARRR: arrrWalletAddress,
        },
        supportedCoins: supportedCoinsSelected,
      });
      handleClose();
    } catch (error: any) {
      setErrorMessage(error.message);
    }
  };

  useEffect(() => {
    if (open && currentStore && storeId === currentStore.id) {
      setTitle(currentStore?.title || "");
      setDescription(currentStore?.description || "");
      setLogo(currentStore?.logo || null);
      setLocation(currentStore?.location || "");
      setShipsTo(currentStore?.shipsTo || "");
      const selectedCoinsList = [...new Set([...(currentStore?.supportedCoins || []), 'QORT'])];
      setSupportedCoinsSelected(selectedCoinsList)
      setArrrWalletAddress(currentStore?.foreignCoins?.ARRR || "")
    }
  }, [currentStore, storeId, open]);

  const handleClose = (): void => {
    setTitle("");
    setDescription("");
    setErrorMessage("");
    setDescription("");
    setLogo(null);
    setLocation("");
    setShipsTo("");
    setArrrWalletAddress("");
    setSupportedCoinsSelected(["QORT"]);
    setShowAdvancedSettings(false);
    dispatch(toggleCreateStoreModal(false));
    onClose();
  };

  const handleChipSelect = (value: string[]) => {
    setSupportedCoinsSelected(value);
  };

  const handleChipRemove = (chip: string) => {
    if (chip === "QORT") return;
    setSupportedCoinsSelected(prevChips => prevChips.filter(c => c !== chip));
  };

  const importAddress = async (coin: string) => {
    try {
      const res = await qortalRequest({
        action: "GET_USER_WALLET",
        coin,
      });
      if (res?.address) {
        setArrrWalletAddress(res.address);
      }
    } catch (error) {
      console.error(error);
    }
  };

  // Recreate Shop Data

  const handleRecreateShopData = async () => {
    if (!currentStore || !user?.name) {
      dispatch(
        setNotification({
          msg: "Error! Missing shop data or name",
          alertType: "error",
        })
      );
      return;
    }
    try {
      const shortStoreId = currentStore?.shortStoreId;
      const dataContainer: ShortDataContainer = {
        storeId: currentStore.id,
        shortStoreId: shortStoreId,
        owner: user.name,
        products: {},
      };
      const dataContainerToBase64 = await objectToBase64(dataContainer);

      const dataContainerCreated = await qortalRequest({
        action: "PUBLISH_QDN_RESOURCE",
        name: user?.name,
        service: "DOCUMENT",
        data64: dataContainerToBase64,
        identifier: `${currentStore.id}-${DATA_CONTAINER_BASE}`,
      });
      if (dataContainerCreated && !dataContainerCreated.error) {
        dispatch(
          setDataContainer({
            ...dataContainer,
            id: `${currentStore.id}-${DATA_CONTAINER_BASE}`,
          })
        );
        dispatch(resetListProducts());
        dispatch(resetProducts());
        dispatch(
          setNotification({
            msg: "Data Container Created!",
            alertType: "success",
          })
        );
        onClose();
        setShowCreateNewDataContainerModal(false);
        setShowAdvancedSettings(false);
      }
    } catch (error) {
      console.error(error);
      dispatch(
        setNotification({
          msg: "Error when creating the data container. Please try again!",
          alertType: "error",
        })
      );
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      aria-labelledby="modal-title"
      aria-describedby="modal-description"
    >
      <ModalBody>
        <ModalTitle id="modal-title" variant="h6">
          Edit Shop
        </ModalTitle>
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
          label="Title"
          value={title}
          onChange={e => setTitle(e.target.value)}
          inputProps={{ maxLength: 50 }}
          fullWidth
          required
          variant="filled"
        />
        <CustomInputField
          id="modal-description-input"
          label="Description"
          value={description}
          onChange={e => setDescription(e.target.value)}
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
          onChange={e => setLocation(e.target.value)}
          fullWidth
          required
          variant="filled"
        />
        <CustomInputField
          id="modal-shipsTo-input"
          label="Ships To"
          value={shipsTo}
          onChange={e => setShipsTo(e.target.value)}
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
            arrow={true} const importAddress = async (coin: string)=> {
    try {
      const res = await qortalRequest({
        action: 'GET_USER_WALLET',
        coin
      })
      if(res?.address){
        setArrrWalletAddress(res.address)
      }
      console.log({res})
    } catch (error) {
      
    }
  }
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
            <IconButton
              disableFocusRipple={true}
              disableRipple={true}
              onClick={() => importAddress("ARRR")}
            >
              <DownloadArrrWalletIcon
                color={theme.palette.text.primary}
                height="40"
                width="40"
              />
            </IconButton>
          </Tooltip>
        </WalletRow>
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
        {showAdvancedSettings && (
          <CreateNewDataContainerRow
            onClick={() => {
              setShowCreateNewDataContainerModal(true);
            }}
          >
            <CreateNewDataContainerButton>
              Recreate Shop Data
            </CreateNewDataContainerButton>
          </CreateNewDataContainerRow>
        )}
        <FormControl fullWidth sx={{ marginBottom: 2 }}></FormControl>
        {errorMessage && (
          <Typography color="error" variant="body1">
            {errorMessage}
          </Typography>
        )}
        <ButtonRow sx={{ display: "flex", justifyContent: "space-between" }}>
          <AdvancedSettingsBox>
            <Typography>Advanced Settings</Typography>
            <FiltersCheckbox
              checked={showAdvancedSettings}
              onChange={() => setShowAdvancedSettings(!showAdvancedSettings)}
            />
          </AdvancedSettingsBox>
          <EditStoreButtonsRow>
            <CancelButton
              variant="outlined"
              color="error"
              onClick={handleClose}
            >
              Cancel
            </CancelButton>
            <CreateButton variant="contained" onClick={handlePublish}>
              Edit Shop
            </CreateButton>
          </EditStoreButtonsRow>
        </ButtonRow>
        <ReusableModal
          open={showCreateNewDataContainerModal}
          customStyles={{
            width: "50%",
            maxWidth: 1700,
            height: "auto",
            backgroundColor:
              theme.palette.mode === "light" ? "#e8e8e8" : "#32333c",
            position: "relative",
            padding: "25px",
            borderRadius: "3px",
            overflowY: "auto",
            overflowX: "hidden",
            maxHeight: "90vh",
          }}
        >
          <Box>
            Warning! ⚠️ Are you sure you want to recreate your shop's data? This
            will clear all your shop's products. This should only be done as a
            last resort if you cannot access your product manager or if you are
            experiencing issues products displaying properly.
          </Box>
          <ButtonRow>
            <CancelButton
              variant="outlined"
              color="error"
              onClick={() => {
                setShowCreateNewDataContainerModal(false);
              }}
            >
              Cancel
            </CancelButton>
            <CreateButton variant="contained" onClick={handleRecreateShopData}>
              Recreate Shop Data
            </CreateButton>
          </ButtonRow>
        </ReusableModal>
      </ModalBody>
    </Modal>
  );
};

export default MyModal;
