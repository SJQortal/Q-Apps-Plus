/**
 * Resolve the registered name of an address through Core's `/names/address`.
 * Returns `""` when the address has no name or the request fails. Callers that
 * look names up repeatedly should go through `src/utils/groupMembersCache.ts`,
 * which caches the answer per address for the session.
 */
export async function getNameInfo(address: string): Promise<string> {
    try {
        const response = await fetch('/names/address/' + encodeURIComponent(address))
        if (!response.ok) return ''
        const nameData = await response.json()

        if (Array.isArray(nameData) && nameData.length > 0 && typeof nameData[0]?.name === 'string') {
            return nameData[0].name
        }
        return ''
    } catch {
        return ''
    }
}
