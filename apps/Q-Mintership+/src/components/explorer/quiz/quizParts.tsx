/**
 * The Explorer Quiz's shared pieces: a question's parts as text (names in
 * bold, an address whole, blocks with their number) and a level's chip in
 * its colour (Easy green, Medium blue, Tricky violet, Expert magenta, the
 * info blue turned to each hue).
 */
import { Box } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { MarkedName } from '../../common/MarkedName';
import { withHue } from '../../../pages/decisions/sectionAccents';
import { QUIZ_LEVELS, type QuizLevel, type QuizPart } from '../../../rules/explorer/quiz/types';
import { formatCount } from '../../../utils/format';
import { readableOn } from '../../../utils/readable';

const LEVEL_HUE: Record<QuizLevel, number> = { easy: 150, medium: 210, tricky: 285, expert: 330 };

const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

/** The question's parts as text: names in bold, an address whole, blocks with their number. */
export function QuestionText({ parts }: { parts: readonly QuizPart[] }) {
  return (
    <>
      {parts.map((part, i) => {
        switch (part.kind) {
          case 'text':
            return <span key={i}>{part.text}</span>;
          case 'account':
            return part.name ? (
              <Box component="strong" key={i}>
                <bdi dir="auto">
                  <MarkedName name={part.name} />
                </bdi>
              </Box>
            ) : (
              <Box
                component="code"
                key={i}
                sx={{ fontFamily: MONO, fontSize: '0.92em', wordBreak: 'break-all' }}
              >
                {part.address}
              </Box>
            );
          case 'name':
            return (
              <Box component="strong" key={i}>
                “
                <bdi dir="auto">
                  <MarkedName name={part.name} />
                </bdi>
                ”
              </Box>
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
