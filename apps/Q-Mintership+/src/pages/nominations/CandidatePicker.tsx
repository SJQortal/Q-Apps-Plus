/**
 * Pick who to nominate: type a name and choose it from the registered names
 * that start with it (debounced, cached: data/nameSearch.ts), or paste a
 * Qortal address. A typed name that isn't chosen from the list is looked up
 * exactly with GET /names/{name} when you press Enter or "Look up".
 */
import { useEffect, useState, type Ref } from 'react';
import { Autocomplete, Box, Button, TextField, Typography } from '@mui/material';
import { NameAvatar } from '../../components/common/NameAvatar';
import { getNameOwner, isAddress } from '../../data/accounts';
import {
  NAME_SEARCH_LIMIT,
  NAME_SEARCH_MIN,
  searchNames,
  type NameHit,
} from '../../data/nameSearch';
import { useQuery } from '../../hooks/useQuery';
import { shortAddress } from '../../utils/format';
import { MarkedName } from '../../components/common/MarkedName';

export interface PickedCandidate {
  address: string;
  /** The name it was picked by, if any (a hint; the candidate's primary name is read too). */
  name: string | null;
}

const DEBOUNCE_MS = 300;

export function CandidatePicker({
  onPick,
  initialError = '',
  inputRef,
}: {
  onPick: (picked: PickedCandidate) => void;
  initialError?: string;
  /** The text field, so the form can move focus to it. */
  inputRef?: Ref<HTMLInputElement>;
}) {
  const [input, setInput] = useState('');
  const [debounced, setDebounced] = useState('');
  const [error, setError] = useState(initialError);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(input.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input]);

  // The same key searchNames caches under.
  const key = `namesearch:${NAME_SEARCH_LIMIT}:${debounced.toLowerCase()}`;
  const searchable = debounced.length >= NAME_SEARCH_MIN && !isAddress(debounced);
  const search = useQuery(searchable ? key : null, () => searchNames(debounced));
  const options = searchable && !search.isError ? (search.data ?? []) : [];

  const resolve = async (text: string) => {
    const value = text.trim();
    if (!value) return;
    if (isAddress(value)) {
      onPick({ address: value, name: null });
      return;
    }
    setResolving(true);
    setError('');
    try {
      const owner = await getNameOwner(value);
      if (owner) onPick({ address: owner, name: value });
      else setError(`No registered name “${value}”. Check the spelling, or paste their address.`);
    } catch {
      setError('Couldn’t look that up on your node. Try again.');
    } finally {
      setResolving(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
      <Autocomplete<NameHit, false, false, true>
        freeSolo
        fullWidth
        options={options}
        filterOptions={(x) => x}
        getOptionLabel={(option) => (typeof option === 'string' ? option : option.name)}
        inputValue={input}
        onInputChange={(_, value, reason) => {
          setInput(value);
          setError('');
          // A pasted address is picked straight away.
          if (reason === 'input' && isAddress(value.trim()))
            onPick({ address: value.trim(), name: null });
        }}
        onChange={(_, value) => {
          if (!value) return;
          if (typeof value === 'string') void resolve(value);
          else onPick({ address: value.owner, name: value.name });
        }}
        loading={search.fetching}
        loadingText="Looking up names…"
        noOptionsText={
          search.isError
            ? 'Couldn’t search names right now. Try again, or paste their address.'
            : 'No registered names start with that'
        }
        renderOption={(props, option) => {
          const { key, ...rest } = props;
          return (
            <Box
              component="li"
              key={key}
              {...rest}
              sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minHeight: 48 }}
            >
              <NameAvatar name={option.name} size={32} />
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
                  <MarkedName name={option.name} />
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {shortAddress(option.owner)}
                </Typography>
              </Box>
            </Box>
          );
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            inputRef={inputRef}
            label="Name or Qortal address"
            error={Boolean(error)}
            helperText={error || 'Type a name and choose it, or paste an address.'}
            slotProps={{
              ...params.slotProps,
              htmlInput: {
                ...params.slotProps.htmlInput,
                autoCapitalize: 'none',
                autoCorrect: 'off',
                spellCheck: false,
                enterKeyHint: 'search',
              },
            }}
          />
        )}
      />
      <Button
        variant="outlined"
        onClick={() => void resolve(input)}
        disabled={!input.trim() || resolving}
        sx={{ minHeight: 56, flexShrink: 0 }}
      >
        {resolving ? 'Looking…' : 'Look up'}
      </Button>
    </Box>
  );
}
