/**
 * Settings → Muted names: the names muted in comments on this device
 * (state/comments.ts), newest first, each with Unmute. 20 at a time;
 * avatars load once on screen, and nothing else is read. After an Unmute,
 * focus moves to the next name's Unmute (the one before it at the end), or
 * to the empty note once the list is empty; after Show more, to the first
 * name it added.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { NameAvatar } from '../../components/common/NameAvatar';
import { Section } from '../../components/common/Section';
import { useMutedNames } from '../../state/comments';

const PAGE = 20;
/** Focus the empty note (no name left). */
const EMPTY = Symbol('empty');

const Card = styled('div')(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  overflow: 'hidden',
}));

const Row = styled('li')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  minHeight: 56,
  padding: theme.spacing(1, 2),
  '& + &': { borderTop: `1px solid ${theme.palette.divider}` },
}));

export function MutedNames() {
  const { muted, setMuted } = useMutedNames();
  const names = useMemo(() => [...muted], [muted]);
  const [shown, setShown] = useState(PAGE);
  const [said, setSaid] = useState('');
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const emptyRef = useRef<HTMLParagraphElement>(null);
  const focusNext = useRef<string | typeof EMPTY | null>(null);
  const hintId = useId();

  useEffect(() => {
    const target = focusNext.current;
    if (target === null) return;
    focusNext.current = null;
    if (target === EMPTY) emptyRef.current?.focus();
    else buttons.current.get(target)?.focus();
  }, [names, shown]);

  const unmute = (name: string) => {
    const index = names.indexOf(name);
    const rest = names.filter((n) => n !== name);
    focusNext.current = rest.length ? rest[Math.min(index, rest.length - 1)] : EMPTY;
    setMuted(name, false);
    setSaid(`Unmuted ${name}.`);
  };

  const visible = names.slice(0, shown);
  return (
    <Section title="Muted names" id="settings-muted">
      <Typography id={hintId} variant="body2" color="text.secondary" sx={{ px: 0.5 }}>
        Comments from these names are folded away on this device only, with Show anyway. Nobody is
        told, and nothing is published.
      </Typography>
      <Card>
        {names.length ? (
          <Box component="ul" aria-describedby={hintId} sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {visible.map((name) => (
              <Row key={name}>
                <NameAvatar name={name} size={40} />
                <Typography
                  sx={{ flex: 1, minWidth: 0, fontWeight: 600, overflowWrap: 'anywhere' }}
                >
                  {name}
                </Typography>
                <Button
                  variant="outlined"
                  ref={(node: HTMLButtonElement | null) => {
                    if (node) buttons.current.set(name, node);
                    else buttons.current.delete(name);
                  }}
                  aria-label={`Unmute ${name}`}
                  onClick={() => unmute(name)}
                  sx={{ minHeight: 44, flexShrink: 0 }}
                >
                  Unmute
                </Button>
              </Row>
            ))}
          </Box>
        ) : (
          <Typography
            ref={emptyRef}
            tabIndex={-1}
            color="text.secondary"
            sx={(theme) => ({
              px: 2,
              py: 2,
              '&:focus-visible': {
                outline: `2px solid ${theme.palette.primary.main}`,
                outlineOffset: -2,
              },
            })}
          >
            No muted names. Mute a name from a comment&apos;s menu.
          </Typography>
        )}
        {names.length > shown ? (
          <Box sx={{ px: 2, py: 1, borderTop: 1, borderColor: 'divider' }}>
            <Button
              onClick={() => {
                // The button goes once all are shown: focus the first new name instead.
                focusNext.current = names[shown] ?? null;
                setShown((n) => n + PAGE);
              }}
              sx={{ minHeight: 44 }}
            >
              Show {Math.min(PAGE, names.length - shown)} more
            </Button>
          </Box>
        ) : null}
      </Card>
      <Box role="status" aria-live="polite" className="qmp-visually-hidden">
        {said}
      </Box>
    </Section>
  );
}
