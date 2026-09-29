import { useParams } from 'react-router-dom';
import { Typography } from '@mui/material';
import { PageHeader } from '../components/layout/PageHeader';
import { PageBody } from '../components/layout/PageBody';
import { StatusCard } from '../components/common/StatusCard';
import { UserStatusBanner } from '../components/common/UserStatusBanner';
import { ORIGINAL_APP_LINK } from '../constants/app';

interface BoardPlaceholderProps {
  title: string;
  subtitle: string;
  phase: number;
  /** What the deep-link parameter means on this board. */
  itemLabel?: string;
}

/**
 * Stands in for a board until its phase lands. It still honours deep links,
 * so a `#/minter/<card>` link from chat shows which card it will open.
 */
export function BoardPlaceholder({ title, subtitle, phase, itemLabel = 'card' }: BoardPlaceholderProps) {
  const { card, section } = useParams<{ card?: string; section?: string }>();
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <PageBody $maxWidth={760}>
        <UserStatusBanner />
        <StatusCard
          title={`${title} arrives in rewrite phase ${phase}`}
          actionLabel="Open the original Q-Mintership"
          onAction={() => window.open(ORIGINAL_APP_LINK, '_blank', 'noopener')}
        >
          The React rewrite lands board by board. Until then, the original app shows the same data.
        </StatusCard>
        {card ? (
          <Typography variant="body2" color="text.secondary">
            This link points at {itemLabel} <code>{card}</code>
            {section ? (
              <>
                {' '}
                (section <code>{section}</code>)
              </>
            ) : null}
            . It will open here once the board is ported.
          </Typography>
        ) : null}
      </PageBody>
    </>
  );
}
