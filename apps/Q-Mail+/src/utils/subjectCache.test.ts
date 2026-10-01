import { beforeEach, describe, expect, it } from 'vitest'
import { mockQortalAction, qortalCalls } from '../test/setup'
import { decryptSubject, peekDecryptedSubject, resetSubjectCache, subjectCacheStats } from './subjectCache'

const encode = (value: string) => btoa(JSON.stringify(value))

describe('subjectCache', () => {
  beforeEach(() => {
    resetSubjectCache()
  })

  it('decrypts each ciphertext once and serves repeats from memory', async () => {
    mockQortalAction('DECRYPT_DATA', (request: any) => encode(`subject of ${request.encryptedData}`))
    const [a, b, c] = await Promise.all([decryptSubject('enc-1'), decryptSubject('enc-1'), decryptSubject('enc-2')])
    expect(a).toBe('subject of enc-1')
    expect(b).toBe('subject of enc-1')
    expect(c).toBe('subject of enc-2')
    expect(await decryptSubject('enc-1')).toBe('subject of enc-1')
    expect(qortalCalls('DECRYPT_DATA')).toHaveLength(2)
    expect(peekDecryptedSubject('enc-2')).toBe('subject of enc-2')
    expect(subjectCacheStats().hits).toBe(1)
  })

  it('never returns the ciphertext when the decrypt fails (Bugs #18)', async () => {
    mockQortalAction('DECRYPT_DATA', () => {
      throw new Error('cannot decrypt')
    })
    expect(await decryptSubject('gibberish==')).toBe('')
    expect(peekDecryptedSubject('gibberish==')).toBe('')
    // Remembered: no second attempt.
    expect(await decryptSubject('gibberish==')).toBe('')
    expect(qortalCalls('DECRYPT_DATA')).toHaveLength(1)
  })

  it('runs decrypts one at a time', async () => {
    let active = 0
    let peak = 0
    mockQortalAction('DECRYPT_DATA', async (request: any) => {
      active += 1
      peak = Math.max(peak, active)
      await new Promise((resolve) => setTimeout(resolve, 2))
      active -= 1
      return encode(String(request.encryptedData))
    })
    await Promise.all(['a', 'b', 'c', 'd'].map((id) => decryptSubject(id)))
    expect(peak).toBe(1)
    expect(qortalCalls('DECRYPT_DATA')).toHaveLength(4)
  })
})
