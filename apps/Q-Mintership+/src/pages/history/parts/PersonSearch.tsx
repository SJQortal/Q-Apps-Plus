/**
 * "Find a person": open someone's page by address or registered name. A
 * name is looked up once (GET /names/{name}, cached).
 */
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, TextField } from '@mui/material';
import PersonSearchOutlinedIcon from '@mui/icons-material/PersonSearchOutlined';
import { getNameOwner, isAddress } from '../../../data/accounts';
import { personPath } from '../../../routes/paths';
import { Card } from '../../../components/common/Section';

export function PersonSearch() {
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    const text = value.trim();
    if (!text) {
      setProblem('Type a name or a Q… address.');
      return;
    }
    if (isAddress(text)) {
      navigate(personPath(text));
      return;
    }
    setBusy(true);
    setProblem('');
    try {
      const owner = await getNameOwner(text);
      if (owner) navigate(personPath(owner));
      else
        setProblem(`No account has the name “${text}”. Check the spelling, or paste an address.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <Box
        component="form"
        role="search"
        aria-label="Search people"
        onSubmit={submit}
        sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', flexWrap: 'wrap' }}
      >
        <TextField
          label="Find a person"
          placeholder="Name or Q… address"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (problem) setProblem('');
          }}
          error={Boolean(problem)}
          helperText={problem || 'Opens their page: status, nominations and MINTER history.'}
          size="small"
          autoComplete="off"
          slotProps={{
            htmlInput: { spellCheck: false, autoCapitalize: 'none', enterKeyHint: 'search' },
          }}
          sx={{ flex: '1 1 180px', minWidth: 0, '& .MuiInputBase-root': { minHeight: 44 } }}
        />
        <Button
          type="submit"
          variant="outlined"
          disabled={busy}
          startIcon={<PersonSearchOutlinedIcon />}
          sx={{ minHeight: 44, flexShrink: 0 }}
        >
          {busy ? 'Looking…' : 'Open'}
        </Button>
      </Box>
    </Card>
  );
}
