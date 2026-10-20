/**
 * "In Q-Mintership+, under any of their names": the + app's records the
 * account published under any name it owns (data/explorer/madeBy.ts):
 * nominations made, supports, community votes, comments and Considering
 * marks, each with the people or items concerned; the encrypted Minter Admin
 * poll records as a count only. Read when the section nears the screen.
 */
import { useState, type ReactNode } from 'react';
import { Box } from '@mui/material';
import { PersonChip } from '../../../../components/common/Person';
import { Section } from '../../../../components/common/Section';
import { ErrorState, ListSkeleton } from '../../../../components/common/states';
import { loadDecisions } from '../../../../data/decisions';
import {
  loadMinterDecisionPage,
  type DecisionPage,
  type DecisionRef,
} from '../../../../data/explorer/answers';
import {
  loadMadeBy,
  type KeyedMade,
  type MadeBy,
  type NominationMade,
  type VoteMade,
} from '../../../../data/explorer/madeBy';
import { peekQuery } from '../../../../data/query';
import { useDisplayName } from '../../../../hooks/useDisplayName';
import { useInView } from '../../../../hooks/useInView';
import { useQuery } from '../../../../hooks/useQuery';
import { decisionTitle } from '../../../../rules/decision';
import { decisionPath, nominationPath } from '../../../../routes/paths';
import { formatCount, formatDate, plural } from '../../../../utils/format';
import {
  AlsoChecked,
  IsolatedName,
  ItemLink,
  ItemText,
  NamesFound,
  Note,
  SteppedList,
  SubHeading,
} from './parts';
import { useDecisionSubject } from './useDecisionSubject';

/** Records of one kind about one person or item, newest first. */
interface Group<T> {
  key: string;
  items: T[];
}

function groupBy<T>(items: readonly T[], keyOf: (item: T) => string): Group<T>[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  return [...groups].map(([key, list]) => ({ key, items: list }));
}

/**
 * "under “Spare Room”" or "under 2 of their names", when the account's
 * records are under more than one name (otherwise the line above the lists
 * already says which).
 */
function Under({ names, several }: { names: readonly string[]; several: boolean }) {
  if (!several) return null;
  const distinct = [...new Set(names)];
  if (distinct.length === 1)
    return (
      <>
        {' · under '}
        <IsolatedName name={distinct[0]} />
      </>
    );
  return <>{` · under ${formatCount(distinct.length)} of their names`}</>;
}

function PersonRows({
  groups,
  label,
  several,
  line,
}: {
  groups: Group<NominationMade | VoteMade>[];
  label: string;
  several: boolean;
  line: (group: Group<NominationMade | VoteMade>) => ReactNode;
}) {
  return (
    <SteppedList
      items={groups}
      label={label}
      keyOf={(g) => g.key}
      render={(group) => (
        <PersonChip
          address={group.key}
          size={32}
          secondary={
            <>
              {line(group)}
              <Under names={group.items.map((i) => i.name)} several={several} />
            </>
          }
        />
      )}
    />
  );
}

/** "Bob’s nomination", the name isolated. */
function NominationTitle({ nominee }: { nominee: string }) {
  const { name, label } = useDisplayName(nominee);
  return (
    <>
      <IsolatedName name={name} label={label} suffix="’s" />
      {' nomination'}
    </>
  );
}

function DecisionTitleText({ decision }: { decision: DecisionRef }) {
  const subject = useDecisionSubject(decision);
  const { name, label } = useDisplayName(subject ?? '', subject ? undefined : null);
  return (
    <>
      {decisionTitle(decision)}
      {subject ? (
        <>
          {': '}
          <IsolatedName name={name} label={label} />
        </>
      ) : null}
    </>
  );
}

/** Comments or Considering marks, one row per item they are about. */
function KeyedRows({
  groups,
  label,
  decisions,
  several,
  count,
}: {
  groups: Group<KeyedMade>[];
  label: string;
  decisions: ReadonlyMap<string, DecisionRef>;
  several: boolean;
  count: (n: number) => string;
}) {
  return (
    <SteppedList
      items={groups}
      label={label}
      keyOf={(g) => g.key}
      render={(group) => {
        const first = group.items[0];
        const secondary = (
          <>
            {count(group.items.length)} · {formatDate(first.at)}
            <Under names={group.items.map((i) => i.name)} several={several} />
          </>
        );
        if (first.about === 'nomination')
          return (
            <ItemLink
              to={nominationPath(first.key)}
              title={<NominationTitle nominee={first.key} />}
              secondary={secondary}
            />
          );
        const decision = decisions.get(first.key);
        return decision ? (
          <ItemLink
            to={decisionPath(decision.signature)}
            title={<DecisionTitleText decision={decision} />}
            secondary={secondary}
          />
        ) : (
          <ItemText
            title="A MINTER decision"
            secondary={
              <>
                Its signature starts with {first.key.slice(0, 8)} · {secondary}
              </>
            }
          />
        );
      }}
    />
  );
}

/**
 * The MINTER decisions comment and Considering keys point at (a key is the
 * first 40 characters of a signature): the waiting ones and the newest 100,
 * plus older pages this session has read. Read only when a key needs it.
 */
