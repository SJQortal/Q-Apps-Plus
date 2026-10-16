/**
 * What the account published on QDN under its names. Once the section nears
 * the screen it searches the primary name and the 9 registered most
 * recently, 4 at a time (data/explorer/qdnBy.ts); the rest only when asked
 * ("Search 20 more names", with progress and Stop). Then: how many
 * resources per service across the names searched ("100+" where a name hit
 * the cap), and the newest ones, 20 at a time. Encrypted ones are counted
 * and never listed: no identifier, nothing about what is inside.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { ProgressBar } from '../../../../components/common/ProgressRing';
import { Card, Section } from '../../../../components/common/Section';
import { ErrorState, ListSkeleton } from '../../../../components/common/states';
import {
  autoQdnNames,
  formatSize,
  qdnNameKey,
  searchQdnNames,
  summarizeQdn,
  type QdnOfName,
  type QdnResource,
  type QdnSearchResult,
} from '../../../../data/explorer/qdnBy';
import { peekQuery } from '../../../../data/query';
import { useInView } from '../../../../hooks/useInView';
import { serviceWords } from '../../../../rules/explorer/qdnServices';
import { formatCount, formatDate } from '../../../../utils/format';
import { NameText } from './NameText';
import {
  autoNamesWords,
  cappedWords,
  encryptedWords,
  resourcesWords,
  searchedLine,
  searchMoreWords,
  serviceCountWords,
  showMoreWords,
} from './namesWords';
import { FOCUSABLE_ROW_SX, useShowMore } from './useShowMore';

/** Resources listed at first, and added by each "Show more". */
export const QDN_PAGE = 20;

const capitalize = (text: string) => (text ? text[0].toUpperCase() + text.slice(1) : text);

/** The names already searched this session (the store keeps each for a while). */
function fromStore(names: readonly string[]): Map<string, QdnSearchResult> {
  const found = new Map<string, QdnSearchResult>();
  for (const name of names) {
    const data = peekQuery<QdnOfName>(qdnNameKey(name));
    if (data) found.set(name, { ok: true, data });
  }
  return found;
}

function ResourceRow({ resource }: { resource: QdnResource }) {
  return (
    <Box
      component="li"
      tabIndex={-1}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0.25,
        py: 1,
        borderTop: 1,
        borderColor: 'divider',
        minWidth: 0,
        '&:first-of-type': { borderTop: 0, pt: 0 },
        ...FOCUSABLE_ROW_SX,
      }}
    >
      <Typography sx={{ fontWeight: 600 }}>
        {capitalize(serviceWords(resource.service))}{' '}
        <Box component="span" sx={{ color: 'text.secondary', fontWeight: 400 }}>
          ({resource.service})
        </Box>
      </Typography>
      <Typography
        variant="body2"
        sx={{
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          overflowWrap: 'anywhere',
        }}
      >
        {resource.identifier ?? 'default'}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
        Under <NameText name={resource.name} />
        {resource.size !== null ? ` · ${formatSize(resource.size)}` : ''}
        {resource.created ? ` · ${formatDate(resource.created)}` : ''}
        {resource.updated ? ` · updated ${formatDate(resource.updated)}` : ''}
      </Typography>
    </Box>
  );
}

