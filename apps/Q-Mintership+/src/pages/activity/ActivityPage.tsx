/**
 * Activity: Minter Admin Activity and the group's pulse. Public chain data,
 * the same for everyone; admins see themselves marked. The window is chosen
 * here (Settings remembers the preset) and measured in blocks.
 */
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Button, IconButton, Tooltip } from '@mui/material';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import { useAtom } from 'jotai';
import { PageHeader } from '../../components/layout/PageHeader';
import { PageBody } from '../../components/layout/PageBody';
import { ErrorState, ListSkeleton, TruncatedNote } from '../../components/common/states';
import { Section } from '../../components/common/Section';
import { useGroupInfo, useNominations } from '../../hooks/useData';
import { usePhoneLayout } from '../../hooks/usePhoneLayout';
import { PATHS } from '../../routes/paths';
import { useSession } from '../../state/session';
import { activityWindowAtom, type ActivityWindow } from '../../state/settings';
import { AdminActivityList } from './AdminActivityList';
import { GroupPulse } from './GroupPulse';
import { HowCounted } from './HowCounted';
import { WINDOW_DAYS, type CustomRange } from './range';
import { useActivity } from './useActivity';
import { WindowPicker } from './WindowPicker';

export default function ActivityPage() {
  const [stored, setStored] = useAtom(activityWindowAtom);
  const days: ActivityWindow = WINDOW_DAYS.includes(stored) ? stored : 30;
  const [custom, setCustom] = useState<CustomRange | null>(null);
  const activity = useActivity(custom ?? { days });
  const nominations = useNominations();
  const group = useGroupInfo();
  const session = useSession();
  const phone = usePhoneLayout();
  const data = activity.data;

  return (
    <>
      <PageHeader
        title="Activity"
        subtitle="Minter Admin Activity and the group’s pulse."
        actions={
          <>
            <Button
              component={RouterLink}
              to={PATHS.history}
              color="inherit"
              startIcon={<HistoryOutlinedIcon />}
              sx={{ minHeight: 44 }}
            >
              History
            </Button>
            <Tooltip title="Refresh">
              <span>
                <IconButton
                  aria-label="Refresh"
                  onClick={() => void activity.refetch()}
                  disabled={activity.fetching}
                  sx={{ width: 44, height: 44 }}
                >
                  <RefreshOutlinedIcon />
                </IconButton>
              </span>
            </Tooltip>
          </>
        }
      />
      <PageBody $maxWidth={960}>
        <WindowPicker
          days={days}
          custom={custom}
          onDays={(d) => {
            setCustom(null);
            setStored(d);
          }}
          onCustom={setCustom}
          range={data?.range ?? null}
          now={data?.now ?? null}
          earliest={group.data?.created}
        />

        {activity.isError && !data ? (
          <ErrorState
            title="Couldn't load Minter Admin Activity."
            error={activity.error}
            onRetry={() => void activity.refetch()}
          />
        ) : (
          <>
            {data?.truncated ? <TruncatedNote what="the decisions in this window" /> : null}
            <GroupPulse
              data={data}
              nominations={{ data: nominations.data, isError: nominations.isError }}
            />
            {data ? (
              <AdminActivityList
                data={data}
                myAddress={session.status === 'ready' ? session.address : null}
              />
            ) : (
              <Section title="Minter Admin Activity" id="activity-admins">
                <ListSkeleton count={phone ? 3 : 5} label="Loading Minter Admin Activity" />
              </Section>
            )}
          </>
        )}
        <HowCounted data={data} />
      </PageBody>
    </>
  );
}
