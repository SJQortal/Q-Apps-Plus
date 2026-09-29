import {
  Dialog,
  DialogContent,
  IconButton,
  useTheme,
  SxProps,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { Spacer } from '../Spacer';

interface ReusableModalProps {
  backdrop?: boolean;
  onClickClose: () => void;
  children: React.ReactNode;
  styles?: SxProps;
  open: boolean;
}

export const ReusableModal: React.FC<ReusableModalProps> = ({
  backdrop = true,
  children,
  onClickClose,
  styles,
  open,
}) => {
  const theme = useTheme();
  return (
    <Dialog
      open={open}
      onClose={onClickClose}
      slotProps={{
        backdrop: {
          sx: {
            backgroundColor: backdrop ? 'rgba(0, 0, 0, 0.5)' : 'transparent',
            backdropFilter: backdrop ? 'blur(1px)' : 'none',
          },
        },
        paper: {
          sx: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            backgroundColor: theme.palette.background.default,
            borderRadius: '20px',
            border: '5px solid #3F3F3F',
            width: '629px',
            maxWidth: '90vw',
            minHeight: '446px',
            maxHeight: '90vh',
            overflowY: 'auto',
            position: 'relative',
            margin: 0,
            ...styles,
          },
        },
      }}
    >
      <IconButton
        onClick={onClickClose}
        sx={{
          position: 'absolute',
          top: 10,
          right: 10,
          color: theme.palette.text.primary,
          '&:hover': { transform: 'scale(1.1)' },
        }}
      >
        <CloseIcon fontSize="large" />
      </IconButton>

      <Spacer height="50px" />
      <DialogContent sx={{ width: '100%', padding: 0 }}>{children}</DialogContent>
    </Dialog>
  );
};
