/**
 * Qortal's Dev Admins: the admins of the dev group (group 1, "dev-group"),
 * the developers' accounts (crowetic-dev among them), marked as such across
 * the Explorer (Simon, 2026-10-16). One read of its admins
 * (`/groups/members/1?onlyAdmins=true`, 100 a page, at most 2 pages),
 * without the group's null owner, which is no one's account. Key
 * `xdevadmins`, cached 30 minutes.
 */
import { NULL_OWNER } from '../constants';
import { getPaged, query } from '../core';
import { fetchQuery } from '../query';
import type { GroupMemberRow, GroupMembersPage } from '../types';

export const DEV_GROUP_ID = 1;

export function getDevAdmins(options: { force?: boolean } = {}): Promise<string[]> {
  return fetchQuery(
    'xdevadmins',
    async () => {
      const { rows } = await getPaged<GroupMemberRow>(
        (offset, limit) =>
          `/groups/members/${DEV_GROUP_ID}?${query({ onlyAdmins: true, limit, offset })}`,
        {
          maxPages: 2,
          pick: (body) => {
            const page = body as GroupMembersPage;
            return Array.isArray(page?.members) ? page.members : [];
          },
        }
      );
      return rows.map((row) => row.member).filter((member) => member !== NULL_OWNER);
    },
    { ttlMs: 30 * 60_000, force: options.force }
  );
}
