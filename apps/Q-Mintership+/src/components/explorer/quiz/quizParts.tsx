/**
 * The Explorer Quiz's shared pieces: a question's parts as text (names in
 * bold, an address whole, blocks with their number; with `links`, each
 * account and name opens in the Explorer) and a level's chip in its colour
 * (Easy green, Medium blue, Tricky violet, Expert magenta, the info blue
 * turned to each hue).
 */
import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Link } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { MarkedName } from '../../common/MarkedName';
import { withHue } from '../../../pages/decisions/sectionAccents';
import { QUIZ_LEVELS, type QuizLevel, type QuizPart } from '../../../rules/explorer/quiz/types';
import { formatCount } from '../../../utils/format';
import { readableOn } from '../../../utils/readable';
import { explorerAccountPath, explorerNamePath, nameLinkState } from '../../../routes/paths';

const LEVEL_HUE: Record<QuizLevel, number> = { easy: 150, medium: 210, tricky: 285, expert: 330 };

const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

/** Where the quiz's accounts and names open: the Explorer, a step of its trail. */
const QUIZ_LINK_STATE = { via: 'explorer' };

/** An account or a name in a question, opening it when `to` is given. */
function Opens({
  to,
  state = QUIZ_LINK_STATE,
  children,
}: {
  to: string | null;
  state?: unknown;
  children: ReactNode;
}) {
  if (!to) return <>{children}</>;
  return (
    <Link component={RouterLink} to={to} state={state} color="inherit" underline="hover">
      {children}
    </Link>
  );
}

/**
 * The question's parts as text: names in bold, an address whole, blocks
 * with their number. `links`: each account and name opens in the Explorer
 * (Simon, 2026-10-17); never inside a button (an option to pick).
 */
export function QuestionText({
  parts,
  links = false,
}: {
  parts: readonly QuizPart[];
  links?: boolean;
}) {
  return (
    <>
      {parts.map((part, i) => {
        switch (part.kind) {
          case 'text':
            return <span key={i}>{part.text}</span>;
          case 'account':
            return (
              <Opens key={i} to={links ? explorerAccountPath(part.address) : null}>
                {part.name ? (
                  <Box component="strong">
                    <bdi dir="auto">
                      <MarkedName name={part.name} />
                    </bdi>
                  </Box>
                ) : (
                  <Box
                    component="code"
                    sx={{ fontFamily: MONO, fontSize: '0.92em', wordBreak: 'break-all' }}
                  >
                    {part.address}
                  </Box>
                )}
              </Opens>
            );
          case 'name':
            return (
              <Opens
                key={i}
                to={links ? explorerNamePath(part.name) : null}
                state={nameLinkState(part.name, QUIZ_LINK_STATE)}
              >
                <Box component="strong">
                  “
                  <bdi dir="auto">
                    <MarkedName name={part.name} />
                  </bdi>
                  ”
                </Box>
              </Opens>
            );
          case 'group':
            return (
              <Box component="strong" key={i}>
                {part.name ? (
                  <>
                    “<bdi dir="auto">{part.name}</bdi>” (#{part.id})
                  </>
                ) : (
                  `#${part.id}`
                )}
              </Box>
            );
          case 'block':
            return (
              <Box component="strong" key={i} sx={{ whiteSpace: 'nowrap' }}>
                block {formatCount(part.height)}
              </Box>
            );
        }
      })}
    </>
  );
}

export function LevelChip({ level }: { level: QuizLevel }) {
  const label = QUIZ_LEVELS.find((l) => l.value === level)?.label ?? level;
  return (
    <Box
      component="span"
      sx={(theme) => {
        const colour = withHue(theme.palette.info.main, LEVEL_HUE[level]);
        return {
          display: 'inline-flex',
          alignItems: 'center',
          px: 1,
          py: 0.25,
          borderRadius: 999,
          fontSize: 13,
          fontWeight: 700,
          color: readableOn(theme, colour, 0.14),
          bgcolor: alpha(colour, 0.14),
          border: 1,
          borderColor: alpha(colour, 0.45),
          whiteSpace: 'nowrap',
        };
      }}
    >
      {label}
    </Box>
  );
}
