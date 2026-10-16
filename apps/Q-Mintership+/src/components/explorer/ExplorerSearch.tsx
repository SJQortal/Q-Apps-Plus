/**
 * The Explorer's one field: a name, a Q… address, an AT address or a
 * transaction signature.
 *
 * - Suggestions come in groups: Exact (what Enter does with the text),
 *   Names (registered names that start with it: the cached searchNames
 *   page Nominate shares, 250 ms after typing stops, one row per owner),
 *   and Recent (accounts explored on this device, while the field is empty).
 * - Enter never picks a suggestion by itself (no auto-highlight): it opens
 *   an address, an AT address or a transaction, or looks the text up as a
 *   name. A name Core doesn't know opens nothing; the names that contain the
 *   text are listed instead. Another account is never opened silently: an
 *   account opened by a name carries that name to its page, which says so.
 * - A polite status line says what the suggestions found.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Autocomplete,
  Box,
  ButtonBase,
  TextField,
  Typography,
  type AutocompleteRenderGroupParams,
} from '@mui/material';
import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import { primarySoft } from '../../hub-theme';
import { NameAvatar } from '../common/NameAvatar';
import { NameWithAvatar } from './NameWithAvatar';
import { isAddress } from '../../data/accounts';
import { getNameData, isAtAddress, isSignature } from '../../data/explorer/account';
import { nameContainsKey, searchNamesContaining } from '../../data/explorer/names';
import {
  NAME_SEARCH_LIMIT,
  NAME_SEARCH_MIN,
  searchNames,
  type NameHit,
} from '../../data/nameSearch';
import { usePrimaryName } from '../../hooks/useData';
import { useQuery } from '../../hooks/useQuery';
import { explorerAccountPath, explorerTxPath } from '../../routes/paths';
import { visibleName } from '../../rules/explorer/nameNotes';
import { useRecent, type NameMatch } from '../../state/explorer';
import { plural, shortAddress } from '../../utils/format';

/** How long typing must pause before names are suggested. */
export const SEARCH_DEBOUNCE_MS = 250;
/** Core keeps names short; longer text can't be one (searchNames' own limit). */
const NAME_MAX = 80;

type Option =
  | { group: 'Exact'; kind: 'lookup'; text: string }
  | { group: 'Exact'; kind: 'account' | 'at'; address: string }
  | { group: 'Exact'; kind: 'tx'; signature: string }
  | { group: 'Names'; kind: 'name'; hit: NameHit }
  | { group: 'Recent'; kind: 'recent'; address: string };

function optionText(option: Option | string): string {
  if (typeof option === 'string') return option;
  switch (option.kind) {
    case 'lookup':
      return option.text;
    case 'account':
    case 'at':
    case 'recent':
      return option.address;
    case 'tx':
      return option.signature;
    case 'name':
      return option.hit.name;
  }
}

function optionKey(option: Option): string {
  return `${option.kind}:${option.kind === 'name' ? option.hit.owner : optionText(option)}`;
}

/** What Enter does with this text, as the first suggestion. */
function exactOption(q: string): Option | null {
  if (!q) return null;
  if (isAddress(q)) return { group: 'Exact', kind: 'account', address: q };
  if (isAtAddress(q)) return { group: 'Exact', kind: 'at', address: q };
  if (isSignature(q)) return { group: 'Exact', kind: 'tx', signature: q };
  return { group: 'Exact', kind: 'lookup', text: q };
}

/** A signature shortened for a label: "4mYb2y…6nM8". */
function shortSignature(signature: string): string {
  return `${signature.slice(0, 6)}…${signature.slice(-4)}`;
}

/** "10 names found", "10 names found · 7 accounts". */
function foundWords(names: number, owners: number): string {
  const found = `${plural(names, 'name')} found`;
  return owners < names ? `${found} · ${plural(owners, 'account')}` : found;
}

/** A name, isolated from the text around it, its invisible characters shown. */
function NameText({ name }: { name: string }) {
  return <bdi dir="auto">{visibleName(name)}</bdi>;
}

/** The name's first letter in the avatar's circle, without loading its image (while typing). */
function LetterAvatar({ name, size }: { name: string; size: number }) {
  return (
    <Box
      aria-hidden
      sx={(theme) => ({
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: '50%',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: primarySoft(theme),
        color: theme.palette.primary.main,
        fontWeight: 700,
        fontSize: Math.round(size * 0.42),
        lineHeight: 1,
      })}
    >
      {[...name.trim()][0]?.toUpperCase() ?? '?'}
    </Box>
  );
}

