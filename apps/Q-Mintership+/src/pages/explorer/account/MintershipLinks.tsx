/**
 * Connections' "In Q-Mintership": nominations, supports and community votes
 * between this account and others (social links from Q-Mintership+ records,
 * never a Minter Admin's duties: approvals, invites and answers are process
 * facts on the Mintership tab). One row per other account, its name linking
 * into the Explorer, with a Compare button beside it. Nothing at all when
 * there are none (or while it reads): mintership/useMintershipLinks.ts
 * tells the Connections tab which, for its "Also checked" line, from the
 * same shared reads (none polled). It reads once `enabled` (the Connections
 * tab passes whether its In common part nears the screen). A read that
 * failed is said, with Retry, above whatever did load. With the tab's
 * search (`find`), each group shows only the rows found, matches first,
 * then those only similar; a group with none goes, and so does the part.
 */
import { Link as RouterLink } from 'react-router-dom';
import { Box, IconButton, Tooltip } from '@mui/material';
import CompareArrowsOutlinedIcon from '@mui/icons-material/CompareArrowsOutlined';
import { PersonChip } from '../../../components/common/Person';
import { usePersonLinks } from '../../../components/common/personLinks';
import { Section } from '../../../components/common/Section';
import { ErrorState } from '../../../components/common/states';
import { useDisplayName } from '../../../hooks/useDisplayName';
import { explorerComparePath } from '../../../routes/paths';
import { formatDate } from '../../../utils/format';
import { LINK_GROUPS, type MintershipLink } from './mintership/links';
import { SteppedList, SubHeading } from './mintership/parts';
import { SimilarHeading } from '../../../components/explorer/search/SimilarHeading';
import type { MatchStrength } from '../../../utils/fuzzySearch';
import { useMintershipLinks } from './mintership/useMintershipLinks';

export interface MintershipLinksProps {
  address: string;
  /** Read now (default); false until the section nears the screen. */
  enabled?: boolean;
  /** The tab's search, when one is typed: how it finds a row. */
  find?: ((link: MintershipLink) => MatchStrength | null) | null;
  typed?: string;
  /** "holds the name “…”" for an account the search found by a name it holds. */
  tagOf?: (address: string) => string | null;
}

function secondary(link: MintershipLink): string {
  const parts: string[] = [];
  if (link.vote)
    parts.push(
      `Voted ${link.vote === 'yes' ? 'Yes' : 'No'}${link.votes > 1 ? ` (newest of ${link.votes} votes)` : ''}`
    );
  if (link.round !== null) parts.push(`Round ${link.round}`);
  parts.push(formatDate(link.at));
  if (link.names > 1) parts.push(`under ${link.names} names`);
  return parts.join(' · ');
}

function LinkRow({
  address,
  link,
  tag = null,
}: {
  address: string;
  link: MintershipLink;
  /** One more plain tag (the search's "holds the name …"). */
  tag?: string | null;
}) {
  const { label } = useDisplayName(link.other);
  const links = usePersonLinks();
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <PersonChip
          address={link.other}
          size={32}
          secondary={tag ? `${secondary(link)} · ${tag}` : secondary(link)}
        />
      </Box>
      <Tooltip title="Compare">
        <IconButton
          component={RouterLink}
          to={explorerComparePath([address, link.other])}
          state={links.state}
          aria-label={`Compare with ${label}`}
          sx={{ width: 44, height: 44, flexShrink: 0 }}
        >
          <CompareArrowsOutlinedIcon />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

export function MintershipLinks({
  address,
  enabled = true,
  find = null,
  typed = '',
  tagOf,
}: MintershipLinksProps) {
  const { links, failed, error, retry } = useMintershipLinks(address, enabled);
  const strength = (link: MintershipLink) => (find ? find(link) : 'match');
  const found = (links ?? []).filter((link) => strength(link) !== null);
  if (!failed && !found.length) return null;
  return (
    <Section title="In Q-Mintership" id="explorer-links-mintership">
      {failed ? (
        <ErrorState
          compact
          title="Couldn’t read all of its Q-Mintership records."
          error={error}
          onRetry={retry}
        />
      ) : null}
      {LINK_GROUPS.map(({ kind, heading }) => {
        const group = found.filter((l) => l.kind === kind);
        if (!group.length) return null;
        const matches = group.filter((l) => strength(l) === 'match');
        const similar = group.filter((l) => strength(l) === 'similar');
        return (
          <Box key={kind} sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <SubHeading>{heading}</SubHeading>
            {matches.length ? (
              <SteppedList
                items={matches}
                label={heading}
                keyOf={(l) => l.other}
                render={(link) => (
                  <LinkRow
                    address={address}
                    link={link}
                    tag={find ? (tagOf?.(link.other) ?? null) : null}
                  />
                )}
              />
            ) : null}
            {similar.length ? (
              <>
                <SimilarHeading typed={typed} />
                <SteppedList
                  items={similar}
                  label={`${heading}, similar to “${typed}”`}
                  keyOf={(l) => l.other}
                  render={(link) => (
                    <LinkRow
                      address={address}
                      link={link}
                      tag={find ? (tagOf?.(link.other) ?? null) : null}
                    />
                  )}
                />
              </>
            ) : null}
          </Box>
        );
      })}
    </Section>
  );
}
