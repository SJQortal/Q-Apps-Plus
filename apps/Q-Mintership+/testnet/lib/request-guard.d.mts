/* Types for testnet/lib/request-guard.mjs, for its TypeScript test. */
export interface GuardedRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
}
export function isGuardedPath(pathname: string): boolean;
export function signerRequestRefusal(req: GuardedRequest, pathname: string): string | null;
