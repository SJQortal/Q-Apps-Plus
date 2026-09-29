import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Box,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  useTheme,
  Typography,
  CircularProgress,
  Avatar,
} from '@mui/material';
import { useAtom, useSetAtom } from 'jotai';
import { forwardRef, useCallback, useEffect, useMemo, useState } from 'react';
import { TableVirtuoso, TableComponents } from 'react-virtuoso';
import {
  forceRefreshAtom,
  forSaleAtom,
  isNamePendingTx,
  Names,
  namesAtom,
  NamesForSale,
  pendingTxsAtom,
  PendingTxsState,
  refreshAtom,
} from '../../state/global/names';
import PersonIcon from '@mui/icons-material/Person';
import {
  ModalFunctions,
  ModalFunctionsAvatar,
  ModalFunctionsSellName,
  useModal,
} from '../../hooks/useModal';
import {
  dismissToast,
  ImagePicker,
  RequestQueueWithPromise,
  showError,
  showLoading,
  showSuccess,
  Spacer,
  useGlobal,
  useQortBalance,
} from 'qapp-core';
import CheckIcon from '@mui/icons-material/Check';
import ErrorIcon from '@mui/icons-material/Error';
import { BarSpinner } from '../../common/Spinners/BarSpinner/BarSpinner';
import { usePendingTxs } from '../../hooks/useHandlePendingTxs';
import { FetchPrimaryNameType, useFetchNames } from '../../hooks/useFetchNames';
import { Availability } from '../../interfaces';
import { SetStateAction } from 'jotai';
import { useTranslation } from 'react-i18next';
import { TFunction } from 'i18next';
interface NameData {
  name: string;
  isSelling?: boolean;
  forceUpdateState?: number;
}

const getNameQueue = new RequestQueueWithPromise(2);

const VirtuosoTableComponents: TableComponents<NameData> = {
  Scroller: forwardRef<HTMLDivElement>((props, ref) => (
    <TableContainer component={Paper} {...props} ref={ref} />
  )),
  Table: (props) => (
    <Table
      {...props}
      sx={{ borderCollapse: 'separate', tableLayout: 'fixed' }}
    />
  ),
  TableHead: forwardRef<HTMLTableSectionElement>((props, ref) => (
    <TableHead {...props} ref={ref} />
  )),
  TableRow,
  TableBody: forwardRef<HTMLTableSectionElement>((props, ref) => (
    <TableBody {...props} ref={ref} />
  )),
};

function fixedHeaderContent(t: TFunction) {
  return (
    <TableRow
      sx={{
        backgroundColor: 'background.paper',
      }}
    >
      <TableCell>
        {t('core:tables.name', {
          postProcess: 'capitalizeFirstChar',
        })}
      </TableCell>
      <TableCell>
        {t('core:tables.actions', {
          postProcess: 'capitalizeFirstChar',
        })}
      </TableCell>
    </TableRow>
  );
}

interface ManageAvatarProps {
  name: string;
  modalFunctionsAvatar: ModalFunctionsAvatar;
  isNameCurrentlyDoingATx?: boolean;
}

const ManageAvatar = ({
  name,
  modalFunctionsAvatar,
  isNameCurrentlyDoingATx,
}: ManageAvatarProps) => {
  const { setHasAvatar, getHasAvatar } = usePendingTxs();
  const [refresh] = useAtom(refreshAtom); // just to subscribe
  const [hasAvatarState, setHasAvatarState] = useState<boolean | null>(null);
  const { t } = useTranslation();
  const checkIfAvatarExists = useCallback(
    async (name: string) => {
      try {
        const res = getHasAvatar(name);
        if (res !== null) {
          setHasAvatarState(res);
          return;
        }
        const identifier = `qortal_avatar`;
        const url = `/arbitrary/resources/searchsimple?mode=ALL&service=THUMBNAIL&identifier=${identifier}&limit=1&name=${name}&includemetadata=false&prefix=true`;
        const response = await getNameQueue.enqueue(() =>
          fetch(url, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          })
        );

        const responseData = await response.json();
        if (responseData?.length > 0) {
          setHasAvatarState(true);
          setHasAvatar(name, true);
        } else {
          setHasAvatarState(false);
        }
      } catch (error) {
        console.log(error);
      }
    },
    [getHasAvatar, setHasAvatar]
  );
  useEffect(() => {
    if (!name) return;
    checkIfAvatarExists(name);
  }, [name, checkIfAvatarExists, refresh]);
  return (
    <Button
      variant="outlined"
      size="small"
      disabled={hasAvatarState === null || isNameCurrentlyDoingATx}
      onClick={() =>
        modalFunctionsAvatar.show({ name, hasAvatar: Boolean(hasAvatarState) })
      }
    >
      {hasAvatarState === null ? (
        <CircularProgress size={10} />
      ) : hasAvatarState ? (
        t('core:actions.update_avatar', {
          postProcess: 'capitalizeFirstChar',
        })
      ) : (
        t('core:actions.set_avatar', {
          postProcess: 'capitalizeFirstChar',
        })
      )}
    </Button>
  );
};