function OptionIcon({ children }: { children: React.ReactNode }) {
  return (
    <Box
      aria-hidden
      sx={(theme) => ({
        width: 32,
        height: 32,
        flexShrink: 0,
        borderRadius: '50%',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: primarySoft(theme),
        color: theme.palette.primary.main,
        '& svg': { fontSize: 20 },
      })}
    >
      {children}
    </Box>
  );
}

const ROW_SX = { display: 'flex', alignItems: 'center', gap: 1.25, minHeight: 48 } as const;

/**
 * A suggested name. Once typing pauses, its owner's primary name is read
 * (cached per owner), so a name that isn't it says whose it is:
 * "Q-Maps · a name of Simon James".
 */
function NameOption({ hit, paused }: { hit: NameHit; paused: boolean }) {
  const primary = usePrimaryName(paused ? hit.owner : null).data;
  const ownerName = primary && primary !== hit.name ? primary : null;
  return (
    <>
      {paused ? (
        <NameAvatar name={hit.name} size={32} />
      ) : (
        <LetterAvatar name={hit.name} size={32} />
      )}
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
          <NameText name={hit.name} />
          {ownerName ? (
            <>
              {' '}
              <Box component="span" sx={{ fontWeight: 400, color: 'text.secondary' }}>
                {'· a name of '}
                <NameWithAvatar name={ownerName} strong={false} />
              </Box>
            </>
          ) : null}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {shortAddress(hit.owner)}
        </Typography>
      </Box>
    </>
  );
}

function RecentOption({ address }: { address: string }) {
  const name = usePrimaryName(isAddress(address) ? address : null).data ?? null;
  return (
    <>
      <NameAvatar name={name} size={32} />
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
          {name ? <NameText name={name} /> : shortAddress(address)}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {name ? shortAddress(address) : 'No primary name'}
        </Typography>
      </Box>
    </>
  );
}

function ExactOption({ option }: { option: Option }) {
  switch (option.kind) {
    case 'account':
      return (
        <>
          <OptionIcon>
            <AccountCircleOutlinedIcon />
          </OptionIcon>
          <Typography sx={{ fontWeight: 600 }}>
            Open account {shortAddress(option.address)}
          </Typography>
        </>
      );
    case 'at':
      return (
        <>
          <OptionIcon>
            <SmartToyOutlinedIcon />
          </OptionIcon>
          <Typography sx={{ fontWeight: 600 }}>
            Open AT address {shortAddress(option.address)}
          </Typography>
        </>
      );
    case 'tx':
      return (
        <>
          <OptionIcon>
            <ReceiptLongOutlinedIcon />
          </OptionIcon>
          <Typography sx={{ fontWeight: 600 }}>
            Open transaction {shortSignature(option.signature)}
          </Typography>
        </>
      );
    case 'lookup':
      return (
        <>
          <OptionIcon>
            <SearchOutlinedIcon />
          </OptionIcon>
          <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
            Look up the name “<NameText name={option.text} />”
          </Typography>
        </>
      );
    default:
      return null;
  }
}

/**
 * A group of suggestions: a labelled group inside the list box (the list
 * item around it is only there for the HTML).
 */
function OptionGroup({ id, params }: { id: string; params: AutocompleteRenderGroupParams }) {
  return (
    <Box component="li" role="presentation" sx={{ listStyle: 'none' }}>
      <div role="group" aria-labelledby={id}>
        <Typography
          id={id}
          component="div"
          variant="body2"
          sx={{
            px: 2,
            pt: 1,
            pb: 0.5,
            fontWeight: 700,
            color: 'text.secondary',
            textTransform: 'uppercase',
            letterSpacing: 0.4,
            fontSize: 14,
          }}
        >
          {params.group}
        </Typography>
        <Box component="ul" role="presentation" sx={{ p: 0, m: 0 }}>
          {params.children}
        </Box>
      </div>
    </Box>
  );
}

export interface ExplorerSearchProps {
  /**
   * Focus the field when it appears. Callers leave it off on phones and
   * touch screens, where the keyboard would cover the page.
   */
  autoFocus?: boolean;
  /**
   * Called with the account instead of opening it (e.g. adding to Compare).
   * Transactions aren't offered then.
   */
  onAccount?: (address: string, from?: NameMatch) => void;
  /** The field's label. */
  label?: string;
  /**
   * The suggestions' tallest height (CSS), when the field sits where they
   * have more room than MUI's 40vh (a tall dialog), so they show without
   * scrolling.
   */
  listMaxHeight?: string;
}

