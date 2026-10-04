import { describe, expect, it } from 'vitest'
import { isForwardableAttachment } from './NewMessage'

const ref = (name: string, service: string, identifier = 'attachments_qmail_a_b') => ({ name, service, identifier })

describe('isForwardableAttachment', () => {
  it("forwards only the sender's own mail attachments", () => {
    expect(isForwardableAttachment(ref('Eve', 'ATTACHMENT_PRIVATE'), 'eve')).toBe(true)
    // A reference into the victim's private state document or other mail is refused.
    expect(isForwardableAttachment(ref('victim', 'DOCUMENT_PRIVATE', 'qmail_state_v1'), 'eve')).toBe(false)
    expect(isForwardableAttachment(ref('victim', 'MAIL_PRIVATE', '_mail_qortal_qmail_x'), 'eve')).toBe(false)
    expect(isForwardableAttachment(ref('victim', 'ATTACHMENT_PRIVATE'), 'eve')).toBe(false)
    expect(isForwardableAttachment(ref('eve', 'ATTACHMENT_PRIVATE'), undefined)).toBe(false)
  })
})
