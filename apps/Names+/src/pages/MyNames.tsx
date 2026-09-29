import { useAtom } from 'jotai';
import { useEffect, useMemo, useState } from 'react';
import { namesAtom, primaryNameAtom } from '../state/global/names';
import { NameTable } from '../components/Tables/NameTable';
import { TextField } from '@mui/material';
import RegisterName from '../components/RegisterName';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../components/layout/PageHeader';
import { PendingTxsTable } from '../components/Tables/PendingTxsTable';

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
    <>
      <PageHeader
        title={t('core:header.my_names', { postProcess: 'capitalizeFirstChar' })}
        actions={<RegisterName />}
      >
        <TextField
          placeholder={t('core:inputs.filter_names', {
            postProcess: 'capitalizeFirstChar',
          })}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          size="small"
          sx={{ ml: 'auto', minWidth: 0, maxWidth: 260 }}
        />
      </PageHeader>
      <PendingTxsTable />
      <NameTable
        names={filteredNames}
        totalNames={names.length}
        primaryName={primaryName}
      />
    </>
  );
};
