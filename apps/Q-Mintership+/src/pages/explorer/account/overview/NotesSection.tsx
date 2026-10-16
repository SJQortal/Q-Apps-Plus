/**
 * The Overview's notes, only when there are any: the minting penalty Core
 * recorded (with the number, and that the chain doesn't say why), and how
 * its primary name is written (rules/explorer/nameNotes.ts). Notes on its
 * other names are counted here and shown on the Names tab.
 */
import { Box, Typography } from '@mui/material';
import { Card, Section } from '../../../../components/common/Section';
import type { NamesOf } from '../../../../data/explorer/account';
import { nameNotes } from '../../../../rules/explorer/nameNotes';
import { NameText } from '../names/NameText';
import { otherNotesWords, penaltySentence } from './overviewWords';
import { TabLink } from './TabLink';

export function NotesSection({
  address,
  penalty,
  primary,
  names,
}: {
  address: string;
  penalty: number;
  primary: string | null;
  names: NamesOf | undefined;
}) {
  const primaryNotes = primary ? nameNotes(primary, address) : [];
  const others = names ? names.names.filter((name) => name !== primary) : [];
  const othersWithNotes = others.filter((name) => nameNotes(name, address).length > 0).length;
  if (!penalty && !primaryNotes.length && !othersWithNotes) return null;
  return (
    <Section title="Notes" id="overview-notes">
      <Card>
        <Box
          component="ul"
          sx={{ m: 0, pl: 2.5, display: 'flex', flexDirection: 'column', gap: 1 }}
        >
          {penalty ? (
            <li>
              <Typography>{penaltySentence(penalty)}</Typography>
            </li>
          ) : null}
          {primary
            ? primaryNotes.map((note) => (
                <li key={note.kind}>
                  <Typography sx={{ overflowWrap: 'anywhere' }}>
                    About its primary name <NameText name={primary} />: {note.text}
                  </Typography>
                </li>
              ))
            : null}
          {othersWithNotes ? (
            <li>
              <Typography>
                <TabLink address={address} tab="names">
                  {otherNotesWords(othersWithNotes, others.length)}
                </TabLink>
                .
              </Typography>
            </li>
          ) : null}
        </Box>
      </Card>
    </Section>
  );
}
