import { beforeEach, describe, expect, it } from 'vitest'
import { mockQortalAction, qortalCalls } from '../../test/setup'
import { resetAttachmentCache } from '../../utils/attachmentCache'
import { downloadAllSequential } from './useDownloadAll'

const ref = (identifier: string) => ({
  name: 'alice',
  service: 'ATTACHMENT_PRIVATE',
  identifier,
  filename: `${identifier}.png`,
  originalFilename: `${identifier}.png`,
  type: 'image/png',
})

const noSleep = async () => {}

describe('downloadAllSequential', () => {
  beforeEach(() => {
    resetAttachmentCache()
    mockQortalAction('GET_QDN_RESOURCE_STATUS', { status: 'READY' })
    mockQortalAction('FETCH_QDN_RESOURCE', 'ENC')
    mockQortalAction('DECRYPT_DATA', btoa('bytes'))
  })

  it('saves each file in turn and counts them', async () => {
    mockQortalAction('SAVE_FILE', true)
    const result = await downloadAllSequential([ref('a'), ref('b')], { sleep: noSleep })
    expect(result).toMatchObject({ active: false, saved: 2, failed: [], total: 2 })
    expect(result.cancelled).toBeUndefined()
    expect(qortalCalls('SAVE_FILE').map((c) => c.filename)).toEqual(['a.png', 'b.png'])
  })

  it('stops quietly when the user declines one of the save prompts', async () => {
    let saves = 0
    mockQortalAction('SAVE_FILE', () => {
      saves += 1
      if (saves === 2) throw 'user declined to save file'
      return true
    })
    const result = await downloadAllSequential([ref('a'), ref('b'), ref('c')], { sleep: noSleep })
    expect(result).toMatchObject({ saved: 1, failed: [], cancelled: true, active: false })
    // The third file was never offered: a decline means stop.
    expect(qortalCalls('SAVE_FILE')).toHaveLength(2)
  })

  it('lists a file that really failed, without stopping', async () => {
    let saves = 0
    mockQortalAction('SAVE_FILE', () => {
      saves += 1
      if (saves === 1) throw { error: 'Missing filename', message: 'Missing filename' }
      return true
    })
    const result = await downloadAllSequential([ref('a'), ref('b')], { sleep: noSleep })
    expect(result).toMatchObject({ saved: 1, failed: ['a.png'] })
    expect(result.cancelled).toBeUndefined()
  })
})
