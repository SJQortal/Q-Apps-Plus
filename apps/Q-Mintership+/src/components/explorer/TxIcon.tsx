/**
 * A transaction's icon: one per family (rules/explorer/txFamilies.ts), so
 * a list reads at a glance as payments, names, minting, groups and so on.
 * Decorative: the sentence beside it says what the transaction did.
 */
import type { SvgIconComponent } from '@mui/icons-material';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined';
import ChatBubbleOutlineOutlinedIcon from '@mui/icons-material/ChatBubbleOutlineOutlined';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import SwapHorizOutlinedIcon from '@mui/icons-material/SwapHorizOutlined';
import { familyOf, type TxFamilyKey } from '../../rules/explorer/txFamilies';

const FAMILY_ICON: Record<Exclude<TxFamilyKey, 'all'>, SvgIconComponent> = {
  payments: PaymentsOutlinedIcon,
  names: BadgeOutlinedIcon,
  minting: BoltOutlinedIcon,
  groups: GroupsOutlinedIcon,
  qdn: CloudUploadOutlinedIcon,
  trading: SwapHorizOutlinedIcon,
  messages: ChatBubbleOutlineOutlinedIcon,
  other: ReceiptLongOutlinedIcon,
};

export function TxIcon({ type }: { type: string }) {
  const Icon = FAMILY_ICON[familyOf(type)];
  return (
    <Icon
      aria-hidden
      data-family={familyOf(type)}
      sx={{ color: 'text.secondary', fontSize: 22, flexShrink: 0 }}
    />
  );
}
