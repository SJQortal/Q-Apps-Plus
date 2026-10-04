/**
 * Settings → Mail → Footer: the plain-text footer the composer adds to new
 * messages (and, with the switch on, to replies and forwards), with an
 * optional footer per name for accounts with several. Saved as you type in
 * `qmail_footer_<address>` (src/utils/mailFooter.ts).
 *
 * The "Footer for" picker lists the names A to Z. Up to NAME_SEARCH_THRESHOLD
 * names it is a plain select; above that (Simon has 86) it is the searchable
 * NameSwitcher, a popover or a full-screen sheet on phones.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, FormControlLabel, MenuItem, Switch, TextField, Typography } from '@mui/material';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import { NAME_SEARCH_THRESHOLD, NameSwitcher, type NameSwitcherLeadRow } from '../../components/common/NameSwitcher';
import {
  MAIL_FOOTER_CHANGED_EVENT,
  MAIL_FOOTER_MAX_LENGTH,
  emptyMailFooter,
  readMailFooter,
  writeMailFooter,
  type MailFooterSettings,
} from '../../utils/mailFooter';

interface FooterSettingsProps {
  /** The account the footer belongs to; empty when signed out. */
  address: string;
  /** Every name of the account (a picker shows when there are several). */
  names: string[];
}

const ownFooterOf = (footer: MailFooterSettings, name: string): string => {
  const wanted = name.toLowerCase();
  const match = Object.entries(footer.byName).find(([key]) => key.toLowerCase() === wanted);
  return match ? match[1] : '';
};

/** The footer with `text` set for the target ("" = the default footer). */
const withFooterText = (footer: MailFooterSettings, target: string, text: string): MailFooterSettings => {
  if (!target) return { ...footer, default: text };
  const byName: Record<string, string> = {};
  Object.entries(footer.byName).forEach(([key, value]) => {
    if (key.toLowerCase() !== target.toLowerCase()) byName[key] = value;
  });
  if (text.trim()) byName[target] = text;
  return { ...footer, byName };
};

const textFor = (footer: MailFooterSettings, target: string) =>
  target ? ownFooterOf(footer, target) : footer.default;

const DEFAULT_TARGET_LABEL = 'All names (default)';

const DEFAULT_TARGET_ROW: NameSwitcherLeadRow = {
  label: DEFAULT_TARGET_LABEL,
  icon: (
    <Box
      component="span"
      aria-hidden
      sx={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'action.selected',
        color: 'text.secondary',
      }}
    >
      <GroupsOutlinedIcon sx={{ fontSize: 18 }} />
    </Box>
  ),
};

/** Names A to Z, ignoring case and accents, without duplicates or blanks. */
export const sortFooterNames = (names: string[]): string[] =>
  [...new Set(names.filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

export function FooterSettings({ address, names }: FooterSettingsProps) {
  const [footer, setFooter] = useState<MailFooterSettings>(() => readMailFooter(address));
  const [target, setTarget] = useState('');
  // The field keeps exactly what was typed (a trailing new line included);
  // the stored footer is the normalised text.
  const [text, setText] = useState(() => textFor(readMailFooter(address), ''));
  const writingRef = useRef(false);

  const reload = useCallback(
    (nextTarget: string) => {
      const stored = address ? readMailFooter(address) : emptyMailFooter();
      setFooter(stored);
      setText(textFor(stored, nextTarget));
    },
    [address]
  );

  useEffect(() => {
    setTarget('');
    reload('');
  }, [reload]);

  // A footer loaded from the published state (only ever into an empty one).
  useEffect(() => {
    const onChange = () => {
      if (writingRef.current) return;
      reload(target);
    };
    window.addEventListener(MAIL_FOOTER_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(MAIL_FOOTER_CHANGED_EVENT, onChange);
  }, [reload, target]);

  const save = (next: MailFooterSettings) => {
    setFooter(next);
    writingRef.current = true;
    try {
      writeMailFooter(address, next);
    } finally {
      writingRef.current = false;
    }
  };

  const sortedNames = useMemo(() => sortFooterNames(names), [names]);
  const disabled = !address;
  const hasSeveralNames = sortedNames.length > 1;
  const searchable = sortedNames.length > NAME_SEARCH_THRESHOLD;
  const pickTarget = (nextTarget: string) => {
    setTarget(nextTarget);
    setText(textFor(footer, nextTarget));
  };
  const fieldLabel = target ? `Footer for ${target}` : hasSeveralNames ? 'Default footer' : 'Footer';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box>
        <Typography component="h3" sx={{ fontWeight: 500, fontSize: '1rem', m: 0 }}>
          Footer
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Added under every new message. Plain text: line breaks are kept and qortal:// links stay as you type
          them.
        </Typography>
      </Box>
      {hasSeveralNames && searchable && (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Footer for · {sortedNames.length} names
          </Typography>
          {disabled ? null : (
            <NameSwitcher
              names={sortedNames}
              activeName={target}
              onPick={pickTarget}
              label="Footer for"
              title="Footer for"
              leadRow={DEFAULT_TARGET_ROW}
              secondaryText={(name) => (ownFooterOf(footer, name).trim() ? 'Own footer' : undefined)}
            />
          )}
        </Box>
      )}
      {hasSeveralNames && !searchable && (
        <TextField
          select
          label="Footer for"
          value={target}
          disabled={disabled}
          onChange={(event) => pickTarget(event.target.value)}
          fullWidth
        >
          <MenuItem value="" sx={{ minHeight: 44 }}>
            {DEFAULT_TARGET_LABEL}
          </MenuItem>
          {sortedNames.map((name) => (
            <MenuItem key={name} value={name} sx={{ minHeight: 44 }}>
              {ownFooterOf(footer, name).trim() ? name : `${name} (uses the default)`}
            </MenuItem>
          ))}
        </TextField>
      )}
      <TextField
        multiline
        minRows={3}
        maxRows={10}
        fullWidth
        label={fieldLabel}
        placeholder={target ? 'Empty: this name uses the default footer' : 'Your name, a qortal:// link…'}
        value={text}
        disabled={disabled}
        onChange={(event) => {
          const raw = event.target.value.slice(0, MAIL_FOOTER_MAX_LENGTH);
          setText(raw);
          save(withFooterText(footer, target, raw));
        }}
        helperText={
          disabled
            ? 'Sign in to set a footer.'
            : target && !text.trim()
            ? `${target} uses the default footer.`
            : `${text.length} / ${MAIL_FOOTER_MAX_LENGTH}`
        }
        slotProps={{
          htmlInput: { maxLength: MAIL_FOOTER_MAX_LENGTH, spellCheck: true },
          formHelperText: { sx: { fontSize: '0.875rem', mx: 0 } },
        }}
      />
      <FormControlLabel
        sx={{ m: 0, justifyContent: 'space-between', minHeight: 44 }}
        labelPlacement="start"
        label="Add the footer to replies and forwards"
        disabled={disabled}
        control={
          <Switch
            checked={footer.inReplies}
            onChange={(event) => save({ ...footer, inReplies: event.target.checked })}
          />
        }
      />
    </Box>
  );
}