type SetPendingTxs = (update: SetStateAction<PendingTxsState>) => void;
type SetNames = (update: SetStateAction<Names[]>) => void;

type SetNamesForSale = (update: SetStateAction<NamesForSale[]>) => void;
function rowContent(
  _index: number,
  row: NameData,
  primaryName: string,
  address: string,
  fetchPrimaryName: FetchPrimaryNameType,
  numberOfNames: number,
  modalFunctions: ModalFunctions,
  modalFunctionsUpdateName: ReturnType<typeof useModal>,
  modalFunctionsAvatar: ModalFunctionsAvatar,
  modalFunctionsSellName: ReturnType<typeof useModal>,
  setPendingTxs: SetPendingTxs,
  setNames: SetNames,
  setNamesForSale: SetNamesForSale,
  isNameCurrentlyDoingATx: boolean,
  t: TFunction
) {
  const handleUpdate = async (name: string) => {
    if (name === primaryName && numberOfNames > 1) {
      showError(
        t('core:actions.set_avatar', {
          postProcess: 'capitalizeFirstChar',
        })
      );
      return;
    }
    let loadId = null;

    try {
      const response = await modalFunctionsUpdateName.show(undefined);
      loadId = showLoading(
        t('core:update_name.responses.loading', {
          postProcess: 'capitalizeFirstChar',
        })
      );
      if (typeof response !== 'string') throw new Error('Invalid name');

      const res = await qortalRequest({
        action: 'UPDATE_NAME',
        newName: response,
        oldName: name,
      });
      showSuccess(
        t('core:update_name.responses.loading', {
          postProcess: 'capitalizeFirstChar',
        })
      );
      setPendingTxs((prev) => {
        return {
          ...prev, // preserve existing categories
          ['UPDATE_NAME']: {
            ...(prev['UPDATE_NAME'] || {}), // preserve existing transactions in this category
            [res.signature]: {
              ...res,
              status: 'PENDING',
              callback: () => {
                setNames((prev) => {
                  const copyArray = [...prev];
                  const findIndex = copyArray.findIndex(
                    (item) => item.name === res.name
                  );
                  if (findIndex === -1) return copyArray;
                  copyArray[findIndex] = {
                    name: res.newName,
                    owner: res.creatorAddress,
                  };
                  return copyArray;
                });
                fetchPrimaryName(address);
              },
            }, // add or overwrite this transaction
          },
        };
      });
    } catch (error) {
      if (error instanceof Error) {
        showError(error?.message);
        return;
      }
      showError(
        t('core:update_name.responses.error', {
          postProcess: 'capitalizeFirstChar',
        })
      );
      console.log('error', error);
    } finally {
      if (loadId) {
        dismissToast(loadId);
      }
    }

    // Your logic here
  };

  const handleSell = async (name: string) => {
    if (name === primaryName && numberOfNames > 1) {
      showError(
        t('core:sell_name.responses.error1', {
          postProcess: 'capitalizeFirstChar',
        })
      );
      return;
    }
    let loadId = null;
    try {
      if (name === primaryName) {
        await modalFunctions.show({ name });
      }
      const price = await modalFunctionsSellName.show(name);
      loadId = showLoading(
        t('core:sell_name.responses.loading', {
          postProcess: 'capitalizeFirstChar',
        })
      );
      if (typeof price !== 'string' && typeof price !== 'number')
        throw new Error(
          t('core:sell_name.responses.error3', {
            postProcess: 'capitalizeFirstChar',
          })
        );
      const res = await qortalRequest({
        action: 'SELL_NAME',
        nameForSale: name,
        salePrice: +price,
      });
      showSuccess(
        t('core:sell_name.responses.success', {
          postProcess: 'capitalizeFirstChar',
        })
      );
      setPendingTxs((prev) => {
        return {
          ...prev, // preserve existing categories
          ['SELL_NAME']: {
            ...(prev['SELL_NAME'] || {}), // preserve existing transactions in this category
            [res.signature]: {
              ...res,
              status: 'PENDING',
              callback: () => {
                setNamesForSale((prev) => {
                  return [
                    {
                      name: res.name,
                      salePrice: res.amount,
                    },
                    ...prev,
                  ];
                });
              },
            }, // add or overwrite this transaction
          },
        };
      });
    } catch (error) {
      if (error instanceof Error) {
        showError(error?.message);

        return;
      }
      showError(
        t('core:sell_name.responses.error2', {
          postProcess: 'capitalizeFirstChar',
        })
      );
      console.log('error', error);
    } finally {
      if (loadId) {
        dismissToast(loadId);
      }
    }
  };

  const handleCancel = async (name: string) => {
    const loadId = showLoading(
      t('core:cancel_name.responses.loading', {
        postProcess: 'capitalizeFirstChar',
      })
    );

    try {
      const res = await qortalRequest({
        action: 'CANCEL_SELL_NAME',
        nameForSale: name,
      });
      setPendingTxs((prev) => {
        return {
          ...prev, // preserve existing categories
          ['CANCEL_SELL_NAME']: {
            ...(prev['CANCEL_SELL_NAME'] || {}), // preserve existing transactions in this category
            [res.signature]: {
              ...res,
              status: 'PENDING',
              callback: () => {
                setNamesForSale((prev) =>
                  prev.filter((item) => item?.name !== res.name)
                );
              },
            },
          },
        };
      });
      showSuccess(
        t('core:cancel_name.responses.success', {
          postProcess: 'capitalizeFirstChar',
        })
      );
    } catch (error) {
      if (error instanceof Error) {
        showError(error?.message);
        return;
      }
      showError(
        t('core:cancel_name.responses.error', {
          postProcess: 'capitalizeFirstChar',
        })
      );
    } finally {
      if (loadId) {
        dismissToast(loadId);
      }
    }
  };

  return (
    <>
      <TableCell>
        <Box
          sx={{
            display: 'flex',
            gap: '5px',
            alignItems: 'center',
            wordBreak: 'break-word',
          }}
        >
          <Avatar
            sx={{
              height: '30px',
              width: '30px',
              objectFit: 'contain',
            }}
            src={`/arbitrary/THUMBNAIL/${row.name}/qortal_avatar?forceUpdateState=${row?.forceUpdateState}`}
            alt={row.name}
          >
            {row.name?.charAt(0)}
          </Avatar>
          {primaryName === row.name && (
            <Tooltip
              title={t('core:tooltips.primary_name', {
                postProcess: 'capitalizeFirstChar',
              })}
              placement="left"
              arrow
              sx={{ fontSize: '24' }}
            >
              <PersonIcon color="success" />
            </Tooltip>
          )}
          {row.name}
        </Box>
      </TableCell>
      <TableCell>
        <Box
          sx={{
            display: 'flex',
            gap: '5px',
            flexWrap: 'wrap',
          }}
        >
          <Button
            color={primaryName === row.name ? 'warning' : 'primary'}
            variant="outlined"
            size="small"
            disabled={
              (row?.name === primaryName && numberOfNames > 1) ||
              isNameCurrentlyDoingATx
            }
            onClick={() => handleUpdate(row.name)}
          >
            {t('core:actions.update', {
              postProcess: 'capitalizeFirstChar',
            })}
          </Button>
          {!row.isSelling ? (
            <Button
              color={primaryName === row.name ? 'warning' : 'primary'}
              size="small"
              variant="outlined"
              onClick={() => handleSell(row.name)}
              disabled={
                (row?.name === primaryName && numberOfNames > 1) ||
                isNameCurrentlyDoingATx
              }
            >
              {t('core:actions.sell', {
                postProcess: 'capitalizeFirstChar',
              })}
            </Button>
          ) : (
            <Button
              color="error"
              size="small"
              onClick={() => handleCancel(row.name)}
              variant="contained"
              disabled={isNameCurrentlyDoingATx}
            >
              {t('core:actions.cancel_sell', {
                postProcess: 'capitalizeFirstChar',
              })}
            </Button>
          )}
          <ManageAvatar
            name={row.name}
            modalFunctionsAvatar={modalFunctionsAvatar}
            isNameCurrentlyDoingATx={isNameCurrentlyDoingATx}
          />
        </Box>
      </TableCell>
    </>
  );
}

