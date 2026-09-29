/**
 * What Hub and GO inject into a Q-App's window. `qortalRequest` is declared
 * with `const` in a classic script, so it is a global name but not a window
 * property; test with `typeof qortalRequest === 'function'`.
 */
export type QortalRequestParams = { action: string } & Record<string, unknown>;
export type QortalRequestFn = (params: QortalRequestParams) => Promise<unknown>;

declare global {
  var qortalRequest: QortalRequestFn | undefined;

  interface Window {
    _qdnTheme?: string;
    _qdnBase?: string;
    _qdnName?: string;
    _qdnService?: string;
    _qdnIdentifier?: string;
  }
}
