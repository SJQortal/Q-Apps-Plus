/**
 * Remove a member, Ban an account and Make a Minter Admin pick from MINTER's
 * members with a dropdown while typing, as Propose nomination does (Simon,
 * 2026-10-18: "for the members of MINTER Group You dont have to list them
 * there as there is too many of them, just the dropdown while typing is fine
 * for it"): a member's name (or the start of their address) brings up to
 * eight members, each with their avatar, Minter Admins marked; someone a
 * proposal like this one already waits for is crossed out and can't be
 * picked. The suggestions come from the member list Decisions already reads
 * (names and join dates included), so typing reads nothing. Ban an account
 * can be for anyone: its dropdown also offers registered names outside
 * MINTER, from the name search Propose nomination uses (one small search per
 * pause in typing, cached). A pasted address is picked at once; Look up finds
 * a name typed in full.
 */
import { useEffect, useMemo, useState, type Ref } from 'react';
import { Autocomplete, Box, Button, TextField, Typography } from '@mui/material';
import { MarkedName } from '../../../components/common/MarkedName';
import { NameAvatar } from '../../../components/common/NameAvatar';
import { isAddress } from '../../../data/accounts';
import { NAME_SEARCH_LIMIT, NAME_SEARCH_MIN, searchNames } from '../../../data/nameSearch';
import type { GroupMemberRow } from '../../../data/types';
import { useMembers } from '../../../hooks/useData';
import { useQuery } from '../../../hooks/useQuery';
import { formatDate, shortAddress } from '../../../utils/format';
import { resolvePerson } from '../proposeKinds';
import type { PickedAccount } from './AccountList';
import { memberCandidates, memberSuggestions } from './pickRows';
import type { WaitingProposals } from './proposeContext';

const DEBOUNCE_MS = 300;

interface Suggestion {
  address: string;
  name: string | null;
  /** In MINTER, or a registered name outside it (Ban an account; said on its second line). */
  group: 'MINTER members' | 'Not in MINTER';
  admin: boolean;
  joined?: number;
  /** A proposal like this one already waits for them: its signature. */
  waiting: string | null;
}

const WAITING_WORDS = {
  kick: 'A removal is waiting for approvals',
  ban: 'A ban is waiting for approvals',
  addAdmin: 'Already proposed: waiting for approvals',
} as const;