interface NameTableProps {
  names: Names[];
  primaryName: string;
}
export const NameTable = ({ names, primaryName }: NameTableProps) => {
  const setNames = useSetAtom(namesAtom);
  const { auth } = useGlobal();
  const [namesForSale, setNamesForSale] = useAtom(forSaleAtom);
  const [pendingTxs] = useAtom(pendingTxsAtom);
  const { t } = useTranslation(['core']);
  const [forceUpdateState, forceUpdate] = useState(0);

  const modalFunctions = useModal<{ name: string }>();
  const modalFunctionsUpdateName = useModal();
  const modalFunctionsAvatar = useModal<{ name: string; hasAvatar: boolean }>();
  const modalFunctionsSellName = useModal();
  const { fetchPrimaryName } = useFetchNames();

  const setPendingTxs = useSetAtom(pendingTxsAtom);

  const triggerRerender = useCallback(() => {
    forceUpdate((n) => n + 1);
  }, []);

  const namesToDisplay = useMemo(() => {
    const namesForSaleString = namesForSale.map((item) => item.name);
    return names.map((name) => {
      return {
        name: name.name,
        isSelling: namesForSaleString.includes(name.name),
        forceUpdateState,
      };
    });
  }, [names, namesForSale, forceUpdateState]);

  return (
    <Paper
      sx={{
        height: 'calc(100vh - 64px - 60px)', // Header + footer height
        width: '100%',
      }}
    >
      <TableVirtuoso
        data={namesToDisplay}
        components={VirtuosoTableComponents}
        fixedHeaderContent={() => fixedHeaderContent(t)}
        itemContent={(index, row) => {
          const isNameCurrentlyDoingATx = isNamePendingTx(
            row?.name,
            pendingTxs
          );
          return rowContent(
            index,
            row,
            primaryName,
            auth?.address || '',
            fetchPrimaryName,
            names?.length,
            modalFunctions,
            modalFunctionsUpdateName,
            modalFunctionsAvatar,
            modalFunctionsSellName,
            setPendingTxs,
            setNames,
            setNamesForSale,
            isNameCurrentlyDoingATx,
            t
          );
        }}
      />
      {modalFunctions?.isShow && (
        <Dialog
          open={modalFunctions?.isShow}
          aria-labelledby="alert-dialog-title"
          aria-describedby="alert-dialog-description"
        >
          <DialogTitle id="alert-dialog-title">
            {t('core:warnings.warning', {
              postProcess: 'capitalizeFirstChar',
            })}
          </DialogTitle>
          <DialogContent>
            <DialogContentText id="alert-dialog-description">
              {t('core:warnings.primary_name_sell_caution', {
                postProcess: 'capitalizeFirstChar',
              })}
            </DialogContentText>
            <Spacer height="20px" />
            <DialogContentText id="alert-dialog-description2">
              {t('core:warnings.primary_name_sell', {
                name: modalFunctions?.data?.name,
              })}
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button
              color="warning"
              variant="contained"
              onClick={() => modalFunctions.onOk(undefined)}
              autoFocus
            >
              {t('core:actions.continue', {
                postProcess: 'capitalizeFirstChar',
              })}
            </Button>
            <Button variant="contained" onClick={modalFunctions.onCancel}>
              {t('core:actions.cancel', {
                postProcess: 'capitalizeFirstChar',
              })}
            </Button>
          </DialogActions>
        </Dialog>
      )}
      {modalFunctionsUpdateName?.isShow && (
        <UpdateNameModal modalFunctionsUpdateName={modalFunctionsUpdateName} />
      )}
      {modalFunctionsAvatar?.isShow && (
        <AvatarModal
          modalFunctionsAvatar={modalFunctionsAvatar}
          triggerRerender={triggerRerender}
          forceUpdateState={forceUpdateState}
        />
      )}
      {modalFunctionsSellName?.isShow && (
        <SellNameModal modalFunctionsSellName={modalFunctionsSellName} />
      )}
    </Paper>
  );
};