export function QdnPublished({
  names,
  primary,
  truncated,
}: {
  /** Every name the account owns, in Core's order. */
  names: readonly string[];
  primary: string | null;
  /** Core's list of its names was cut at 500. */
  truncated: boolean;
}) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const near = useInView(node);
  const auto = useMemo(() => autoQdnNames(names, primary), [names, primary]);
  const [results, setResults] = useState(() => fromStore(names));
  const resultsRef = useRef(results);
  const [running, setRunning] = useState<{
    total: number;
    done: number;
    stopping: boolean;
  } | null>(null);
  const runRef = useRef<{ stopped: boolean } | null>(null);
  const { shown, showMore, listRef } = useShowMore(QDN_PAGE);

  useEffect(() => {
    resultsRef.current = results;
  }, [results]);

  const run = useCallback((list: string[]) => {
    if (!list.length) return;
    const token = { stopped: false };
    runRef.current = token;
    setRunning({ total: list.length, done: 0, stopping: false });
    void searchQdnNames(list, {
      stopped: () => token.stopped,
      onResult: (name, result) => {
        setResults((previous) => new Map(previous).set(name, result));
        if (runRef.current === token)
          setRunning((now) => (now ? { ...now, done: now.done + 1 } : now));
      },
    }).then(() => {
      if (runRef.current !== token) return;
      runRef.current = null;
      setRunning(null);
    });
  }, []);

  // The first names, once the section nears the screen.
  useEffect(() => {
    if (!near || runRef.current) return;
    run(auto.filter((name) => !resultsRef.current.has(name)));
  }, [near, auto, run]);

  // Leaving: names not started yet are skipped.
  useEffect(
    () => () => {
      if (runRef.current) runRef.current.stopped = true;
      runRef.current = null;
    },
    []
  );

  // The names already being read finish (Core does the work either way); no new one starts.
  const stop = () => {
    if (runRef.current) runRef.current.stopped = true;
    setRunning((now) => (now ? { ...now, stopping: true } : now));
  };

  const searched = names.filter((name) => results.get(name)?.ok);
  const failed = names.filter((name) => results.get(name)?.ok === false);
  const left = names.filter((name) => !results.has(name));
  // Only this account's names: the map can still hold another account's.
  const summary = useMemo(
    () =>
      summarizeQdn(
        names.flatMap((name) => {
          const result = results.get(name);
          return result?.ok ? [result.data] : [];
        })
      ),
    [results, names]
  );
  // Only the first names so far: say which they were.
  const onlyAuto =
    searched.length > 0 &&
    searched.length < names.length &&
    searched.every((name) => auto.includes(name));
  const autoHasPrimary = primary !== null && auto.includes(primary);
  const waiting = !searched.length && !failed.length;
  const visible = summary.listed.slice(0, shown);
  const more = summary.listed.length - visible.length;
  const partial = summary.capped.length > 0;

  return (
    <Section title="Published on QDN" id="names-qdn">
      <Card ref={setNode} sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        {waiting ? null : (
          <Typography variant="body2" color="text.secondary">
            {searchedLine(searched.length, names.length, truncated)}
            {onlyAuto
              ? ` ${autoNamesWords(autoHasPrimary, auto.length - (autoHasPrimary ? 1 : 0))}`
              : ''}
          </Typography>
        )}

        {running ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <Typography role="status" sx={{ flex: 1, minWidth: 0 }}>
                Searching: {formatCount(running.done)} of {formatCount(running.total)} names
              </Typography>
              <Button
                variant="outlined"
                onClick={stop}
                disabled={running.stopping}
                sx={{ minHeight: 44 }}
              >
                {running.stopping ? 'Stopping…' : 'Stop'}
              </Button>
            </Box>
            <ProgressBar
              value={running.total ? running.done / running.total : 0}
              label="Searching its names on QDN"
              valueText={`${formatCount(running.done)} of ${formatCount(running.total)} names`}
            />
          </Box>
        ) : null}

        {failed.length && !running ? (
          <ErrorState
            compact
            title={`Couldn't search ${failed.length === 1 ? '1 name' : `${formatCount(failed.length)} names`}.`}
            error={(results.get(failed[0]) as { error?: unknown } | undefined)?.error}
            onRetry={() => run(failed)}
          />
        ) : null}

        {waiting ? (
          <ListSkeleton count={1} label="Searching its names on QDN" />
        ) : !searched.length ? null : summary.total === 0 ? (
          <Typography>
            Nothing published under the{' '}
            {searched.length === 1 ? 'name' : `${formatCount(searched.length)} names`} searched.
          </Typography>
        ) : (
          <>
            <Typography sx={{ fontWeight: 700 }}>
              {resourcesWords(summary.total, partial)}
            </Typography>
            <Box
              component="ul"
              aria-label="Resources per service"
              sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexWrap: 'wrap', gap: 0.75 }}
            >
              {summary.counts.map((count) => (
                <Box
                  component="li"
                  key={count.service}
                  sx={{
                    px: 1,
                    py: 0.25,
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    fontSize: 14,
                    fontVariantNumeric: 'tabular-nums',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {serviceCountWords(count)}
                  {count.encrypted ? ' (encrypted)' : ''}
                </Box>
              ))}
            </Box>
            {summary.capped.length === 1 ? (
              <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
                <NameText name={summary.capped[0]} /> {cappedWords(summary.capped)}
              </Typography>
            ) : summary.capped.length > 1 ? (
              <Typography variant="body2" color="text.secondary">
                {cappedWords(summary.capped)}
              </Typography>
            ) : null}
            {visible.length ? (
              <Box
                component="ul"
                ref={listRef}
                aria-label="Newest resources"
                sx={{ listStyle: 'none', m: 0, p: 0 }}
              >
                {visible.map((resource) => (
                  <ResourceRow
                    key={`${resource.name}|${resource.service}|${resource.identifier}|${resource.created}`}
                    resource={resource}
                  />
                ))}
              </Box>
            ) : null}
            {more > 0 ? (
              <Button onClick={showMore} sx={{ alignSelf: 'flex-start', minHeight: 44 }}>
                {showMoreWords(more, QDN_PAGE)}
              </Button>
            ) : null}
            {summary.encrypted ? (
              <Typography variant="body2" color="text.secondary">
                {encryptedWords(summary.encrypted)}
              </Typography>
            ) : null}
          </>
        )}

        {left.length && !running && near ? (
          <Button
            variant="outlined"
            onClick={() => run(left)}
            sx={{ alignSelf: 'flex-start', minHeight: 44 }}
          >
            {searchMoreWords(left.length)}
          </Button>
        ) : null}
      </Card>
    </Section>
  );
}
