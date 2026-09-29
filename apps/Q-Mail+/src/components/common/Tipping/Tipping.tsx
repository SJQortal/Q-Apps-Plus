import {
  Avatar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Input,
  InputAdornment,
  InputLabel,
  Tooltip,
  Typography,
  useTheme
} from '@mui/material'
import React, { useCallback, useState } from 'react'
import { CardContentContainerComment } from '../../../pages/BlogList/PostPreview-styles'
import { StyledCardHeaderComment } from '../../../pages/BlogList/PostPreview-styles'
import { StyledCardColComment } from '../../../pages/BlogList/PostPreview-styles'
import { AuthorTextComment } from '../../../pages/BlogList/PostPreview-styles'
import { StyledCardContentComment } from '../../../pages/BlogList/PostPreview-styles'
import MenuItem from '@mui/material/MenuItem'
import Select, { SelectChangeEvent } from '@mui/material/Select'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '../../../state/store'
import Portal from '../Portal'
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn'
interface TippingProps {
  name: string
  onSubmit: () => void
  onClose: () => void
  onlyIcon?: boolean
}
import QORT from '../../../assets/img/qort.png'
import ARRR from '../../../assets/img/arrr.png'
import LTC from '../../../assets/img/ltc.png'
import BTC from '../../../assets/img/btc.png'
import DOGE from '../../../assets/img/doge.png'
import DGB from '../../../assets/img/dgb.png'
import RVN from '../../../assets/img/rvn.png'
import { setNotification } from '../../../state/features/notificationsSlice'
const coins = [
  { value: 'QORT', label: 'QORT' },
  { value: 'ARRR', label: 'ARRR' },
  { value: 'LTC', label: 'LTC' },
  { value: 'BTC', label: 'BTC' },
  { value: 'DOGE', label: 'DOGE' },
  { value: 'DGB', label: 'DGB' },
  { value: 'RVN', label: 'RVN' }
]
export const Tipping = ({
  onSubmit,
  onClose,
  name,
  onlyIcon
}: TippingProps) => {
  const { user } = useSelector((state: RootState) => state.auth)
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const [selectedCoin, setSelectedCoint] = useState<any>(coins[0])
  const [amount, setAmount] = useState<number>(0)

  const dispatch = useDispatch()

  const resetValues = () => {
    setSelectedCoint(coins[0])
    setAmount(0)
    setIsOpen(false)
  }

  const sendCoin = async () => {
    try {
      if (!name) return
      let res = await qortalRequest({
        action: 'GET_NAME_DATA',
        name: name
      })
      const address = res.owner
      if (!address || !amount || !selectedCoin?.value) return

      if (isNaN(amount)) return
      await qortalRequest({
        action: 'SEND_COIN',
        coin: selectedCoin.value,
        destinationAddress: address,
        amount: amount
      })
      dispatch(
        setNotification({
          msg: 'Coin successfully sent',
          alertType: 'success'
        })
      )
      resetValues()
      onSubmit()
    } catch (error: any) {
      let notificationObj = null
      if (typeof error === 'string') {
        notificationObj = {
          msg: error || 'Failed to send coin',
          alertType: 'error'
        }
      } else if (typeof error?.error === 'string') {
        notificationObj = {
          msg: error?.error || 'Failed to send coin',
          alertType: 'error'
        }
      } else {
        notificationObj = {
          msg: error?.message || 'Failed to send coin',
          alertType: 'error'
        }
      }
      if (!notificationObj) return
      dispatch(setNotification(notificationObj))
    }
  }

  const handleOptionChange = (event: SelectChangeEvent<string>) => {
    const optionId = event.target.value
    const selectedOption = coins.find(
      (option: any) => option.value === optionId
    )
    setSelectedCoint(selectedOption || null)
  }

  const getLogo = (coin: string) => {
    switch (coin) {
      case 'QORT':
        return QORT
      case 'ARRR':
        return ARRR
      case 'LTC':
        return LTC
      case 'BTC':
        return BTC
      case 'DOGE':
        return DOGE
      case 'DGB':
        return DGB
      case 'RVN':
        return RVN
      default:
        ''
      // code block
    }
  }

  return (
    <Box
      sx={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 1
      }}
    >
      <Tooltip title={`Support ${name}`} arrow>
        <Box
          sx={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            cursor: 'pointer'
          }}
          onClick={() => setIsOpen((prev) => !prev)}
        >
          <MonetizationOnIcon
            sx={{
              cursor: 'pointer',
              color: 'gold'
            }}
          ></MonetizationOnIcon>
          {!onlyIcon && (
            <Typography
              sx={{
                fontSize: '0.875rem'
              }}
            >
              Support
            </Typography>
          )}
        </Box>
      </Tooltip>
      {isOpen && (
        <Portal>
          <Dialog
            open={isOpen}
            onClose={() => setIsOpen(false)}
            aria-labelledby="alert-dialog-title"
            aria-describedby="alert-dialog-description"
          >
            <DialogTitle id="alert-dialog-title"></DialogTitle>
            <DialogContent>
              <Box
                sx={{
                  width: '300px',
                  display: 'flex',
                  justifyContent: 'center'
                }}
              >
                <Box>
                  <InputLabel htmlFor="standard-adornment-name">To</InputLabel>
                  <Input id="standard-adornment-name" value={name} disabled />
                  <InputLabel htmlFor="standard-adornment-coin">
                    Coin
                  </InputLabel>
                  <Select
                    id="standard-adornment-coin"
                    sx={{ width: '100%' }}
                    defaultValue=""
                    displayEmpty
                    value={selectedCoin?.value || ''}
                    onChange={handleOptionChange}
                    renderValue={(value) => {
                      return (
                        <Box
                          sx={{
                            display: 'flex',
                            gap: 1,
                            justifyContent: 'center',
                            alignItems: 'center'
                          }}
                        >
                          {value && (
                            <img
                              style={{
                                height: '25px',
                                width: '25px'
                              }}
                              src={getLogo(value)}
                            />
                          )}

                          {value}
                        </Box>
                      )
                    }}
                  >
                    {coins.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.value}
                      </MenuItem>
                    ))}
                  </Select>
                  <InputLabel htmlFor="standard-adornment-amount">
                    Amount
                  </InputLabel>
                  <Input
                    id="standard-adornment-amount"
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(+e.target.value)}
                    startAdornment={
                      <InputAdornment position="start">
                        <img
                          style={{
                            height: '15px',
                            width: '15px'
                          }}
                          src={getLogo(selectedCoin?.value || '')}
                        />
                      </InputAdornment>
                    }
                  />
                </Box>
              </Box>
            </DialogContent>
            <DialogActions>
              <Button
                variant="contained"
                onClick={() => {
                  setIsOpen(false)
                  resetValues()
                  onClose()
                }}
              >
                Close
              </Button>
              <Button variant="contained" onClick={sendCoin}>
                Send Coin
              </Button>
            </DialogActions>
          </Dialog>
        </Portal>
      )}
    </Box>
  )
}
