/**
 * The small search field over an account's Connections and Transactions
 * (Simon, 2026-10-17): narrower than the Explorer's own search, a magnifier
 * at its start and a clear button once something is typed. It searches
 * what the tab has read, so it answers as you type (after a short pause,
 * which also keeps the link in the address bar from changing on every
 * letter); Enter and Clear answer at once, Escape clears.
 */
import { useEffect, useRef, useState } from 'react';
import { IconButton, InputAdornment, TextField } from '@mui/material';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';

/** The pause after typing before the search answers. */
export const SEARCH_PAUSE_MS = 250;

export function RowSearchField({
  value,
  onChange,
  placeholder,
  label,
}: {
  /** The search as it stands (from the page's URL). */
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** Its spoken name, when it says more than the placeholder. */
  label?: string;
}) {
  const [text, setText] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const changeRef = useRef(onChange);
  changeRef.current = onChange;

  // The URL changed by itself (Back, a link): the field follows.
  useEffect(() => {
    setText((current) => (current.trim() === value.trim() ? current : value));
  }, [value]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const send = (next: string, now = false) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (now) changeRef.current(next);
    else timer.current = setTimeout(() => changeRef.current(next), SEARCH_PAUSE_MS);
  };
  const clear = () => {
    setText('');
    send('', true);
  };

  return (
    <TextField
      type="search"
      size="small"
      value={text}
      onChange={(event) => {
        setText(event.target.value);
        send(event.target.value);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') send(text, true);
        else if (event.key === 'Escape' && text) {
          event.preventDefault();
          event.stopPropagation();
          clear();
        }
      }}
      placeholder={placeholder}
      sx={{
        width: { xs: '100%', sm: 340 },
        maxWidth: '100%',
        // The browser's own clear cross would sit beside ours.
        '& input::-webkit-search-cancel-button': { display: 'none' },
      }}
      slotProps={{
        htmlInput: {
          'aria-label': label ?? placeholder,
          enterKeyHint: 'search',
          autoCapitalize: 'none',
          autoCorrect: 'off',
          spellCheck: false,
        },
        input: {
          sx: { minHeight: 44, pr: 0.5 },
          startAdornment: (
            <InputAdornment position="start">
              <SearchOutlinedIcon fontSize="small" aria-hidden />
            </InputAdornment>
          ),
          endAdornment: text ? (
            <InputAdornment position="end">
              <IconButton
                aria-label="Clear the search"
                onClick={clear}
                edge="end"
                sx={{ width: 44, height: 44 }}
              >
                <CloseOutlinedIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ) : null,
        },
      }}
    />
  );
}
