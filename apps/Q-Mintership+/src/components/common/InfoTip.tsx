/**
 * A small ⓘ beside a value that says more on hover (Simon, 2026-10-17:
 * "the explanation does not have to be there under it maybe the small i
 * icon and shows more info on hover"). Focus shows it too, and a tap or a
 * press toggles it, for phones and keyboards. A 44 px target that doesn't
 * move what is around it.
 */
import { useState, type ReactNode } from 'react';
import { ButtonBase, ClickAwayListener, Tooltip } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

const TARGET = 44;
const ICON = 18;

export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <ClickAwayListener onClickAway={() => setOpen(false)}>
      <Tooltip
        title={children}
        open={open}
        onOpen={() => setOpen(true)}
        onClose={() => setOpen(false)}
        enterTouchDelay={0}
        leaveTouchDelay={6000}
        slotProps={{ tooltip: { sx: { fontSize: 13, maxWidth: 320 } } }}
      >
        <ButtonBase
          aria-label={label}
          onClick={() => setOpen((was) => !was)}
          sx={{
            width: TARGET,
            height: TARGET,
            m: `${-(TARGET - ICON) / 2}px`,
            verticalAlign: 'middle',
            borderRadius: '50%',
            color: 'text.secondary',
            '&:hover': { color: 'text.primary' },
            '&.Mui-focusVisible': { outline: 2, outlineColor: 'primary.main', outlineOffset: -10 },
          }}
        >
          <InfoOutlinedIcon aria-hidden sx={{ fontSize: ICON }} />
        </ButtonBase>
      </Tooltip>
    </ClickAwayListener>
  );
}
