import { useAtom } from 'jotai';
import { useEffect, useMemo, useState } from 'react';
import { namesAtom, primaryNameAtom } from '../state/global/names';
import { NameTable } from '../components/Tables/NameTable';
import { Box, TextField } from '@mui/material';
import RegisterName from '../components/RegisterName';
import { useTranslation } from 'react-i18next';

export const MyNames = () => {
  const { t } = useTranslation(['core']);

  const [names] = useAtom(namesAtom);
  const [value, setValue] = useState('');
  const [filterValue, setFilterValue] = useState('');
  const [primaryName] = useAtom(primaryNameAtom);
  useEffect(() => {
    const handler = setTimeout(() => {
      setFilterValue(value);
    }, 500);

    // Cleanup timeout if searchValue changes before the timeout completes
    return () => {
      clearTimeout(handler);
    };
  }, [value]);

  const filteredNames = useMemo(() => {
    const lowerFilter = filterValue.trim().toLowerCase();
    const filtered = !lowerFilter
      ? names
      : names.filter((item) => item.name.toLowerCase().includes(lowerFilter));

    // Sort to move primaryName to the top if it exists in the list
    return [...filtered].sort((a, b) => {
      if (a.name === primaryName) return -1;
      if (b.name === primaryName) return 1;
      return 0;
    });
  }, [names, filterValue, primaryName]);

  return (
    <div>
      <Box
        sx={{
          width: '100%',
          height: '60px',
          padding: '10px',
          display: 'flex',
          gap: '10px',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {' '}
        <TextField
          placeholder={t('core:inputs.filter_names', {
            postProcess: 'capitalizeFirstChar',
          })}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          size="small"
        />
        <RegisterName />
      </Box>
      <NameTable names={filteredNames} primaryName={primaryName} />
    </div>
  );
};
