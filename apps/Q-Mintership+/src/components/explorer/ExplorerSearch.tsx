/**
 * The Explorer's one field: a name, a Q… address, an AT address, a
 * transaction signature or a QDN identifier. On the Explorer's own page it
 * is the big field; every other Explorer page has it compact in its header
 * (ExplorerHeaderSearch).
 *
 * - Suggestions come in groups: Exact (what Enter does with the text),
 *   Names (registered names that start with it: the cached searchNames
 *   page Nominate shares, 250 ms after typing stops, one row per owner),
 *   QDN (resources published under exactly that identifier, newest first:
 *   data/explorer/qdnIdentifier.ts, each opening its latest transaction),
 *   and Recent (accounts explored on this device, while the field is empty).
 * - Enter never picks a suggestion by itself (no auto-highlight): it opens
 *   an address, an AT address or a transaction, or looks the text up as a
 *   name. A name Core doesn't know opens the one QDN resource with that
 *   identifier when there is exactly one; otherwise nothing opens, and the
 *   names that contain the text are listed instead. Another account is never opened silently: an
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
import CloudOutlinedIcon from '@mui/icons-material/CloudOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import { visuallyHidden } from '@mui/utils';
import { primarySoft } from '../../hub-theme';
import { NameAvatar } from '../common/NameAvatar';
import { NameWithAvatar } from './NameWithAvatar';
import { isAddress } from '../../data/accounts';
import { getNameData, isAtAddress, isSignature } from '../../data/explorer/account';
import { nameContainsKey, searchNamesContaining } from '../../data/explorer/names';
import {
  couldBeIdentifier,
  identifierKey,
  isPrivateService,
  searchIdentifier,
} from '../../data/explorer/qdnIdentifier';
import { rowTime } from '../../data/qdn';
import type { QdnRow } from '../../data/types';
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
import { formatDate, plural, shortAddress } from '../../utils/format';
import { MarkedName } from '../common/MarkedName';

/** How long typing must pause before names are suggested. */
export const SEARCH_DEBOUNCE_MS = 250;
/** Core keeps names short; longer text can't be one (searchNames' own limit). */
const NAME_MAX = 80;

type Option =
  | { group: 'Exact'; kind: 'lookup'; text: string }
  | { group: 'Exact'; kind: 'account' | 'at'; address: string }
  | { group: 'Exact'; kind: 'tx'; signature: string }
  | { group: 'Names'; kind: 'name'; hit: NameHit }
  | { group: 'QDN'; kind: 'resource'; row: QdnRow }
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
    case 'resource':
      return option.row.identifier;
  }
}

