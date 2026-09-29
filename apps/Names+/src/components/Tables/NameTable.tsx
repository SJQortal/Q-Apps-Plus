import {
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  InputAdornment,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { useAtom, useSetAtom } from 'jotai';
import { useCallback, useMemo, useState, type MouseEvent } from 'react';
import { Virtuoso } from 'react-virtuoso';
import PersonIcon from '@mui/icons-material/Person';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import SellOutlinedIcon from '@mui/icons-material/SellOutlined';
import RemoveShoppingCartOutlinedIcon from '@mui/icons-material/RemoveShoppingCartOutlined';
import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import CheckIcon from '@mui/icons-material/Check';
import ErrorIcon from '@mui/icons-material/Error';
import {
  forceRefreshAtom,
  forSaleAtom,
  isNamePendingTx,
  ListStatus,
  Names,
  namesAtom,
  pendingTxsAtom,
} from '../../state/global/names';
import {
  ModalFunctionsAvatar,
  ModalFunctionsSellName,
  useModal,
} from '../../hooks/useModal';
import {
  dismissToast,
  ImagePicker,
  showError,
  showLoading,
  showSuccess,
  Spacer,
  useGlobal,
  useQortBalance,
} from 'qapp-core';
import { BarSpinner } from '../../common/Spinners/BarSpinner/BarSpinner';
import { usePendingTxs } from '../../hooks/useHandlePendingTxs';
import { useFetchNames } from '../../hooks/useFetchNames';
import { Availability } from '../../interfaces';
import { useTranslation } from 'react-i18next';
import {
  nameLengthMessage,
  useNameAvailability,
} from '../../hooks/useNameAvailability';
import { useAvatarStatuses, useUnitFee } from '../../hooks/useNamesApi';
import { usePhoneLayout } from '../../hooks/usePhoneLayout';
import { formatQort } from '../../utils/format';
import {
  EmptyState,
  ErrorState,
  ListCard,
  Row,
  RowActions,
  RowMain,
  RowMeta,
  RowSkeletons,
  RowTitle,
} from '../names/ListStates';

interface NameRow {
  name: string;
  isPrimary: boolean;
  isSelling: boolean;
  salePrice?: number;
  /** A transaction for this name is waiting for a block. */
  pending: boolean;
  hasAvatar: boolean | undefined;
}

interface NameTableProps {
  names: Names[];
  /** How many names the account owns in total, whatever the filter shows. */
  totalNames: number;
  primaryName: string;
  status: ListStatus;
  filter: string;
  signedIn: boolean;
  onRetry: () => void;
  registerAction?: React.ReactNode;
}

export const NameTable = ({
  names,
  totalNames,
  primaryName,
  status,
  filter,
  signedIn,
  onRetry,
  registerAction,
}: NameTableProps) => {
  const setNames = useSetAtom(namesAtom);
  const { auth } = useGlobal();
  const address = auth?.address || '';
  const [namesForSale, setNamesForSale] = useAtom(forSaleAtom);
  const [pendingTxs, setPendingTxs] = useAtom(pendingTxsAtom);
  const { t } = useTranslation(['core']);
  const cap = { postProcess: 'capitalizeFirstChar' as const };
  const phone = usePhoneLayout();
  const [forceUpdateState, forceUpdate] = useState(0);
  const [menu, setMenu] = useState<{ anchor: HTMLElement; row: NameRow } | null>(null);

  const modalFunctions = useModal<{ name: string }>();
  const modalFunctionsUpdateName = useModal();
  const modalFunctionsAvatar = useModal<{ name: string; hasAvatar: boolean }>();
  const modalFunctionsSellName = useModal();
  const { fetchPrimaryName } = useFetchNames();
  const nameStrings = useMemo(() => names.map((item) => item.name), [names]);
  const avatarStatuses = useAvatarStatuses(nameStrings);

  const triggerRerender = useCallback(() => {
    forceUpdate((n) => n + 1);
  }, []);

  const rows = useMemo<NameRow[]>(() => {
    const priceByName = new Map(namesForSale.map((item) => [item.name, item.salePrice]));
    return names.map((item) => ({
      name: item.name,
      isPrimary: item.name === primaryName,
      isSelling: priceByName.has(item.name),
      salePrice: priceByName.get(item.name),
      pending: isNamePendingTx(item.name, pendingTxs),
      hasAvatar: avatarStatuses[item.name],
    }));
  }, [names, namesForSale, primaryName, pendingTxs, avatarStatuses]);

  // The three flows below are the original app's, moved out of the table row
  // so the same code serves the inline buttons and the phone menu.
  const handleUpdate = async (name: string) => {
    if (name === primaryName && totalNames > 1) {
      showError(t('core:update_name.responses.error_primary', cap));
      return;
    }
    let loadId = null;

    try {
      const response = await modalFunctionsUpdateName.show(undefined);
      loadId = showLoading(t('core:update_name.responses.loading', cap));
      if (typeof response !== 'string') throw new Error('Invalid name');

      const res = await qortalRequest({
        action: 'UPDATE_NAME',
        newName: response,
        oldName: name,
      });
      showSuccess(t('core:update_name.responses.success', cap));
      setPendingTxs((prev) => {
        return {
          ...prev,
          ['UPDATE_NAME']: {
            ...(prev['UPDATE_NAME'] || {}),
            [res.signature]: {
              ...res,
              status: 'PENDING',
              callback: () => {
                setNames((prev) => {
                  const copyArray = [...prev];
                  const findIndex = copyArray.findIndex((item) => item.name === res.name);
                  if (findIndex === -1) return copyArray;
                  copyArray[findIndex] = {
                    name: res.newName,
                    owner: res.creatorAddress,
                  };
                  return copyArray;
                });
                fetchPrimaryName(address);
              },
            },
          },
        };
      });
    } catch (error) {
      if (error instanceof Error) {
        showError(error?.message);
        return;
      }
      showError(t('core:update_name.responses.error', cap));
      console.log('error', error);
    } finally {
      if (loadId) {
        dismissToast(loadId);
      }
    }
  };

  const handleSell = async (name: string) => {
    if (name === primaryName && totalNames > 1) {
      showError(t('core:sell_name.responses.error1', cap));
      return;
    }
    let loadId = null;
    try {
      if (name === primaryName) {
        await modalFunctions.show({ name });
      }
      const price = await modalFunctionsSellName.show(name);
      loadId = showLoading(t('core:sell_name.responses.loading', cap));
      if (typeof price !== 'string' && typeof price !== 'number')
        throw new Error(t('core:sell_name.responses.error3', cap));
      const res = await qortalRequest({
        action: 'SELL_NAME',
        nameForSale: name,
        salePrice: +price,
      });
      showSuccess(t('core:sell_name.responses.success', cap));
      setPendingTxs((prev) => {
        return {
          ...prev,
          ['SELL_NAME']: {
            ...(prev['SELL_NAME'] || {}),
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
            },
          },
        };
      });
    } catch (error) {
      if (error instanceof Error) {
        showError(error?.message);

        return;
      }
      showError(t('core:sell_name.responses.error2', cap));
      console.log('error', error);
    } finally {
      if (loadId) {
        dismissToast(loadId);
      }
    }
  };

  const handleCancel = async (name: string) => {
    const loadId = showLoading(t('core:cancel_name.responses.loading', cap));

    try {
      const res = await qortalRequest({
        action: 'CANCEL_SELL_NAME',
        nameForSale: name,
      });
      setPendingTxs((prev) => {
        return {
          ...prev,
          ['CANCEL_SELL_NAME']: {
            ...(prev['CANCEL_SELL_NAME'] || {}),
            [res.signature]: {
              ...res,
              status: 'PENDING',
              callback: () => {
                setNamesForSale((prev) => prev.filter((item) => item?.name !== res.name));
              },
            },
          },
        };
      });
      showSuccess(t('core:cancel_name.responses.success', cap));
    } catch (error) {
      if (error instanceof Error) {
        showError(error?.message);
        return;
      }
      showError(t('core:cancel_name.responses.error', cap));
    } finally {
      if (loadId) {
        dismissToast(loadId);
      }
    }
  };

  const openAvatar = (row: NameRow) =>
    modalFunctionsAvatar.show({ name: row.name, hasAvatar: Boolean(row.hasAvatar) });

  // Same rules as the original: the primary name is locked while other names exist.
  const primaryLocked = (row: NameRow) => row.isPrimary && totalNames > 1;
  const canUpdate = (row: NameRow) => !primaryLocked(row) && !row.pending;
  const canSell = (row: NameRow) => !row.isSelling && !primaryLocked(row) && !row.pending;
  const canCancel = (row: NameRow) => row.isSelling && !row.pending;
  const canAvatar = (row: NameRow) => row.hasAvatar !== undefined && !row.pending;
  const avatarLabel = (row: NameRow) =>
    row.hasAvatar === undefined ? (
      <CircularProgress size={12} />
    ) : row.hasAvatar ? (
      t('core:actions.update_avatar', cap)
    ) : (
      t('core:actions.set_avatar', cap)
    );

  const renderRow = (row: NameRow) => (
    <Row>
      <Avatar
        sx={{ width: 40, height: 40 }}
        src={`/arbitrary/THUMBNAIL/${encodeURIComponent(row.name)}/qortal_avatar?forceUpdateState=${forceUpdateState}`}
        alt=""
        slotProps={{ img: { loading: 'lazy' } }}
      >
        {row.name.charAt(0)}
      </Avatar>
      <RowMain>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
          <RowTitle>{row.name}</RowTitle>
          {row.isPrimary ? (
            <Tooltip title={t('core:tooltips.primary_name', cap)} arrow>
              <Chip
                size="small"
                color="success"
                variant="outlined"
                icon={<PersonIcon />}
                label={t('core:names.primary', cap)}
              />
            </Tooltip>
          ) : null}
        </Box>
        {row.isSelling ? (
          <RowMeta>
            {t('core:names.for_sale', cap)}
            {row.salePrice !== undefined ? ` · ${formatQort(row.salePrice)} QORT` : ''}
          </RowMeta>
        ) : null}
        {row.pending ? <RowMeta>{t('core:names.pending', cap)}…</RowMeta> : null}
      </RowMain>
      {phone ? (
        <IconButton
          aria-label={t('core:names.more_actions', cap)}
          aria-haspopup="menu"
          onClick={(event: MouseEvent<HTMLElement>) =>
            setMenu({ anchor: event.currentTarget, row })
          }
        >
          <MoreVertIcon />
        </IconButton>
      ) : (
        <RowActions>
          <Button
            color={row.isPrimary ? 'warning' : 'primary'}
            variant="outlined"
            size="small"
            disabled={!canUpdate(row)}
            onClick={() => handleUpdate(row.name)}
          >
            {t('core:actions.update', cap)}
          </Button>
          {!row.isSelling ? (
            <Button
              color={row.isPrimary ? 'warning' : 'primary'}
              size="small"
              variant="outlined"
              onClick={() => handleSell(row.name)}
              disabled={!canSell(row)}
            >
              {t('core:actions.sell', cap)}
            </Button>
          ) : (
            <Button
              color="error"
              size="small"
              onClick={() => handleCancel(row.name)}
              variant="contained"
              disabled={!canCancel(row)}
            >
              {t('core:actions.cancel_sell', cap)}
            </Button>
          )}
          <Button
            variant="outlined"
            size="small"
            disabled={!canAvatar(row)}
            onClick={() => openAvatar(row)}
          >
            {avatarLabel(row)}
          </Button>
        </RowActions>
      )}
    </Row>
  );

  let body;
  if (!signedIn) {
    body = <EmptyState icon={<BadgeOutlinedIcon />} title={t('core:names.sign_in', cap)} />;
  } else if (status === 'loading' && rows.length === 0) {
    body = <RowSkeletons rows={3} />;
  } else if (status === 'error' && rows.length === 0) {
    body = (
      <ErrorState
        message={t('core:names.error', cap)}
        retryLabel={t('core:actions.retry', cap)}
        onRetry={onRetry}
      />
    );
  } else if (rows.length === 0) {
    body = filter.trim() ? (
      <EmptyState
        icon={<BadgeOutlinedIcon />}
        title={t('core:names.empty_filter', { filter: filter.trim(), ...cap })}
      />
    ) : (
      <EmptyState
        icon={<BadgeOutlinedIcon />}
        title={t('core:names.empty_title', cap)}
        hint={t('core:names.empty_hint', cap)}
        action={registerAction}
      />
    );
  } else {
    body = (
      <Virtuoso
        data={rows}
        style={{ flex: 1 }}
        computeItemKey={(_index, row) => row.name}
        itemContent={(_index, row) => renderRow(row)}
      />
    );
  }

  const menuRow = menu?.row;
  return (
    <>
      <ListCard>{body}</ListCard>
      <Menu
        open={Boolean(menu)}
        anchorEl={menu?.anchor}
        onClose={() => setMenu(null)}
        onClick={() => setMenu(null)}
      >
        {menuRow ? (
          [
            <MenuItem
              key="update"
              disabled={!canUpdate(menuRow)}
              onClick={() => handleUpdate(menuRow.name)}
            >
              <ListItemIcon>
                <EditOutlinedIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>{t('core:actions.update', cap)}</ListItemText>
            </MenuItem>,
            menuRow.isSelling ? (
              <MenuItem
                key="cancel"
                disabled={!canCancel(menuRow)}
                onClick={() => handleCancel(menuRow.name)}
              >
                <ListItemIcon>
                  <RemoveShoppingCartOutlinedIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>{t('core:actions.cancel_sell', cap)}</ListItemText>
              </MenuItem>
            ) : (
              <MenuItem
                key="sell"
                disabled={!canSell(menuRow)}
                onClick={() => handleSell(menuRow.name)}
              >
                <ListItemIcon>
                  <SellOutlinedIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>{t('core:actions.sell', cap)}</ListItemText>
              </MenuItem>
            ),
            <MenuItem
              key="avatar"
              disabled={!canAvatar(menuRow)}
              onClick={() => openAvatar(menuRow)}
            >
              <ListItemIcon>
                <AccountCircleOutlinedIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>
                {menuRow.hasAvatar
                  ? t('core:actions.update_avatar', cap)
                  : t('core:actions.set_avatar', cap)}
              </ListItemText>
            </MenuItem>,
          ]
        ) : null}
      </Menu>
      {modalFunctions?.isShow && (
        <Dialog
          open={modalFunctions?.isShow}
          aria-labelledby="alert-dialog-title"
          aria-describedby="alert-dialog-description"
        >
          <DialogTitle id="alert-dialog-title">{t('core:warnings.warning', cap)}</DialogTitle>
          <DialogContent>
            <DialogContentText id="alert-dialog-description">
              {t('core:warnings.primary_name_sell_caution', cap)}
            </DialogContentText>
            <Spacer height="20px" />
            <DialogContentText id="alert-dialog-description2">
              {t('core:warnings.primary_name_sell', {
                name: modalFunctions?.data?.name,
              })}
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button variant="contained" onClick={modalFunctions.onCancel}>
              {t('core:actions.cancel', cap)}
            </Button>
            <Button
              color="warning"
              variant="contained"
              onClick={() => modalFunctions.onOk(undefined)}
              autoFocus
            >
              {t('core:actions.continue', cap)}
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
    </>
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
        t('core:avatar.responses.error2', {
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
              src={`/arbitrary/THUMBNAIL/${encodeURIComponent(modalFunctionsAvatar.data.name)}/qortal_avatar?forceUpdateState=${forceUpdateState}`}
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
  const isNameAvailable = useNameAvailability(newName);
  const { t } = useTranslation();
  const nameFee = useUnitFee('UPDATE_NAME');
  const { value: balance } = useQortBalance();

  const theme = useTheme();

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
                    {t('core:update_name.balance_info', {
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
            {isNameAvailable === Availability.INVALID && (
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
                <Typography>{nameLengthMessage(t, newName)}</Typography>
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
                  {t('core:new_name.checking_name', {
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
  const cap = { postProcess: 'capitalizeFirstChar' as const };
  const [price, setPrice] = useState('');
  const fee = useUnitFee('SELL_NAME');
  const numeric = Number(price);
  const valid = price.trim() !== '' && Number.isFinite(numeric) && numeric > 0;

  return (
    <Dialog
      open={modalFunctionsSellName?.isShow}
      onClose={modalFunctionsSellName.onCancel}
      fullWidth
      maxWidth="xs"
      aria-labelledby="sell-name-title"
    >
      <DialogTitle id="sell-name-title">{t('core:sell_name.title', cap)}</DialogTitle>
      <DialogContent>
        <DialogContentText>{t('core:sell_name.choose_price', cap)}</DialogContentText>
        <Spacer height="16px" />
        <TextField
          autoComplete="off"
          autoFocus
          fullWidth
          type="number"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="0"
          slotProps={{
            htmlInput: { min: 0, step: 'any', inputMode: 'decimal' },
            input: { endAdornment: <InputAdornment position="end">QORT</InputAdornment> },
          }}
        />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          {t('core:sell_name.price_hint', cap)}
        </Typography>
        {fee !== null ? (
          <Typography variant="body2" color="text.secondary">
            {t('core:sell_name.fee', { fee: formatQort(fee), ...cap })}
          </Typography>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={modalFunctionsSellName.onCancel}>{t('core:actions.cancel', cap)}</Button>
        <Button
          color="primary"
          variant="contained"
          disabled={!valid}
          onClick={() => modalFunctionsSellName.onOk(numeric)}
          autoFocus
        >
          {t('core:actions.continue', cap)}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
