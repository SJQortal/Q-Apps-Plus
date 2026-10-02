import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('pdfjs-dist/build/pdf.worker.mjs', () => ({
  WorkerMessageHandler: { id: 'fake-handler' },
}))

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerPort: null },
  OPS: { save: 1 },
  getDocument: vi.fn(),
}))

import { copyPdfBytes, loadPdfJs, resetPdfjsMainThreadHandlerCache } from './pdfJsHub'

describe('pdfJsHub', () => {
  beforeEach(() => {
    resetPdfjsMainThreadHandlerCache()
    delete (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker
  })

  it('copies PDF bytes so the source buffer is not detached', () => {
    const source = new Uint8Array([1, 2, 3]).buffer
    const copy = copyPdfBytes(source)
    expect(copy).toEqual(new Uint8Array([1, 2, 3]))
    expect(copy.buffer).not.toBe(source)
  })

  it('installs the main-thread WorkerMessageHandler so Hub never loads a worker file', async () => {
    const lib = await loadPdfJs()
    expect((globalThis as { pdfjsWorker?: { WorkerMessageHandler?: { id: string } } }).pdfjsWorker?.WorkerMessageHandler).toEqual({
      id: 'fake-handler',
    })
    expect(lib.GlobalWorkerOptions.workerPort).toBeNull()
    expect(lib.OPS).toEqual({ save: 1 })
  })
})