function useDecisionsByKey(needed: boolean): Map<string, DecisionRef> {
  const page = useQuery(needed ? 'xminterdecisions:0' : null, (force) =>
    loadMinterDecisionPage(0, { force })
  );
  const queue = useQuery(needed ? 'decisions:queue' : null, (force) => loadDecisions({ force }));
  const byKey = new Map<string, DecisionRef>();
  const add = (ref: DecisionRef) => byKey.set(ref.signature.slice(0, 40), ref);
  page.data?.rows.forEach(add);
  for (let p = 1; ; p++) {
    const older = peekQuery<DecisionPage>(`xminterdecisions:${p}`);
    if (!older) break;
    older.rows.forEach(add);
  }
  for (const d of queue.data?.decisions ?? [])
    add({
      signature: d.signature,
      kind: d.kind,
      subject: d.subject,
      creatorAddress: d.creatorAddress,
      height: d.blockHeight,
      outcome: 'pending',
      decline: Boolean(d.decline),
    });
  return byKey;
}

function MadeBody({ made }: { made: MadeBy }) {
  const several = made.namesWithRecords.length > 1;
  const keyed = [...made.comments, ...made.considering].some((m) => m.about === 'decision');
  const decisions = useDecisionsByKey(keyed);
  const none: string[] = [];
  const blocks: ReactNode[] = [];

  const nominations = groupBy(made.nominations, (n) => n.nominee);
  if (nominations.length)
    blocks.push(
      <Box key="nominations" sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <SubHeading>Nominations made · {formatCount(nominations.length)}</SubHeading>
        <PersonRows
          groups={nominations}
          label="People they nominated"
          several={several}
          line={(g) => `Nominated ${formatDate(g.items[0].at)}`}
        />
      </Box>
    );
  else none.push('nominations made');

  const supports = groupBy(made.supports, (n) => n.nominee);
  if (supports.length)
    blocks.push(
      <Box key="supports" sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <SubHeading>Supports given · {formatCount(supports.length)}</SubHeading>
        <PersonRows
          groups={supports}
          label="Nominations they supported"
          several={several}
          line={(g) => `Supported ${formatDate(g.items[0].at)}`}
        />
      </Box>
    );
  else none.push('supports');

  const votes = groupBy(made.votes, (v) => v.nominee);
  if (votes.length)
    blocks.push(
      <Box key="votes" sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <SubHeading>Community votes · {formatCount(votes.length)}</SubHeading>
        <Note>Each person’s newest vote counts. Votes are advisory: nothing on chain follows.</Note>
        <PersonRows
          groups={votes}
          label="Nominations they voted on"
          several={several}
          line={(g) => {
            const newest = g.items[0] as VoteMade;
            const changed = g.items.length > 1 ? ` (newest of ${g.items.length} votes)` : '';
            return `Voted ${newest.vote === 'yes' ? 'Yes' : 'No'}${changed} · ${formatDate(newest.at)}`;
          }}
        />
      </Box>
    );
  else none.push('community votes');

  const comments = groupBy(made.comments, (c) => c.key);
  if (comments.length)
    blocks.push(
      <Box key="comments" sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <SubHeading>
          Comments · {formatCount(made.comments.length)} on {plural(comments.length, 'item')}
        </SubHeading>
        <KeyedRows
          groups={comments}
          label="What they commented on"
          decisions={decisions}
          several={several}
          count={(n) => plural(n, 'comment')}
        />
      </Box>
    );
  else none.push('comments');

  const considering = groupBy(made.considering, (c) => c.key);
  if (considering.length)
    blocks.push(
      <Box key="considering" sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <SubHeading>Considering marks · {formatCount(considering.length)}</SubHeading>
        <KeyedRows
          groups={considering}
          label="What they marked as Considering"
          decisions={decisions}
          several={several}
          count={(n) => plural(n, 'record')}
        />
      </Box>
    );
  else none.push('Considering marks');

  return (
    <>
      <NamesFound
        names={made.names}
        withRecords={made.namesWithRecords}
        truncated={made.namesTruncated}
      />
      {blocks}
      {made.adminRecords ? (
        <Note>
          {plural(made.adminRecords, 'encrypted Minter Admin poll record')} (counted only, never
          opened).
        </Note>
      ) : null}
      {made.truncated.length ? (
        <Note role="note">
          Some lists stopped at their ceiling (the newest 300 records of a kind per 40 names).
        </Note>
      ) : null}
      {made.names.length ? <AlsoChecked items={none} /> : null}
    </>
  );
}

export function MadeSection({ address, eager = false }: { address: string; eager?: boolean }) {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const near = useInView(node);
  const made = useQuery(`xmade:${address}`, (force) => loadMadeBy(address, { force }), {
    enabled: near || eager,
  });
  return (
    <Section title="In Q-Mintership+, under any of their names" id="explorer-mintership-made">
      <Box ref={setNode} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0 }}>
        {made.data ? (
          <MadeBody made={made.data} />
        ) : made.isError ? (
          <ErrorState
            compact
            title="Couldn't read their Q-Mintership+ records."
            error={made.error}
            onRetry={() => void made.refetch()}
          />
        ) : (
          <ListSkeleton count={1} label="Reading their Q-Mintership+ records" />
        )}
      </Box>
    </Section>
  );
}
