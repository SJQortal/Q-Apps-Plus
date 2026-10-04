import { beforeEach, describe, expect, it } from 'vitest'
import { mockQortalAction, qortalCalls } from '../../test/setup'
import {
  PDF_OPEN_MAX_BYTES,
  hasPdfHeader,
  hubPdfReaderMissing,
  openPdfInHub,
  pdfReaderRequest,
  resetHubPdfReader,
} from './hubPdfReader'

const bytes = (text: string) => new TextEncoder().encode(text)

describe('hubPdfReader', () => {
  beforeEach(() => {
    resetHubPdfReader()
  })

  it('finds the %PDF- header anywhere in the first 1 KB, and only there', () => {
    expect(hasPdfHeader(bytes('%PDF-1.7\n'))).toBe(true)
    expect(hasPdfHeader(bytes(`${' '.repeat(500)}%PDF-1.4`))).toBe(true)
    expect(hasPdfHeader(bytes(`${' '.repeat(1100)}%PDF-1.4`))).toBe(false)
    expect(hasPdfHeader(bytes('<html>'))).toBe(false)
  })

  it('builds the request Hub expects: only a blob, typed application/pdf, with the same bytes', async () => {
    const source = new Blob(['%PDF-1.4 hello'], { type: 'application/octet-stream' })
    const request = pdfReaderRequest(source)
    expect(Object.keys(request).sort()).toEqual(['action', 'blob'])
    expect(request.action).toBe('SHOW_PDF_READER')
    expect(request.blob.type).toBe('application/pdf')
    expect(await request.blob.text()).toBe('%PDF-1.4 hello')
  })

  it('hands the decrypted bytes to Hub and reports opened', async () => {
    mockQortalAction('SHOW_PDF_READER', true)
    const result = await openPdfInHub(new Blob(['%PDF-1.7 mail'], { type: 'application/pdf' }))
    expect(result).toBe('opened')
    const calls = qortalCalls('SHOW_PDF_READER')
    expect(calls).toHaveLength(1)
    expect((calls[0].blob as Blob).type).toBe('application/pdf')
    expect(await (calls[0].blob as Blob).text()).toBe('%PDF-1.7 mail')
    // Nothing else goes to Hub: no publish, no save, no upload.
    expect(qortalCalls()).toHaveLength(1)
  })

  it('refuses bytes that are not a PDF without asking Hub', async () => {
    mockQortalAction('SHOW_PDF_READER', true)
    expect(await openPdfInHub(new Blob(['<html><script>x</script>']))).toBe('not-pdf')
    expect(qortalCalls('SHOW_PDF_READER')).toHaveLength(0)
  })

  it('refuses PDFs over the cap', async () => {
    const big = { size: PDF_OPEN_MAX_BYTES + 1 } as Blob
    expect(await openPdfInHub(big)).toBe('too-large')
    expect(qortalCalls()).toHaveLength(0)
  })

  it('reports unavailable when Hub has no reader, and skips Hub for the rest of the session', async () => {
    mockQortalAction('SHOW_PDF_READER', () => {
      throw new Error('Unknown action')
    })
    const pdf = new Blob(['%PDF-1.4 x'])
    expect(await openPdfInHub(pdf)).toBe('unavailable')
    expect(hubPdfReaderMissing()).toBe(true)
    expect(await openPdfInHub(pdf)).toBe('unavailable')
    expect(qortalCalls('SHOW_PDF_READER')).toHaveLength(1)
  })
})
