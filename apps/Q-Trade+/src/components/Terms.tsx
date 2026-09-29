import * as React from 'react';
import Button from '@mui/material/Button';
import { styled } from '@mui/material/styles';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import Typography from '@mui/material/Typography';

export const BootstrapDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialogContent-root': {
    padding: theme.spacing(2),
  },
  '& .MuiDialogActions-root': {
    padding: theme.spacing(1),
  },
}));

export const Terms =() => {
  const [open, setOpen] = React.useState(false);

  const handleClickOpen = () => {
    setOpen(true);
  };
  const handleClose = () => {
    setOpen(false);
  };

  return (
    <React.Fragment>
      <Button variant="outlined" onClick={handleClickOpen}>
        Terms and conditions
      </Button>
      <BootstrapDialog
        onClose={handleClose}
        aria-labelledby="customized-dialog-title"
        open={open}
      >
        <DialogTitle sx={{ m: 0, p: 2 }} id="customized-dialog-title">
          Terms and Conditions
        </DialogTitle>
        <IconButton
          aria-label="close"
          onClick={handleClose}
          sx={(theme) => ({
            position: 'absolute',
            right: 8,
            top: 8,
            color: theme.palette.grey[500],
          })}
        >
          <CloseIcon />
        </IconButton>
        <DialogContent dividers>
        <Typography gutterBottom>
  The purpose of q-trade is to make trading LTC and other coins for QORT as easy as possible. The maintainers of this site do not profit from its use—there are no additional fees for buying QORT through this site. There are two ways to place a buy order: 
  1. Use the gateway 
  2. Use your local node. 
  By using q-trade, you agree to the following terms and conditions.
</Typography>

<Typography gutterBottom>
  Using the gateway means you trust the maintainer of the node, as your foreign coin (i.e. LTC) private key will need to be handled by that node to execute a trade order. If you have more than 4 QORT and your public key is already on the blockchain, your foreign coin private key will be transmitted using q-chat. If not, the message will be encrypted in the same manner as q-chat but stored temporarily in a database to ensure it reaches its destination.
</Typography>

<Typography gutterBottom>
  If you are uncomfortable using the gateway, we offer the option to use your local node to buy QORT. When logging into the UI, choose the local node configuration.
</Typography>

<Typography gutterBottom>
  The maintainers and devs of this site are not responsible for any lost foreign coin, QORT, or other cryptocurrencies that may result from using this site. This is a hobby project, and mistakes in the code may occur.
</Typography>

        </DialogContent>
        <DialogActions>
          <Button autoFocus onClick={handleClose}>
            Close
          </Button>
        </DialogActions>
      </BootstrapDialog>
    </React.Fragment>
  );
}