interface PickedAvatar {
  base64: string;
  name: string;
}

interface AvatarModalProps {
  modalFunctionsAvatar: ModalFunctionsAvatar;
  triggerRerender: () => void;
  forceUpdateState?: number;
}
const AvatarModal = ({
  modalFunctionsAvatar,
  triggerRerender,
  forceUpdateState,
}: AvatarModalProps) => {
  const { t } = useTranslation();
  const { setHasAvatar } = usePendingTxs();
  const forceRefresh = useSetAtom(forceRefreshAtom);

  const [pickedAvatar, setPickedAvatar] = useState<null | PickedAvatar>(null);
  const [isLoadingPublish, setIsLoadingPublish] = useState(false);

  const publishAvatar = async () => {
    const loadId = showLoading(
      t('core:avatar.responses.loading', {
        postProcess: 'capitalizeFirstChar',
      })
    );
    try {
      if (!modalFunctionsAvatar?.data || !pickedAvatar?.base64)
        throw new Error(
          t('core:avatar.responses.error1', {
            postProcess: 'capitalizeFirstChar',
          })
        );
      setIsLoadingPublish(true);
      await qortalRequest({
        action: 'PUBLISH_QDN_RESOURCE',
        base64: pickedAvatar?.base64,
        service: 'THUMBNAIL',
        identifier: 'qortal_avatar',
        name: modalFunctionsAvatar?.data?.name,
      });
      setHasAvatar(modalFunctionsAvatar?.data?.name, true);
      forceRefresh();

      showSuccess(
        t('core:avatar.responses.success', {
          postProcess: 'capitalizeFirstChar',
        })
      );
      modalFunctionsAvatar.onOk(undefined);
      triggerRerender();
    } catch (error) {
      if (error instanceof Error) {
        showError(error?.message);
        return;
      }
      showError(
        t('core:avatar.responses.loading', {
          postProcess: 'capitalizeFirstChar',
        })
      );
    } finally {
      dismissToast(loadId);
      setIsLoadingPublish(false);
    }
  };

  return (
    <Dialog
      open={modalFunctionsAvatar?.isShow}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      <DialogTitle id="alert-dialog-title">
        {t('core:avatar.title', {
          postProcess: 'capitalizeFirstChar',
        })}
      </DialogTitle>
      <DialogContent
        sx={{
          width: '300px',
          maxWidth: '95vw',
        }}
      >
        <Spacer height="20px" />
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%',
          }}
        >
          {modalFunctionsAvatar?.data?.hasAvatar && !pickedAvatar?.base64 && (
            <Avatar
              sx={{
                height: '138px',
                width: '138px',
              }}
              src={`/arbitrary/THUMBNAIL/${modalFunctionsAvatar.data.name}/qortal_avatar?forceUpdateState=${forceUpdateState}`}
              alt={modalFunctionsAvatar.data.name}
            >
              {modalFunctionsAvatar?.data?.name?.charAt(0)}
            </Avatar>
          )}
          {pickedAvatar?.base64 && (
            <Avatar
              sx={{
                height: '138px',
                width: '138px',
              }}
              src={`data:image/webp;base64,${pickedAvatar?.base64}`}
              alt={modalFunctionsAvatar?.data?.name}
            >
              <CircularProgress />
            </Avatar>
          )}

          {pickedAvatar?.name && (
            <>
              <Spacer height="10px" />
              <Typography variant="body2">{pickedAvatar?.name}</Typography>
            </>
          )}

          <Spacer height="20px" />
          <Typography
            sx={{
              fontSize: '12px',
            }}
          >
            (500 KB max. for GIFS){' '}
          </Typography>
          <ImagePicker onPick={(file) => setPickedAvatar(file)} mode="single">
            <Button variant="contained">
              {t('core:actions.choose_image', {
                postProcess: 'capitalizeFirstChar',
              })}
            </Button>
          </ImagePicker>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button
          disabled={!pickedAvatar?.base64 || isLoadingPublish}
          variant="contained"
          onClick={publishAvatar}
          autoFocus
        >
          {t('core:actions.publish', {
            postProcess: 'capitalizeFirstChar',
          })}
        </Button>
        <Button variant="contained" onClick={modalFunctionsAvatar.onCancel}>
          {t('core:actions.cancel', {
            postProcess: 'capitalizeFirstChar',
          })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

interface UpdateNameModalProps {
  modalFunctionsUpdateName: ReturnType<typeof useModal>;
}

const UpdateNameModal = ({
  modalFunctionsUpdateName,
}: UpdateNameModalProps) => {
  const [step, setStep] = useState(1);
  const [newName, setNewName] = useState('');
  const [isNameAvailable, setIsNameAvailable] = useState<Availability>(
    Availability.NULL
  );
  const { t } = useTranslation();
  const [nameFee, setNameFee] = useState<null | number>(null);
  const { value: balance } = useQortBalance();

  const theme = useTheme();

  const checkIfNameExisits = async (name: string) => {
    if (!name?.trim()) {
      setIsNameAvailable(Availability.NULL);

      return;
    }
    setIsNameAvailable(Availability.LOADING);
    try {
      const res = await fetch(`/names/` + name);
      const data = await res.json();
      if (data?.message === 'name unknown' || data?.error) {
        setIsNameAvailable(Availability.AVAILABLE);
      } else {
        setIsNameAvailable(Availability.NOT_AVAILABLE);
      }
    } catch (error) {
      setIsNameAvailable(Availability.AVAILABLE);
      console.error(error);
    }
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      checkIfNameExisits(newName);
    }, 500);

    // Cleanup timeout if searchValue changes before the timeout completes
    return () => {
      clearTimeout(handler);
    };
  }, [newName]);

  useEffect(() => {
    const nameRegistrationFee = async () => {
      try {
        const data = await fetch(`/transactions/unitfee?txType=REGISTER_NAME`);
        const fee = await data.text();

        setNameFee(+(Number(fee) / 1e8).toFixed(8));
      } catch (error) {
        console.error(error);
      }
    };
    nameRegistrationFee();
  }, []);

  return (
    <Dialog
      open={modalFunctionsUpdateName?.isShow}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      {step === 1 && (
        <>
          <DialogTitle id="alert-dialog-title">
            {t('core:warnings.warning', {
              postProcess: 'capitalizeFirstChar',
            })}
          </DialogTitle>
          <DialogContent>
            <DialogContentText id="alert-dialog-description">
              {t('core:update_name.title', {
                postProcess: 'capitalizeFirstChar',
              })}
            </DialogContentText>
            <Spacer height="20px" />
            <DialogContentText id="alert-dialog-description2">
              {t('core:warnings.update_name1', {
                postProcess: 'capitalizeFirstChar',
              })}
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button
              color="warning"
              variant="contained"
              onClick={() => setStep(2)}
              autoFocus
            >
              {t('core:actions.continue', {
                postProcess: 'capitalizeFirstChar',
              })}
            </Button>
            <Button
              variant="contained"
              onClick={modalFunctionsUpdateName.onCancel}
            >
              {t('core:actions.cancel', {
                postProcess: 'capitalizeFirstChar',
              })}
            </Button>
          </DialogActions>
        </>
      )}
      {step === 2 && (
        <>
          <DialogTitle id="alert-dialog-title">
            {t('core:warnings.warning', {
              postProcess: 'capitalizeFirstChar',
            })}
          </DialogTitle>
          <DialogContent>
            <DialogContentText id="alert-dialog-description">
              {t('core:update_name.choose_name', {
                postProcess: 'capitalizeFirstChar',
              })}
            </DialogContentText>
            <Spacer height="20px" />
            <TextField
              autoComplete="off"
              autoFocus
              onChange={(e) => setNewName(e.target.value)}
              value={newName}
              placeholder={t('core:new_name.choose_name', {
                postProcess: 'capitalizeFirstChar',
              })}
            />
            {(!balance || (nameFee && balance && balance < nameFee)) && (
              <>
                <Spacer height="10px" />
                <Box
                  sx={{
                    display: 'flex',
                    gap: '5px',
                    alignItems: 'center',
                  }}
                >
                  <ErrorIcon
                    sx={{
                      color: theme.palette.text.primary,
                    }}
                  />
                  <Typography>
                    {t('core:update_name.balanceInfo', {
                      postProcess: 'capitalizeFirstChar',
                      nameFee: nameFee,
                      balance: balance ?? 0,
                    })}
                  </Typography>
                </Box>
                <Spacer height="10px" />
              </>
            )}
            <Spacer height="5px" />
            {isNameAvailable === Availability.AVAILABLE && (
              <Box
                sx={{
                  display: 'flex',
                  gap: '5px',
                  alignItems: 'center',
                }}
              >
                <CheckIcon
                  sx={{
                    color: theme.palette.text.primary,
                  }}
                />
                <Typography>
                  {' '}
                  {t('core:update_name.name_available', {
                    name: newName,
                  })}
                </Typography>
              </Box>
            )}
            {isNameAvailable === Availability.NOT_AVAILABLE && (
              <Box
                sx={{
                  display: 'flex',
                  gap: '5px',
                  alignItems: 'center',
                }}
              >
                <ErrorIcon
                  sx={{
                    color: theme.palette.text.primary,
                  }}
                />
                <Typography>
                  {t('core:update_name.name_unavailable', {
                    name: newName,
                  })}
                </Typography>
              </Box>
            )}
            {isNameAvailable === Availability.LOADING && (
              <Box
                sx={{
                  display: 'flex',
                  gap: '5px',
                  alignItems: 'center',
                }}
              >
                <BarSpinner width="16px" color={theme.palette.text.primary} />
                <Typography>
                  {t('core:new_name.checking', {
                    postProcess: 'capitalizeFirstChar',
                  })}
                </Typography>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button
              color="primary"
              variant="contained"
              disabled={Boolean(
                !newName?.trim() ||
                  isNameAvailable !== Availability.AVAILABLE ||
                  !balance ||
                  (balance && nameFee && +balance < +nameFee)
              )}
              onClick={() => modalFunctionsUpdateName.onOk(newName.trim())}
              autoFocus
            >
              {t('core:actions.continue', {
                postProcess: 'capitalizeFirstChar',
              })}
            </Button>
            <Button
              color="secondary"
              variant="contained"
              onClick={modalFunctionsUpdateName.onCancel}
            >
              {t('core:actions.cancel', {
                postProcess: 'capitalizeFirstChar',
              })}
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
};

interface SellNameModalProps {
  modalFunctionsSellName: ModalFunctionsSellName;
}

const SellNameModal = ({ modalFunctionsSellName }: SellNameModalProps) => {
  const { t } = useTranslation();
  const [price, setPrice] = useState<number | string>(0);

  return (
    <Dialog
      open={modalFunctionsSellName?.isShow}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      <DialogTitle id="alert-dialog-title">
        {t('core:sell_name.title', {
          postProcess: 'capitalizeFirstChar',
        })}
      </DialogTitle>
      <DialogContent>
        <DialogContentText id="alert-dialog-description">
          {t('core:sell_name.choose_price', {
            postProcess: 'capitalizeFirstChar',
          })}
        </DialogContentText>
        <Spacer height="20px" />
        <TextField
          autoComplete="off"
          autoFocus
          onChange={(e) => {
            const raw = e.target.value;

            // Allow empty input
            if (raw === '') {
              setPrice('');
              return;
            }

            // Remove leading zeros and convert to number
            const numericValue = +raw;
            if (!isNaN(numericValue)) {
              setPrice(numericValue);
            }
          }}
          value={price}
          type="number"
          placeholder={t('core:sell_name.choose_price', {
            postProcess: 'capitalizeFirstChar',
          })}
        />
      </DialogContent>
      <DialogActions>
        <Button
          color="primary"
          variant="contained"
          disabled={!price}
          onClick={() => modalFunctionsSellName.onOk(price)}
          autoFocus
        >
          {t('core:actions.continue', {
            postProcess: 'capitalizeFirstChar',
          })}
        </Button>
        <Button
          color="secondary"
          variant="contained"
          onClick={modalFunctionsSellName.onCancel}
        >
          {t('core:actions.cancel', {
            postProcess: 'capitalizeFirstChar',
          })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