export function ExplorerSearch({
  autoFocus = false,
  onAccount,
  label = 'Find an account or transaction',
  listMaxHeight,
}: ExplorerSearchProps) {
  const navigate = useNavigate();
  const recent = useRecent();
  const inputRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState('');
  const [debounced, setDebounced] = useState('');
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState('');
  /** A name Core doesn't know (Enter was pressed on it). */
  const [missing, setMissing] = useState<string | null>(null);
  const groupId = useId();

  useEffect(() => {
    const value = input.trim();
    const timer = setTimeout(() => setDebounced(value), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input]);

  // After PageHeader's own focus on a new page, so typing can start at once.
  useEffect(() => {
    if (autoFocus) inputRef.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  const q = input.trim();
  const paused = q === debounced;
  const special = isAddress(debounced) || isAtAddress(debounced) || isSignature(debounced);
  const searchable =
    debounced.length >= NAME_SEARCH_MIN && debounced.length <= NAME_MAX && !special;
  // The same key searchNames caches under (Nominate's picker shares it).
  const key = `namesearch:${NAME_SEARCH_LIMIT}:${debounced.toLowerCase()}`;
  const search = useQuery(searchable ? key : null, () => searchNames(debounced, NAME_SEARCH_LIMIT));
  const hits = searchable && !search.isError ? (search.data ?? []) : [];
  // One row per owner: the first of their names Core listed.
  const owners = new Map<string, NameHit>();
  for (const hit of hits) if (!owners.has(hit.owner)) owners.set(hit.owner, hit);

  const exact = exactOption(q);
  const options: Option[] = [
    ...(exact && !(onAccount && exact.kind === 'tx') ? [exact] : []),
    ...(q.length >= NAME_SEARCH_MIN
      ? [...owners.values()].map((hit): Option => ({ group: 'Names', kind: 'name', hit }))
      : []),
    ...(q ? [] : recent.map((address): Option => ({ group: 'Recent', kind: 'recent', address }))),
  ];

  const open = (address: string, from?: NameMatch) => {
    if (onAccount) {
      onAccount(address, from);
      setInput('');
      setMissing(null);
      return;
    }
    navigate(explorerAccountPath(address), from ? { state: from } : undefined);
  };

  const resolve = async (text: string) => {
    const value = text.trim();
    if (!value) return;
    setError('');
    setMissing(null);
    if (isAddress(value) || isAtAddress(value)) return open(value);
    if (isSignature(value)) {
      if (onAccount) {
        setError('That is a transaction signature. Enter a name or an address.');
        return;
      }
      navigate(explorerTxPath(value));
      return;
    }
    setResolving(true);
    try {
      const data = await getNameData(value);
      if (data) open(data.owner, { viaName: value, matched: data.name });
      else setMissing(value);
    } catch {
      setError('Couldn’t look that up on your node. Try again.');
    } finally {
      setResolving(false);
    }
  };

  const pick = (option: Option) => {
    switch (option.kind) {
      case 'lookup':
        return void resolve(option.text);
      case 'account':
      case 'at':
      case 'recent':
        return open(option.address);
      case 'tx':
        return navigate(explorerTxPath(option.signature));
      case 'name':
        return open(option.hit.owner, { viaName: option.hit.name, matched: option.hit.name });
    }
  };

  let status = '';
  if (resolving) status = `Looking up “${visibleName(q)}”…`;
  else if (q.length === 1) status = 'Type one more letter for suggestions';
  else if (isAddress(q)) status = 'Press Enter to open this account.';
  else if (isAtAddress(q)) status = 'Press Enter to open this AT address.';
  else if (isSignature(q)) status = onAccount ? '' : 'Press Enter to open this transaction.';
  else if (searchable && paused) {
    if (search.isError)
      status = 'Couldn’t suggest names right now. Press Enter to look up the name.';
    else if (search.data)
      status = hits.length
        ? foundWords(hits.length, owners.size)
        : `No names start with “${visibleName(debounced)}”`;
    else status = 'Looking up names…';
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 0 }}>
      <Autocomplete<Option, false, false, true>
        freeSolo
        fullWidth
        autoHighlight={false}
        autoSelect={false}
        // The suggestions stay inside the page's main landmark (screen readers
        // and axe expect every part of the page in one), and the clear button
        // is a full tap target.
        slotProps={{
          popper: { disablePortal: true },
          ...(listMaxHeight ? { listbox: { style: { maxHeight: listMaxHeight } } } : {}),
          clearIndicator: { sx: { width: 44, height: 44 } },
        }}
        options={options}
        value={null}
        filterOptions={(x) => x}
        groupBy={(option) => option.group}
        renderGroup={(params) => (
          <OptionGroup key={params.key} id={`${groupId}-${params.key}`} params={params} />
        )}
        getOptionLabel={optionText}
        getOptionKey={(option) => (typeof option === 'string' ? option : optionKey(option))}
        isOptionEqualToValue={(a, b) =>
          typeof b === 'string' ? optionText(a) === b : optionKey(a) === optionKey(b)
        }
        inputValue={input}
        onInputChange={(_, value, reason) => {
          // Picking a suggestion opens it; the text stays what was typed.
          if (reason === 'reset' || reason === 'selectOption') return;
          setInput(value);
          setError('');
          if (!value.trim()) setMissing(null);
        }}
        onChange={(_, value) => {
          if (!value) return;
          if (typeof value === 'string') void resolve(value);
          else pick(value);
        }}
        renderOption={(props, option) => {
          const { key, ...rest } = props;
          return (
            <Box component="li" key={key} {...rest} sx={ROW_SX}>
              {option.kind === 'name' ? (
                <NameOption hit={option.hit} paused={paused} />
              ) : option.kind === 'recent' ? (
                <RecentOption address={option.address} />
              ) : (
                <ExactOption option={option} />
              )}
            </Box>
          );
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            inputRef={inputRef}
            label={label}
            placeholder="Name, Q… address or signature"
            error={Boolean(error)}
            helperText={error || 'Pick a suggestion, or press Enter to look up the name'}
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
      <Typography
        role="status"
        variant="body2"
        color="text.secondary"
        sx={{ px: 0.5, minHeight: '1.43em' }}
      >
        {status}
      </Typography>
      {missing ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
            No one has the name “<NameText name={missing} />
            ”. Names that contain it:
          </Typography>
          <NamesContaining text={missing} onAccount={onAccount ? open : undefined} />
        </Box>
      ) : null}
    </Box>
  );
}

/**
 * Registered names that contain `text` (one cached page of 10), each opening
 * its owner's account with the name it was found by. Used under the field
 * after a name Core doesn't know, and on the account page for one.
 */
export function NamesContaining({
  text,
  onAccount,
}: {
  text: string;
  onAccount?: (address: string, from?: NameMatch) => void;
}) {
  const q = text.trim();
  const search = useQuery(q ? nameContainsKey(q) : null, () => searchNamesContaining(q));
  if (search.isError)
    return (
      <Typography variant="body2" color="text.secondary">
        Couldn’t search the names right now.
      </Typography>
    );
  if (!search.data)
    return (
      <Typography variant="body2" color="text.secondary" role="status">
        Looking for names that contain it…
      </Typography>
    );
  if (!search.data.length)
    return (
      <Typography variant="body2" color="text.secondary">
        No names contain it either. Check the spelling, or paste the address.
      </Typography>
    );
  return (
    <Box
      component="ul"
      aria-label={`Names that contain “${visibleName(q)}”`}
      sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column' }}
    >
      {search.data.map((hit) => {
        const from: NameMatch = { viaName: hit.name, matched: hit.name };
        const content = (
          <>
            <NameAvatar name={hit.name} size={32} />
            <Box component="span" sx={{ minWidth: 0, display: 'block' }}>
              <Typography
                component="span"
                sx={{ display: 'block', fontWeight: 600, overflowWrap: 'anywhere' }}
              >
                <NameText name={hit.name} />
              </Typography>
              <Typography
                component="span"
                variant="body2"
                color="text.secondary"
                sx={{ display: 'block' }}
              >
                {shortAddress(hit.owner)}
              </Typography>
            </Box>
          </>
        );
        const sx = {
          ...ROW_SX,
          width: '100%',
          px: 1,
          borderRadius: 1,
          textAlign: 'left',
          justifyContent: 'flex-start',
          color: 'inherit',
          textDecoration: 'none',
          '&:hover': { bgcolor: 'action.hover' },
        } as const;
        return (
          <li key={hit.name}>
            {onAccount ? (
              <ButtonBase onClick={() => onAccount(hit.owner, from)} sx={sx}>
                {content}
              </ButtonBase>
            ) : (
              <ButtonBase
                component={RouterLink}
                to={explorerAccountPath(hit.owner)}
                state={from}
                sx={sx}
              >
                {content}
              </ButtonBase>
            )}
          </li>
        );
      })}
    </Box>
  );
}
