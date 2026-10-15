/**
 * Activity: Minter Admin Activity and the group's pulse. Public chain data,
 * the same for everyone; admins see themselves marked. The window is chosen
 * here (Settings remembers the preset) and measured in blocks.
 */
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Badge, Button } from '@mui/material';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import { useAtom } from 'jotai';
import { PageHeader } from '../../components/layout/PageHeader';
import { PageBody, WIDE_PAGE } from '../../components/layout/PageBody';
import { badgeWords } from '../../components/layout/navItems';
import { useNavHas } from '../../components/layout/useNavHas';
import { ErrorState, ListSkeleton, TruncatedNote } from '../../components/common/states';
import { RefreshButton } from '../../components/common/RefreshButton';
import { Section } from '../../components/common/Section';
import { useGroupInfo, useMyStatus, useNominations } from '../../hooks/useData';
import { useHistoryNews } from '../../hooks/useHistoryNews';
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
  const { status } = useMyStatus();
  const historyInNav = useNavHas('history');
  const news = useHistoryNews(
    Boolean(status?.isAdmin),
    session.status === 'ready' ? session.address : null
  );
  const historyNews = historyInNav ? 0 : news;

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
              startIcon={
                // Where History isn't in the nav (a Minter Admin's phone bar), its count is here.
                <Badge
                  badgeContent={historyNews}
                  color="error"
                  max={99}
                  slotProps={{ badge: { 'aria-hidden': true } }}
                >
                  <HistoryOutlinedIcon />
                </Badge>
              }
              sx={{ minHeight: 44 }}
            >
              History
              {historyNews ? (
                <span className="qmp-visually-hidden">, {badgeWords('history', historyNews)}</span>
              ) : null}
            </Button>
            <RefreshButton onClick={() => void activity.refetch()} fetching={activity.fetching} />
          </>
        }
      />
      <PageBody $maxWidth={WIDE_PAGE}>
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
