import type { ComponentProps } from 'react';
import { useAtomValue } from 'jotai';
import { styled } from '@mui/material/styles';
import { pageWidthAtom } from '../../state/settings';
import { FULL_WINDOW_MEDIA, flowColumns } from './flowColumns';

const Column = styled('div', {
  shouldForwardProp: (prop) => prop !== '$maxWidth' && prop !== '$full' && prop !== '$flow',
})<{ $maxWidth?: number; $full?: boolean; $flow?: number }>(
  ({ theme, $maxWidth = 760, $full = false, $flow }) => ({
    width: '100%',
    maxWidth: $maxWidth,
    ...($full ? { [FULL_WINDOW_MEDIA]: { maxWidth: 'none' } } : null),
    margin: '0 auto',
    padding: theme.spacing(2),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2.5),
    ...($flow ? flowColumns($flow) : null),
    [theme.breakpoints.down('sm')]: {
      padding: theme.spacing(1.5),
      gap: theme.spacing(2),
    },
  })
);

/**
 * How wide the pages whose cards carry long text and columns may grow on a
 * desktop or in Hub: Decisions, Nominations (and a decision's, a
 * nomination's or a poll's own page) and Activity.
 */
export const WIDE_PAGE = 960;

/** A form's width, in Full window too: a field across a 4K screen is no easier to fill in. */
const FORM_PAGE = 680;

type PageBodyProps = Omit<ComponentProps<typeof Column>, '$full'> & {
  /** A form (Propose, Ask the Minter Admins, Propose nomination): 680 px, whatever Page width says. */
  $form?: boolean;
};

/**
 * The content column under a PageHeader: centred, 760 px for lists, wider
 * when asked (WIDE_PAGE). With Page width set to Full window (Settings →
 * Appearance) it spans the window, forms and a phone held sideways aside
 * (FULL_WINDOW_MEDIA). `$flow`: its blocks side by
 * side when they fit (flowColumns), as Home's and Settings' sections are.
 * Its blocks fade in and rise 4 px as they arrive: the page as it opens, and
 * data as it replaces a skeleton (index.css → .qmp-reveal; its padding holds
 * the rise, so the page never grows a scrollbar for it).
 */
export function PageBody({ className, $form = false, $maxWidth, ...rest }: PageBodyProps) {
  const full = useAtomValue(pageWidthAtom) === 'full' && !$form;
  return (
    <Column
      className={className ? `qmp-reveal ${className}` : 'qmp-reveal'}
      $maxWidth={$form ? FORM_PAGE : $maxWidth}
      $full={full}
      {...rest}
    />
  );
}