function optionKey(option: Option): string {
  if (option.kind === 'resource')
    return `resource:${option.row.name}:${option.row.service}:${option.row.identifier}`;
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

/** "1 QDN resource with this identifier", "10+ QDN resources with this identifier". */
function resourcesWords(count: number, more: boolean): string {
  return `${more ? `${count}+ QDN resources` : plural(count, 'QDN resource')} with this identifier`;
}

/** A name, isolated from the text around it, its invisible characters shown. */
function NameText({ name }: { name: string }) {
  return (
    <bdi dir="auto">
      <MarkedName name={name}>{visibleName(name)}</MarkedName>
    </bdi>
  );
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

/**
 * A QDN resource with the identifier typed: its service and identifier
 * (an encrypted one says only that), who published it and when.
 */
function ResourceOption({ row }: { row: QdnRow }) {
  const encrypted = isPrivateService(row.service);
  return (
    <>
      <OptionIcon>
        <CloudOutlinedIcon />
      </OptionIcon>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
          {encrypted
            ? `An encrypted ${row.service} resource`
            : `${row.service} · ${row.identifier}`}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
          {'Published by '}
          <NameText name={row.name} />
          {` · ${formatDate(rowTime(row))}`}
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
  /**
   * The header's small field: no floating label or hint under it (an error
   * still shows), the status for screen readers only, suggestions at least
   * 360 px wide. A name Core doesn't know opens its page, which lists the
   * names that contain it.
   */
  compact?: boolean;
  /** Called once it has opened something (the phone's search dialog closes). */
  onDone?: () => void;
}

export function ExplorerSearch({
  autoFocus = false,
  onAccount,
  label = 'Find an account or transaction',
  listMaxHeight,
  compact = false,
  onDone,
}: ExplorerSearchProps) {
  const routerNavigate = useNavigate();
  const recent = useRecent();
  const inputRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState('');
  const [debounced, setDebounced] = useState('');
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState('');
  /** A name Core doesn't know (Enter was pressed on it). */
  const [missing, setMissing] = useState<string | null>(null);
  /** Enter on text that names no one but several QDN resources have as identifier. */
  const [pickResource, setPickResource] = useState<number | null>(null);
  /** The suggestions are open (opened again for "pick one"). */
  const [listOpen, setListOpen] = useState(false);
  const groupId = useId();
  // Opening anything empties a compact field and tells the caller.
  const navigate = (to: string, options?: { state?: unknown }) => {
    void routerNavigate(to, options);
    if (compact) setInput('');
    onDone?.();
  };

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
  // Exactly that identifier on QDN: one small search, once typing pauses.
  const idSearchable = couldBeIdentifier(debounced) && !special;
  const resources = useQuery(idSearchable ? identifierKey(debounced) : null, () =>
    searchIdentifier(debounced)
  );
  const resourceRows = idSearchable && !resources.isError ? (resources.data?.rows ?? []) : [];
  // One row per owner: the first of their names Core listed.
  const owners = new Map<string, NameHit>();
  for (const hit of hits) if (!owners.has(hit.owner)) owners.set(hit.owner, hit);

  const exact = exactOption(q);
  const options: Option[] = [
    ...(exact && !(onAccount && exact.kind === 'tx') ? [exact] : []),
    ...(q.length >= NAME_SEARCH_MIN
      ? [...owners.values()].map((hit): Option => ({ group: 'Names', kind: 'name', hit }))
      : []),
    ...(paused ? resourceRows.map((row): Option => ({ group: 'QDN', kind: 'resource', row })) : []),
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

  /** A QDN resource: its latest transaction, or (picking an account) its publisher. */
  const openResource = async (row: QdnRow) => {
    if (!onAccount && row.latestSignature) return navigate(explorerTxPath(row.latestSignature));
    setResolving(true);
    try {
      const data = await getNameData(row.name);
      if (data) open(data.owner, { viaName: row.name, matched: data.name });
      else setError('Couldn’t find who published it on your node.');
    } catch {
      setError('Couldn’t look that up on your node. Try again.');
    } finally {
      setResolving(false);
    }
  };

  const resolve = async (text: string) => {
    const value = text.trim();
    if (!value) return;
    setError('');
    setMissing(null);
    setPickResource(null);
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
      if (data) return open(data.owner, { viaName: value, matched: data.name });
      // No such name: a QDN identifier, when exactly one resource has it.
      const found = couldBeIdentifier(value) ? (await searchIdentifier(value)).rows : [];
      if (found.length === 1) return void openResource(found[0]);
      if (found.length > 1) {
        setPickResource(found.length);
        setListOpen(true);
        return;
      }
      // The header's field: the name's own page lists the names that contain it.
      if (compact && !onAccount) return navigate(explorerAccountPath(value));
      setMissing(value);
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
      case 'resource':
        return void openResource(option.row);
    }
  };

  let status = '';
  if (resolving) status = `Looking up “${visibleName(q)}”…`;
  else if (q.length === 1) status = 'Type one more letter for suggestions';
  else if (isAddress(q)) status = 'Press Enter to open this account.';
  else if (isAtAddress(q)) status = 'Press Enter to open this AT address.';
  else if (isSignature(q)) status = onAccount ? '' : 'Press Enter to open this transaction.';
  else if (pickResource)
    status = `No one has that name, and ${plural(pickResource, 'QDN resource')} have it as identifier: pick one.`;
  else if (searchable && paused) {
    if (search.isError)
      status = 'Couldn’t suggest names right now. Press Enter to look up the name.';
    else if (search.data)
      status = hits.length
        ? foundWords(hits.length, owners.size)
        : `No names start with “${visibleName(debounced)}”`;
    else status = 'Looking up names…';
    if (resourceRows.length && search.data)
      status += ` · ${resourcesWords(resourceRows.length, resources.data?.more ?? false)}`;
  } else if (idSearchable && paused && resourceRows.length)
    status = resourcesWords(resourceRows.length, resources.data?.more ?? false);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 0 }}>
      <Autocomplete<Option, false, false, true>
        freeSolo
        fullWidth
        autoHighlight={false}
        autoSelect={false}
        open={listOpen}
        onOpen={() => setListOpen(true)}
        onClose={() => setListOpen(false)}
        // The suggestions stay inside the page's main landmark (screen readers
        // and axe expect every part of the page in one), and the clear button
        // is a full tap target.
        slotProps={{
          popper: {
            disablePortal: true,
            // In the header the field is narrow: the suggestions keep room to read.
            ...(compact ? { placement: 'bottom-end', sx: { minWidth: 'min(360px, 92vw)' } } : {}),
          },
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
              ) : option.kind === 'resource' ? (
                <ResourceOption row={option.row} />
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
            label={compact ? undefined : label}
            size={compact ? 'small' : 'medium'}
            placeholder={
              compact ? 'Search the Explorer' : 'Name, Q… address, signature or QDN identifier'
            }
            error={Boolean(error)}
            helperText={
              error || (compact ? undefined : 'Pick a suggestion, or press Enter to look it up')
            }
            slotProps={{
              ...params.slotProps,
              htmlInput: {
                ...params.slotProps.htmlInput,
                ...(compact ? { 'aria-label': label } : {}),
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
        sx={compact ? visuallyHidden : { px: 0.5, minHeight: '1.43em' }}
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
