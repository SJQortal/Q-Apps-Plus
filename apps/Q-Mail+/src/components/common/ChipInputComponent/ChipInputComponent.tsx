import React, { useState } from 'react';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import { useDispatch } from 'react-redux';
import { setNotification } from '../../../state/features/notificationsSlice';
import { Input } from '@mui/material';

export interface NameChip {
    name: string;
    publicKey: string;
    address: string;
}
interface ChipInputComponent {
    chips: NameChip[];
    setChips: (val: NameChip[])=> void;
}

export const ChipInputComponent = ({chips, setChips}: ChipInputComponent) => {
    const [inputValue, setInputValue] = useState<string>('');
    const dispatch = useDispatch()
    // Add chip on enter or onBlur
    const handleAddChip = async () => {
        try {
            if(!inputValue) return
            const recipientName = inputValue
            const resName = await qortalRequest({
              action: 'GET_NAME_DATA',
              name: recipientName
            })
            if (!resName?.owner) throw new Error("Name cannot be found")
      
            const recipientAddress = resName.owner
            const resAddress = await qortalRequest({
              action: 'GET_ACCOUNT_DATA',
              address: recipientAddress
            })
            if (!resAddress?.publicKey) throw new Error("Cannot retrieve public key of name")
            const recipientPublicKey = resAddress.publicKey
            if (inputValue && !chips.find((item)=> item?.name === inputValue)) {
                setChips([...chips, {
                    name: inputValue,
                    publicKey: recipientPublicKey,
                    address: recipientAddress
                }]);
                setInputValue('');
            }
        } catch (error:any) {
            dispatch(
                setNotification({
                  msg: error?.message,
                  alertType: 'error'
                })
              )
        }
       
    };

    // Remove chip
    const handleDeleteChip = (chipToDelete: string) => () => {
        setChips(chips.filter(chip => chip.name !== chipToDelete));
    };

    return (
        <div>
            {chips.map((chip, index) => (
                <Chip
                    key={index}
                    label={chip.name}
                    onDelete={handleDeleteChip(chip.name)}
                    sx={{
                        color: 'var(--qmail-compose-text)',
                        backgroundColor: 'var(--qmail-compose-button-bg)',
                        border: '1px solid var(--qmail-compose-button-border)',
                        '& .MuiChip-deleteIcon': {
                            color: 'var(--qmail-compose-muted)' ,
                            "&:hover": {
                                color: 'var(--qmail-compose-text)'
                            }
                        }
                    }}
                />
            ))}
            {/* <TextField
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddChip()}
                placeholder="Type and press enter..."
            /> */}
             <Input
              id="standard-adornment-name"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value)
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleAddChip()}
              disableUnderline
              autoComplete='off'
              autoCorrect='off'
              placeholder="Type and press enter..."
              sx={{
                width: '100%',
                color: 'var(--new-message-text)',
                '& .MuiInput-input::placeholder': {
                  color: 'var(--qmail-compose-placeholder) !important',
                  fontSize: '1.25rem',
                  fontStyle: 'normal',
                  fontWeight: 400,
                  lineHeight: '120%', // 24px
                  letterSpacing: '0.15px',
                  opacity: 1
                },
                '&:focus': {
                  outline: 'none',
                },
                // Add any additional styles for the input here
              }}
            />
        </div>
    );
};
