import { MAIL_SERVICE_TYPE } from "../../constants/mail";

/**
 * What the "Opening message" pane gets for a list row: the resource to fetch,
 * plus the row's date and title, so "Not available" can say which message
 * failed (the body never arrived, so the row is all there is).
 */
export const openerInfoFor = (
  identifier: string,
  name: string,
  to: string | undefined,
  row: any
) => ({
  identifier,
  name,
  service: MAIL_SERVICE_TYPE,
  to,
  createdAt: row?.createdAt,
  title: row?.title,
});
