import { useEffect, useMemo, useState } from 'react';
import { TextField } from '@mui/material';
import { useAtomValue } from 'jotai';
import { useGlobal } from 'qapp-core';
import { useTranslation } from 'react-i18next';
import { namesAtom, namesStatusAtom, primaryNameAtom } from '../state/global/names';
import { NameTable } from '../components/Tables/NameTable';
import RegisterName from '../components/RegisterName';
import { PageHeader } from '../components/layout/PageHeader';
import { PageBody } from '../components/layout/PageBody';
import { PendingTxsList } from '../components/Tables/PendingTxsTable';
import { useNameData } from '../hooks/useNameData';

export const MyNames = () => {
  const { t } = useTranslation(['core']);
  const cap = { postProcess: 'capitalizeFirstChar' as const };
  const names = useAtomValue(namesAtom);
  const status = useAtomValue(namesStatusAtom);
  const primaryName = useAtomValue(primaryNameAtom);
  const { auth } = useGlobal();
  const signedIn = Boolean(auth?.address);
  const { reloadMyNames } = useNameData();
  const [value, setValue] = useState('');
  const [filterValue, setFilterValue] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => setFilterValue(value), 300);
    return () => clearTimeout(handler);
  }, [value]);

  const filteredNames = useMemo(() => {
    const lowerFilter = filterValue.trim().toLowerCase();
    const filtered = !lowerFilter
      ? names
      : names.filter((item) => item.name.toLowerCase().includes(lowerFilter));
    // The primary name first, the rest in the node's order.
    return [...filtered].sort((a, b) => {
      if (a.name === primaryName) return -1;
      if (b.name === primaryName) return 1;
      return 0;
    });
  }, [names, filterValue, primaryName]);

  const subtitle = !signedIn
    ? undefined
    : primaryName
      ? `${primaryName} · ${t('core:settings.names_count', { count: names.length })}`
      : status === 'ready'
        ? t('core:settings.names_count', { count: names.length })
        : undefined;

  return (
    <>
      <PageHeader
        title={t('core:header.my_names', cap)}
        subtitle={subtitle}
        actions={<RegisterName />}
      >
        {names.length > 5 ? (
          <TextField
            placeholder={t('core:inputs.filter_names', cap)}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            size="small"
            slotProps={{ htmlInput: { 'aria-label': t('core:inputs.filter_names', cap) } }}
            sx={{ ml: 'auto', minWidth: 0, maxWidth: 260 }}
          />
        ) : null}
      </PageHeader>
      <PageBody $maxWidth={880} sx={{ flex: 1, minHeight: 0 }}>
        <PendingTxsList />
        <NameTable
          names={filteredNames}
          totalNames={names.length}
          primaryName={primaryName}
          status={status}
          filter={filterValue}
          signedIn={signedIn}
          onRetry={() => void reloadMyNames()}
          registerAction={<RegisterName />}
        />
      </PageBody>
    </>
  );
};
