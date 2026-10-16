/**
 * Overview's "Latest transactions": the newest few, with "All transactions". Built with the Transactions tab; renders nothing until then.
 */
export interface LatestTransactionsProps {
  address: string;
}

export function LatestTransactions({ address }: LatestTransactionsProps) {
  void address;
  return null;
}
