/**
 * The read store's key for the Minter Admin polls a viewer read
 * (data/adminPolls.ts loadAdminPolls), apart so Home can check whether they
 * were read this session without loading any of the polls' code.
 */
export function adminPollsKey(viewer: string): string {
  return `adminpolls:list:${viewer}`;
}