export function MemberSearch({
  kind,
  me,
  admins,
  waiting,
  onPick,
  inputRef,
}: {
  kind: 'kick' | 'ban' | 'addAdmin';
  me: string;
  /** The Minter Admins: marked (and left out of Make a Minter Admin). */
  admins: ReadonlySet<string>;
  waiting: WaitingProposals;
  onPick: (person: PickedAccount) => void;
  inputRef?: Ref<HTMLInputElement>;
}) {
  const members = useMembers();
  const [input, setInput] = useState('');
  const [debounced, setDebounced] = useState('');
  const [error, setError] = useState('');
  const [resolving, setResolving] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(input.trim().replace(/^@/, '')), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input]);

  const list = members.data;
  const candidates = useMemo(
    () => (list ? memberCandidates(kind, list.members, admins, me) : []),
    [list, kind, admins, me]
  );
  const memberSet = useMemo(() => new Set(list?.members.map((m) => m.member)), [list]);
  const waitingFor = waiting.get(kind);
  const typed = input.trim();
  const fromMembers = memberSuggestions(candidates, typed);

  // Ban an account: registered names outside MINTER too (the same search as Propose nomination).
  const searchable = kind === 'ban' && debounced.length >= NAME_SEARCH_MIN && !isAddress(debounced);
  const key = `namesearch:${NAME_SEARCH_LIMIT}:${debounced.toLowerCase()}`;
  const outside = useQuery(searchable ? key : null, () => searchNames(debounced));
  const others = (searchable && !outside.isError ? (outside.data ?? []) : []).filter(
    (hit) => !memberSet.has(hit.owner) && hit.owner !== me
  );

  const toSuggestion = (m: GroupMemberRow): Suggestion => ({
    address: m.member,
    name: m.primaryName ?? null,
    group: 'MINTER members',
    admin: admins.has(m.member),
    joined: m.joined,
    waiting: waitingFor?.get(m.member) ?? null,
  });
  const options: Suggestion[] = [
    ...fromMembers.map(toSuggestion),
    ...others.map((hit) => ({
      address: hit.owner,
      name: hit.name,
      group: 'Not in MINTER' as const,
      admin: false,
      waiting: waitingFor?.get(hit.owner) ?? null,
    })),
  ];

  const resolve = async (text: string) => {
    const value = text.trim();
    if (!value) return;
    setResolving(true);
    setError('');
    try {
      const found = await resolvePerson(value);
      if ('error' in found) setError(found.error);
      else onPick({ address: found.address, name: found.name ?? null });
    } catch {
      setError('Couldn’t look that up on your node. Try again.');
    } finally {
      setResolving(false);
    }
  };

  // Typing (freeSolo) shows no "no options" line in the dropdown: the field's hint says it.
  const settled = Boolean(list) && !(searchable && outside.fetching) && debounced === typed;
  const hint =
    error ||
    (!list && members.isError
      ? 'Couldn’t read the member list. Try again, or paste their address.'
      : typed && settled && !options.length && !isAddress(typed)
        ? kind === 'ban'
          ? 'No registered name goes with that. Look up a name typed in full, or paste an address.'
          : 'No MINTER member’s name goes with that. Paste their address, or Look up a name typed in full.'
        : kind === 'ban'
          ? 'Type a name and choose it (MINTER’s members first), or paste an address.'
          : 'Type a member’s name and choose it, or paste their address.');

  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
      <Autocomplete<Suggestion, false, true, true>
        freeSolo
        fullWidth
        // In the page, so the open list is inside its landmarks; no clear button (a target
        // under 40 px): deleting the text clears it.
        disablePortal
        disableClearable
        options={options}
        filterOptions={(x) => x}
        getOptionLabel={(option) =>
          typeof option === 'string' ? option : (option.name ?? option.address)
        }
        getOptionDisabled={(option) => Boolean(option.waiting)}
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
          else onPick({ address: value.address, name: value.name });
        }}
        loading={(!list && members.fetching) || (searchable && outside.fetching)}
        loadingText={list ? 'Looking up names…' : 'Reading MINTER’s members…'}
        renderOption={(props, option) => {
          const { key: optionKey, ...rest } = props;
          const second = option.waiting
            ? WAITING_WORDS[kind]
            : option.group === 'Not in MINTER'
              ? 'Not in MINTER'
              : [
                  option.admin ? 'Minter Admin' : null,
                  option.joined ? `in MINTER since ${formatDate(option.joined)}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || shortAddress(option.address);
          return (
            <Box
              component="li"
              key={optionKey}
              {...rest}
              sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minHeight: 48 }}
            >
              <NameAvatar name={option.name} size={32} />
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  sx={{
                    fontWeight: 600,
                    overflowWrap: 'anywhere',
                    ...(option.waiting ? { textDecoration: 'line-through' } : {}),
                  }}
                >
                  {option.name ? <MarkedName name={option.name} /> : shortAddress(option.address)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {second.charAt(0).toUpperCase() + second.slice(1)}
                </Typography>
              </Box>
            </Box>
          );
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            inputRef={inputRef}
            label={kind === 'ban' ? 'Name or Qortal address' : 'Member’s name or address'}
            error={Boolean(error)}
            helperText={hint}
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
        disabled={!typed || resolving}
        sx={{ minHeight: 56, flexShrink: 0 }}
      >
        {resolving ? 'Looking…' : 'Look up'}
      </Button>
    </Box>
  );
}
