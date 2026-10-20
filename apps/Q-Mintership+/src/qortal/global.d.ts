/**
 * Hub injects `qortalRequest` as a global. It is declared with `const` in a
 * classic script, so it is a global name but not always a property of
 * `window`; read it as a bare identifier guarded by `typeof` (see client.ts).
 */
declare function qortalRequest<T = unknown>(request: Record<string, unknown>): Promise<T>;
